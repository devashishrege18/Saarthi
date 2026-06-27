"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Shield,
  Loader2,
  FileText,
} from "lucide-react";
import { getReviewQueue, submitReview, getInvoice, type Invoice, type ReviewRequest } from "@/lib/api";

export default function ReviewPage() {
  const [queue, setQueue] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const loadQueue = useCallback(() => {
    setLoading(true);
    getReviewQueue()
      .then(setQueue)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const selectInvoice = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setShowRejectForm(false);
    setRejectReason("");
    try {
      const inv = await getInvoice(id);
      setSelectedInvoice(inv);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAction = async (action: "APPROVE" | "REJECT") => {
    if (!selectedId) return;
    if (action === "REJECT" && !rejectReason.trim()) {
      setShowRejectForm(true);
      return;
    }

    setActionLoading(true);
    try {
      await submitReview(selectedId, {
        action,
        reason: action === "REJECT" ? rejectReason : "Approved by reviewer",
      });
      setSelectedId(null);
      setSelectedInvoice(null);
      setShowRejectForm(false);
      setRejectReason("");
      loadQueue();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-0.5">Review Queue</h1>
        <p className="text-[13px] text-[var(--text-tertiary)]">
          {queue.length} invoice{queue.length !== 1 ? "s" : ""} pending human review
        </p>
      </motion.div>

      <div className="grid grid-cols-5 gap-4" style={{ minHeight: "calc(100vh - 200px)" }}>
        {/* Queue List */}
        <div className="col-span-2 card overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <p className="section-label">Pending Review</p>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : queue.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="w-10 h-10 text-[var(--success)] opacity-30 mb-3" />
              <p className="text-[14px] font-medium text-[var(--text-primary)] mb-1">All clear</p>
              <p className="text-[12px] text-[var(--text-muted)]">No invoices pending review</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
              {queue.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => selectInvoice(inv.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    selectedId === inv.id ? "bg-[var(--bg-hover)]" : "hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                      {inv.vendor_name || inv.file_name}
                    </span>
                    {inv.trust_score !== null && (
                      <span className="text-[11px] mono font-medium text-[var(--warning-text)]">
                        {Math.round(inv.trust_score * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {inv.invoice_number || "—"} · {inv.total_amount ? `₹${inv.total_amount.toLocaleString()}` : "—"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="col-span-3 card overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {!selectedId ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center py-16">
                <ClipboardCheck className="w-10 h-10 text-[var(--text-muted)] opacity-15 mb-3" />
                <p className="text-[13px] text-[var(--text-muted)]">Select an invoice to review</p>
              </motion.div>
            ) : detailLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
              </div>
            ) : selectedInvoice ? (
              <motion.div key={selectedId} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{selectedInvoice.vendor_name || selectedInvoice.file_name}</h2>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {selectedInvoice.invoice_number || "—"} · {selectedInvoice.invoice_date || "—"} · ₹{selectedInvoice.total_amount?.toLocaleString() || "—"}
                      </p>
                    </div>
                    <Link href={`/invoices/${selectedId}`} className="btn btn-ghost btn-sm">
                      <Eye className="w-3 h-3" /> Full Detail
                    </Link>
                  </div>
                </div>

                {/* Decision DNA Summary */}
                <div className="flex-1 overflow-y-auto">
                  {selectedInvoice.decision_dna && (
                    <div className="p-5 space-y-4">
                      {/* Trust + Flags Summary */}
                      <div className="flex items-center gap-4 p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                        <Shield className="w-8 h-8 text-[var(--warning)]" />
                        <div>
                          <p className="text-[13px] font-medium text-[var(--text-primary)]">
                            Trust Score: {Math.round(selectedInvoice.decision_dna.trust_score * 100)}% · {selectedInvoice.decision_dna.confidence_level}
                          </p>
                          <p className="text-[12px] text-[var(--text-tertiary)]">{selectedInvoice.decision_dna.reason}</p>
                        </div>
                      </div>

                      {/* Evidence */}
                      <div>
                        <p className="section-label mb-2">Evidence Chain</p>
                        <div className="space-y-1.5">
                          {selectedInvoice.decision_dna.evidence.map((e, i) => {
                            const isPass = e.startsWith("✓");
                            const isFail = e.startsWith("✗");
                            return (
                              <div key={i} className="flex items-start gap-2 text-[12px]">
                                {isPass ? <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success-text)] mt-0.5 flex-shrink-0" /> :
                                 isFail ? <XCircle className="w-3.5 h-3.5 text-[var(--danger-text)] mt-0.5 flex-shrink-0" /> :
                                 <AlertTriangle className="w-3.5 h-3.5 text-[var(--warning-text)] mt-0.5 flex-shrink-0" />}
                                <span className="text-[var(--text-secondary)]">{e.replace(/^[✓✗⚠]\s*/, "")}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Flags */}
                      {selectedInvoice.decision_dna.flags.length > 0 && (
                        <div>
                          <p className="section-label mb-2">Flags</p>
                          <div className="space-y-1.5">
                            {selectedInvoice.decision_dna.flags.map((f, i) => (
                              <div key={i} className="flex items-start gap-2 text-[12px] p-2 rounded bg-[var(--warning-muted)]">
                                <AlertTriangle className="w-3.5 h-3.5 text-[var(--warning-text)] mt-0.5 flex-shrink-0" />
                                <span className="text-[var(--warning-text)]">{f}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested Action */}
                      <div className="p-3 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-muted)]">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--accent)] mb-1">Suggested Action</p>
                        <p className="text-[13px] text-[var(--text-secondary)]">{selectedInvoice.decision_dna.suggested_action}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Bar */}
                <div className="px-5 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  {showRejectForm ? (
                    <div className="space-y-3">
                      <textarea
                        className="input text-[13px]"
                        placeholder="Reason for rejection (required)..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                      />
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleAction("REJECT")} disabled={!rejectReason.trim() || actionLoading} className="btn btn-danger btn-sm">
                          {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                          Confirm Reject
                        </button>
                        <button onClick={() => { setShowRejectForm(false); setRejectReason(""); }} className="btn btn-ghost btn-sm">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleAction("APPROVE")} disabled={actionLoading} className="btn btn-success btn-sm">
                        {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Approve
                      </button>
                      <button onClick={() => setShowRejectForm(true)} disabled={actionLoading} className="btn btn-danger btn-sm">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
