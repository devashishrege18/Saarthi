"""
Invoice API Endpoints
Handles upload, listing, and detail retrieval.
"""

import json
import os
import shutil
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Query
import aiosqlite

from config import UPLOAD_DIR, ALLOWED_EXTENSIONS, MAX_FILE_SIZE_MB
from database import get_db
from models import (
    InvoiceResponse,
    InvoiceListResponse,
    InvoiceStatus,
    LineItem,
    ExtractionResponse,
    ValidationResultResponse,
    DecisionDNAResponse,
    ReviewResponse,
    AuditEventResponse,
    new_id,
    now_iso,
)

router = APIRouter(prefix="/invoices", tags=["invoices"])


def _parse_json_field(value: str | None, default=None):
    """Safely parse a JSON string field."""
    if not value:
        return default if default is not None else {}
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return default if default is not None else {}


def _row_to_invoice(row: aiosqlite.Row) -> InvoiceResponse:
    """Convert a database row to an InvoiceResponse."""
    return InvoiceResponse(
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
    )


@router.post("", response_model=InvoiceResponse, status_code=201)
async def upload_invoice(
    file: UploadFile = File(...),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Upload an invoice document for processing."""

    # Validate file extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Validate file size
    if file_size > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE_MB}MB",
        )

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    # Generate IDs and paths
    invoice_id = new_id()
    timestamp = now_iso()
    safe_name = f"{invoice_id}{ext}"
    file_path = UPLOAD_DIR / safe_name

    # Persist file
    with open(file_path, "wb") as f:
        f.write(content)

    # Create database record
    await db.execute(
        """
        INSERT INTO invoices (id, file_name, file_path, file_type, file_size, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (invoice_id, file.filename, str(file_path), ext, file_size, InvoiceStatus.RECEIVED.value, timestamp, timestamp),
    )

    # Log audit event
    await db.execute(
        """
        INSERT INTO audit_events (id, invoice_id, event_type, actor, action, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (new_id(), invoice_id, "INVOICE_RECEIVED", "system", f"Invoice uploaded: {file.filename}", "{}", timestamp),
    )

    await db.commit()

    return InvoiceResponse(
        id=invoice_id,
        file_name=file.filename or "unknown",
        file_type=ext,
        file_size=file_size,
        status=InvoiceStatus.RECEIVED,
        created_at=timestamp,
        updated_at=timestamp,
    )


@router.get("", response_model=InvoiceListResponse)
async def list_invoices(
    status: str | None = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: aiosqlite.Connection = Depends(get_db),
):
    """List all invoices with optional filtering."""

    offset = (page - 1) * page_size

    if status:
        count_row = await db.execute_fetchall(
            "SELECT COUNT(*) as cnt FROM invoices WHERE status = ?", (status,)
        )
        rows = await db.execute_fetchall(
            "SELECT * FROM invoices WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (status, page_size, offset),
        )
    else:
        count_row = await db.execute_fetchall("SELECT COUNT(*) as cnt FROM invoices")
        rows = await db.execute_fetchall(
            "SELECT * FROM invoices ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (page_size, offset),
        )

    total = count_row[0]["cnt"] if count_row else 0
    invoices = [_row_to_invoice(row) for row in rows]

    return InvoiceListResponse(
        invoices=invoices,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get full invoice details including extraction, validation, decision DNA, and audit trail."""

    # Fetch invoice
    rows = await db.execute_fetchall("SELECT * FROM invoices WHERE id = ?", (invoice_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice = _row_to_invoice(rows[0])

    # Fetch line items
    li_rows = await db.execute_fetchall(
        "SELECT * FROM line_items WHERE invoice_id = ? ORDER BY rowid", (invoice_id,)
    )
    invoice.line_items = [
        LineItem(
            description=r["description"] or "",
            quantity=r["quantity"] or 0,
            unit_price=r["unit_price"] or 0,
            amount=r["amount"] or 0,
            confidence=r["confidence"] or 0,
        )
        for r in li_rows
    ]

    # Fetch extraction
    ext_rows = await db.execute_fetchall(
        "SELECT * FROM extracted_data WHERE invoice_id = ? ORDER BY created_at DESC LIMIT 1", (invoice_id,)
    )
    if ext_rows:
        r = ext_rows[0]
        invoice.extraction = ExtractionResponse(
            id=r["id"],
            invoice_id=r["invoice_id"],
            extracted_fields=_parse_json_field(r["extracted_fields"]),
            confidence_map=_parse_json_field(r["confidence_map"]),
            llm_model=r["llm_model"],
            prompt_tokens=r["prompt_tokens"] or 0,
            completion_tokens=r["completion_tokens"] or 0,
            extraction_time_ms=r["extraction_time_ms"] or 0,
            created_at=r["created_at"],
        )

    # Fetch validation results
    val_rows = await db.execute_fetchall(
        "SELECT * FROM validation_results WHERE invoice_id = ? ORDER BY created_at", (invoice_id,)
    )
    invoice.validation_results = [
        ValidationResultResponse(
            id=r["id"], invoice_id=r["invoice_id"], rule_name=r["rule_name"],
            status=r["status"], severity=r["severity"], evidence=r["evidence"],
            created_at=r["created_at"],
        )
        for r in val_rows
    ]

    # Fetch decision DNA
    dec_rows = await db.execute_fetchall(
        "SELECT * FROM decisions WHERE invoice_id = ?", (invoice_id,)
    )
    if dec_rows:
        r = dec_rows[0]
        invoice.decision_dna = DecisionDNAResponse(
            id=r["id"],
            invoice_id=r["invoice_id"],
            trust_score=r["trust_score"],
            confidence_level=r["confidence_level"],
            decision=r["decision"],
            evidence=_parse_json_field(r["evidence"], []),
            flags=_parse_json_field(r["flags"], []),
            reason=r["reason"],
            suggested_action=r["suggested_action"],
            created_at=r["created_at"],
        )

    # Fetch reviews
    rev_rows = await db.execute_fetchall(
        "SELECT * FROM reviews WHERE invoice_id = ? ORDER BY created_at", (invoice_id,)
    )
    invoice.reviews = [
        ReviewResponse(
            id=r["id"], invoice_id=r["invoice_id"], action=r["action"],
            reason=r["reason"], notes=r["notes"], reviewer=r["reviewer"],
            created_at=r["created_at"],
        )
        for r in rev_rows
    ]

    # Fetch audit trail
    audit_rows = await db.execute_fetchall(
        "SELECT * FROM audit_events WHERE invoice_id = ? ORDER BY created_at", (invoice_id,)
    )
    invoice.audit_trail = [
        AuditEventResponse(
            id=r["id"], invoice_id=r["invoice_id"], event_type=r["event_type"],
            actor=r["actor"], action=r["action"],
            details=_parse_json_field(r["details"]),
            created_at=r["created_at"],
        )
        for r in audit_rows
    ]

    return invoice


@router.post("/{invoice_id}/process")
async def process_invoice(
    invoice_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Trigger the full processing pipeline for an invoice."""
    from services.pipeline import PipelineOrchestrator

    # Verify invoice exists
    rows = await db.execute_fetchall("SELECT * FROM invoices WHERE id = ?", (invoice_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice = rows[0]
    if invoice["status"] not in (InvoiceStatus.RECEIVED.value, InvoiceStatus.EXTRACTED.value):
        # Allow reprocessing from RECEIVED or EXTRACTED states
        if invoice["status"] not in (InvoiceStatus.NEEDS_REVIEW.value,):
            raise HTTPException(
                status_code=400,
                detail=f"Invoice cannot be processed in current state: {invoice['status']}",
            )

    orchestrator = PipelineOrchestrator()

    try:
        # Run extraction pipeline
        extraction_result = await orchestrator.process_invoice(invoice_id, db)

        # Run validation + decision pipeline if extraction succeeded
        if extraction_result.get("status") == "EXTRACTED":
            from services.validation import ValidationEngine
            from services.decision import DecisionEngine

            validator = ValidationEngine()
            validation_results = await validator.validate(invoice_id, db)

            decider = DecisionEngine()
            decision_result = await decider.decide(
                invoice_id, db,
                extraction_result.get("confidence_map", {}),
                extraction_result.get("ocr_confidence", 0.0),
                validation_results,
            )

        # Return full invoice detail
        updated_rows = await db.execute_fetchall("SELECT * FROM invoices WHERE id = ?", (invoice_id,))
        if updated_rows:
            return _row_to_invoice(updated_rows[0])

        raise HTTPException(status_code=500, detail="Failed to retrieve processed invoice")

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
