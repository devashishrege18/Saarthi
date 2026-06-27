"""
SAARTHI — AI Extraction Service
Multi-provider LLM integration for semantic invoice field extraction.

Supported providers:
  - ollama  (default, free, local — Qwen, Llama, Mistral, etc.)
  - claude  (Anthropic API)
  - openai_compatible  (OpenAI, Groq, Together, etc.)

This is the ONLY module that makes LLM calls in the entire pipeline.
"""

import json
import time
import structlog
import httpx

from config import (
    LLM_PROVIDER, LLM_MAX_TOKENS,
    OLLAMA_BASE_URL, OLLAMA_MODEL,
    CLAUDE_API_KEY, CLAUDE_MODEL,
    OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL,
)

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

# Shorter prompt for fast local models (phi3, small llama, etc.)
EXTRACTION_PROMPT_LOCAL = """Extract invoice fields as JSON. Return ONLY valid JSON, no explanation.

Fields to extract:
- vendor_name, invoice_number, invoice_date (YYYY-MM-DD), due_date (YYYY-MM-DD)
- total_amount (number), subtotal (number), tax_amount (number), tax_rate (number)
- currency, po_number, payment_terms
- line_items: array of {description, quantity, unit_price, amount}

For each field use: {"value": <value or null>, "confidence": <0.0-1.0>}

INVOICE:
{invoice_text}

JSON:"""

# Simple, fast, selective prompt for timesheets/data inputs
TIMESHEET_PROMPT = """Extract timesheet fields as JSON. Return ONLY valid JSON, no explanation.

Fields to extract:
- employee_name: name of the contractor/employee
- vendor_name: company/agency name or employee_name if individual
- total_hours (number): total hours worked
- hourly_rate (number): hourly payment rate
- total_amount (number): total payment amount
- period_start (YYYY-MM-DD): start of work period
- period_end (YYYY-MM-DD): end of work period

For each field use: {"value": <value or null>, "confidence": <0.0-1.0>}

TIMESHEET:
{timesheet_text}

JSON:"""


class AIExtractionService:
    """Calls LLM APIs for semantic invoice field extraction. Supports multiple providers."""

    def __init__(self):
        self.provider = LLM_PROVIDER
        self.max_tokens = LLM_MAX_TOKENS

        log.info("ai.init", provider=self.provider, model=self._get_model_name())

    def _get_model_name(self) -> str:
        if self.provider == "ollama":
            return OLLAMA_MODEL
        elif self.provider == "claude":
            return CLAUDE_MODEL
        else:
            return OPENAI_MODEL

    async def extract_fields(self, raw_text: str, is_selective_timesheet: bool = False) -> dict:
        """
        Send invoice/timesheet text to LLM for structured extraction.
        Routes to the configured provider.
        """
        if is_selective_timesheet:
            prompt = TIMESHEET_PROMPT.replace("{timesheet_text}", raw_text[:2000])
        else:
            # Local models get a shorter prompt + less text for speed
            if self.provider == "ollama":
                prompt = EXTRACTION_PROMPT_LOCAL.replace("{invoice_text}", raw_text[:2000])
            else:
                prompt = EXTRACTION_PROMPT.replace("{invoice_text}", raw_text[:8000])

        if self.provider == "ollama":
            return await self._call_ollama(prompt)
        elif self.provider == "claude":
            return await self._call_claude(prompt)
        elif self.provider == "openai_compatible":
            return await self._call_openai(prompt)
        else:
            log.warning("ai.unknown_provider", provider=self.provider)
            return self._mock_extraction(raw_text)

    # ─── Ollama Provider ──────────────────────────────────────────────────────

    async def _call_ollama(self, prompt: str) -> dict:
        """Call Ollama native /api/generate endpoint (faster than OpenAI-compat)."""
        model = OLLAMA_MODEL
        url = f"{OLLAMA_BASE_URL}/api/generate"

        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    url,
                    json={
                        "model": model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.1,
                            "num_predict": 1024,  # Limit tokens for speed
                            "stop": ["\n\nINVOICE", "---"],
                        },
                    },
                )

            elapsed_ms = int((time.time() - start_time) * 1000)

            if response.status_code != 200:
                log.error("ai.ollama.error", status=response.status_code, body=response.text[:300])
                return self._mock_extraction(prompt)

            result = response.json()
            content = result.get("response", "{}")
            prompt_tokens = result.get("prompt_eval_count", 0)
            completion_tokens = result.get("eval_count", 0)

            extracted = self._parse_extraction(content)

            log.info("ai.ollama.complete", model=model,
                     prompt_tokens=prompt_tokens,
                     completion_tokens=completion_tokens,
                     elapsed_ms=elapsed_ms)

            return {
                "extracted_fields": extracted.get("fields", {}),
                "confidence_map": extracted.get("confidence_map", {}),
                "line_items": extracted.get("line_items", []),
                "llm_model": f"ollama/{model}",
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "extraction_time_ms": elapsed_ms,
            }

        except httpx.ConnectError:
            log.error("ai.ollama.connection_refused", url=url,
                      message="Is Ollama running? Start with: ollama serve")
            return self._mock_extraction(prompt)
        except httpx.TimeoutException:
            log.error("ai.ollama.timeout", elapsed_ms=int((time.time() - start_time) * 1000))
            return self._mock_extraction(prompt)
        except Exception as e:
            log.error("ai.ollama.error", error=str(e))
            return self._mock_extraction(prompt)

    # ─── Claude Provider ──────────────────────────────────────────────────────

    async def _call_claude(self, prompt: str) -> dict:
        """Call Anthropic Claude API directly."""
        if not CLAUDE_API_KEY or CLAUDE_API_KEY == "your-claude-api-key-here":
            log.warning("ai.claude.no_key", message="Claude API key not configured")
            return self._mock_extraction(prompt)

        model = CLAUDE_MODEL
        start_time = time.time()

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": CLAUDE_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": model,
                        "max_tokens": self.max_tokens,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )

            elapsed_ms = int((time.time() - start_time) * 1000)

            if response.status_code != 200:
                log.error("ai.claude.error", status=response.status_code, body=response.text[:300])
                return self._mock_extraction(prompt)

            result = response.json()
            content = result.get("content", [{}])[0].get("text", "{}")
            usage = result.get("usage", {})

            extracted = self._parse_extraction(content)

            log.info("ai.claude.complete", model=model,
                     prompt_tokens=usage.get("input_tokens", 0),
                     completion_tokens=usage.get("output_tokens", 0),
                     elapsed_ms=elapsed_ms)

            return {
                "extracted_fields": extracted.get("fields", {}),
                "confidence_map": extracted.get("confidence_map", {}),
                "line_items": extracted.get("line_items", []),
                "llm_model": f"claude/{model}",
                "prompt_tokens": usage.get("input_tokens", 0),
                "completion_tokens": usage.get("output_tokens", 0),
                "extraction_time_ms": elapsed_ms,
            }

        except Exception as e:
            log.error("ai.claude.error", error=str(e))
            return self._mock_extraction(prompt)

    # ─── OpenAI-Compatible Provider ───────────────────────────────────────────

    async def _call_openai(self, prompt: str) -> dict:
        """Call any OpenAI-compatible API (OpenAI, Groq, Together, etc.)."""
        if not OPENAI_API_KEY:
            log.warning("ai.openai.no_key", message="OpenAI API key not configured")
            return self._mock_extraction(prompt)

        model = OPENAI_MODEL
        url = f"{OPENAI_BASE_URL}/chat/completions"
        start_time = time.time()

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {OPENAI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": self.max_tokens,
                        "temperature": 0.1,
                    },
                )

            elapsed_ms = int((time.time() - start_time) * 1000)

            if response.status_code != 200:
                log.error("ai.openai.error", status=response.status_code, body=response.text[:300])
                return self._mock_extraction(prompt)

            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "{}")
            usage = result.get("usage", {})

            extracted = self._parse_extraction(content)

            log.info("ai.openai.complete", model=model,
                     prompt_tokens=usage.get("prompt_tokens", 0),
                     completion_tokens=usage.get("completion_tokens", 0),
                     elapsed_ms=elapsed_ms)

            return {
                "extracted_fields": extracted.get("fields", {}),
                "confidence_map": extracted.get("confidence_map", {}),
                "line_items": extracted.get("line_items", []),
                "llm_model": f"openai/{model}",
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "extraction_time_ms": elapsed_ms,
            }

        except Exception as e:
            log.error("ai.openai.error", error=str(e))
            return self._mock_extraction(prompt)

    def _parse_extraction(self, raw_json: str) -> dict:
        """Parse and normalize the LLM extraction response."""
        try:
            text = raw_json.strip()
            # Clean markdown wrapping
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
            if text.startswith("json"):
                text = text[4:].strip()

            data = json.loads(text)
        except json.JSONDecodeError as e:
            log.error("ai.parse_error", error=str(e), raw=raw_json[:200])
            return {"fields": {}, "confidence_map": {}, "line_items": []}

        fields = {}
        confidence_map = {}

        # Check if this is a timesheet payload
        if "employee_name" in data or "total_hours" in data:
            emp_name = data.get("employee_name", {}).get("value") if isinstance(data.get("employee_name"), dict) else data.get("employee_name")
            vend_name = data.get("vendor_name", {}).get("value") if isinstance(data.get("vendor_name"), dict) else data.get("vendor_name")
            total_h = data.get("total_hours", {}).get("value") if isinstance(data.get("total_hours"), dict) else data.get("total_hours")
            rate = data.get("hourly_rate", {}).get("value") if isinstance(data.get("hourly_rate"), dict) else data.get("hourly_rate")
            amount = data.get("total_amount", {}).get("value") if isinstance(data.get("total_amount"), dict) else data.get("total_amount")
            start_d = data.get("period_start", {}).get("value") if isinstance(data.get("period_start"), dict) else data.get("period_start")
            end_d = data.get("period_end", {}).get("value") if isinstance(data.get("period_end"), dict) else data.get("period_end")

            vendor_final = vend_name or emp_name or "Timesheet Contributor"
            try:
                hours_val = float(total_h) if total_h is not None else 0.0
            except ValueError:
                hours_val = 0.0
            try:
                rate_val = float(rate) if rate is not None else 0.0
            except ValueError:
                rate_val = 0.0
            try:
                amount_final = float(amount) if amount is not None else (hours_val * rate_val)
            except ValueError:
                amount_final = hours_val * rate_val

            fields = {
                "vendor_name": vendor_final,
                "vendor_address": None,
                "vendor_tax_id": None,
                "invoice_number": f"TS-{end_d or '2026-06'}",
                "invoice_date": end_d or "2026-06-27",
                "due_date": end_d or "2026-06-27",
                "po_number": None,
                "currency": "INR",
                "payment_terms": "Immediate",
                "subtotal": hours_val * rate_val,
                "tax_rate": 0.0,
                "tax_amount": 0.0,
                "total_amount": amount_final,
            }
            confidence_map = {k: 0.95 for k in fields}
            
            line_items = [{
                "description": f"Timesheet: {hours_val} hrs @ {rate_val}/hr for {emp_name or 'Contributor'}",
                "quantity": hours_val,
                "unit_price": rate_val,
                "amount": amount_final,
                "confidence": 0.95
            }]
            return {"fields": fields, "confidence_map": confidence_map, "line_items": line_items}

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
                confidence_map[field_name] = 0.5

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

        return {"fields": fields, "confidence_map": confidence_map, "line_items": line_items}

    def _mock_extraction(self, raw_text: str) -> dict:
        """Fallback when no LLM is available. Uses regex heuristics."""
        log.info("ai.mock", message="Using regex fallback (no LLM available)")

        import re
        fields = {
            "vendor_name": None, "vendor_address": None, "vendor_tax_id": None,
            "invoice_number": None, "invoice_date": None, "due_date": None,
            "po_number": None, "currency": "INR", "payment_terms": None,
            "subtotal": None, "tax_rate": None, "tax_amount": None, "total_amount": None,
        }
        confidence_map = {k: 0.3 for k in fields}

        lines = raw_text.split("\n")
        for line in lines:
            ll = line.lower().strip()

            inv_match = re.search(r'invoice\s*(?:#|no|number|num)?[:\s]*([A-Za-z0-9\-/]+)', ll)
            if inv_match and not fields["invoice_number"]:
                fields["invoice_number"] = inv_match.group(1).upper()
                confidence_map["invoice_number"] = 0.5

            total_match = re.search(r'(?:total|grand\s*total|amount\s*due)[:\s]*[₹$€£]?\s*([\d,]+\.?\d*)', ll)
            if total_match and not fields["total_amount"]:
                try:
                    fields["total_amount"] = float(total_match.group(1).replace(",", ""))
                    confidence_map["total_amount"] = 0.5
                except ValueError:
                    pass

        return {
            "extracted_fields": fields, "confidence_map": confidence_map,
            "line_items": [], "llm_model": "mock/regex",
            "prompt_tokens": 0, "completion_tokens": 0, "extraction_time_ms": 0,
        }
