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
  ExternalLink,
} from "lucide-react";
import { getInvoice, type Invoice } from "@/lib/api";

function decColor(d: string | null | undefined) {
  if (d === "AUTO_APPROVE" || d === "AUTO_APPROVED" || d === "HUMAN_APPROVED") return "var(--success)";
  if (d === "NEEDS_REVIEW") return "var(--warning)";
  return "var(--danger)";
}

function decLabel(d: string | null | undefined) {
  if (d === "AUTO_APPROVE" || d === "AUTO_APPROVED") return "Auto-Approved";
  if (d === "HUMAN_APPROVED") return "Approved by Reviewer";
  if (d === "NEEDS_REVIEW") return "Needs Review";
  if (d === "AUTO_REJECT" || d === "AUTO_REJECTED") return "Rejected";
  if (d === "HUMAN_REJECTED") return "Rejected by Reviewer";
  return d || "—";
}

function TrustGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score * circumference);
  const color = score >= 0.85 ? "var(--success)" : score >= 0.5 ? "var(--accent)" : "var(--danger)";

  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border-default)" strokeWidth="5" />
        <motion.circle
          cx="60" cy="60" r="54" fill="none"
          stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-[var(--text-primary)]">{pct}</span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-muted)]">Trust %</span>
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
        <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <p className="text-[var(--text-muted)] mb-4">Invoice not found</p>
        <Link href="/invoices" className="btn btn-ghost btn-sm">Back to Invoices</Link>
      </div>
    );
  }

  const dna = invoice.decision_dna;

  return (
    <div>
      {/* Back Nav */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
      </motion.div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card mb-4 overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderLeftWidth: 3, borderLeftColor: decColor(invoice.decision) }}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center">
              <FileText className="w-5 h-5 text-[var(--text-muted)]" />
            </div>
            <div>
              <h1 className="text-[17px] font-semibold text-[var(--text-primary)]">{invoice.vendor_name || invoice.file_name}</h1>
              <p className="text-[12px] text-[var(--text-tertiary)]">
                {invoice.invoice_number || "—"} · {invoice.invoice_date || "—"} · {invoice.file_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[12px] px-3 py-1 rounded-full font-medium" style={{
              background: decColor(invoice.decision) + "18",
              color: decColor(invoice.decision),
            }}>
              {decLabel(invoice.decision)}
            </span>
            {invoice.trust_score !== null && (
              <span className="text-2xl font-bold mono" style={{ color: decColor(invoice.decision) }}>
                {Math.round(invoice.trust_score * 100)}%
              </span>
            )}
          </div>
        </div>

        {/* Financial Data Grid */}
        <div className="grid grid-cols-6 divide-x divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
          {[
            { label: "Total", value: invoice.total_amount ? `₹${invoice.total_amount.toLocaleString()}` : "—" },
            { label: "Subtotal", value: invoice.subtotal ? `₹${invoice.subtotal.toLocaleString()}` : "—" },
            { label: "Tax", value: invoice.tax_amount ? `₹${invoice.tax_amount.toLocaleString()}` : "—" },
            { label: "Currency", value: invoice.currency || "—" },
            { label: "Due Date", value: invoice.due_date || "—" },
            { label: "PO #", value: invoice.po_number || "—" },
          ].map((item) => (
            <div key={item.label} className="px-5 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-0.5">{item.label}</p>
              <p className="text-[13px] font-medium text-[var(--text-primary)] mono">{item.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4">
        {[
          { key: "dna" as const, label: "Decision DNA™", icon: Dna },
          { key: "validation" as const, label: "Validation", icon: ClipboardList },
          { key: "audit" as const, label: "Audit Trail", icon: Clock },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-medium transition-colors ${
              tab === t.key
                ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-hover)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {tab === "dna" && dna && (
          <div className="grid grid-cols-3 gap-4">
            {/* Trust Score Gauge */}
            <div className="card p-6 flex flex-col items-center justify-center">
              <p className="section-label mb-4">Trust Score</p>
              <TrustGauge score={dna.trust_score} />
              <p className="text-[11px] text-[var(--text-tertiary)] mt-3 text-center">
                Confidence: <span className="font-medium text-[var(--text-secondary)]">{dna.confidence_level}</span>
              </p>
            </div>

            {/* Evidence Chain */}
            <div className="card col-span-2 overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
                <p className="section-label">Evidence Chain</p>
              </div>
              <div className="divide-y divide-[var(--border-subtle)]">
                {dna.evidence.map((e, i) => {
                  const isPass = e.startsWith("✓");
                  const isFail = e.startsWith("✗");
                  const isWarn = e.startsWith("⚠");
                  return (
                    <div key={i} className="px-5 py-3 flex items-start gap-3 text-[13px]">
                      {isPass && <CheckCircle2 className="w-4 h-4 text-[var(--success-text)] flex-shrink-0 mt-0.5" />}
                      {isFail && <XCircle className="w-4 h-4 text-[var(--danger-text)] flex-shrink-0 mt-0.5" />}
                      {isWarn && <AlertTriangle className="w-4 h-4 text-[var(--warning-text)] flex-shrink-0 mt-0.5" />}
                      {!isPass && !isFail && !isWarn && <Shield className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />}
                      <span className="text-[var(--text-secondary)]">
                        {e.replace(/^[✓✗⚠]\s*/, "")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Flags */}
            {dna.flags.length > 0 && (
              <div className="card col-span-3 overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
                  <p className="section-label">Flags</p>
                </div>
                <div className="p-5 space-y-2">
                  {dna.flags.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-[13px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-[var(--warning-text)] flex-shrink-0 mt-0.5" />
                      <span className="text-[var(--text-secondary)]">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reason + Action */}
            <div className="card col-span-2 p-5">
              <p className="section-label mb-2">Reason</p>
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{dna.reason}</p>
            </div>
            <div className="card p-5">
              <p className="section-label mb-2">Suggested Action</p>
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{dna.suggested_action}</p>
            </div>
          </div>
        )}

        {tab === "dna" && !dna && (
          <div className="card p-12 flex flex-col items-center justify-center">
            <Dna className="w-8 h-8 text-[var(--text-muted)] opacity-20 mb-3" />
            <p className="text-[13px] text-[var(--text-muted)]">Decision DNA™ not yet generated</p>
          </div>
        )}

        {tab === "validation" && (
          <div className="card overflow-hidden">
            {invoice.validation_results.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8"></th>
                    <th>Rule</th>
                    <th>Severity</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.validation_results.map((v, i) => (
                    <tr key={i}>
                      <td>
                        {v.status === "PASS" && <CheckCircle2 className="w-4 h-4 text-[var(--success-text)]" />}
                        {v.status === "FAIL" && <XCircle className="w-4 h-4 text-[var(--danger-text)]" />}
                        {v.status === "WARN" && <AlertTriangle className="w-4 h-4 text-[var(--warning-text)]" />}
                      </td>
                      <td className="font-medium text-[var(--text-primary)] capitalize">{v.rule_name.replace(/_/g, " ")}</td>
                      <td><span className={`badge ${v.severity === "CRITICAL" ? "badge-danger" : v.severity === "WARNING" ? "badge-warning" : "badge-neutral"}`}>{v.severity}</span></td>
                      <td className="text-[12px] max-w-md">{v.evidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center">
                <ClipboardList className="w-8 h-8 text-[var(--text-muted)] opacity-20 mb-3" />
                <p className="text-[13px] text-[var(--text-muted)]">No validation results yet</p>
              </div>
            )}
          </div>
        )}

        {tab === "audit" && (
          <div className="card overflow-hidden">
            {invoice.audit_trail.length > 0 ? (
              <div className="divide-y divide-[var(--border-subtle)]">
                {invoice.audit_trail.map((event, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent)] flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-[13px] text-[var(--text-primary)]">{event.action}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {event.actor} · {event.event_type}
                      </p>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] mono">
                      {new Date(event.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center">
                <Clock className="w-8 h-8 text-[var(--text-muted)] opacity-20 mb-3" />
                <p className="text-[13px] text-[var(--text-muted)]">No audit events yet</p>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Line Items */}
      {invoice.line_items.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card overflow-hidden mt-4">
          <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
            <p className="section-label">Line Items ({invoice.line_items.length})</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item, i) => (
                <tr key={i}>
                  <td className="text-[var(--text-primary)]">{item.description || "—"}</td>
                  <td className="text-right mono">{item.quantity || "—"}</td>
                  <td className="text-right mono">₹{item.unit_price?.toLocaleString() || "—"}</td>
                  <td className="text-right mono font-medium text-[var(--text-primary)]">₹{item.amount?.toLocaleString() || "—"}</td>
                  <td className="text-right">
                    <span className="mono text-[12px]" style={{
                      color: item.confidence >= 0.85 ? "var(--success-text)" : item.confidence >= 0.5 ? "var(--warning-text)" : "var(--danger-text)"
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
