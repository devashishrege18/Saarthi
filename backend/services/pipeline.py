"""
SAARTHI — Pipeline Orchestrator
Coordinates the full invoice processing pipeline:
  Ingest → OCR/Extract Text → AI Extract Fields → Validate → Score → Decide

This is a deterministic state machine. No AI in the orchestration logic.
"""

import json
import time
import structlog
import aiosqlite

from models import new_id, now_iso, InvoiceStatus
from services.ingestion import DocumentIngestionService
from services.ocr import OCRService
from services.extraction import AIExtractionService

log = structlog.get_logger()


class PipelineOrchestrator:
    """Orchestrates the invoice processing pipeline."""

    def __init__(self):
        self.ingestion = DocumentIngestionService()
        self.ocr = OCRService()
        self.extraction = AIExtractionService()

    async def process_invoice(self, invoice_id: str, db: aiosqlite.Connection) -> dict:
        """
        Run the full processing pipeline for an invoice.
        Returns the updated invoice data.
        """
        pipeline_start = time.time()

        # ─── Step 1: Load invoice record ──────────────────────────────────
        rows = await db.execute_fetchall(
            "SELECT * FROM invoices WHERE id = ?", (invoice_id,)
        )
        if not rows:
            raise ValueError(f"Invoice not found: {invoice_id}")

        invoice = dict(rows[0])
        file_path = invoice["file_path"]
        file_ext = invoice["file_type"]
        timestamp = now_iso()

        log.info("pipeline.start", invoice_id=invoice_id, file=invoice["file_name"])

        # Update status to EXTRACTING
        await self._update_status(db, invoice_id, InvoiceStatus.EXTRACTING.value)
        await self._log_audit(db, invoice_id, "EXTRACTION_STARTED", "system", "Starting document intelligence pipeline")

        # ─── Step 2: Extract raw text ─────────────────────────────────────
        doc_type = self.ingestion.detect_document_type(file_path, file_ext)
        raw_text = ""
        ocr_confidence = 1.0

        log.info("pipeline.doc_type", invoice_id=invoice_id, doc_type=doc_type)

        if doc_type == "digital_pdf":
            raw_text = self.ingestion.extract_text_from_pdf(file_path)
            ocr_confidence = 0.95  # High confidence for digital PDFs

        elif doc_type == "scanned_pdf":
            # Convert to images, then OCR
            image_paths = self.ingestion.get_page_images(file_path)
            if image_paths:
                raw_text, ocr_confidence = self.ocr.extract_text_from_images(image_paths)
                self.ocr.cleanup_temp_images(image_paths)

        elif doc_type == "image":
            raw_text, ocr_confidence = self.ocr.extract_text_from_image(file_path)

        elif doc_type == "spreadsheet":
            raw_text = self.ingestion.extract_text_from_spreadsheet(file_path, file_ext)
            ocr_confidence = 0.98  # Very high confidence for structured data

        # Fallback: try reading as plain text if nothing extracted
        if not raw_text or len(raw_text.strip()) < 10:
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    fallback_text = f.read()
                if fallback_text and len(fallback_text.strip()) >= 10:
                    raw_text = fallback_text
                    ocr_confidence = 0.90
                    log.info("pipeline.fallback_text", invoice_id=invoice_id, chars=len(raw_text))
            except Exception:
                pass

        if not raw_text or len(raw_text.strip()) < 10:
            log.warning("pipeline.no_text", invoice_id=invoice_id)
            await self._update_status(db, invoice_id, InvoiceStatus.NEEDS_REVIEW.value)
            await self._log_audit(
                db, invoice_id, "EXTRACTION_FAILED", "system",
                "Could not extract text from document",
                {"doc_type": doc_type, "text_length": len(raw_text)}
            )
            return {"status": "NEEDS_REVIEW", "reason": "No text could be extracted"}

        log.info("pipeline.text_extracted", invoice_id=invoice_id, chars=len(raw_text), ocr_confidence=round(ocr_confidence, 3))

        # Check if Gmail or Local PC is connected and if this is a timesheet/data sheet
        from services.settings_store import load_settings
        settings = load_settings()
        
        is_timesheet = False
        content_lower = (raw_text + " " + invoice["file_name"]).lower()
        timesheet_keywords = ["timesheet", "time sheet", "timecard", "time card", "hours worked", "activity log", "payroll", "weekly report", "data input", "data sheet"]
        if any(kw in content_lower for kw in timesheet_keywords):
            if settings.get("gmail_connected") or settings.get("local_pc_connected"):
                is_timesheet = True
                log.info("pipeline.selective_parsing", invoice_id=invoice_id, reason="Gmail/Local PC connected, doing selective timesheet parsing")

        # ─── Step 3: AI Field Extraction ──────────────────────────────────
        extraction_result = await self.extraction.extract_fields(raw_text, is_selective_timesheet=is_timesheet)

        fields = extraction_result.get("extracted_fields", {})
        confidence_map = extraction_result.get("confidence_map", {})
        line_items = extraction_result.get("line_items", [])

        # Store extraction results
        extraction_id = new_id()
        await db.execute(
            """
            INSERT INTO extracted_data (id, invoice_id, raw_text, extracted_fields, confidence_map, 
                                        llm_model, prompt_tokens, completion_tokens, extraction_time_ms, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                extraction_id, invoice_id, raw_text,
                json.dumps(fields), json.dumps(confidence_map),
                extraction_result.get("llm_model", "unknown"),
                extraction_result.get("prompt_tokens", 0),
                extraction_result.get("completion_tokens", 0),
                extraction_result.get("extraction_time_ms", 0),
                now_iso(),
            ),
        )

        # Store line items
        for item in line_items:
            await db.execute(
                """
                INSERT INTO line_items (id, invoice_id, description, quantity, unit_price, amount, confidence, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_id(), invoice_id,
                    item.get("description", ""),
                    item.get("quantity", 0),
                    item.get("unit_price", 0),
                    item.get("amount", 0),
                    item.get("confidence", 0),
                    now_iso(),
                ),
            )

        # Update invoice with extracted fields
        await db.execute(
            """
            UPDATE invoices SET
                vendor_name = ?, invoice_number = ?, invoice_date = ?,
                due_date = ?, subtotal = ?, tax_amount = ?,
                total_amount = ?, currency = ?, po_number = ?,
                payment_terms = ?, status = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                fields.get("vendor_name"),
                fields.get("invoice_number"),
                fields.get("invoice_date"),
                fields.get("due_date"),
                fields.get("subtotal"),
                fields.get("tax_amount"),
                fields.get("total_amount"),
                fields.get("currency", "INR"),
                fields.get("po_number"),
                fields.get("payment_terms"),
                InvoiceStatus.EXTRACTED.value,
                now_iso(),
                invoice_id,
            ),
        )

        await self._log_audit(
            db, invoice_id, "EXTRACTION_COMPLETED", "ai:extraction",
            f"Extracted {len(fields)} fields, {len(line_items)} line items",
            {
                "doc_type": doc_type,
                "ocr_confidence": round(ocr_confidence, 3),
                "fields_extracted": len([v for v in fields.values() if v is not None]),
                "line_items_count": len(line_items),
                "model": extraction_result.get("llm_model", "unknown"),
                "extraction_time_ms": extraction_result.get("extraction_time_ms", 0),
            }
        )

        await db.commit()

        elapsed_ms = int((time.time() - pipeline_start) * 1000)
        log.info("pipeline.extraction.complete", invoice_id=invoice_id, elapsed_ms=elapsed_ms)

        return {
            "status": "EXTRACTED",
            "fields": fields,
            "confidence_map": confidence_map,
            "line_items": line_items,
            "doc_type": doc_type,
            "ocr_confidence": ocr_confidence,
            "extraction_time_ms": extraction_result.get("extraction_time_ms", 0),
        }

    # ─── Helpers ──────────────────────────────────────────────────────────────

    async def _update_status(self, db: aiosqlite.Connection, invoice_id: str, status: str):
        """Update invoice status."""
        await db.execute(
            "UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?",
            (status, now_iso(), invoice_id),
        )
        await db.commit()

    async def _log_audit(
        self, db: aiosqlite.Connection, invoice_id: str,
        event_type: str, actor: str, action: str, details: dict | None = None
    ):
        """Log an audit event."""
        await db.execute(
            """
            INSERT INTO audit_events (id, invoice_id, event_type, actor, action, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (new_id(), invoice_id, event_type, actor, action, json.dumps(details or {}), now_iso()),
        )
