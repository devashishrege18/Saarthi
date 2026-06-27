"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Settings, 
  Mail, 
  Monitor, 
  ToggleLeft, 
  ToggleRight, 
  FolderSync, 
  HelpCircle, 
  CheckCircle, 
  Loader2,
  Lock,
  RefreshCw
} from "lucide-react";
import { getSettings, updateSettings, type SystemSettings } from "@/lib/api";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Mock connecting inputs
  const [gmailEmail, setGmailEmail] = useState("");
  const [watchFolder, setWatchFolder] = useState("");

  useEffect(() => {
    getSettings()
      .then((res) => {
        setSettings(res);
        setGmailEmail(res.gmail_email || "");
        setWatchFolder(res.watch_folder || "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (key: keyof SystemSettings) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [key]: !settings[key],
    });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const updated = {
        ...settings,
        gmail_email: gmailEmail,
        watch_folder: watchFolder,
      };
      const res = await updateSettings(updated);
      setSettings(res);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 text-[var(--brand)] animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Integrations & Connections</h1>
          <p className="page-subtitle">Connect external sources and manage document ingestion preferences.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : saveSuccess ? (
            <>
              <CheckCircle className="w-4 h-4 text-white" />
              Changes Saved
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>

      {settings && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Card 1: Google Account / Gmail Ingestion */}
          <div className="card">
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[var(--brand)]" />
                <span className="panel-header-title">Google Workspace & Gmail</span>
              </div>
              <span className={`badge ${settings.gmail_connected ? 'badge-success' : 'badge-neutral'}`}>
                {settings.gmail_connected ? "Connected" : "Disconnected"}
              </span>
            </div>
            
            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)", marginBottom: 4 }}>
                    Email Ingestion Sync
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
                    Connect your corporate Gmail or GSuite inbox. When active, SAARTHI monitors incoming mail attachments for financial records, timesheets, and invoices.
                  </p>
                  
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                    <div style={{ flex: 1, maxWidth: 350 }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase" }}>
                        Corporate Google Email Address
                      </label>
                      <input 
                        type="email" 
                        className="input" 
                        placeholder="e.g. accounts@saarthi-finops.com"
                        value={gmailEmail}
                        onChange={(e) => setGmailEmail(e.target.value)}
                        disabled={settings.gmail_connected}
                      />
                    </div>
                    <div style={{ marginTop: 20 }}>
                      <button
                        onClick={() => {
                          if (settings.gmail_connected) {
                            setGmailEmail("");
                            setSettings({ ...settings, gmail_connected: false });
                          } else if (gmailEmail.trim()) {
                            setSettings({ ...settings, gmail_connected: true });
                          }
                        }}
                        className={`btn ${settings.gmail_connected ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                      >
                        {settings.gmail_connected ? "Disconnect" : "Connect Account"}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
                    <Lock className="w-3.5 h-3.5" />
                    <span>OAuth2 connection secured via Google Identity Services</span>
                  </div>
                </div>

                <div style={{
                  width: 220, 
                  background: "var(--surface-1)", 
                  padding: 16, 
                  borderRadius: "var(--radius-md)",
                  border: "1px dashed var(--border-strong)"
                }}>
                  <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-heading)", marginBottom: 8 }}>
                    Google Sync Active
                  </h4>
                  <ul style={{ paddingLeft: 16, fontSize: 12, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 6 }}>
                    <li>Monitors <code>subject:Timesheet</code></li>
                    <li>Monitors <code>subject:Invoice</code></li>
                    <li>Automatic secure downloads</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Local PC Folder Sync */}
          <div className="card">
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-[var(--brand)]" />
                <span className="panel-header-title">Local PC File Watcher</span>
              </div>
              <span className={`badge ${settings.local_pc_connected ? 'badge-success' : 'badge-neutral'}`}>
                {settings.local_pc_connected ? "Active" : "Inactive"}
              </span>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)", marginBottom: 4 }}>
                    Local Directory Monitoring
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
                    Connect to SAARTHI's local daemon running on your computer. Monitors local download or scanner output folders to automatically queue new files.
                  </p>

                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                    <div style={{ flex: 1, maxWidth: 350 }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase" }}>
                        Local Folder Path
                      </label>
                      <input 
                        type="text" 
                        className="input" 
                        placeholder="e.g. C:\Users\Finance\Downloads"
                        value={watchFolder}
                        onChange={(e) => setWatchFolder(e.target.value)}
                        disabled={settings.local_pc_connected}
                      />
                    </div>
                    <div style={{ marginTop: 20 }}>
                      <button
                        onClick={() => {
                          if (settings.local_pc_connected) {
                            setWatchFolder("");
                            setSettings({ ...settings, local_pc_connected: false });
                          } else if (watchFolder.trim()) {
                            setSettings({ ...settings, local_pc_connected: true });
                          }
                        }}
                        className={`btn ${settings.local_pc_connected ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                      >
                        {settings.local_pc_connected ? "Stop Watcher" : "Start Watcher"}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
                    <FolderSync className="w-3.5 h-3.5" />
                    <span>Uses background FileSystemWatcher for zero lag</span>
                  </div>
                </div>

                <div style={{
                  width: 220, 
                  background: "var(--surface-1)", 
                  padding: 16, 
                  borderRadius: "var(--radius-md)",
                  border: "1px dashed var(--border-strong)"
                }}>
                  <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-heading)", marginBottom: 8 }}>
                    Watcher Directives
                  </h4>
                  <ul style={{ paddingLeft: 16, fontSize: 12, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 6 }}>
                    <li>Polls path for changes</li>
                    <li>Locks file during copy</li>
                    <li>Accepts text, PDF, spreadsheets</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Behavior Preferences */}
          <div className="card">
            <div className="panel-header">
              <span className="panel-header-title">Behavior Customization</span>
            </div>

            <div style={{ padding: "8px 24px" }}>
              <div style={{ divideY: "1px solid var(--border-default)" }}>
                {/* Rule 1 */}
                <div style={{
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  padding: "16px 0",
                  borderBottom: "1px solid var(--border-subtle)"
                }}>
                  <div style={{ flex: 1, paddingRight: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)", marginBottom: 2 }}>
                      Automatically Accept Verified Input Data
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      When timesheets or payroll inputs are ingested from a connected Google/Gmail or local watch folder, bypass standard validation rules and automatically transition state to Approved.
                    </div>
                  </div>
                  <button 
                    onClick={() => handleToggle("auto_accept_timesheets")} 
                    style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}
                  >
                    {settings.auto_accept_timesheets ? (
                      <ToggleRight className="w-10 h-10 text-[var(--brand)]" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-[var(--text-muted)]" />
                    )}
                  </button>
                </div>

                {/* Rule 2 */}
                <div style={{
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  padding: "16px 0"
                }}>
                  <div style={{ flex: 1, paddingRight: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)", marginBottom: 2 }}>
                      Selective AI Parsing for Timesheets
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      For documents matching timesheets/data templates, extract only key operational fields (hours, rate, amount) rather than the complete general invoice schema. Restricts LLM token footprint.
                    </div>
                  </div>
                  <button 
                    onClick={() => handleToggle("selective_ai_parsing")} 
                    style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}
                  >
                    {settings.selective_ai_parsing ? (
                      <ToggleRight className="w-10 h-10 text-[var(--brand)]" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-[var(--text-muted)]" />
                    )}
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
