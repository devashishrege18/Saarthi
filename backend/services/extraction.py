"""
SAARTHI — AI Extraction Service
Calls Claude API directly (no wrappers) for semantic invoice field extraction.
This is the ONLY module that makes LLM calls in the entire pipeline.
"""

import json
import time
import structlog
import httpx

from config import CLAUDE_API_KEY, CLAUDE_MODEL, CLAUDE_MAX_TOKENS

log = structlog.get_logger()

# ─── Extraction Prompt ────────────────────────────────────────────────────────

EXTRACTION_PROMPT = """You are a financial document analysis expert. Extract structured data from the following invoice text.

RULES:
1. Extract ALL fields with maximum accuracy.
2. For each field, assess your confidence (0.0 to 1.0) in the extraction.
3. If a field is not present in the document, use null and confidence 0.0.
4. For line items, extract each item separately.
5. Amounts should be numbers without currency symbols.
6. Dates should be in YYYY-MM-DD format.
7. Do NOT hallucinate or guess values. If uncertain, use null.

Respond ONLY with a valid JSON object in this exact structure:

{
  "vendor_name": {"value": "string or null", "confidence": 0.0},
  "vendor_address": {"value": "string or null", "confidence": 0.0},
  "vendor_tax_id": {"value": "string or null", "confidence": 0.0},
  "invoice_number": {"value": "string or null", "confidence": 0.0},
  "invoice_date": {"value": "YYYY-MM-DD or null", "confidence": 0.0},
  "due_date": {"value": "YYYY-MM-DD or null", "confidence": 0.0},
  "po_number": {"value": "string or null", "confidence": 0.0},
  "currency": {"value": "string or null", "confidence": 0.0},
  "payment_terms": {"value": "string or null", "confidence": 0.0},
  "subtotal": {"value": 0.0, "confidence": 0.0},
  "tax_rate": {"value": 0.0, "confidence": 0.0},
  "tax_amount": {"value": 0.0, "confidence": 0.0},
  "total_amount": {"value": 0.0, "confidence": 0.0},
  "line_items": [
    {
      "description": {"value": "string", "confidence": 0.0},
      "quantity": {"value": 0.0, "confidence": 0.0},
      "unit_price": {"value": 0.0, "confidence": 0.0},
      "amount": {"value": 0.0, "confidence": 0.0}
    }
  ]
}

INVOICE TEXT:
---
{invoice_text}
---

Respond with ONLY the JSON object. No markdown, no explanation."""


class AIExtractionService:
    """Calls Claude API for semantic invoice field extraction."""

    def __init__(self):
        self.api_key = CLAUDE_API_KEY
        self.model = CLAUDE_MODEL
        self.max_tokens = CLAUDE_MAX_TOKENS
        self.api_url = "https://api.anthropic.com/v1/messages"

    async def extract_fields(self, raw_text: str) -> dict:
        """
        Send invoice text to Claude for structured extraction.
        Returns dict with: extracted_fields, confidence_map, usage, elapsed_ms
        """
        if not self.api_key or self.api_key == "your-claude-api-key-here":
            log.warning("ai.extraction.no_key", message="Claude API key not configured, using mock extraction")
            return self._mock_extraction(raw_text)

        prompt = EXTRACTION_PROMPT.replace("{invoice_text}", raw_text[:8000])  # Limit input size

        start_time = time.time()

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    self.api_url,
                    headers={
                        "x-api-key": self.api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "max_tokens": self.max_tokens,
                        "messages": [
                            {"role": "user", "content": prompt}
                        ],
                    },
                )

            elapsed_ms = int((time.time() - start_time) * 1000)

            if response.status_code != 200:
                log.error(
                    "ai.extraction.api_error",
                    status=response.status_code,
                    body=response.text[:500],
                )
                return self._mock_extraction(raw_text)

            result = response.json()
            content = result.get("content", [{}])[0].get("text", "{}")
            usage = result.get("usage", {})

            # Parse the JSON response
            extracted = self._parse_extraction(content)

            log.info(
                "ai.extraction.complete",
                model=self.model,
                prompt_tokens=usage.get("input_tokens", 0),
                completion_tokens=usage.get("output_tokens", 0),
                elapsed_ms=elapsed_ms,
            )

            return {
                "extracted_fields": extracted.get("fields", {}),
                "confidence_map": extracted.get("confidence_map", {}),
                "line_items": extracted.get("line_items", []),
                "llm_model": self.model,
                "prompt_tokens": usage.get("input_tokens", 0),
                "completion_tokens": usage.get("output_tokens", 0),
                "extraction_time_ms": elapsed_ms,
            }

        except httpx.TimeoutException:
            log.error("ai.extraction.timeout", elapsed_ms=int((time.time() - start_time) * 1000))
            return self._mock_extraction(raw_text)
        except Exception as e:
            log.error("ai.extraction.error", error=str(e))
            return self._mock_extraction(raw_text)

    def _parse_extraction(self, raw_json: str) -> dict:
        """Parse and normalize the Claude extraction response."""
        try:
            # Clean potential markdown wrapping
            text = raw_json.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
            
            if text.startswith("json"):
                text = text[4:].strip()

            data = json.loads(text)
        except json.JSONDecodeError as e:
            log.error("ai.extraction.parse_error", error=str(e), raw=raw_json[:200])
            return {"fields": {}, "confidence_map": {}, "line_items": []}

        # Separate values and confidences
        fields = {}
        confidence_map = {}

        simple_fields = [
            "vendor_name", "vendor_address", "vendor_tax_id",
            "invoice_number", "invoice_date", "due_date",
            "po_number", "currency", "payment_terms",
            "subtotal", "tax_rate", "tax_amount", "total_amount",
        ]

        for field_name in simple_fields:
            field_data = data.get(field_name, {})
            if isinstance(field_data, dict):
                fields[field_name] = field_data.get("value")
                confidence_map[field_name] = field_data.get("confidence", 0.0)
            else:
                fields[field_name] = field_data
                confidence_map[field_name] = 0.5  # Unknown confidence

        # Extract line items
        line_items = []
        raw_items = data.get("line_items", [])
        for item in raw_items:
            li = {}
            li_conf = {}
            for key in ["description", "quantity", "unit_price", "amount"]:
                item_field = item.get(key, {})
                if isinstance(item_field, dict):
                    li[key] = item_field.get("value")
                    li_conf[key] = item_field.get("confidence", 0.0)
                else:
                    li[key] = item_field
                    li_conf[key] = 0.5
            li["confidence"] = sum(li_conf.values()) / max(len(li_conf), 1)
            line_items.append(li)

        return {
            "fields": fields,
            "confidence_map": confidence_map,
            "line_items": line_items,
        }

    def _mock_extraction(self, raw_text: str) -> dict:
        """Fallback extraction when Claude API is unavailable. Attempts basic parsing."""
        log.info("ai.extraction.mock", message="Using mock extraction (Claude unavailable)")

        # Try to extract some basic fields from text using simple heuristics
        fields = {
            "vendor_name": None,
            "vendor_address": None,
            "vendor_tax_id": None,
            "invoice_number": None,
            "invoice_date": None,
            "due_date": None,
            "po_number": None,
            "currency": "INR",
            "payment_terms": None,
            "subtotal": None,
            "tax_rate": None,
            "tax_amount": None,
            "total_amount": None,
        }

        confidence_map = {k: 0.3 for k in fields}

        # Simple heuristic: look for common patterns
        import re
        lines = raw_text.split("\n")

        for line in lines:
            line_lower = line.lower().strip()
            # Invoice number
            inv_match = re.search(r'invoice\s*(?:#|no|number|num)?[:\s]*([A-Za-z0-9\-/]+)', line_lower)
            if inv_match and not fields["invoice_number"]:
                fields["invoice_number"] = inv_match.group(1).upper()
                confidence_map["invoice_number"] = 0.5

            # Total amount
            total_match = re.search(r'(?:total|grand\s*total|amount\s*due)[:\s]*[₹$€£]?\s*([\d,]+\.?\d*)', line_lower)
            if total_match and not fields["total_amount"]:
                try:
                    fields["total_amount"] = float(total_match.group(1).replace(",", ""))
                    confidence_map["total_amount"] = 0.5
                except ValueError:
                    pass

        return {
            "extracted_fields": fields,
            "confidence_map": confidence_map,
            "line_items": [],
            "llm_model": "mock",
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "extraction_time_ms": 0,
        }
