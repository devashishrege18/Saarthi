"""
Human Review API Endpoints
Handles review queue listing and review actions.
"""

import json
from fastapi import APIRouter, Depends, HTTPException
import aiosqlite

from database import get_db
from models import (
    InvoiceResponse,
    ReviewRequest,
    ReviewResponse,
    AuditEventResponse,
    InvoiceStatus,
    new_id,
    now_iso,
)

router = APIRouter(prefix="/review", tags=["review"])


@router.get("/queue", response_model=list[InvoiceResponse])
async def get_review_queue(
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get invoices that need human review, sorted by priority."""

    rows = await db.execute_fetchall(
        """
        SELECT * FROM invoices 
        WHERE status = ? 
        ORDER BY 
            CASE WHEN trust_score IS NOT NULL THEN trust_score ELSE 0.5 END ASC,
            created_at ASC
        """,
        (InvoiceStatus.NEEDS_REVIEW.value,),
    )

    invoices = []
    for row in rows:
        invoices.append(InvoiceResponse(
            id=row["id"],
            file_name=row["file_name"],
            file_type=row["file_type"],
            file_size=row["file_size"],
            status=row["status"],
            vendor_name=row["vendor_name"],
            invoice_number=row["invoice_number"],
            invoice_date=row["invoice_date"],
            due_date=row["due_date"],
            subtotal=row["subtotal"],
            tax_amount=row["tax_amount"],
            total_amount=row["total_amount"],
            currency=row["currency"],
            po_number=row["po_number"],
            payment_terms=row["payment_terms"],
            trust_score=row["trust_score"],
            confidence_level=row["confidence_level"],
            decision=row["decision"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        ))

    return invoices


@router.post("/{invoice_id}/decision", response_model=ReviewResponse)
async def submit_review(
    invoice_id: str,
    review: ReviewRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Submit a human review decision for an invoice."""

    # Verify invoice exists and is in review state
    rows = await db.execute_fetchall(
        "SELECT * FROM invoices WHERE id = ?", (invoice_id,)
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice = rows[0]
    if invoice["status"] != InvoiceStatus.NEEDS_REVIEW.value:
        raise HTTPException(
            status_code=400,
            detail=f"Invoice is not in review state. Current status: {invoice['status']}",
        )

    # Require reason for rejection
    if review.action.value == "REJECT" and not review.reason:
        raise HTTPException(status_code=400, detail="Reason is required when rejecting an invoice")

    # Map review action to invoice status
    status_map = {
        "APPROVE": InvoiceStatus.HUMAN_APPROVED.value,
        "REJECT": InvoiceStatus.HUMAN_REJECTED.value,
        "REVIEW": InvoiceStatus.NEEDS_REVIEW.value,
    }
    new_status = status_map[review.action.value]
    timestamp = now_iso()
    review_id = new_id()

    # Update invoice status
    await db.execute(
        "UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?",
        (new_status, timestamp, invoice_id),
    )

    # Create review record
    await db.execute(
        """
        INSERT INTO reviews (id, invoice_id, action, reason, notes, reviewer, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (review_id, invoice_id, review.action.value, review.reason, review.notes, "analyst", timestamp),
    )

    # Log audit event
    await db.execute(
        """
        INSERT INTO audit_events (id, invoice_id, event_type, actor, action, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id(), invoice_id, "HUMAN_REVIEW_COMPLETED", "user:analyst",
            f"Reviewer action: {review.action.value}",
            json.dumps({"action": review.action.value, "reason": review.reason, "notes": review.notes}),
            timestamp,
        ),
    )

    await db.commit()

    return ReviewResponse(
        id=review_id,
        invoice_id=invoice_id,
        action=review.action.value,
        reason=review.reason,
        notes=review.notes,
        reviewer="analyst",
        created_at=timestamp,
    )
