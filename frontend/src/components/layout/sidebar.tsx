"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  FileText,
  ClipboardCheck,
  ChevronRight,
  Activity,
  Cpu,
  Settings,
} from "lucide-react";

const navGroups = [
  {
    label: "Main",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, desc: "Overview & KPIs" },
      { href: "/upload", label: "Upload Invoice", icon: Upload, desc: "Process documents" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/invoices", label: "Invoice Ledger", icon: FileText, desc: "All records" },
      { href: "/review", label: "Review Queue", icon: ClipboardCheck, desc: "Pending actions", badge: true },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, desc: "Integrations & Connections" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        position: "fixed",
        left: 0, top: 0, bottom: 0,
        width: 240,
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        display: "flex",
        flexDirection: "column",
        zIndex: 100,
        userSelect: "none",
      }}
    >
      {/* Brand Header */}
      <div style={{
        padding: "0 16px",
        height: 60,
        borderBottom: "1px solid var(--sidebar-border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: 8,
          background: "var(--brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0,82,204,0.35)",
        }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, letterSpacing: -0.5 }}>S</span>
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, letterSpacing: -0.3, lineHeight: 1.2 }}>
            SAARTHI
          </div>
          <div style={{ color: "var(--sidebar-text-muted)", fontSize: 9.5, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            FinOps Platform
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
        {navGroups.map((group) => (
          <div key={group.label} style={{ marginBottom: 20 }}>
            <div style={{
              padding: "0 8px 6px",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--sidebar-text-muted)",
            }}>
              {group.label}
            </div>
            {group.items.map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 7,
                    marginBottom: 2,
                    textDecoration: "none",
                    background: isActive ? "var(--sidebar-active)" : "transparent",
                    transition: "background 100ms",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--sidebar-hover)"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div style={{
                      position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                      width: 3, height: 18, borderRadius: "0 2px 2px 0",
                      background: "var(--brand)",
                    }} />
                  )}
                  <div style={{
                    width: 30, height: 30,
                    borderRadius: 6,
                    background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Icon size={14} color={isActive ? "#fff" : "var(--sidebar-text)"} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
                      lineHeight: 1.3,
                    }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--sidebar-text-muted)", lineHeight: 1.2, marginTop: 1 }}>
                      {item.desc}
                    </div>
                  </div>
                  {isActive && (
                    <ChevronRight size={12} color="var(--sidebar-text-muted)" style={{ flexShrink: 0 }} />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* System Status Footer */}
      <div style={{
        padding: "12px 12px",
        borderTop: "1px solid var(--sidebar-border)",
        flexShrink: 0,
      }}>
        <div style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: 8,
          padding: "10px 12px",
          border: "1px solid var(--sidebar-border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 6px rgba(34,197,94,0.6)",
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#22c55e" }}>All Systems Operational</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {[
              { icon: Cpu, label: "AI Engine", value: "Ollama/phi3" },
              { icon: Activity, label: "API", value: "Connected" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Icon size={10} color="var(--sidebar-text-muted)" />
                  <span style={{ fontSize: 10, color: "var(--sidebar-text-muted)" }}>{label}</span>
                </div>
                <span style={{ fontSize: 10, color: "var(--sidebar-text)", fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
