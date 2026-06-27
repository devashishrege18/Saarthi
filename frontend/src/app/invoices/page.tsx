"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ChevronRight,
  Search,
  Layers,
} from "lucide-react";
import { listInvoices, type Invoice, type InvoiceListResponse } from "@/lib/api";

function getStatusInfo(status: string) {
  switch (status) {
    case "AUTO_APPROVED": return { badge: "badge-success", label: "Approved" };
    case "HUMAN_APPROVED": return { badge: "badge-success", label: "Approved (H)" };
    case "NEEDS_REVIEW": return { badge: "badge-warning", label: "Review" };
    case "AUTO_REJECTED": return { badge: "badge-danger", label: "Rejected" };
    case "HUMAN_REJECTED": return { badge: "badge-danger", label: "Rejected (H)" };
    case "EXTRACTING": case "VALIDATING": return { badge: "badge-info", label: "Processing" };
    default: return { badge: "badge-neutral", label: status.replace(/_/g, " ") };
  }
}

export default function InvoicesPage() {
  const [data, setData] = useState<InvoiceListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    listInvoices(filter || undefined, 1, 50)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  const filters = [
    { value: "", label: "All Documents" },
    { value: "AUTO_APPROVED", label: "Approved" },
    { value: "NEEDS_REVIEW", label: "Needs Review" },
    { value: "AUTO_REJECTED", label: "Rejected" },
  ];

  return (
    <div>
      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: -8 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.3 }} 
        className="page-header"
      >
        <div>
          <h1 className="page-title">Document Ledger</h1>
          <p className="page-subtitle">
            {data ? `${data.total} document${data.total !== 1 ? "s" : ""} indexed` : "Loading ledger..."}
          </p>
        </div>
        <Link href="/upload" className="btn btn-primary btn-sm">Upload Invoice</Link>
      </motion.div>

      {/* Toolbar & Filters */}
      <div className="card mb-6" style={{ overflow: "hidden" }}>
        <div className="toolbar flex items-center justify-between">
          <div className="flex items-center gap-2">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => { setLoading(true); setFilter(f.value); }}
                className={`filter-pill ${filter === f.value ? 'active' : ''}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-6 items-center">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-4 w-16" />
                <div className="skeleton h-4 w-28" />
              </div>
            ))}
          </div>
        ) : data && data.invoices.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Document Source</th>
                <th>Type</th>
                <th>Reference #</th>
                <th>Total Value</th>
                <th>Trust Score</th>
                <th>Workflow Status</th>
                <th>Ingestion Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((inv, i) => {
                const info = getStatusInfo(inv.status);
                const isTimesheet = (inv.vendor_name || inv.file_name || "").toLowerCase().includes("timesheet") || inv.file_name.toLowerCase().includes("timesheet") || inv.file_name.toLowerCase().includes("data");
                return (
                  <motion.tr
                    key={inv.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <td>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>
                        {inv.vendor_name || inv.file_name}
                      </span>
                    </td>
                    <td>
                      {isTimesheet ? (
                        <span className="badge badge-brand" style={{ fontSize: 9.5 }}>Timesheet</span>
                      ) : (
                        <span className="badge badge-neutral" style={{ fontSize: 9.5 }}>Invoice</span>
                      )}
                    </td>
                    <td className="mono text-[12px]">{inv.invoice_number || "—"}</td>
                    <td className="mono font-semibold text-[var(--text-heading)]">
                      {inv.total_amount ? `₹${inv.total_amount.toLocaleString()}` : "—"}
                    </td>
                    <td>
                      {inv.trust_score !== null ? (
                        <span className="mono font-semibold" style={{
                          color: inv.trust_score >= 0.85 ? "var(--success)" : inv.trust_score >= 0.5 ? "var(--warning)" : "var(--danger)"
                        }}>
                          {Math.round(inv.trust_score * 100)}%
                        </span>
                      ) : "—"}
                    </td>
                    <td><span className={`badge ${info.badge}`}>{info.label}</span></td>
                    <td className="text-[12px]">{inv.invoice_date || inv.created_at?.slice(0, 10) || "—"}</td>
                    <td>
                      <Link 
                        href={`/invoices/${inv.id}`} 
                        className="btn btn-ghost btn-sm px-2"
                        style={{ minWidth: "auto" }}
                      >
                        <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                      </Link>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FileText className="w-6 h-6 text-[var(--text-muted)]" />
            </div>
            <p className="empty-state-title">No matching records</p>
            <p className="empty-state-desc">Try changing your filter settings or upload a new financial document.</p>
          </div>
        )}
      </div>
    </div>
  );
}
