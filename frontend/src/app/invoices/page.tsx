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
    { value: "", label: "All" },
    { value: "AUTO_APPROVED", label: "Approved" },
    { value: "NEEDS_REVIEW", label: "Review" },
    { value: "AUTO_REJECTED", label: "Rejected" },
  ];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-0.5">Invoices</h1>
          <p className="text-[13px] text-[var(--text-tertiary)]">
            {data ? `${data.total} invoice${data.total !== 1 ? "s" : ""} processed` : "Loading..."}
          </p>
        </div>
        <Link href="/upload" className="btn btn-primary btn-sm">Upload</Link>
      </motion.div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 mb-4">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => { setLoading(true); setFilter(f.value); }}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              filter === f.value
                ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-hover)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-transparent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }} className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-4 w-16" />
              </div>
            ))}
          </div>
        ) : data && data.invoices.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Invoice #</th>
                <th>Amount</th>
                <th>Trust</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((inv, i) => {
                const info = getStatusInfo(inv.status);
                return (
                  <motion.tr
                    key={inv.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <td>
                      <span className="text-[var(--text-primary)] font-medium">
                        {inv.vendor_name || inv.file_name}
                      </span>
                    </td>
                    <td className="mono text-[12px]">{inv.invoice_number || "—"}</td>
                    <td className="mono font-medium text-[var(--text-primary)]">
                      {inv.total_amount ? `₹${inv.total_amount.toLocaleString()}` : "—"}
                    </td>
                    <td>
                      {inv.trust_score !== null ? (
                        <span className="mono text-[12px] font-medium" style={{
                          color: inv.trust_score >= 0.85 ? "var(--success-text)" : inv.trust_score >= 0.5 ? "var(--warning-text)" : "var(--danger-text)"
                        }}>
                          {Math.round(inv.trust_score * 100)}%
                        </span>
                      ) : "—"}
                    </td>
                    <td><span className={`badge ${info.badge}`}>{info.label}</span></td>
                    <td className="text-[12px]">{inv.invoice_date || inv.created_at?.slice(0, 10) || "—"}</td>
                    <td>
                      <Link href={`/invoices/${inv.id}`} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="w-8 h-8 text-[var(--text-muted)] opacity-20 mb-3" />
            <p className="text-[13px] text-[var(--text-muted)] mb-3">No invoices found</p>
            <Link href="/upload" className="btn btn-ghost btn-sm">Upload Invoice</Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
