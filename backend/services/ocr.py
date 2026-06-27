"""
SAARTHI — OCR Service
Wraps PaddleOCR for text extraction from images and scanned PDFs.
Falls back to basic image description if PaddleOCR is unavailable.
"""

import os
import time
import structlog

log = structlog.get_logger()

# Try to import PaddleOCR — graceful fallback if not installed
_paddleocr_available = False
_ocr_engine = None

try:
    from paddleocr import PaddleOCR
    _paddleocr_available = True
except ImportError:
    log.warning("ocr.paddleocr.unavailable", message="PaddleOCR not installed. OCR will be limited.")


def get_ocr_engine():
    """Lazy-initialize OCR engine (heavy startup cost)."""
    global _ocr_engine
    if _ocr_engine is None and _paddleocr_available:
        log.info("ocr.init", message="Initializing PaddleOCR engine...")
        _ocr_engine = PaddleOCR(
            use_angle_cls=True,
            lang="en",
            show_log=False,
            use_gpu=False,
        )
        log.info("ocr.init.complete", message="PaddleOCR ready")
    return _ocr_engine


class OCRService:
    """Extracts text from images using PaddleOCR."""

    def extract_text_from_image(self, image_path: str) -> tuple[str, float]:
        """
        Extract text from a single image.
        Returns (extracted_text, average_confidence).
        """
        engine = get_ocr_engine()

        if engine is None:
            log.warning("ocr.fallback", message="PaddleOCR unavailable, returning empty text")
            return "", 0.0

        try:
            start_time = time.time()
            result = engine.ocr(image_path, cls=True)
            elapsed_ms = int((time.time() - start_time) * 1000)

            if not result or not result[0]:
                log.warning("ocr.no_text", image=image_path)
                return "", 0.0

            lines = []
            confidences = []

            for line in result[0]:
                if line and len(line) >= 2:
                    text = line[1][0]
                    confidence = line[1][1]
                    lines.append(text)
                    confidences.append(confidence)

            extracted_text = "\n".join(lines)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

            log.info(
                "ocr.complete",
                image=os.path.basename(image_path),
                lines=len(lines),
                avg_confidence=round(avg_confidence, 3),
                elapsed_ms=elapsed_ms,
            )

            return extracted_text, avg_confidence

        except Exception as e:
            log.error("ocr.error", error=str(e), image=image_path)
            return "", 0.0

    def extract_text_from_images(self, image_paths: list[str]) -> tuple[str, float]:
        """
        Extract text from multiple images (e.g., multi-page PDF).
        Returns (combined_text, average_confidence).
        """
        all_text = []
        all_confidences = []

        for i, path in enumerate(image_paths):
            text, conf = self.extract_text_from_image(path)
            if text:
                all_text.append(f"--- Page {i + 1} ---\n{text}")
                all_confidences.append(conf)

        combined = "\n\n".join(all_text)
        avg_conf = sum(all_confidences) / len(all_confidences) if all_confidences else 0.0

        return combined, avg_conf

    def cleanup_temp_images(self, image_paths: list[str]):
        """Remove temporary OCR images."""
        for path in image_paths:
            try:
                if os.path.exists(path) and "_ocr_page_" in path:
                    os.remove(path)
            except OSError:
                pass
