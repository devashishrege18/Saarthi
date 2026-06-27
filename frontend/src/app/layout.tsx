import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SAARTHI — Enterprise Financial Operations",
  description:
    "Autonomous invoice processing platform with AI extraction, deterministic validation, and explainable Decision DNA™.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          background: "var(--shell-bg)",
          fontFamily: "var(--font-sans)",
        }}
      >
        <Sidebar />
        <main
          style={{
            flex: 1,
            marginLeft: 240,
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Top Header Bar */}
          <header
            style={{
              height: 60,
              background: "var(--surface-0)",
              borderBottom: "1px solid var(--border-default)",
              display: "flex",
              alignItems: "center",
              padding: "0 28px",
              flexShrink: 0,
              boxShadow: "var(--shadow-xs)",
              position: "sticky",
              top: 0,
              zIndex: 50,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
              <span style={{ fontWeight: 600, color: "var(--brand)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                SAARTHI
              </span>
              <span style={{ color: "var(--border-strong)" }}>›</span>
              <span>Financial Operations</span>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                fontSize: 11,
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                background: "var(--surface-1)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                <span>Live</span>
              </div>
              <div style={{
                width: 32, height: 32,
                borderRadius: "50%",
                background: "var(--brand)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
              }}>
                A
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div
            style={{
              flex: 1,
              padding: "28px",
              maxWidth: 1280,
              width: "100%",
            }}
          >
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
