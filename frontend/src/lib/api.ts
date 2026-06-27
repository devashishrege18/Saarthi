/**
 * SAARTHI API Client
 * Typed fetch helpers for communicating with the FastAPI backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  confidence: number;
}

export interface ExtractionResult {
  id: string;
  invoice_id: string;
  extracted_fields: Record<string, unknown>;
  confidence_map: Record<string, number>;
  llm_model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  extraction_time_ms: number;
  created_at: string;
}

export interface ValidationResult {
  id: string;
  invoice_id: string;
  rule_name: string;
  status: "PASS" | "FAIL" | "WARN";
  severity: "CRITICAL" | "ERROR" | "WARNING" | "INFO";
  evidence: string;
  created_at: string;
}

export interface DecisionDNA {
  id: string;
  invoice_id: string;
  trust_score: number;
  confidence_level: "HIGH" | "MEDIUM" | "LOW";
  decision: "AUTO_APPROVE" | "NEEDS_REVIEW" | "AUTO_REJECT";
  evidence: string[];
  flags: string[];
  reason: string;
  suggested_action: string;
  created_at: string;
}

export interface Review {
  id: string;
  invoice_id: string;
  action: string;
  reason: string | null;
  notes: string | null;
  reviewer: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  invoice_id: string;
  event_type: string;
  actor: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Invoice {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: string;
  vendor_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  currency: string | null;
  po_number: string | null;
  payment_terms: string | null;
  trust_score: number | null;
  confidence_level: string | null;
  decision: string | null;
  created_at: string;
  updated_at: string;
  line_items: LineItem[];
  extraction: ExtractionResult | null;
  validation_results: ValidationResult[];
  decision_dna: DecisionDNA | null;
  reviews: Review[];
  audit_trail: AuditEvent[];
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardMetrics {
  total_invoices: number;
  auto_approved: number;
  needs_review: number;
  auto_rejected: number;
  human_approved: number;
  human_rejected: number;
  avg_trust_score: number;
  auto_approve_rate: number;
  avg_processing_time_ms: number;
  recent_invoices: Invoice[];
}

export interface ReviewRequest {
  action: "APPROVE" | "REJECT" | "REVIEW";
  reason?: string;
  notes?: string;
}

// ─── API Functions ───────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API Error: ${res.status}`);
  }

  return res.json();
}

// ─── Invoice Endpoints ───────────────────────────────────────────────────────

export async function uploadInvoice(file: File): Promise<Invoice> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/invoices`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `Upload failed: ${res.status}`);
  }

  return res.json();
}

export async function listInvoices(
  status?: string,
  page = 1,
  pageSize = 20
): Promise<InvoiceListResponse> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (status) params.set("status", status);
  return apiFetch(`/invoices?${params}`);
}

export async function getInvoice(id: string): Promise<Invoice> {
  return apiFetch(`/invoices/${id}`);
}

// ─── Review Endpoints ────────────────────────────────────────────────────────

export async function getReviewQueue(): Promise<Invoice[]> {
  return apiFetch("/review/queue");
}

export async function submitReview(invoiceId: string, review: ReviewRequest): Promise<Review> {
  return apiFetch(`/review/${invoiceId}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(review),
  });
}

// ─── Dashboard Endpoints ─────────────────────────────────────────────────────

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return apiFetch("/dashboard/metrics");
}

// ─── Process Endpoint (triggers full pipeline) ───────────────────────────────

export async function processInvoice(invoiceId: string): Promise<Invoice> {
  return apiFetch(`/invoices/${invoiceId}/process`, {
    method: "POST",
  });
}

// ─── Settings Endpoints ──────────────────────────────────────────────────────

export interface SystemSettings {
  gmail_connected: boolean;
  gmail_email: string;
  local_pc_connected: boolean;
  watch_folder: string;
  auto_accept_timesheets: boolean;
  selective_ai_parsing: boolean;
}

export async function getSettings(): Promise<SystemSettings> {
  return apiFetch("/settings");
}

export async function updateSettings(settings: SystemSettings): Promise<SystemSettings> {
  return apiFetch("/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}
