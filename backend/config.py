"""
SAARTHI Configuration
Loads settings from environment variables with sensible defaults.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / os.getenv("DATABASE_PATH", "data").rsplit("/", 1)[0] if "/" in os.getenv("DATABASE_PATH", "data/saarthi.db") else BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / os.getenv("UPLOAD_DIR", "uploads")
DATABASE_PATH = BASE_DIR / os.getenv("DATABASE_PATH", "data/saarthi.db")

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ─── LLM Configuration ────────────────────────────────────────────────────────
# Supported providers: "ollama", "claude", "openai_compatible"
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")

# Ollama (default — free, local)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")

# Claude (optional — requires API key)
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")

# OpenAI-compatible (for any provider — Groq, Together, etc.)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Shared
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "4096"))

# ─── Server ───────────────────────────────────────────────────────────────────
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# ─── Trust Score Thresholds ───────────────────────────────────────────────────
AUTO_APPROVE_THRESHOLD = float(os.getenv("AUTO_APPROVE_THRESHOLD", "0.85"))
AUTO_REJECT_THRESHOLD = float(os.getenv("AUTO_REJECT_THRESHOLD", "0.50"))

# ─── Trust Score Weights (must sum to 1.0) ────────────────────────────────────
WEIGHT_EXTRACTION = float(os.getenv("WEIGHT_EXTRACTION", "0.35"))
WEIGHT_VALIDATION = float(os.getenv("WEIGHT_VALIDATION", "0.30"))
WEIGHT_HISTORICAL = float(os.getenv("WEIGHT_HISTORICAL", "0.20"))
WEIGHT_FRAUD = float(os.getenv("WEIGHT_FRAUD", "0.15"))

# ─── File Upload Limits ───────────────────────────────────────────────────────
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "20"))
ALLOWED_EXTENSIONS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif",
    ".xls", ".xlsx", ".csv"
}

# ─── Frontend ─────────────────────────────────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
