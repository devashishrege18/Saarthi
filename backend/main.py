"""
SAARTHI Backend — Main Application
FastAPI entry point with CORS, lifespan, and route registration.
"""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import FRONTEND_URL, UPLOAD_DIR, DEBUG
from database import init_db_sync

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer() if not DEBUG else structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — runs on startup and shutdown."""
    log.info("saarthi.startup", message="Initializing SAARTHI backend...")

    # Initialize database
    init_db_sync()
    log.info("saarthi.database", message="Database initialized")

    # Ensure upload directory exists
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    log.info("saarthi.storage", upload_dir=str(UPLOAD_DIR))

    log.info("saarthi.ready", message="SAARTHI backend is ready")
    yield
    log.info("saarthi.shutdown", message="SAARTHI backend shutting down")


# ─── Application ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="SAARTHI",
    description="Autonomous Financial Operations Companion — Trust Every Decision.",
    version="0.1.0",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for hackathon demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Static Files (uploaded documents) ────────────────────────────────────────

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ─── Routes ───────────────────────────────────────────────────────────────────

from api.health import router as health_router
from api.invoices import router as invoices_router
from api.review import router as review_router
from api.dashboard import router as dashboard_router
from api.settings import router as settings_router

app.include_router(health_router, prefix="/api/v1")
app.include_router(invoices_router, prefix="/api/v1")
app.include_router(review_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "service": "SAARTHI",
        "tagline": "Trust Every Decision.",
        "version": "0.1.0",
        "docs": "/docs",
    }
