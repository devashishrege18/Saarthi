"""
SAARTHI — Validation Engine
Deterministic business rules for invoice validation.
NO AI in this module — every check is arithmetic, lookup, or comparison.
"""

import json
import re
from datetime import datetime
import structlog
import aiosqlite

from models import new_id, now_iso

log = structlog.get_logger()


class ValidationEngine:
    """Runs deterministic business rules against extracted invoice data."""

    async def validate(self, invoice_id: str, db: aiosqlite.Connection) -> list[dict]:
        """Run all validation rules and store results. Returns list of rule results."""

        # Fetch invoice data
        rows = await db.execute_fetchall("SELECT * FROM invoices WHERE id = ?", (invoice_id,))
        if not rows:
            raise ValueError(f"Invoice not found: {invoice_id}")

        invoice = dict(rows[0])

        # Fetch line items
        li_rows = await db.execute_fetchall(
            "SELECT * FROM line_items WHERE invoice_id = ?", (invoice_id,)
        )
        line_items = [dict(r) for r in li_rows]

        # Update status
        await db.execute(
            "UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?",
            ("VALIDATING", now_iso(), invoice_id)
        )

        # ─── Run all rules ────────────────────────────────────────────────
        results = []

        results.append(self._check_mandatory_fields(invoice))
        results.append(self._check_math_integrity(invoice, line_items))
        results.append(await self._check_duplicates(invoice, db))
        results.append(self._check_date_validity(invoice))
        results.append(self._check_format_validity(invoice))
        results.append(await self._check_amount_anomaly(invoice, db))
        results.append(self._check_fraud_signals(invoice, line_items))

        # Store results
        for r in results:
            await db.execute(
                """
                INSERT INTO validation_results (id, invoice_id, rule_name, status, severity, evidence, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (new_id(), invoice_id, r["rule_name"], r["status"], r["severity"], r["evidence"], now_iso()),
            )

        # Update status
        await db.execute(
            "UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?",
            ("VALIDATED", now_iso(), invoice_id)
        )

        # Audit log
        passed = sum(1 for r in results if r["status"] == "PASS")
        failed = sum(1 for r in results if r["status"] == "FAIL")
        warned = sum(1 for r in results if r["status"] == "WARN")

        await db.execute(
            """
            INSERT INTO audit_events (id, invoice_id, event_type, actor, action, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id(), invoice_id, "VALIDATION_COMPLETED", "system",
                f"Validation complete: {passed} passed, {failed} failed, {warned} warnings",
                json.dumps({"passed": passed, "failed": failed, "warned": warned, "total": len(results)}),
                now_iso(),
            ),
        )

        await db.commit()

        log.info("validation.complete", invoice_id=invoice_id, passed=passed, failed=failed, warned=warned)
        return results

    # ─── Rule Implementations ─────────────────────────────────────────────────

    def _check_mandatory_fields(self, invoice: dict) -> dict:
        """Check that all mandatory fields are present."""
        mandatory = {
            "vendor_name": invoice.get("vendor_name"),
            "invoice_number": invoice.get("invoice_number"),
            "invoice_date": invoice.get("invoice_date"),
            "total_amount": invoice.get("total_amount"),
        }

        missing = [k for k, v in mandatory.items() if not v and v != 0]

        if not missing:
            return {
                "rule_name": "mandatory_fields",
                "status": "PASS",
                "severity": "CRITICAL",
                "evidence": f"All {len(mandatory)} mandatory fields present: {', '.join(mandatory.keys())}",
            }
        else:
            return {
                "rule_name": "mandatory_fields",
                "status": "FAIL",
                "severity": "CRITICAL",
                "evidence": f"Missing mandatory fields: {', '.join(missing)}",
            }

    def _check_math_integrity(self, invoice: dict, line_items: list[dict]) -> dict:
        """Verify that line items sum matches subtotal, and subtotal + tax = total."""
        if not line_items:
            return {
                "rule_name": "math_integrity",
                "status": "WARN",
                "severity": "WARNING",
                "evidence": "No line items to verify — cannot perform math check",
            }

        # Sum line item amounts
        li_sum = sum(float(item.get("amount", 0) or 0) for item in line_items)

        subtotal = float(invoice.get("subtotal") or 0)
        tax = float(invoice.get("tax_amount") or 0)
        total = float(invoice.get("total_amount") or 0)

        issues = []

        # Check line items vs subtotal (if subtotal exists)
        if subtotal > 0 and li_sum > 0:
            diff = abs(li_sum - subtotal)
            if diff > 1.0:  # Allow ₹1 rounding tolerance
                issues.append(
                    f"Line items sum ({li_sum:,.2f}) ≠ subtotal ({subtotal:,.2f}) — difference: {diff:,.2f}"
                )

        # Check subtotal + tax = total
        if subtotal > 0 and total > 0:
            expected_total = subtotal + tax
            diff = abs(expected_total - total)
            if diff > 1.0:
                issues.append(
                    f"Subtotal ({subtotal:,.2f}) + Tax ({tax:,.2f}) = {expected_total:,.2f} ≠ Total ({total:,.2f})"
                )

        if not issues:
            evidence = f"Math verified: line items sum ({li_sum:,.2f})"
            if subtotal > 0:
                evidence += f" matches subtotal ({subtotal:,.2f})"
            if total > 0:
                evidence += f", total ({total:,.2f}) correct"
            return {
                "rule_name": "math_integrity",
                "status": "PASS",
                "severity": "CRITICAL",
                "evidence": evidence,
            }
        else:
            return {
                "rule_name": "math_integrity",
                "status": "FAIL",
                "severity": "CRITICAL",
                "evidence": "; ".join(issues),
            }

    async def _check_duplicates(self, invoice: dict, db: aiosqlite.Connection) -> dict:
        """Check for exact duplicate invoices (same vendor + invoice# + amount)."""
        vendor = invoice.get("vendor_name")
        inv_num = invoice.get("invoice_number")
        amount = invoice.get("total_amount")
        current_id = invoice.get("id")

        if not (vendor and inv_num):
            return {
                "rule_name": "duplicate_detection",
                "status": "WARN",
                "severity": "WARNING",
                "evidence": "Insufficient data for duplicate check (missing vendor or invoice number)",
            }

        # Exact match
        rows = await db.execute_fetchall(
            """
            SELECT id, vendor_name, invoice_number, total_amount, status, created_at 
            FROM invoices 
            WHERE vendor_name = ? AND invoice_number = ? AND id != ?
            """,
            (vendor, inv_num, current_id),
        )

        if rows:
            dup = rows[0]
            return {
                "rule_name": "duplicate_detection",
                "status": "FAIL",
                "severity": "CRITICAL",
                "evidence": (
                    f"DUPLICATE FOUND: Invoice {dup['invoice_number']} from {dup['vendor_name']} "
                    f"(amount: {dup['total_amount']}, status: {dup['status']}, "
                    f"submitted: {dup['created_at'][:10]})"
                ),
            }

        # Fuzzy match: same vendor + similar amount (within 5%) in last 30 days
        if amount and amount > 0:
            near_rows = await db.execute_fetchall(
                """
                SELECT id, invoice_number, total_amount, created_at 
                FROM invoices 
                WHERE vendor_name = ? AND id != ?
                  AND total_amount BETWEEN ? AND ?
                  AND created_at > datetime('now', '-30 days')
                """,
                (vendor, current_id, amount * 0.95, amount * 1.05),
            )

            if near_rows:
                near = near_rows[0]
                return {
                    "rule_name": "duplicate_detection",
                    "status": "WARN",
                    "severity": "WARNING",
                    "evidence": (
                        f"NEAR-DUPLICATE: Similar invoice found from same vendor — "
                        f"Invoice #{near['invoice_number']}, amount: {near['total_amount']}, "
                        f"date: {near['created_at'][:10]}"
                    ),
                }

        return {
            "rule_name": "duplicate_detection",
            "status": "PASS",
            "severity": "CRITICAL",
            "evidence": "No duplicate or near-duplicate invoices found in database",
        }

    def _check_date_validity(self, invoice: dict) -> dict:
        """Check that invoice date and due date are reasonable."""
        inv_date_str = invoice.get("invoice_date")
        due_date_str = invoice.get("due_date")

        issues = []

        if inv_date_str:
            try:
                inv_date = datetime.strptime(inv_date_str[:10], "%Y-%m-%d")
                today = datetime.now()

                # Invoice from the future?
                if inv_date > today:
                    issues.append(f"Invoice date ({inv_date_str}) is in the future")

                # Invoice too old? (> 1 year)
                days_old = (today - inv_date).days
                if days_old > 365:
                    issues.append(f"Invoice date ({inv_date_str}) is over 1 year old ({days_old} days)")

            except (ValueError, TypeError):
                issues.append(f"Invalid invoice date format: {inv_date_str}")

        if due_date_str and inv_date_str:
            try:
                inv_date = datetime.strptime(inv_date_str[:10], "%Y-%m-%d")
                due_date = datetime.strptime(due_date_str[:10], "%Y-%m-%d")

                if due_date < inv_date:
                    issues.append(f"Due date ({due_date_str}) is before invoice date ({inv_date_str})")
            except (ValueError, TypeError):
                pass

        if not issues:
            return {
                "rule_name": "date_validity",
                "status": "PASS",
                "severity": "WARNING",
                "evidence": f"Date validation passed (invoice: {inv_date_str or 'N/A'}, due: {due_date_str or 'N/A'})",
            }
        else:
            return {
                "rule_name": "date_validity",
                "status": "WARN",
                "severity": "WARNING",
                "evidence": "; ".join(issues),
            }

    def _check_format_validity(self, invoice: dict) -> dict:
        """Validate currency codes and basic format checks."""
        issues = []

        currency = invoice.get("currency")
        if currency:
            valid_currencies = {"INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "SGD"}
            if currency.upper() not in valid_currencies:
                issues.append(f"Unusual currency code: {currency}")

        total = invoice.get("total_amount")
        if total is not None and total < 0:
            issues.append(f"Negative total amount: {total}")

        if not issues:
            return {
                "rule_name": "format_validity",
                "status": "PASS",
                "severity": "INFO",
                "evidence": "All format checks passed",
            }
        else:
            return {
                "rule_name": "format_validity",
                "status": "WARN",
                "severity": "WARNING",
                "evidence": "; ".join(issues),
            }

    async def _check_amount_anomaly(self, invoice: dict, db: aiosqlite.Connection) -> dict:
        """Compare amount against vendor's historical baseline."""
        vendor = invoice.get("vendor_name")
        amount = invoice.get("total_amount")

        if not vendor or not amount or amount <= 0:
            return {
                "rule_name": "amount_anomaly",
                "status": "PASS",
                "severity": "WARNING",
                "evidence": "Insufficient data for anomaly check",
            }

        # Get vendor's historical amounts
        rows = await db.execute_fetchall(
            """
            SELECT total_amount FROM invoices 
            WHERE vendor_name = ? AND id != ? AND total_amount IS NOT NULL AND total_amount > 0
            ORDER BY created_at DESC LIMIT 50
            """,
            (vendor, invoice.get("id")),
        )

        if len(rows) < 3:
            return {
                "rule_name": "amount_anomaly",
                "status": "PASS",
                "severity": "WARNING",
                "evidence": f"Insufficient history for vendor '{vendor}' ({len(rows)} past invoices, need ≥3)",
            }

        amounts = [r["total_amount"] for r in rows]
        mean = sum(amounts) / len(amounts)
        variance = sum((x - mean) ** 2 for x in amounts) / len(amounts)
        std_dev = variance ** 0.5

        if std_dev == 0:
            z_score = 0
        else:
            z_score = (amount - mean) / std_dev

        if abs(z_score) > 3:
            return {
                "rule_name": "amount_anomaly",
                "status": "FAIL",
                "severity": "WARNING",
                "evidence": (
                    f"Amount ({amount:,.2f}) is {z_score:.1f}σ from vendor's mean ({mean:,.2f}, σ={std_dev:,.2f}). "
                    f"Highly anomalous — verify with vendor."
                ),
            }
        elif abs(z_score) > 2:
            return {
                "rule_name": "amount_anomaly",
                "status": "WARN",
                "severity": "WARNING",
                "evidence": (
                    f"Amount ({amount:,.2f}) is {z_score:.1f}σ above vendor's mean ({mean:,.2f}, σ={std_dev:,.2f}). "
                    f"Above usual range but not extreme."
                ),
            }
        else:
            return {
                "rule_name": "amount_anomaly",
                "status": "PASS",
                "severity": "WARNING",
                "evidence": (
                    f"Amount ({amount:,.2f}) is within {z_score:.1f}σ of vendor's mean ({mean:,.2f}). "
                    f"Normal range."
                ),
            }

    def _check_fraud_signals(self, invoice: dict, line_items: list[dict]) -> dict:
        """Check for common fraud indicators."""
        signals = []

        total = float(invoice.get("total_amount") or 0)

        # Round number bias (exact thousands)
        if total > 0 and total == int(total) and total % 1000 == 0 and total >= 10000:
            signals.append(f"Round number: {total:,.0f} (exact thousands — common in fabricated invoices)")

        # Just below common approval thresholds
        common_thresholds = [5000, 10000, 25000, 50000, 100000, 500000]
        for threshold in common_thresholds:
            if 0 < (threshold - total) <= threshold * 0.02:  # Within 2% below threshold
                signals.append(
                    f"Amount ({total:,.2f}) is just below common approval threshold ({threshold:,.0f})"
                )
                break

        # Check for weekend/holiday submission (basic)
        inv_date = invoice.get("invoice_date")
        if inv_date:
            try:
                dt = datetime.strptime(inv_date[:10], "%Y-%m-%d")
                if dt.weekday() >= 5:  # Saturday=5, Sunday=6
                    signals.append(f"Invoice dated on weekend ({dt.strftime('%A')})")
            except (ValueError, TypeError):
                pass

        if not signals:
            return {
                "rule_name": "fraud_signals",
                "status": "PASS",
                "severity": "WARNING",
                "evidence": "No fraud signals detected",
            }
        else:
            return {
                "rule_name": "fraud_signals",
                "status": "WARN",
                "severity": "WARNING",
                "evidence": "; ".join(signals),
            }
