"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Shield,
  ChevronRight,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { uploadInvoice, processInvoice, type Invoice } from "@/lib/api";
import Link from "next/link";

type Stage = "idle" | "uploading" | "extracting" | "validating" | "deciding" | "complete" | "error";

const STAGES: { key: Stage; label: string }[] = [
  { key: "uploading", label: "Upload" },
  { key: "extracting", label: "Extract" },
  { key: "validating", label: "Validate" },
  { key: "deciding", label: "Decide" },
];

export default function UploadPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setError(null);
    setResult(null);

    try {
      setStage("uploading");
      const invoice = await uploadInvoice(file);

      setStage("extracting");
      const processed = await processInvoice(invoice.id);
      
      setStage("validating");
      await new Promise((r) => setTimeout(r, 300));
      
      setStage("deciding");
      await new Promise((r) => setTimeout(r, 300));

      setStage("complete");
      setResult(processed);
    } catch (err: unknown) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Processing failed");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); },
    [processFile]
  );

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processFile(f); },
    [processFile]
  );

  const reset = () => { setStage("idle"); setResult(null); setError(null); setFileName(""); };

  const decColor = (d: string | null) => d === "AUTO_APPROVE" ? "var(--success)" : d === "NEEDS_REVIEW" ? "var(--warning)" : d === "AUTO_REJECT" ? "var(--danger)" : "var(--text-muted)";
  const decBg = (d: string | null) => d === "AUTO_APPROVE" ? "var(--success-muted)" : d === "NEEDS_REVIEW" ? "var(--warning-muted)" : d === "AUTO_REJECT" ? "var(--danger-muted)" : "var(--bg-elevated)";
  const decLabel = (d: string | null) => d === "AUTO_APPROVE" ? "Auto-Approved" : d === "NEEDS_REVIEW" ? "Needs Review" : d === "AUTO_REJECT" ? "Rejected" : "—";

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-8">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-0.5">Upload Invoice</h1>
        <p className="text-[13px] text-[var(--text-tertiary)]">Process a financial document through the SAARTHI pipeline</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {stage === "idle" ? (
          <motion.label
            key="dropzone"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className={`card border-dashed border-2 p-14 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
              dragOver ? "border-[var(--accent)] bg-[var(--accent-subtle)]" : "border-[var(--border-default)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.xls,.xlsx,.csv" onChange={handleSelect} />
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center mb-5">
              <Upload className="w-5 h-5 text-[var(--text-tertiary)]" />
            </div>
            <p className="text-[15px] font-medium text-[var(--text-primary)] mb-1.5">Drop your invoice here</p>
            <p className="text-[13px] text-[var(--text-tertiary)] mb-3">or click to browse</p>
            <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
              <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)]">PDF</span>
              <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)]">PNG</span>
              <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)]">JPEG</span>
              <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)]">Excel</span>
              <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)]">CSV</span>
              <span className="text-[var(--text-muted)]">· max 20MB</span>
            </div>
          </motion.label>

        ) : stage === "complete" && result ? (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-4">
            {/* Decision Header */}
            <div className="card overflow-hidden">
              <div className="px-6 py-5 flex items-center justify-between border-b border-[var(--border-subtle)]" style={{ borderLeftWidth: 3, borderLeftColor: decColor(result.decision) }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: decBg(result.decision) }}>
                    {result.decision === "AUTO_APPROVE" && <CheckCircle2 className="w-5 h-5" style={{ color: decColor(result.decision) }} />}
                    {result.decision === "NEEDS_REVIEW" && <AlertTriangle className="w-5 h-5" style={{ color: decColor(result.decision) }} />}
                    {result.decision === "AUTO_REJECT" && <XCircle className="w-5 h-5" style={{ color: decColor(result.decision) }} />}
                    {!result.decision && <FileText className="w-5 h-5 text-[var(--text-muted)]" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 mb-0.5">
                      <span className="text-[15px] font-semibold text-[var(--text-primary)]">{result.vendor_name || "Unknown Vendor"}</span>
                      <span className="text-[12px] px-2 py-0.5 rounded-full font-medium" style={{ background: decBg(result.decision), color: decColor(result.decision) }}>
                        {decLabel(result.decision)}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--text-tertiary)]">
                      {result.invoice_number || "—"} · {result.invoice_date || "—"} · {fileName}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-0.5">Trust Score</p>
                  <p className="text-3xl font-bold tracking-tight" style={{ color: decColor(result.decision) }}>
                    {result.trust_score !== null ? `${Math.round(result.trust_score * 100)}` : "—"}
                    <span className="text-lg text-[var(--text-muted)]">%</span>
                  </p>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-4 divide-x divide-[var(--border-subtle)]">
                {[
                  { label: "Total Amount", value: result.total_amount ? `${result.currency || "₹"} ${result.total_amount.toLocaleString()}` : "—" },
                  { label: "Subtotal", value: result.subtotal ? `${result.currency || "₹"} ${result.subtotal.toLocaleString()}` : "—" },
                  { label: "Tax", value: result.tax_amount ? `${result.currency || "₹"} ${result.tax_amount.toLocaleString()}` : "—" },
                  { label: "Due Date", value: result.due_date || "—" },
                ].map((item) => (
                  <div key={item.label} className="px-6 py-4">
                    <p className="section-label mb-1">{item.label}</p>
                    <p className="text-[14px] font-medium text-[var(--text-primary)] mono">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5">
              <Link href={`/invoices/${result.id}`} className="btn btn-primary">
                View Decision DNA™
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              {result.decision === "NEEDS_REVIEW" && (
                <Link href="/review" className="btn btn-accent">
                  Go to Review Queue
                </Link>
              )}
              <button onClick={reset} className="btn btn-ghost">
                <RotateCcw className="w-3.5 h-3.5" />
                Upload Another
              </button>
            </div>
          </motion.div>

        ) : stage === "error" ? (
          <motion.div key="error" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--danger-muted)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <XCircle className="w-4 h-4 text-[var(--danger)]" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-[var(--text-primary)] mb-1">Processing failed</p>
                <p className="text-[13px] text-[var(--text-tertiary)] mb-4">{error}</p>
                <button onClick={reset} className="btn btn-ghost btn-sm">
                  <RotateCcw className="w-3 h-3" /> Try Again
                </button>
              </div>
            </div>
          </motion.div>

        ) : (
          /* Processing State */
          <motion.div key="processing" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-10">
            <div className="flex flex-col items-center justify-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="mb-5">
                <Loader2 className="w-8 h-8 text-[var(--accent)]" />
              </motion.div>
              <p className="text-[14px] font-medium text-[var(--text-primary)] mb-1">
                {stage === "uploading" ? "Uploading document..." : stage === "extracting" ? "AI extracting fields..." : stage === "validating" ? "Running business rules..." : "Computing trust score..."}
              </p>
              <p className="text-[12px] text-[var(--text-muted)] mb-6">{fileName}</p>

              {/* Pipeline Progress */}
              <div className="flex items-center gap-1">
                {STAGES.map((s, i) => {
                  const idx = STAGES.findIndex((x) => x.key === stage);
                  const done = i < idx;
                  const active = i === idx;
                  return (
                    <div key={s.key} className="flex items-center gap-1">
                      <div className="flex flex-col items-center gap-1.5">
                        <motion.div
                          className={`w-2.5 h-2.5 rounded-full ${done ? "bg-[var(--success)]" : active ? "bg-[var(--accent)]" : "bg-[var(--border-default)]"}`}
                          animate={active ? { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] } : {}}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        />
                        <span className={`text-[9px] font-medium uppercase tracking-wider ${done ? "text-[var(--success-text)]" : active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
                          {s.label}
                        </span>
                      </div>
                      {i < STAGES.length - 1 && (
                        <div className={`w-16 h-px mb-4 ${done ? "bg-[var(--success)]" : "bg-[var(--border-default)]"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
