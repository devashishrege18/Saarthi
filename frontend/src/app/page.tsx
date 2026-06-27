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
  TrendingUp,
  Clock,
  Shield,
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
  const color = score >= 0.85 ? "var(--success)" : score >= 0.5 ? "var(--accent)" : "var(--danger)";

  return (
    <div className="relative w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-default)" strokeWidth="6" />
        <motion.circle
          cx="50" cy="50" r="42" fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-[var(--text-primary)]">{pct}%</span>
        <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Trust</span>
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
          label: "Total Processed",
          value: metrics.total_invoices,
          icon: FileText,
          color: "var(--text-secondary)",
        },
        {
          label: "Auto-Approved",
          value: metrics.auto_approved + metrics.human_approved,
          icon: CheckCircle2,
          color: "var(--success)",
          sub: metrics.total_invoices > 0 ? `${metrics.auto_approve_rate}%` : undefined,
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
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-0.5">
            Dashboard
          </h1>
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Invoice processing overview
          </p>
        </div>
        <Link href="/upload" className="btn btn-primary btn-sm">
          <ArrowUpRight className="w-3.5 h-3.5" />
          Upload Invoice
        </Link>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5">
                <div className="skeleton h-3 w-20 mb-3" />
                <div className="skeleton h-7 w-12" />
              </div>
            ))
          : kpis.map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                className="card p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="section-label">{kpi.label}</span>
                  <kpi.icon className="w-3.5 h-3.5" style={{ color: kpi.color }} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold text-[var(--text-primary)]">
                    {kpi.value}
                  </span>
                  {kpi.sub && (
                    <span className="text-xs font-medium" style={{ color: kpi.color }}>
                      {kpi.sub}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Trust Score */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="card p-6 flex flex-col items-center justify-center"
        >
          <p className="section-label mb-4">Average Trust Score</p>
          {loading ? (
            <div className="skeleton w-28 h-28 rounded-full" />
          ) : metrics && metrics.avg_trust_score > 0 ? (
            <TrustGauge score={metrics.avg_trust_score} />
          ) : (
            <div className="flex flex-col items-center gap-2 py-4">
              <Shield className="w-10 h-10 text-[var(--text-muted)] opacity-30" />
              <p className="text-xs text-[var(--text-muted)]">No data yet</p>
            </div>
          )}
          {metrics && metrics.avg_trust_score > 0 && (
            <p className="text-xs text-[var(--text-tertiary)] mt-3">
              across {metrics.total_invoices} invoice{metrics.total_invoices !== 1 ? "s" : ""}
            </p>
          )}
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="card col-span-2 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
            <p className="section-label">Recent Activity</p>
            <Link
              href="/invoices"
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton w-8 h-8 rounded-md" />
                  <div className="flex-1">
                    <div className="skeleton h-3 w-40 mb-1.5" />
                    <div className="skeleton h-2.5 w-24" />
                  </div>
                  <div className="skeleton h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : metrics && metrics.recent_invoices.length > 0 ? (
            <div className="divide-y divide-[var(--border-subtle)]">
              {metrics.recent_invoices.slice(0, 6).map((inv) => {
                const info = getStatusInfo(inv.status);
                return (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] flex items-center justify-center flex-shrink-0">
                      <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                        {inv.vendor_name || inv.file_name}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {inv.invoice_number || "—"} · {inv.total_amount ? `₹${inv.total_amount.toLocaleString()}` : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {inv.trust_score !== null && (
                        <span className="text-[11px] font-mono font-medium text-[var(--text-muted)]">
                          {Math.round(inv.trust_score * 100)}%
                        </span>
                      )}
                      <span className={`badge ${info.badge}`}>{info.label}</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] w-12 text-right flex-shrink-0">
                      {formatTimeAgo(inv.created_at)}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-8 h-8 text-[var(--text-muted)] opacity-20 mb-3" />
              <p className="text-[13px] text-[var(--text-muted)] mb-3">
                No invoices processed yet
              </p>
              <Link href="/upload" className="btn btn-ghost btn-sm">
                Upload your first invoice
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
