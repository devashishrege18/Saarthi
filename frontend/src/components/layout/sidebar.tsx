"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Upload,
  FileText,
  ClipboardCheck,
  Activity,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/review", label: "Review Queue", icon: ClipboardCheck },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-[var(--bg-surface)] border-r border-[var(--border-default)] flex flex-col z-50">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-[var(--border-default)]">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
            <span className="text-black font-bold text-sm">S</span>
          </div>
          <div>
            <span className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
              SAARTHI
            </span>
            <span className="block text-[9px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] -mt-0.5">
              Trust Every Decision
            </span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="section-label px-3 mb-3">Navigation</p>
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
                isActive
                  ? "text-[var(--text-primary)] bg-[var(--bg-hover)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-[var(--accent)]"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Status */}
      <div className="px-3 pb-4">
        <div className="px-3 py-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 mb-1.5">
            <Activity className="w-3 h-3 text-[var(--success)]" />
            <span className="text-[11px] font-medium text-[var(--success-text)]">
              Online
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
            <span>Claude API</span>
            <span className="text-[var(--border-hover)]">•</span>
            <span>PaddleOCR</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
