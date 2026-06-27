"""Generate a sample invoice PDF for testing SAARTHI."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
import os, sys

def create_sample_invoice(output_path: str):
    c = canvas.Canvas(output_path, pagesize=A4)
    w, h = A4

    # Header
    c.setFont("Helvetica-Bold", 22)
    c.drawString(40, h - 60, "INVOICE")
    c.setFont("Helvetica", 10)
    c.drawString(40, h - 80, "TechFlow Solutions Pvt. Ltd.")
    c.drawString(40, h - 93, "42 Koramangala, Bangalore 560034")
    c.drawString(40, h - 106, "GSTIN: 29AABCT1234F1ZN")

    # Invoice Details
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(w - 40, h - 60, "Invoice No: INV-2026-0847")
    c.setFont("Helvetica", 10)
    c.drawRightString(w - 40, h - 75, "Date: 2026-06-15")
    c.drawRightString(w - 40, h - 88, "Due Date: 2026-07-15")
    c.drawRightString(w - 40, h - 101, "PO: PO-2026-3391")

    # Bill To
    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, h - 140, "Bill To:")
    c.setFont("Helvetica", 10)
    c.drawString(40, h - 155, "Mozilla Foundation")
    c.drawString(40, h - 168, "331 E Evelyn Ave, Mountain View, CA 94041")

    # Table header
    y = h - 210
    c.setFont("Helvetica-Bold", 9)
    c.drawString(40, y, "Description")
    c.drawString(320, y, "Qty")
    c.drawString(380, y, "Unit Price")
    c.drawRightString(w - 40, y, "Amount")
    c.line(40, y - 5, w - 40, y - 5)

    # Line items
    items = [
        ("AI Model Training — Claude Integration (40 hrs)", "40", "2,500.00", "1,00,000.00"),
        ("Frontend Development — React Dashboard (60 hrs)", "60", "2,000.00", "1,20,000.00"),
        ("Backend API Development — FastAPI (50 hrs)", "50", "2,200.00", "1,10,000.00"),
        ("QA Testing & Documentation (20 hrs)", "20", "1,500.00", "30,000.00"),
        ("Cloud Infrastructure Setup", "1", "15,000.00", "15,000.00"),
    ]

    c.setFont("Helvetica", 9)
    for desc, qty, price, amount in items:
        y -= 20
        c.drawString(40, y, desc)
        c.drawString(330, y, qty)
        c.drawString(380, y, price)
        c.drawRightString(w - 40, y, amount)

    # Totals
    y -= 30
    c.line(350, y + 10, w - 40, y + 10)
    c.setFont("Helvetica", 10)
    c.drawString(350, y, "Subtotal:")
    c.drawRightString(w - 40, y, "3,75,000.00")

    y -= 18
    c.drawString(350, y, "GST (18%):")
    c.drawRightString(w - 40, y, "67,500.00")

    y -= 18
    c.line(350, y + 10, w - 40, y + 10)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(350, y, "Total (INR):")
    c.drawRightString(w - 40, y, "4,42,500.00")

    # Payment terms
    y -= 40
    c.setFont("Helvetica", 9)
    c.drawString(40, y, "Payment Terms: Net 30")
    y -= 14
    c.drawString(40, y, "Bank: HDFC Bank | A/C: 50100123456789 | IFSC: HDFC0001234")

    c.save()
    print(f"Created: {output_path}")

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "samples", "sample_invoice_techflow.pdf")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    create_sample_invoice(out)
