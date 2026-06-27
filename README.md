# SAARTHI

**Trust Every Decision.**

> Autonomous Financial Operations Companion — built for Touchless Invoice Agent challenge.

SAARTHI transforms financial documents into **trustworthy, explainable financial decisions**. It is NOT an invoice OCR app — it's a complete decision intelligence platform with human-in-the-loop governance.

---

## What Makes SAARTHI Different

| Traditional Invoice Tools | SAARTHI |
|---|---|
| Extract text → dump into ERP | Extract → Validate → Score → Decide → Explain |
| Black-box AI | Every decision backed by an auditable **Decision DNA™** |
| No confidence tracking | Per-field confidence scoring with evidence chains |
| Manual review everything | Auto-approve high-trust, escalate only what matters |
| No fraud detection | 7 deterministic business rules including anomaly detection |

## Architecture

```
┌──────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│  Upload  │───▶│  Ingestion   │───▶│  AI Extraction  │───▶│  Validation  │
│  (PDF/   │    │  PDF/OCR/    │    │  Ollama/Claude  │    │  7 Rules     │
│  Image)  │    │  Excel/Text) │    │  (structured)   │    │  (determin.) │
└──────────┘    └──────────────┘    └─────────────────┘    └──────┬───────┘
                                                                  │
                                                                  ▼
┌──────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│ Dashboard│◀───│ Human Review │◀───│  Decision DNA™  │◀───│ Trust Score  │
│  (KPIs)  │    │  (approve/   │    │  (evidence +    │    │  (weighted   │
│          │    │   reject)    │    │   flags)        │    │   composite) │
└──────────┘    └──────────────┘    └─────────────────┘    └──────────────┘
```

## Core Philosophy

1. **AI is only used where semantic reasoning is required** — field extraction from unstructured text.
2. **Everything else is deterministic** — validation rules, trust scoring, decision routing.
3. **Every decision is explainable** — full evidence chain, confidence per field, audit trail.
4. **Human approval is the final authority** — auto-approve only when confidence is high.
5. **No AI wrappers** — direct API calls, no LangChain/CrewAI/AutoGen.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React, TailwindCSS, Framer Motion |
| Backend | FastAPI, Python 3.13 |
| Database | SQLite (WAL mode) |
| OCR | PaddleOCR (optional) |
| AI | **Ollama** (local, free) or Claude API — configurable |

## LLM Providers

SAARTHI supports multiple LLM backends — switch with one env var:

| Provider | `LLM_PROVIDER=` | Cost | Best For |
|---|---|---|---|
| **Ollama + phi3** | `ollama` | **Free** | Local dev, hackathon demo |
| **Ollama + Qwen2.5** | `ollama` | **Free** | Higher accuracy locally |
| **Claude API** | `claude` | Paid | Production / cloud |
| **Groq / Together** | `openai_compatible` | Free tier | Cloud without cost |

## Features

### Document Intelligence
- Multi-format support: PDF (digital + scanned), PNG, JPEG, TIFF, Excel, CSV, TXT
- Automatic document type classification
- PaddleOCR for scanned documents with confidence scoring
- PyMuPDF for digital PDF text extraction
- Plain-text fallback for any readable file

### AI Extraction
- Structured prompt engineering for 13+ invoice fields
- Per-field confidence scoring (0.0–1.0)
- Line item extraction with individual confidence
- Token usage tracking for cost monitoring
- Graceful fallback with regex heuristics when no LLM available

### Validation Engine (7 Deterministic Rules)
- **Mandatory Fields** — vendor, invoice#, date, total
- **Math Integrity** — line items ↔ subtotal ↔ total
- **Duplicate Detection** — exact + fuzzy (5% tolerance, 30-day window)
- **Date Validity** — future dates, stale invoices
- **Format Validity** — currency codes, negative amounts
- **Amount Anomaly** — z-score analysis against vendor history
- **Fraud Signals** — round number bias, threshold gaming

### Decision DNA™
- Weighted Trust Score: extraction(35%) + validation(30%) + historical(20%) + fraud(15%)
- Three confidence levels: HIGH / MEDIUM / LOW
- Decision routing: AUTO_APPROVE / NEEDS_REVIEW / AUTO_REJECT
- Evidence chain with pass/fail/warn indicators
- Flags, human-readable reason, and suggested action

### Human Review
- Split-panel review queue
- Full Decision DNA™ context during review
- Approve/reject with mandatory rejection reason
- Audit trail for every action

### Dashboard
- Real-time KPI cards (total, approved, review, rejected)
- Animated trust score gauge
- Recent activity feed
- Filter-based invoice listing

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- [Ollama](https://ollama.com) (free, local AI)

### 1. Install Ollama + pull a model

```bash
# Install Ollama from https://ollama.com
ollama pull phi3          # 2.2GB — fast on CPU
# or
ollama pull qwen2.5:7b    # 4.7GB — higher accuracy
ollama serve              # starts on port 11434
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# .env already defaults to Ollama/phi3 — no API key needed!
python -m uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Optional: Use Claude instead of Ollama

```bash
# In backend/.env:
LLM_PROVIDER=claude
CLAUDE_API_KEY=your-key-here
```

### Optional: Use Groq (free cloud inference)

```bash
# In backend/.env:
LLM_PROVIDER=openai_compatible
OPENAI_API_KEY=your-groq-key
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_MODEL=llama-3.3-70b-versatile
```

## Project Structure

```
saarthi/
├── backend/
│   ├── api/
│   │   ├── health.py          # Health check
│   │   ├── invoices.py        # Upload, list, detail, process
│   │   ├── review.py          # Review queue + actions
│   │   └── dashboard.py       # Aggregated metrics
│   ├── services/
│   │   ├── ingestion.py       # Document intake + text extraction
│   │   ├── ocr.py             # PaddleOCR wrapper
│   │   ├── extraction.py      # Multi-provider LLM extraction
│   │   ├── pipeline.py        # Orchestrator (state machine)
│   │   ├── validation.py      # 7 business rules
│   │   └── decision.py        # Trust Score + Decision DNA
│   ├── samples/
│   │   └── sample_invoice.txt # Test invoice
│   ├── config.py              # Environment configuration
│   ├── database.py            # SQLite schema (7 tables)
│   ├── models.py              # Pydantic domain models
│   └── main.py                # FastAPI entrypoint
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx        # Dashboard
│       │   ├── upload/         # Upload + pipeline visualization
│       │   ├── invoices/       # List + detail (Decision DNA)
│       │   └── review/         # Human review queue
│       ├── components/
│       │   └── layout/
│       │       └── sidebar.tsx # Navigation
│       └── lib/
│           ├── api.ts          # Typed API client
│           └── utils.ts        # Utilities
└── README.md
```

## Verified E2E Test Result

Tested with `phi3:latest` (Ollama, local, free):

```
Vendor: TechFlow Solutions Pvt. Ltd.   ✓ confidence: 1.0
Invoice #: INV-2026-0847               ✓ confidence: 1.0
Date: 2026-06-15                       ✓ confidence: 1.0
Total: ₹4,42,500                       ✓ confidence: 1.0
Trust Score: 0.865 (HIGH)
LLM: ollama/phi3:latest
Processing time: ~2 min on CPU
```

## License

MIT

---

Built for the **Hackathon** — Touchless Invoice Agent challenge.
