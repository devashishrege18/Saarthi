"""
SAARTHI — Document Ingestion Service
Handles file validation, type detection, text extraction from PDFs and images.
"""

import os
import time
from pathlib import Path

import fitz  # PyMuPDF
import structlog

from config import UPLOAD_DIR, ALLOWED_EXTENSIONS, MAX_FILE_SIZE_MB

log = structlog.get_logger()


class DocumentIngestionService:
    """Handles document intake, validation, and raw text extraction."""

    DIGITAL_PDF_TEXT_THRESHOLD = 50  # Minimum chars to consider a PDF digital (not scanned)

    def validate_file(self, filename: str, file_size: int) -> tuple[bool, str]:
        """Validate file type and size. Returns (is_valid, error_message)."""
        ext = os.path.splitext(filename)[1].lower()

        if ext not in ALLOWED_EXTENSIONS:
            return False, f"Unsupported file type: {ext}. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"

        if file_size == 0:
            return False, "Empty file"

        if file_size > MAX_FILE_SIZE_MB * 1024 * 1024:
            return False, f"File too large ({file_size / 1024 / 1024:.1f}MB). Max: {MAX_FILE_SIZE_MB}MB"

        return True, ""

    def detect_document_type(self, file_path: str, file_ext: str) -> str:
        """Classify the document type: digital_pdf, scanned_pdf, image, spreadsheet."""
        if file_ext in {".xls", ".xlsx", ".csv"}:
            return "spreadsheet"
        elif file_ext in {".png", ".jpg", ".jpeg", ".tiff", ".tif"}:
            return "image"
        elif file_ext == ".pdf":
            return self._classify_pdf(file_path)
        return "unknown"

    def _classify_pdf(self, file_path: str) -> str:
        """Determine if a PDF is digital (has text) or scanned (needs OCR)."""
        try:
            doc = fitz.open(file_path)
            total_text = ""
            for page in doc:
                total_text += page.get_text()
            doc.close()

            if len(total_text.strip()) > self.DIGITAL_PDF_TEXT_THRESHOLD:
                return "digital_pdf"
            return "scanned_pdf"
        except Exception as e:
            log.warning("pdf.classify.error", error=str(e), path=file_path)
            return "scanned_pdf"  # Fallback to OCR path

    def extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from a digital PDF using PyMuPDF."""
        try:
            doc = fitz.open(file_path)
            text_parts = []
            for page_num, page in enumerate(doc):
                page_text = page.get_text()
                if page_text.strip():
                    text_parts.append(f"--- Page {page_num + 1} ---\n{page_text}")
            doc.close()
            return "\n".join(text_parts)
        except Exception as e:
            log.error("pdf.extract.error", error=str(e), path=file_path)
            return ""

    def extract_text_from_spreadsheet(self, file_path: str, file_ext: str) -> str:
        """Extract text from Excel/CSV files."""
        try:
            import pandas as pd

            if file_ext == ".csv":
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)

            # Convert to a readable text format
            lines = []
            lines.append(f"Columns: {', '.join(df.columns.tolist())}")
            lines.append(f"Rows: {len(df)}")
            lines.append("")

            # Output as formatted table text
            for idx, row in df.iterrows():
                row_parts = []
                for col in df.columns:
                    val = row[col]
                    if pd.notna(val):
                        row_parts.append(f"{col}: {val}")
                lines.append(f"Row {idx + 1}: {' | '.join(row_parts)}")

            return "\n".join(lines)
        except Exception as e:
            log.error("spreadsheet.extract.error", error=str(e), path=file_path)
            return ""

    def get_page_images(self, file_path: str) -> list[str]:
        """Convert PDF pages to images for OCR. Returns list of image paths."""
        try:
            doc = fitz.open(file_path)
            image_paths = []

            for page_num, page in enumerate(doc):
                # Render page at 300 DPI for OCR quality
                mat = fitz.Matrix(300 / 72, 300 / 72)
                pix = page.get_pixmap(matrix=mat)
                img_path = str(UPLOAD_DIR / f"_ocr_page_{page_num}_{int(time.time())}.png")
                pix.save(img_path)
                image_paths.append(img_path)

            doc.close()
            return image_paths
        except Exception as e:
            log.error("pdf.to_images.error", error=str(e), path=file_path)
            return []
