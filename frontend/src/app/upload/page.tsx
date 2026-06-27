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
  Layers,
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
      await new Promise((r) => setTimeout(r, 400));
      
      setStage("deciding");
      await new Promise((r) => setTimeout(r, 400));

      setStage("complete");
      setResult(processed);
    } catch (err: unknown) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Document processing failed");
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

  const decColor = (d: string | null) => d === "AUTO_APPROVE" || d === "AUTO_APPROVED" || d === "HUMAN_APPROVED" ? "var(--success)" : d === "NEEDS_REVIEW" ? "var(--warning)" : "var(--danger)";
  const decBg = (d: string | null) => d === "AUTO_APPROVE" || d === "AUTO_APPROVED" || d === "HUMAN_APPROVED" ? "var(--success-bg)" : d === "NEEDS_REVIEW" ? "var(--warning-bg)" : "var(--danger-bg)";
  const decBorder = (d: string | null) => d === "AUTO_APPROVE" || d === "AUTO_APPROVED" || d === "HUMAN_APPROVED" ? "var(--success-border)" : d === "NEEDS_REVIEW" ? "var(--warning-border)" : "var(--danger-border)";
  const decLabel = (d: string | null) => {
    if (d === "AUTO_APPROVE" || d === "AUTO_APPROVED") return "Auto-Approved";
    if (d === "HUMAN_APPROVED") return "Approved";
    if (d === "NEEDS_REVIEW") return "Needs Review";
    return "Rejected";
  };

  const isTimesheet = fileName.toLowerCase().includes("timesheet") || (result && (result.vendor_name || "").toLowerCase().includes("timesheet")) || fileName.toLowerCase().includes("data");

  return (
    <div style={{ maxWidth: 850, margin: "0 auto" }}>
      {/* Page Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="page-header">
        <div>
          <h1 className="page-title">Ingest Financial Document</h1>
          <p className="page-subtitle">Upload digital/scanned invoices or timesheets to execute structured AI processing.</p>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {stage === "idle" ? (
          <motion.label
            key="dropzone"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`card flex flex-col items-center justify-center cursor-pointer transition-all duration-150 p-16 text-center ${
              dragOver ? "bg-[var(--brand-light)] border-[var(--brand)]" : "hover:bg-[var(--surface-1)] border-[var(--border-strong)]"
            }`}
            style={{ 
              borderStyle: "dashed", 
              borderWidth: 2,
              minHeight: 280 
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.xls,.xlsx,.csv,.txt" onChange={handleSelect} />
            <div className="w-12 h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border-default)] flex items-center justify-center mb-5">
              <Upload className="w-5 h-5 text-[var(--brand)]" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-heading)", marginBottom: 4 }}>
              Drag and drop document here
            </p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              or click to browse local files
            </p>
            <div className="flex items-center justify-center gap-2.5 text-[11px] text-[var(--text-muted)] font-medium">
              <span className="px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-default)]">PDF</span>
              <span className="px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-default)]">PNG / JPG</span>
              <span className="px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-default)]">Spreadsheet</span>
              <span className="px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-default)]">TXT</span>
              <span>· max 20MB</span>
            </div>
          </motion.label>

        ) : stage === "complete" && result ? (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
            {/* Decision Header */}
            <div className="card overflow-hidden">
              <div 
                className="px-6 py-5 flex items-center justify-between border-b border-[var(--border-default)]" 
                style={{ 
                  borderLeft: `4px solid ${decColor(result.decision)}`,
                  background: "var(--surface-0)"
                }}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center border" 
                    style={{ 
                      background: decBg(result.decision), 
                      borderColor: decBorder(result.decision),
                      color: decColor(result.decision)
                    }}
                  >
                    {result.decision === "AUTO_APPROVE" || result.decision === "AUTO_APPROVED" || result.decision === "HUMAN_APPROVED" ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : result.decision === "NEEDS_REVIEW" ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-heading)" }}>
                        {result.vendor_name || "Unknown Sender"}
                      </span>
                      <span className={`badge ${
                        result.decision === "AUTO_APPROVE" || result.decision === "AUTO_APPROVED" || result.decision === "HUMAN_APPROVED"
                          ? "badge-success" 
                          : result.decision === "NEEDS_REVIEW"
                          ? "badge-warning"
                          : "badge-danger"
                      }`}>
                        {decLabel(result.decision)}
                      </span>
                      {isTimesheet && (
                        <span className="badge badge-brand">Timesheet</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] m-0">
                      Doc ID: <span className="mono">{result.invoice_number || "—"}</span> · Ingested: {result.invoice_date || "—"} · Filename: {fileName}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="section-label mb-0.5">Trust Score</p>
                  <p className="text-3xl font-bold tracking-tight m-0" style={{ color: decColor(result.decision) }}>
                    {result.trust_score !== null ? `${Math.round(result.trust_score * 100)}` : "—"}
                    <span style={{ fontSize: 14, color: "var(--text-muted)", marginLeft: 2 }}>%</span>
                  </p>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-4 divide-x divide-[var(--border-default)] bg-[var(--surface-1)]">
                {[
                  { label: "Total Amount", value: result.total_amount ? `${result.currency || "₹"} ${result.total_amount.toLocaleString()}` : "—" },
                  { label: "Subtotal Value", value: result.subtotal ? `${result.currency || "₹"} ${result.subtotal.toLocaleString()}` : "—" },
                  { label: "Tax Liability", value: result.tax_amount ? `${result.currency || "₹"} ${result.tax_amount.toLocaleString()}` : "—" },
                  { label: "Payment Term", value: result.payment_terms || "—" },
                ].map((item) => (
                  <div key={item.label} className="px-6 py-4">
                    <p className="section-label mb-1">{item.label}</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }} className="mono m-0">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center gap-3">
              <Link href={`/invoices/${result.id}`} className="btn btn-primary flex items-center gap-1.5">
                View Decision DNA™
                <ArrowRight className="w-4 h-4" />
              </Link>
              {result.decision === "NEEDS_REVIEW" && (
                <Link href="/review" className="btn btn-secondary">
                  Go to Review Queue
                </Link>
              )}
              <button onClick={reset} className="btn btn-secondary flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                Ingest Another
              </button>
            </div>
          </motion.div>

        ) : stage === "error" ? (
          <motion.div key="error" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-[var(--danger)]" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)", marginBottom: 4 }}>Ingestion Processing Failure</p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>{error}</p>
                <button onClick={reset} className="btn btn-secondary btn-sm flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" /> Retry Upload
                </button>
              </div>
            </div>
          </motion.div>

        ) : (
          /* Pipeline Processing State */
          <motion.div key="processing" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} className="mb-6">
                <Loader2 className="w-8 h-8 text-[var(--brand)]" />
              </motion.div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-heading)", marginBottom: 4 }}>
                {stage === "uploading" ? "Transferring document..." : stage === "extracting" ? "Executing selective AI parsing..." : stage === "validating" ? "Applying deterministic validation rules..." : "Assembling trust calculations..."}
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 32 }}>{fileName}</p>

              {/* Pipeline Progress Steps */}
              <div className="flex items-center gap-2 bg-[var(--surface-1)] border border-[var(--border-default)] p-5 rounded-lg" style={{ width: "100%", maxWidth: 640 }}>
                {STAGES.map((s, i) => {
                  const idx = STAGES.findIndex((x) => x.key === stage);
                  const done = i < idx;
                  const active = i === idx;
                  return (
                    <div key={s.key} className="flex-1 flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                            done ? "bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success-border)]" : active ? "bg-[var(--brand-light)] text-[var(--brand)] border border-[var(--brand)] animate-pulse" : "bg-[var(--surface-3)] text-[var(--text-secondary)] border border-[var(--border-default)]"
                          }`}
                        >
                          {i + 1}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: active ? 600 : 500 }} className={done ? "text-[var(--success-text)]" : active ? "text-[var(--brand)]" : "text-[var(--text-secondary)]"}>
                          {s.label}
                        </span>
                      </div>
                      {i < STAGES.length - 1 && (
                        <div className="flex-1 h-px bg-[var(--border-strong)] min-w-[20px]" />
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
