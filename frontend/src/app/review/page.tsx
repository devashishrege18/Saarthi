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
  Layers,
} from "lucide-react";
import { getReviewQueue, submitReview, getInvoice, type Invoice } from "@/lib/api";

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
      {/* Page Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="page-header">
        <div>
          <h1 className="page-title">Human Verification Queue</h1>
          <p className="page-subtitle">
            {queue.length} invoice{queue.length !== 1 ? "s" : ""} requiring operational review.
          </p>
        </div>
      </motion.div>

      {/* Two Panel Layout */}
      <div style={{ display: "flex", gap: 24, minHeight: "calc(100vh - 220px)" }}>
        {/* Left Side: Pending Queue */}
        <div className="card flex flex-col" style={{ width: 340, flexShrink: 0, overflow: "hidden" }}>
          <div className="panel-header">
            <span className="panel-header-title">Pending Escalate Queue</span>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-16 w-full rounded" />
              ))}
            </div>
          ) : queue.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center px-4">
              <CheckCircle2 className="w-8 h-8 text-[var(--success)] opacity-30 mb-3" />
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }} className="m-0 mb-1">Queue cleared</p>
              <p className="text-xs text-[var(--text-secondary)] m-0">All invoices processed autonomously.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-default)]">
              {queue.map((inv) => {
                const isSelected = selectedId === inv.id;
                const isTimesheet = (inv.vendor_name || inv.file_name || "").toLowerCase().includes("timesheet") || inv.file_name.toLowerCase().includes("timesheet") || inv.file_name.toLowerCase().includes("data");
                return (
                  <button
                    key={inv.id}
                    onClick={() => selectInvoice(inv.id)}
                    className="w-full text-left px-5 py-4 transition-colors flex flex-col gap-1 border-0"
                    style={{
                      background: isSelected ? "var(--surface-1)" : "var(--surface-0)",
                      borderLeft: isSelected ? "3px solid var(--brand)" : "none",
                      paddingLeft: isSelected ? 17 : 20
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }} className="truncate">
                        {inv.vendor_name || inv.file_name}
                      </span>
                      {inv.trust_score !== null && (
                        <span className="text-xs mono font-semibold text-[var(--warning-text)]">
                          {Math.round(inv.trust_score * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-secondary)]">
                        {inv.invoice_number || "—"} · {inv.total_amount ? `₹${inv.total_amount.toLocaleString()}` : "—"}
                      </span>
                      {isTimesheet && (
                        <span className="badge badge-brand" style={{ fontSize: 8 }}>Timesheet</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Detail Panel */}
        <div className="card flex-1 overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {!selectedId ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center p-12">
                <div className="empty-state-icon">
                  <ClipboardCheck className="w-6 h-6 text-[var(--text-secondary)]" />
                </div>
                <p className="empty-state-title">No Document Selected</p>
                <p className="empty-state-desc">Select an item from the queue list to perform verification review.</p>
              </motion.div>
            ) : detailLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-[var(--brand)] animate-spin" />
              </div>
            ) : selectedInvoice ? (
              <motion.div key={selectedId} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col overflow-hidden">
                {/* Panel Header */}
                <div className="px-6 py-5 border-b border-[var(--border-default)] flex items-center justify-between">
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-heading)" }} className="m-0">
                      {selectedInvoice.vendor_name || selectedInvoice.file_name}
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] m-0 mt-0.5">
                      Ref ID: <span className="mono">{selectedInvoice.invoice_number || "—"}</span> · Ingest Date: {selectedInvoice.invoice_date || "—"} · Total: ₹{selectedInvoice.total_amount?.toLocaleString() || "—"}
                    </p>
                  </div>
                  <Link href={`/invoices/${selectedId}`} className="btn btn-secondary btn-sm flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Full Audit Detail
                  </Link>
                </div>

                {/* Evidence & Decision DNA Summary */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {selectedInvoice.decision_dna && (
                    <>
                      {/* Trust index box */}
                      <div className="p-4 rounded-lg bg-[var(--surface-1)] border border-[var(--border-default)] flex items-center gap-4">
                        <Shield className="w-8 h-8 text-[var(--warning)]" />
                        <div>
                          <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-heading)" }} className="m-0">
                            Trust Index Score: {Math.round(selectedInvoice.decision_dna.trust_score * 100)}% ({selectedInvoice.decision_dna.confidence_level})
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] m-0 mt-0.5">{selectedInvoice.decision_dna.reason}</p>
                        </div>
                      </div>

                      {/* Evidence */}
                      <div>
                        <span className="section-label mb-2 block">System Reason Verification</span>
                        <div className="space-y-2">
                          {selectedInvoice.decision_dna.evidence.map((e, i) => {
                            const isPass = e.startsWith("✓");
                            const isFail = e.startsWith("✗");
                            return (
                              <div key={i} className="flex items-start gap-2.5 text-xs">
                                {isPass ? (
                                  <CheckCircle2 className="w-4 h-4 text-[var(--success)] flex-shrink-0 mt-0.5" />
                                ) : isFail ? (
                                  <XCircle className="w-4 h-4 text-[var(--danger)] flex-shrink-0 mt-0.5" />
                                ) : (
                                  <AlertTriangle className="w-4 h-4 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                                )}
                                <span className="text-[var(--text-body)]">{e.replace(/^[✓✗⚠]\s*/, "")}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Flags */}
                      {selectedInvoice.decision_dna.flags.length > 0 && (
                        <div>
                          <span className="section-label mb-2 block">Triggered Anomalies</span>
                          <div className="space-y-2">
                            {selectedInvoice.decision_dna.flags.map((f, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs p-2.5 rounded bg-[var(--danger-bg)] border border-[var(--danger-border)]">
                                <AlertTriangle className="w-4 h-4 text-[var(--danger)] flex-shrink-0 mt-0.5" />
                                <span className="text-[var(--danger-text)] font-semibold">{f}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested Action */}
                      <div className="p-3.5 rounded-lg bg-[var(--brand-light)] border border-rgba(0,82,204,0.18)">
                        <span className="section-label mb-1 block" style={{ color: "var(--brand)" }}>Suggested Action</span>
                        <p style={{ fontSize: 13, color: "var(--brand)", fontWeight: 500 }} className="m-0">{selectedInvoice.decision_dna.suggested_action}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Review Queue Actions Bar */}
                <div className="px-6 py-4 border-t border-[var(--border-default)] bg-[var(--surface-1)]">
                  {showRejectForm ? (
                    <div className="space-y-3">
                      <textarea
                        className="input text-xs"
                        placeholder="Define audit rejection reason (required)..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={3}
                      />
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleAction("REJECT")} 
                          disabled={!rejectReason.trim() || actionLoading} 
                          className="btn btn-danger btn-sm flex items-center gap-1.5"
                        >
                          {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                          Confirm Rejection
                        </button>
                        <button 
                          onClick={() => { setShowRejectForm(false); setRejectReason(""); }} 
                          className="btn btn-secondary btn-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleAction("APPROVE")} 
                        disabled={actionLoading} 
                        className="btn btn-success btn-sm flex items-center gap-1.5"
                      >
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Approve Payment
                      </button>
                      <button 
                        onClick={() => setShowRejectForm(true)} 
                        disabled={actionLoading} 
                        className="btn btn-danger btn-sm flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject Payment
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
