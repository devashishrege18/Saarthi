"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Shield,
  Dna,
  ClipboardList,
  Clock,
  Loader2,
} from "lucide-react";
import { getInvoice, type Invoice } from "@/lib/api";

function decColor(d: string | null | undefined) {
  if (d === "AUTO_APPROVE" || d === "AUTO_APPROVED" || d === "HUMAN_APPROVED") return "var(--success)";
  if (d === "NEEDS_REVIEW") return "var(--warning)";
  return "var(--danger)";
}

function decBg(d: string | null | undefined) {
  if (d === "AUTO_APPROVE" || d === "AUTO_APPROVED" || d === "HUMAN_APPROVED") return "var(--success-bg)";
  if (d === "NEEDS_REVIEW") return "var(--warning-bg)";
  return "var(--danger-bg)";
}

function decLabel(d: string | null | undefined) {
  if (d === "AUTO_APPROVE" || d === "AUTO_APPROVED") return "Auto-Approved";
  if (d === "HUMAN_APPROVED") return "Approved";
  if (d === "NEEDS_REVIEW") return "Needs Review";
  if (d === "AUTO_REJECT" || d === "AUTO_REJECTED") return "Rejected";
  if (d === "HUMAN_REJECTED") return "Rejected";
  return d || "—";
}

function TrustGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score * circumference);
  const color = score >= 0.85 ? "var(--success)" : score >= 0.5 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border-strong)" strokeWidth="5" />
        <motion.circle
          cx="60" cy="60" r="54" fill="none"
          stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-[var(--text-heading)]">{pct}</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">Trust %</span>
      </div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dna" | "validation" | "audit">("dna");

  const id = params.id as string;

  useEffect(() => {
    getInvoice(id)
      .then(setInvoice)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 text-[var(--brand)] animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="empty-state">
        <p className="empty-state-title">Invoice record not found</p>
        <button onClick={() => router.push("/invoices")} className="btn btn-secondary btn-sm">Back to Ledger</button>
      </div>
    );
  }

  const dna = invoice.decision_dna;
  const isTimesheet = (invoice.vendor_name || invoice.file_name || "").toLowerCase().includes("timesheet") || invoice.file_name.toLowerCase().includes("timesheet") || invoice.file_name.toLowerCase().includes("data");

  return (
    <div>
      {/* Back Navigation Link */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
        <button onClick={() => router.back()} className="btn btn-ghost btn-sm flex items-center gap-1.5 px-0">
          <ArrowLeft className="w-4 h-4" /> Back to Ledger
        </button>
      </motion.div>

      {/* Main Header Card */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card mb-6 overflow-hidden">
        <div 
          className="px-6 py-5 flex items-center justify-between" 
          style={{ 
            borderLeft: `4px solid ${decColor(invoice.decision)}`,
            background: "var(--surface-0)" 
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--surface-2)] border border-[var(--border-default)] flex items-center justify-center">
              <FileText className="w-5 h-5 text-[var(--text-secondary)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[var(--text-heading)] m-0">{invoice.vendor_name || invoice.file_name}</h1>
                {isTimesheet && (
                  <span className="badge badge-brand">Timesheet</span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] m-0 mt-0.5">
                Ref: <span className="mono font-semibold">{invoice.invoice_number || "—"}</span> · Ingested: {invoice.invoice_date || "—"} · Filename: {invoice.file_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="badge" style={{
              background: decBg(invoice.decision),
              color: decColor(invoice.decision),
              borderColor: decColor(invoice.decision) + "40"
            }}>
              {decLabel(invoice.decision)}
            </span>
            {invoice.trust_score !== null && (
              <span className="text-3xl font-bold mono" style={{ color: decColor(invoice.decision) }}>
                {Math.round(invoice.trust_score * 100)}%
              </span>
            )}
          </div>
        </div>

        {/* Financial Details strip */}
        <div className="grid grid-cols-6 divide-x divide-[var(--border-default)] border-t border-[var(--border-default)] bg-[var(--surface-1)]">
          {[
            { label: "Total Value", value: invoice.total_amount ? `₹${invoice.total_amount.toLocaleString()}` : "—" },
            { label: "Subtotal Value", value: invoice.subtotal ? `₹${invoice.subtotal.toLocaleString()}` : "—" },
            { label: "Tax Liability", value: invoice.tax_amount ? `₹${invoice.tax_amount.toLocaleString()}` : "—" },
            { label: "Currency", value: invoice.currency || "—" },
            { label: "Payment Due", value: invoice.due_date || "—" },
            { label: "PO Number", value: invoice.po_number || "—" },
          ].map((item) => (
            <div key={item.label} className="px-5 py-3.5">
              <p className="section-label mb-0.5">{item.label}</p>
              <p className="text-[13px] font-semibold text-[var(--text-heading)] mono m-0">{item.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tabs list */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { key: "dna" as const, label: "Decision DNA™", icon: Dna },
          { key: "validation" as const, label: "Verification Checks", icon: ClipboardList },
          { key: "audit" as const, label: "Audit Log & Lifecycle", icon: Clock },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`filter-pill flex items-center gap-1.5 ${tab === t.key ? 'active' : ''}`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
        {tab === "dna" && dna && (
          <div className="grid grid-cols-3 gap-6">
            {/* Left: Trust ring */}
            <div className="card p-6 flex flex-col items-center justify-center">
              <span className="section-label mb-4">Decision Confidence</span>
              <TrustGauge score={dna.trust_score} />
              <p className="text-xs text-[var(--text-secondary)] mt-4">
                Confidence Grade: <span className="font-semibold text-[var(--text-heading)]">{dna.confidence_level}</span>
              </p>
            </div>

            {/* Right: Evidence Chain */}
            <div className="card col-span-2 overflow-hidden flex flex-col">
              <div className="panel-header">
                <span className="panel-header-title">Decision Explanation Evidence</span>
              </div>
              <div className="divide-y divide-[var(--border-default)]">
                {dna.evidence.map((e, i) => {
                  const isPass = e.startsWith("✓");
                  const isFail = e.startsWith("✗") || e.startsWith("critical");
                  const isWarn = e.startsWith("⚠");
                  return (
                    <div key={i} className="px-5 py-3 flex items-start gap-3">
                      {isPass && <CheckCircle2 className="w-4 h-4 text-[var(--success)] flex-shrink-0 mt-0.5" />}
                      {isFail && <XCircle className="w-4 h-4 text-[var(--danger)] flex-shrink-0 mt-0.5" />}
                      {isWarn && <AlertTriangle className="w-4 h-4 text-[var(--warning)] flex-shrink-0 mt-0.5" />}
                      {!isPass && !isFail && !isWarn && <Shield className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />}
                      <span className="text-[var(--text-body)] text-xs">
                        {e.replace(/^[✓✗⚠]\s*/, "")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Left: Reason */}
            <div className="card col-span-2 p-5">
              <span className="section-label mb-2 block">System Reason Narrative</span>
              <p style={{ fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.5 }} className="m-0">{dna.reason}</p>
            </div>

            {/* Bottom Right: Suggested Action */}
            <div className="card p-5" style={{ background: "var(--brand-light)", borderColor: "rgba(0,82,204,0.18)" }}>
              <span className="section-label mb-2 block" style={{ color: "var(--brand)" }}>Suggested Actions</span>
              <p style={{ fontSize: 13.5, color: "var(--brand)", lineHeight: 1.5, fontWeight: 500 }} className="m-0">{dna.suggested_action}</p>
            </div>

            {/* Flags */}
            {dna.flags.length > 0 && (
              <div className="card col-span-3 overflow-hidden">
                <div className="panel-header">
                  <span className="panel-header-title">System Anomalies & Flags ({dna.flags.length})</span>
                </div>
                <div className="p-5 space-y-2.5">
                  {dna.flags.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs p-3 rounded bg-[var(--danger-bg)] border border-[var(--danger-border)]">
                      <AlertTriangle className="w-4 h-4 text-[var(--danger)] flex-shrink-0 mt-0.5" />
                      <span className="text-[var(--danger-text)] font-medium">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "dna" && !dna && (
          <div className="card p-12 flex flex-col items-center justify-center text-center">
            <span className="section-label mb-4">Decision DNA™</span>
            <p className="text-xs text-[var(--text-muted)]">Decision data is not calculated. Reprocess document to generate.</p>
          </div>
        )}

        {tab === "validation" && (
          <div className="card overflow-hidden">
            <div className="panel-header">
              <span className="panel-header-title">Rules Engine checks</span>
            </div>
            {invoice.validation_results.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8"></th>
                    <th>Audit Rule Check</th>
                    <th>Severity Level</th>
                    <th>Result Evidence Log</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.validation_results.map((v, i) => (
                    <tr key={i}>
                      <td>
                        {v.status === "PASS" && <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />}
                        {v.status === "FAIL" && <XCircle className="w-4 h-4 text-[var(--danger)]" />}
                        {v.status === "WARN" && <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />}
                      </td>
                      <td>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }} className="capitalize">
                          {v.rule_name.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${v.severity === "CRITICAL" ? "badge-danger" : v.severity === "WARNING" ? "badge-warning" : "badge-neutral"}`}>
                          {v.severity}
                        </span>
                      </td>
                      <td className="text-xs max-w-md">{v.evidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p className="empty-state-title">No audit checks executed</p>
              </div>
            )}
          </div>
        )}

        {tab === "audit" && (
          <div className="card overflow-hidden">
            <div className="panel-header">
              <span className="panel-header-title">Operations Audit log trail</span>
            </div>
            {invoice.audit_trail.length > 0 ? (
              <div className="divide-y divide-[var(--border-default)]">
                {invoice.audit_trail.map((event, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-4 hover:bg-[var(--surface-1)] transition-colors">
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--brand)] flex-shrink-0" />
                    <div className="flex-1">
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }} className="m-0">{event.action}</p>
                      <p className="text-xs text-[var(--text-secondary)] m-0 mt-0.5">
                        Actor: <span style={{ textTransform: "capitalize" }}>{event.actor}</span> · Event: <code>{event.event_type}</code>
                      </p>
                    </div>
                    <span className="text-[11px] text-[var(--text-secondary)] mono font-medium">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p className="empty-state-title">Audit trail empty</p>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Line Items Table */}
      {invoice.line_items.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card overflow-hidden mt-6">
          <div className="panel-header">
            <span className="panel-header-title">Document Content Line Items ({invoice.line_items.length})</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="text-right">Quantity</th>
                <th className="text-right">Unit Rate</th>
                <th className="text-right">Line Total</th>
                <th className="text-right">OCR Confidence</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item, i) => (
                <tr key={i}>
                  <td>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-heading)" }}>
                      {item.description || "—"}
                    </span>
                  </td>
                  <td className="text-right mono">{item.quantity || "—"}</td>
                  <td className="text-right mono">₹{item.unit_price?.toLocaleString() || "—"}</td>
                  <td className="text-right mono font-semibold text-[var(--text-heading)]">₹{item.amount?.toLocaleString() || "—"}</td>
                  <td className="text-right">
                    <span className="mono font-semibold" style={{
                      color: item.confidence >= 0.85 ? "var(--success)" : item.confidence >= 0.5 ? "var(--warning)" : "var(--danger)"
                    }}>
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}
