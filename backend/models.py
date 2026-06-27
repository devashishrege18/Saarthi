"""
SAARTHI Domain Models
Pydantic models for API request/response schemas and internal data structures.
"""

from __future__ import annotations

import json
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field


# ─── Enums ────────────────────────────────────────────────────────────────────

class InvoiceStatus(str, Enum):
    RECEIVED = "RECEIVED"
    EXTRACTING = "EXTRACTING"
    EXTRACTED = "EXTRACTED"
    VALIDATING = "VALIDATING"
    VALIDATED = "VALIDATED"
    AUTO_APPROVED = "AUTO_APPROVED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    AUTO_REJECTED = "AUTO_REJECTED"
    HUMAN_APPROVED = "HUMAN_APPROVED"
    HUMAN_REJECTED = "HUMAN_REJECTED"


class ConfidenceLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class DecisionType(str, Enum):
    AUTO_APPROVE = "AUTO_APPROVE"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    AUTO_REJECT = "AUTO_REJECT"


class ValidationStatus(str, Enum):
    PASS_ = "PASS"
    FAIL = "FAIL"
    WARN = "WARN"


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class ReviewAction(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    REVIEW = "REVIEW"


# ─── Utility ──────────────────────────────────────────────────────────────────

def new_id() -> str:
    return str(uuid4())


def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


# ─── Line Items ───────────────────────────────────────────────────────────────

class LineItem(BaseModel):
    description: str = ""
    quantity: float = 0.0
    unit_price: float = 0.0
    amount: float = 0.0
    confidence: float = 0.0


class LineItemResponse(LineItem):
    id: str
    invoice_id: str


# ─── Invoice ──────────────────────────────────────────────────────────────────

class InvoiceResponse(BaseModel):
    id: str
    file_name: str
    file_type: str
    file_size: int
    status: InvoiceStatus
    vendor_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    total_amount: Optional[float] = None
    currency: Optional[str] = "INR"
    po_number: Optional[str] = None
    payment_terms: Optional[str] = None
    trust_score: Optional[float] = None
    confidence_level: Optional[str] = None
    decision: Optional[str] = None
    created_at: str
    updated_at: str

    # Nested data (populated on detail view)
    line_items: list[LineItem] = []
    extraction: Optional[ExtractionResponse] = None
    validation_results: list[ValidationResultResponse] = []
    decision_dna: Optional[DecisionDNAResponse] = None
    reviews: list[ReviewResponse] = []
    audit_trail: list[AuditEventResponse] = []


class InvoiceListResponse(BaseModel):
    invoices: list[InvoiceResponse]
    total: int
    page: int = 1
    page_size: int = 20


# ─── Extraction ───────────────────────────────────────────────────────────────

class ExtractionResponse(BaseModel):
    id: str
    invoice_id: str
    extracted_fields: dict = {}
    confidence_map: dict = {}
    llm_model: Optional[str] = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    extraction_time_ms: int = 0
    created_at: str


# ─── Validation ───────────────────────────────────────────────────────────────

class ValidationResultResponse(BaseModel):
    id: str
    invoice_id: str
    rule_name: str
    status: str
    severity: str
    evidence: str
    created_at: str


# ─── Decision DNA™ ────────────────────────────────────────────────────────────

class DecisionDNAResponse(BaseModel):
    id: str
    invoice_id: str
    trust_score: float
    confidence_level: str
    decision: str
    evidence: list[str] = []
    flags: list[str] = []
    reason: str
    suggested_action: str
    created_at: str


# ─── Human Review ─────────────────────────────────────────────────────────────

class ReviewRequest(BaseModel):
    action: ReviewAction
    reason: Optional[str] = None
    notes: Optional[str] = None


class ReviewResponse(BaseModel):
    id: str
    invoice_id: str
    action: str
    reason: Optional[str] = None
    notes: Optional[str] = None
    reviewer: str = "analyst"
    created_at: str


# ─── Audit Events ─────────────────────────────────────────────────────────────

class AuditEventResponse(BaseModel):
    id: str
    invoice_id: str
    event_type: str
    actor: str
    action: str
    details: dict = {}
    created_at: str


# ─── Dashboard ────────────────────────────────────────────────────────────────

class DashboardMetrics(BaseModel):
    total_invoices: int = 0
    auto_approved: int = 0
    needs_review: int = 0
    auto_rejected: int = 0
    human_approved: int = 0
    human_rejected: int = 0
    avg_trust_score: float = 0.0
    auto_approve_rate: float = 0.0
    avg_processing_time_ms: int = 0
    recent_invoices: list[InvoiceResponse] = []


# ─── Health ───────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"
    service: str = "saarthi-backend"
    database: str = "connected"
    timestamp: str = Field(default_factory=now_iso)


# ─── Fix forward references ──────────────────────────────────────────────────
InvoiceResponse.model_rebuild()
