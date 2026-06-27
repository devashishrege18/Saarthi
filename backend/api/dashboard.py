"""
Dashboard API Endpoints
Provides aggregated metrics for the dashboard.
"""

from fastapi import APIRouter, Depends
import aiosqlite

from database import get_db
from models import DashboardMetrics, InvoiceResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/metrics", response_model=DashboardMetrics)
async def get_dashboard_metrics(
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get aggregated dashboard metrics."""

    # Total invoices
    total_row = await db.execute_fetchall("SELECT COUNT(*) as cnt FROM invoices")
    total = total_row[0]["cnt"] if total_row else 0

    # Status counts
    status_rows = await db.execute_fetchall(
        "SELECT status, COUNT(*) as cnt FROM invoices GROUP BY status"
    )
    status_counts = {row["status"]: row["cnt"] for row in status_rows}

    auto_approved = status_counts.get("AUTO_APPROVED", 0)
    needs_review = status_counts.get("NEEDS_REVIEW", 0)
    auto_rejected = status_counts.get("AUTO_REJECTED", 0)
    human_approved = status_counts.get("HUMAN_APPROVED", 0)
    human_rejected = status_counts.get("HUMAN_REJECTED", 0)

    # Average trust score
    avg_row = await db.execute_fetchall(
        "SELECT AVG(trust_score) as avg_score FROM invoices WHERE trust_score IS NOT NULL"
    )
    avg_trust = round(avg_row[0]["avg_score"] or 0, 3)

    # Auto-approve rate
    decided = auto_approved + auto_rejected + human_approved + human_rejected
    auto_approve_rate = round((auto_approved / decided * 100) if decided > 0 else 0, 1)

    # Average processing time
    time_row = await db.execute_fetchall(
        "SELECT AVG(extraction_time_ms) as avg_time FROM extracted_data"
    )
    avg_time = int(time_row[0]["avg_time"] or 0)

    # Recent invoices (last 10)
    recent_rows = await db.execute_fetchall(
        "SELECT * FROM invoices ORDER BY created_at DESC LIMIT 10"
    )
    recent = [
        InvoiceResponse(
            id=r["id"], file_name=r["file_name"], file_type=r["file_type"],
            file_size=r["file_size"], status=r["status"],
            vendor_name=r["vendor_name"], invoice_number=r["invoice_number"],
            invoice_date=r["invoice_date"], due_date=r["due_date"],
            subtotal=r["subtotal"], tax_amount=r["tax_amount"],
            total_amount=r["total_amount"], currency=r["currency"],
            po_number=r["po_number"], payment_terms=r["payment_terms"],
            trust_score=r["trust_score"], confidence_level=r["confidence_level"],
            decision=r["decision"], created_at=r["created_at"], updated_at=r["updated_at"],
        )
        for r in recent_rows
    ]

    return DashboardMetrics(
        total_invoices=total,
        auto_approved=auto_approved,
        needs_review=needs_review,
        auto_rejected=auto_rejected,
        human_approved=human_approved,
        human_rejected=human_rejected,
        avg_trust_score=avg_trust,
        auto_approve_rate=auto_approve_rate,
        avg_processing_time_ms=avg_time,
        recent_invoices=recent,
    )
