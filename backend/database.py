"""
SAARTHI Database Layer
SQLite setup with schema initialization.
All tables use TEXT UUIDs as primary keys for portability.
Audit events table is append-only by design.
"""

import sqlite3
import aiosqlite
from pathlib import Path
from config import DATABASE_PATH

SCHEMA = """
-- ─── Invoices ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id                TEXT PRIMARY KEY,
    file_name         TEXT NOT NULL,
    file_path         TEXT NOT NULL,
    file_type         TEXT NOT NULL,
    file_size         INTEGER NOT NULL,
    status            TEXT NOT NULL DEFAULT 'RECEIVED',
    vendor_name       TEXT,
    invoice_number    TEXT,
    invoice_date      TEXT,
    due_date          TEXT,
    subtotal          REAL,
    tax_amount        REAL,
    total_amount      REAL,
    currency          TEXT DEFAULT 'INR',
    po_number         TEXT,
    payment_terms     TEXT,
    trust_score       REAL,
    confidence_level  TEXT,
    decision          TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);

-- ─── Extracted Data ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS extracted_data (
    id                  TEXT PRIMARY KEY,
    invoice_id          TEXT NOT NULL,
    raw_text            TEXT,
    extracted_fields    TEXT,           -- JSON blob
    confidence_map      TEXT,           -- JSON blob: field -> confidence score
    llm_model           TEXT,
    prompt_tokens       INTEGER DEFAULT 0,
    completion_tokens   INTEGER DEFAULT 0,
    extraction_time_ms  INTEGER DEFAULT 0,
    created_at          TEXT NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- ─── Line Items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS line_items (
    id              TEXT PRIMARY KEY,
    invoice_id      TEXT NOT NULL,
    description     TEXT,
    quantity        REAL,
    unit_price      REAL,
    amount          REAL,
    confidence      REAL DEFAULT 0.0,
    created_at      TEXT NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- ─── Validation Results ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS validation_results (
    id              TEXT PRIMARY KEY,
    invoice_id      TEXT NOT NULL,
    rule_name       TEXT NOT NULL,
    status          TEXT NOT NULL,       -- PASS, FAIL, WARN
    severity        TEXT NOT NULL,       -- CRITICAL, ERROR, WARNING, INFO
    evidence        TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- ─── Decision DNA ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
    id                TEXT PRIMARY KEY,
    invoice_id        TEXT NOT NULL UNIQUE,
    trust_score       REAL NOT NULL,
    confidence_level  TEXT NOT NULL,      -- HIGH, MEDIUM, LOW
    decision          TEXT NOT NULL,      -- AUTO_APPROVE, NEEDS_REVIEW, AUTO_REJECT
    evidence          TEXT NOT NULL,      -- JSON array of evidence strings
    flags             TEXT DEFAULT '[]',  -- JSON array of flag strings
    reason            TEXT NOT NULL,
    suggested_action  TEXT NOT NULL,
    created_at        TEXT NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- ─── Human Reviews ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
    id              TEXT PRIMARY KEY,
    invoice_id      TEXT NOT NULL,
    action          TEXT NOT NULL,       -- APPROVE, REJECT, REVIEW
    reason          TEXT,
    notes           TEXT,
    reviewer        TEXT DEFAULT 'analyst',
    created_at      TEXT NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- ─── Audit Events (Append-Only) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_events (
    id              TEXT PRIMARY KEY,
    invoice_id      TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    actor           TEXT NOT NULL,       -- 'system', 'ai:extraction', 'user:analyst'
    action          TEXT NOT NULL,
    details         TEXT DEFAULT '{}',   -- JSON blob
    created_at      TEXT NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON invoices(vendor_name);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_extracted_invoice ON extracted_data(invoice_id);
CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_validation_invoice ON validation_results(invoice_id);
CREATE INDEX IF NOT EXISTS idx_decisions_invoice ON decisions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_reviews_invoice ON reviews(invoice_id);
CREATE INDEX IF NOT EXISTS idx_audit_invoice ON audit_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_events(event_type);
"""


def init_db_sync():
    """Initialize database synchronously (used at startup)."""
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.executescript(SCHEMA)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.close()


async def get_db() -> aiosqlite.Connection:
    """Get an async database connection. Use as dependency injection in FastAPI."""
    db = await aiosqlite.connect(str(DATABASE_PATH))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys=ON")
    try:
        yield db
    finally:
        await db.close()


async def get_db_connection() -> aiosqlite.Connection:
    """Get a standalone async database connection (for services)."""
    db = await aiosqlite.connect(str(DATABASE_PATH))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys=ON")
    return db
