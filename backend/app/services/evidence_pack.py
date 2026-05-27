"""
Evidence Pack Generation Service — Week 4 (BE-19 partial).

Bundles multiple uploaded compliance documents (PDFs and images) into a
single merged PDF suitable for tender applications and audits.

Supported input types:
  application/pdf  — merged directly via pypdf
  image/jpeg       — wrapped in a PDF page before merging
  image/png        — wrapped in a PDF page before merging
  image/webp       — wrapped in a PDF page before merging (via Pillow)

Usage:
    from app.services.evidence_pack import build_evidence_pack
    pdf_bytes = build_evidence_pack(documents, s3_keys_to_bytes_fn)

Where `s3_keys_to_bytes_fn` is a callable(s3_key) -> bytes that fetches
the raw file content (from S3 or local storage).
"""
import io
import re
from datetime import datetime, timezone
from typing import Callable

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    # Fallback to PyPDF2 if pypdf is not installed
    from PyPDF2 import PdfReader, PdfWriter  # type: ignore[no-redef]

PAGE_W, PAGE_H = A4
MARGIN = 1.5 * cm
PRIMARY = colors.HexColor("#1A1A2E")
MID_GREY = colors.HexColor("#CCCCCC")

# MIME types treated as images that need wrapping before merging
_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/tiff"}


# ── Public API ────────────────────────────────────────────────────────────────

def build_evidence_pack(
    documents: list[dict],
    fetch_bytes: Callable[[str], bytes],
) -> bytes:
    """
    Build a merged evidence pack PDF.

    Args:
        documents:    List of document dicts from the DB.
                      Each must have: filename, category, mime_type,
                      s3_key, uploaded_at.
        fetch_bytes:  Callable that takes an s3_key and returns raw bytes.
                      This decouples the service from S3 vs local storage.

    Returns:
        Merged PDF bytes.

    Raises:
        ValueError: If documents list is empty.
        RuntimeError: If a file cannot be processed.
    """
    if not documents:
        raise ValueError("Cannot generate evidence pack: no documents provided.")

    writer = PdfWriter()

    # 1. Cover page
    cover_bytes = _build_cover_page(documents)
    cover_reader = PdfReader(io.BytesIO(cover_bytes))
    for page in cover_reader.pages:
        writer.add_page(page)

    # 2. Merge each document
    errors: list[str] = []
    for doc in documents:
        s3_key = doc.get("s3_key", "")
        mime_type = doc.get("mime_type", "").lower()
        filename = doc.get("filename", s3_key)

        try:
            raw_bytes = fetch_bytes(s3_key)
        except Exception as exc:
            errors.append(f"{filename}: failed to fetch — {exc}")
            continue

        try:
            if mime_type == "application/pdf":
                pdf_bytes = raw_bytes
            elif mime_type in _IMAGE_MIMES:
                pdf_bytes = _image_to_pdf(raw_bytes, mime_type, filename)
            else:
                # Unsupported type — skip gracefully
                errors.append(f"{filename}: unsupported MIME type '{mime_type}', skipped.")
                continue

            reader = PdfReader(io.BytesIO(pdf_bytes))
            for page in reader.pages:
                writer.add_page(page)
        except Exception as exc:
            errors.append(f"{filename}: processing error — {exc}")
            continue

    # 3. If there were errors, append a final error summary page
    if errors:
        err_bytes = _build_error_page(errors)
        err_reader = PdfReader(io.BytesIO(err_bytes))
        for page in err_reader.pages:
            writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


# ── Cover page ────────────────────────────────────────────────────────────────

def _build_cover_page(documents: list[dict]) -> bytes:
    """Render a ReportLab cover page listing all bundled documents."""
    buf = io.BytesIO()
    pdf_doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title="Evidence Pack — CompliancePro Botswana",
    )

    story = []

    # Header
    header_data = [[
        Paragraph(
            "<font color='white'><b>CompliancePro Botswana</b></font>",
            ParagraphStyle("hdr", fontSize=16, leading=20),
        ),
        Paragraph(
            "<font color='white'>Evidence Pack</font>",
            ParagraphStyle("hdr_r", fontSize=10, leading=14),
        ),
    ]]
    hdr_tbl = Table(header_data, colWidths=[10 * cm, 7.5 * cm])
    hdr_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (0, 0), 12),
        ("RIGHTPADDING", (-1, -1), (-1, -1), 12),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(hdr_tbl)
    story.append(Spacer(1, 1 * cm))

    story.append(Paragraph(
        "Compliance Evidence Pack",
        ParagraphStyle("title", fontSize=22, leading=28, textColor=PRIMARY, spaceAfter=6),
    ))
    story.append(Paragraph(
        f"Generated: {datetime.now(timezone.utc).strftime('%d %B %Y, %H:%M UTC')}",
        ParagraphStyle("sub", fontSize=10, leading=14, textColor=MID_GREY, spaceAfter=4),
    ))
    story.append(Paragraph(
        f"Total documents bundled: {len(documents)}",
        ParagraphStyle("count", fontSize=10, leading=14, textColor=MID_GREY),
    ))
    story.append(Spacer(1, 0.6 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY))
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph(
        "Document Index",
        ParagraphStyle("h2", fontSize=14, leading=18, textColor=PRIMARY, spaceAfter=8),
    ))

    table_data = [["#", "Filename", "Category", "Upload Date"]]
    for i, doc in enumerate(documents, 1):
        uploaded_raw = doc.get("uploaded_at")
        if isinstance(uploaded_raw, datetime):
            upload_str = uploaded_raw.strftime("%d %b %Y")
        else:
            upload_str = str(uploaded_raw) if uploaded_raw else "—"

        table_data.append([
            str(i),
            doc.get("filename", "—"),
            doc.get("category", "—"),
            upload_str,
        ])

    idx_tbl = Table(table_data, colWidths=[1 * cm, 9 * cm, 3.5 * cm, 4 * cm])
    idx_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.4, MID_GREY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        *[
            ("BACKGROUND", (0, i), (-1, i), colors.HexColor("#F7F7F7"))
            for i in range(2, len(table_data), 2)
        ],
    ]))
    story.append(idx_tbl)

    pdf_doc.build(story)
    return buf.getvalue()


# ── Image → PDF wrapping ──────────────────────────────────────────────────────

def _image_to_pdf(raw_bytes: bytes, mime_type: str, filename: str) -> bytes:
    """
    Wrap a single image in a PDF page sized to A4.

    The image is centred on the page with a maximum of 1cm margins,
    preserving aspect ratio. A small caption is placed below the image.
    """
    from reportlab.pdfgen import canvas as rl_canvas

    img = PILImage.open(io.BytesIO(raw_bytes))

    # Normalise WEBP / other formats to RGB for reliable PDF embedding
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    img_w_px, img_h_px = img.size
    img_dpi = img.info.get("dpi", (72, 72))
    dpi = img_dpi[0] if img_dpi[0] > 0 else 72

    # Convert to points (1 pt = 1/72 inch)
    img_w_pt = (img_w_px / dpi) * 72
    img_h_pt = (img_h_px / dpi) * 72

    usable_w = PAGE_W - 2 * MARGIN
    usable_h = PAGE_H - 2 * MARGIN - 1 * cm  # reserve space for caption

    # Scale to fit
    scale = min(usable_w / img_w_pt, usable_h / img_h_pt, 1.0)
    draw_w = img_w_pt * scale
    draw_h = img_h_pt * scale

    # Centre on page
    x = (PAGE_W - draw_w) / 2
    y = (PAGE_H - draw_h) / 2 + 0.5 * cm  # offset up for caption

    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A4)

    # Save image to a temp buffer in JPEG for ReportLab
    img_buf = io.BytesIO()
    img.save(img_buf, format="JPEG", quality=92)
    img_buf.seek(0)

    c.drawImage(
        img_buf,  # type: ignore[arg-type]  # ReportLab accepts file-like objects
        x, y,
        width=draw_w,
        height=draw_h,
        preserveAspectRatio=True,
    )

    # Caption
    safe_filename = _safe_text(filename)
    c.setFont("Helvetica", 8)
    c.setFillColor(MID_GREY)
    c.drawCentredString(PAGE_W / 2, MARGIN / 2, safe_filename)

    c.showPage()
    c.save()
    return buf.getvalue()


# ── Error summary page ────────────────────────────────────────────────────────

def _build_error_page(errors: list[str]) -> bytes:
    """Append a page listing any documents that could not be merged."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                             topMargin=MARGIN, bottomMargin=MARGIN)
    story = [
        Paragraph("Processing Errors", ParagraphStyle(
            "h2_err", fontSize=14, leading=18, textColor=colors.HexColor("#E94560"), spaceAfter=8
        )),
        Paragraph(
            "The following documents could not be included in this evidence pack:",
            ParagraphStyle("body", fontSize=10, leading=14, spaceAfter=10),
        ),
    ]
    for err in errors:
        story.append(Paragraph(
            f"• {_safe_text(err)}",
            ParagraphStyle("err_item", fontSize=9, leading=13, leftIndent=10),
        ))
    doc.build(story)
    return buf.getvalue()


# ── Utilities ─────────────────────────────────────────────────────────────────

def _safe_text(text: str) -> str:
    """Strip non-printable characters to avoid ReportLab encoding errors."""
    return re.sub(r"[^\x20-\x7E]", "?", text)