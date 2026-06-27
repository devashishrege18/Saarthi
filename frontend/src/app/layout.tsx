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
  title: "SAARTHI — Trust Every Decision",
  description:
    "Autonomous Financial Operations Companion. Explainable AI for invoice processing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body className="min-h-screen flex bg-[var(--bg-root)]">
        <Sidebar />
        <main className="flex-1 ml-[240px] min-h-screen">
          <div className="max-w-[1200px] mx-auto px-8 py-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
