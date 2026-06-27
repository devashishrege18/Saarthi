"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowUpRight,
  Clock,
  Shield,
  Layers,
} from "lucide-react";
import { getDashboardMetrics, type DashboardMetrics, type Invoice } from "@/lib/api";

function formatTimeAgo(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function getStatusInfo(status: string) {
  switch (status) {
    case "AUTO_APPROVED":
    case "HUMAN_APPROVED":
      return { badge: "badge-success", label: "Approved", icon: CheckCircle2 };
    case "NEEDS_REVIEW":
      return { badge: "badge-warning", label: "Review", icon: AlertTriangle };
    case "AUTO_REJECTED":
    case "HUMAN_REJECTED":
      return { badge: "badge-danger", label: "Rejected", icon: XCircle };
    default:
      return { badge: "badge-neutral", label: status.replace(/_/g, " "), icon: Clock };
  }
}

function TrustGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score * circumference);
  const color = score >= 0.85 ? "var(--success)" : score >= 0.5 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="relative w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-strong)" strokeWidth="6" />
        <motion.circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-[var(--text-heading)]">{pct}%</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Trust</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardMetrics()
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const kpis = metrics
    ? [
        {
          label: "Total Invoices",
          value: metrics.total_invoices,
          icon: FileText,
          color: "var(--brand)",
        },
        {
          label: "Approved",
          value: metrics.auto_approved + metrics.human_approved,
          icon: CheckCircle2,
          color: "var(--success)",
          sub: metrics.total_invoices > 0 ? `${metrics.auto_approve_rate}% Auto` : undefined,
        },
        {
          label: "Pending Review",
          value: metrics.needs_review,
          icon: AlertTriangle,
          color: "var(--warning)",
        },
        {
          label: "Rejected",
          value: metrics.auto_rejected + metrics.human_rejected,
          icon: XCircle,
          color: "var(--danger)",
        },
      ]
    : [];

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
          <h1 className="page-title">Accounts Payable Dashboard</h1>
          <p className="page-subtitle">Real-time status overview of invoice ingestion and verification pipelines.</p>
        </div>
        <Link href="/upload" className="btn btn-primary btn-sm flex items-center gap-1.5">
          <ArrowUpRight className="w-3.5 h-3.5" />
          Upload Document
        </Link>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5">
                <div className="skeleton h-3.5 w-24 mb-3" />
                <div className="skeleton h-8 w-16" />
              </div>
            ))
          : kpis.map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="kpi-card"
                style={{ "--kpi-color": kpi.color } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="section-label">{kpi.label}</span>
                  <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[var(--text-heading)]">
                    {kpi.value}
                  </span>
                  {kpi.sub && (
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      ({kpi.sub})
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Trust Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="card flex flex-col items-center justify-center p-6"
        >
          <div style={{ alignSelf: "flex-start", marginBottom: 16 }}>
            <span className="section-label">Trust Index</span>
          </div>
          {loading ? (
            <div className="skeleton w-28 h-28 rounded-full" />
          ) : metrics && metrics.avg_trust_score > 0 ? (
            <TrustGauge score={metrics.avg_trust_score} />
          ) : (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <Shield className="w-10 h-10 text-[var(--text-muted)] opacity-30" />
              <p className="text-xs text-[var(--text-muted)]">No score calculated yet</p>
            </div>
          )}
          {metrics && metrics.avg_trust_score > 0 && (
            <div className="text-center mt-4">
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>
                Average Trust Index
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Calculated across {metrics.total_invoices} document{metrics.total_invoices !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </motion.div>

        {/* Recent Activity Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="card col-span-2 overflow-hidden flex flex-col"
        >
          <div className="panel-header">
            <span className="panel-header-title">Recent Ledger Influx</span>
            <Link
              href="/invoices"
              className="text-xs text-[var(--brand)] hover:underline font-semibold"
            >
              View Full Ledger →
            </Link>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="skeleton w-8 h-8 rounded" />
                  <div className="flex-1">
                    <div className="skeleton h-3.5 w-40 mb-2" />
                    <div className="skeleton h-3 w-24" />
                  </div>
                  <div className="skeleton h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : metrics && metrics.recent_invoices.length > 0 ? (
            <div className="divide-y divide-[var(--border-default)]">
              {metrics.recent_invoices.slice(0, 5).map((inv) => {
                const info = getStatusInfo(inv.status);
                const isTimesheet = (inv.vendor_name || inv.file_name || "").toLowerCase().includes("timesheet") || inv.file_name.toLowerCase().includes("timesheet") || inv.file_name.toLowerCase().includes("data");
                return (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--surface-1)] transition-colors text-decoration-none"
                  >
                    <div className="w-9 h-9 rounded bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0 border border-[var(--border-default)]">
                      {isTimesheet ? (
                        <Layers className="w-4 h-4 text-[var(--brand)]" />
                      ) : (
                        <FileText className="w-4 h-4 text-[var(--text-secondary)]" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }} className="truncate m-0">
                          {inv.vendor_name || inv.file_name}
                        </p>
                        {isTimesheet && (
                          <span className="badge badge-brand" style={{ fontSize: 9 }}>Timesheet</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] m-0 mt-0.5">
                        ID: <span className="mono">{inv.invoice_number || "—"}</span> · Due: {inv.due_date || "—"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }} className="mono m-0">
                          {inv.total_amount ? `₹${inv.total_amount.toLocaleString()}` : "—"}
                        </p>
                        {inv.trust_score !== null && (
                          <p className="text-[10.5px] text-[var(--text-secondary)] m-0">
                            Trust: {Math.round(inv.trust_score * 100)}%
                          </p>
                        )}
                      </div>
                      <span className={`badge ${info.badge}`}>{info.label}</span>
                    </div>

                    <span className="text-xs text-[var(--text-muted)] w-14 text-right flex-shrink-0">
                      {formatTimeAgo(inv.created_at)}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <FileText className="w-6 h-6 text-[var(--text-muted)]" />
              </div>
              <p className="empty-state-title">No documents processed yet</p>
              <p className="empty-state-desc">Upload invoices or timesheets to begin autonomous FinOps ingestion.</p>
              <Link href="/upload" className="btn btn-secondary btn-sm">
                Upload Document
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
