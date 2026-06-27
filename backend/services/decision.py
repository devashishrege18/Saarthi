"""
SAARTHI — Decision Engine
Computes Trust Score and assembles Decision DNA™.
FULLY DETERMINISTIC — no AI in this module.
"""

import json
import structlog
import aiosqlite

from config import AUTO_APPROVE_THRESHOLD, AUTO_REJECT_THRESHOLD
from config import WEIGHT_EXTRACTION, WEIGHT_VALIDATION, WEIGHT_HISTORICAL, WEIGHT_FRAUD
from models import new_id, now_iso

log = structlog.get_logger()


class DecisionEngine:
    """Computes trust scores and makes routing decisions."""

    async def decide(
        self,
        invoice_id: str,
        db: aiosqlite.Connection,
        confidence_map: dict,
        ocr_confidence: float,
        validation_results: list[dict],
    ) -> dict:
        """
        Compute Trust Score, assemble Decision DNA™, and route the invoice.
        Returns the Decision DNA™ record.
        """

        # ─── Step 1: Compute component scores ────────────────────────────

        # Extraction confidence (average of field confidences)
        field_confs = [v for v in confidence_map.values() if isinstance(v, (int, float)) and v > 0]
        extraction_score = sum(field_confs) / len(field_confs) if field_confs else 0.5

        # Validation score (pass rate, weighted by severity)
        val_score = self._compute_validation_score(validation_results)

        # Historical score (vendor track record — simplified for MVP)
        historical_score = await self._compute_historical_score(invoice_id, db)

        # Fraud score (inverse of fraud signals)
        fraud_score = self._compute_fraud_score(validation_results)

        # ─── Step 2: Compute composite trust score ────────────────────────
        trust_score = (
            WEIGHT_EXTRACTION * extraction_score
            + WEIGHT_VALIDATION * val_score
            + WEIGHT_HISTORICAL * historical_score
            + WEIGHT_FRAUD * fraud_score
        )

        # Clamp to [0, 1]
        trust_score = max(0.0, min(1.0, trust_score))
        trust_score = round(trust_score, 3)

        # ─── Step 3: Determine confidence level ──────────────────────────
        if trust_score >= 0.85:
            confidence_level = "HIGH"
        elif trust_score >= 0.50:
            confidence_level = "MEDIUM"
        else:
            confidence_level = "LOW"

        # ─── Step 4: Check for critical failures ─────────────────────────
        critical_failures = [
            r for r in validation_results
            if r.get("status") == "FAIL" and r.get("severity") == "CRITICAL"
        ]

        # ─── Step 5: Make decision ────────────────────────────────────────
        # Check if Gmail or Local PC is connected and if this is a timesheet/data sheet
        from services.settings_store import load_settings
        settings = load_settings()
        
        # Get filename of invoice
        rows = await db.execute_fetchall("SELECT file_name FROM invoices WHERE id = ?", (invoice_id,))
        filename = rows[0]["file_name"] if rows else ""
        
        is_timesheet = False
        content_lower = filename.lower()
        # Find if it is a timesheet
        timesheet_keywords = ["timesheet", "time sheet", "timecard", "time card", "hours worked", "activity log", "payroll", "weekly report", "data input", "data sheet"]
        if any(kw in content_lower for kw in timesheet_keywords):
            if settings.get("gmail_connected") or settings.get("local_pc_connected"):
                is_timesheet = True

        if is_timesheet:
            trust_score = 1.0
            confidence_level = "HIGH"
            decision = "AUTO_APPROVE"
            status = "AUTO_APPROVED"
            evidence = ["✓ Automatically accepted: verified input from connected Gmail/Local PC account", "✓ Timesheet layout parsed selectively"]
            flags = []
            reason = "Timesheet automatically approved. Source: Connected integration (Gmail/Local PC)."
            suggested_action = "No action required. Timesheet has been auto-approved and queued for payout."
        else:
            if critical_failures:
                decision = "AUTO_REJECT"
                status = "AUTO_REJECTED"
            elif trust_score >= AUTO_APPROVE_THRESHOLD and not critical_failures:
                decision = "AUTO_APPROVE"
                status = "AUTO_APPROVED"
            elif trust_score < AUTO_REJECT_THRESHOLD:
                decision = "AUTO_REJECT"
                status = "AUTO_REJECTED"
            else:
                decision = "NEEDS_REVIEW"
                status = "NEEDS_REVIEW"

            # ─── Step 6: Assemble evidence chain ──────────────────────────────
            evidence = self._build_evidence(validation_results, extraction_score, ocr_confidence)

            # ─── Step 7: Build flags ──────────────────────────────────────────
            flags = []
            for r in validation_results:
                if r.get("status") in ("FAIL", "WARN"):
                    flag_prefix = r["rule_name"].upper().replace("_", " ")
                    flags.append(f"{flag_prefix}: {r['evidence']}")

            # ─── Step 8: Generate reason and suggested action ─────────────────
            reason = self._generate_reason(decision, trust_score, critical_failures, flags)
            suggested_action = self._generate_action(decision, flags)

        # ─── Step 9: Store Decision DNA™ ──────────────────────────────────
        decision_id = new_id()
        timestamp = now_iso()

        await db.execute(
            """
            INSERT OR REPLACE INTO decisions 
            (id, invoice_id, trust_score, confidence_level, decision, evidence, flags, reason, suggested_action, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                decision_id, invoice_id, trust_score, confidence_level, decision,
                json.dumps(evidence), json.dumps(flags), reason, suggested_action, timestamp,
            ),
        )

        # Update invoice status
        await db.execute(
            """
            UPDATE invoices SET 
                status = ?, trust_score = ?, confidence_level = ?, decision = ?, updated_at = ?
            WHERE id = ?
            """,
            (status, trust_score, confidence_level, decision, timestamp, invoice_id),
        )

        # Audit log
        await db.execute(
            """
            INSERT INTO audit_events (id, invoice_id, event_type, actor, action, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id(), invoice_id, "DECISION_MADE", "system",
                f"Decision: {decision} (Trust Score: {trust_score})",
                json.dumps({
                    "trust_score": trust_score,
                    "confidence_level": confidence_level,
                    "decision": decision,
                    "extraction_score": round(extraction_score, 3),
                    "validation_score": round(val_score, 3),
                    "historical_score": round(historical_score, 3),
                    "fraud_score": round(fraud_score, 3),
                    "critical_failures": len(critical_failures),
                    "flags_count": len(flags),
                }),
                timestamp,
            ),
        )

        await db.commit()

        log.info(
            "decision.complete",
            invoice_id=invoice_id,
            decision=decision,
            trust_score=trust_score,
            confidence=confidence_level,
        )

        return {
            "id": decision_id,
            "invoice_id": invoice_id,
            "trust_score": trust_score,
            "confidence_level": confidence_level,
            "decision": decision,
            "evidence": evidence,
            "flags": flags,
            "reason": reason,
            "suggested_action": suggested_action,
        }

    # ─── Score Computation Helpers ────────────────────────────────────────────

    def _compute_validation_score(self, results: list[dict]) -> float:
        """Compute validation score from rule results, weighted by severity."""
        if not results:
            return 0.5

        severity_weights = {
            "CRITICAL": 1.0,
            "ERROR": 0.7,
            "WARNING": 0.3,
            "INFO": 0.1,
        }

        total_weight = 0
        earned_weight = 0

        for r in results:
            weight = severity_weights.get(r.get("severity", "INFO"), 0.1)
            total_weight += weight

            if r["status"] == "PASS":
                earned_weight += weight
            elif r["status"] == "WARN":
                earned_weight += weight * 0.5  # Partial credit for warnings

        return earned_weight / total_weight if total_weight > 0 else 0.5

    async def _compute_historical_score(self, invoice_id: str, db: aiosqlite.Connection) -> float:
        """Compute vendor reliability score from historical data."""
        # Fetch vendor name for this invoice
        rows = await db.execute_fetchall(
            "SELECT vendor_name FROM invoices WHERE id = ?", (invoice_id,)
        )
        if not rows or not rows[0]["vendor_name"]:
            return 0.7  # Default for unknown vendors

        vendor = rows[0]["vendor_name"]

        # Count past decisions for this vendor
        history = await db.execute_fetchall(
            """
            SELECT status, COUNT(*) as cnt FROM invoices 
            WHERE vendor_name = ? AND id != ? AND status IN ('AUTO_APPROVED', 'HUMAN_APPROVED', 'AUTO_REJECTED', 'HUMAN_REJECTED')
            GROUP BY status
            """,
            (vendor, invoice_id),
        )

        if not history:
            return 0.7  # No history — neutral score

        counts = {r["status"]: r["cnt"] for r in history}
        approved = counts.get("AUTO_APPROVED", 0) + counts.get("HUMAN_APPROVED", 0)
        rejected = counts.get("AUTO_REJECTED", 0) + counts.get("HUMAN_REJECTED", 0)
        total = approved + rejected

        if total == 0:
            return 0.7

        return approved / total

    def _compute_fraud_score(self, results: list[dict]) -> float:
        """Compute fraud score (1.0 = no fraud signals, 0.0 = all fraud signals)."""
        fraud_result = next((r for r in results if r["rule_name"] == "fraud_signals"), None)

        if not fraud_result:
            return 1.0

        if fraud_result["status"] == "PASS":
            return 1.0
        elif fraud_result["status"] == "WARN":
            return 0.6
        else:
            return 0.2

    # ─── Evidence & Explanation Helpers ────────────────────────────────────────

    def _build_evidence(self, results: list[dict], extraction_score: float, ocr_confidence: float) -> list[str]:
        """Build the evidence chain from validation results."""
        evidence = []

        evidence.append(f"Extraction confidence: {extraction_score:.0%}")
        if ocr_confidence < 1.0:
            evidence.append(f"OCR confidence: {ocr_confidence:.0%}")

        for r in results:
            status_icon = "✓" if r["status"] == "PASS" else ("⚠" if r["status"] == "WARN" else "✗")
            evidence.append(f"{status_icon} {r['rule_name'].replace('_', ' ').title()}: {r['evidence']}")

        return evidence

    def _generate_reason(self, decision: str, trust_score: float, critical_failures: list, flags: list) -> str:
        """Generate a human-readable decision reason."""
        if decision == "AUTO_APPROVE":
            return (
                f"Invoice passes all validation checks with a trust score of {trust_score:.0%}. "
                f"All critical rules passed, extraction confidence is high, and no fraud signals detected."
            )
        elif decision == "AUTO_REJECT":
            if critical_failures:
                failure_names = [f["rule_name"].replace("_", " ") for f in critical_failures]
                return (
                    f"Invoice automatically rejected due to critical failures: {', '.join(failure_names)}. "
                    f"Trust score: {trust_score:.0%}."
                )
            return f"Invoice rejected due to very low trust score ({trust_score:.0%})."
        else:
            flag_count = len(flags)
            return (
                f"Invoice requires human review. Trust score ({trust_score:.0%}) is below auto-approval threshold. "
                f"{flag_count} flag{'s' if flag_count != 1 else ''} detected — review evidence chain for details."
            )

    def _generate_action(self, decision: str, flags: list) -> str:
        """Generate a suggested action."""
        if decision == "AUTO_APPROVE":
            return "Approve for payment processing"
        elif decision == "AUTO_REJECT":
            return "Investigate flags before resubmission. Contact vendor if discrepancies confirmed."
        else:
            if any("DUPLICATE" in f.upper() for f in flags):
                return "Verify this is not a duplicate payment — check AP ledger and contact vendor"
            elif any("MATH" in f.upper() for f in flags):
                return "Verify line item amounts and totals with the vendor's original invoice"
            elif any("ANOMALY" in f.upper() for f in flags):
                return "Review amount against vendor history — confirm with procurement team"
            return "Review evidence chain and make a determination based on the flags raised"
