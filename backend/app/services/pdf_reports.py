"""
PDF Report Generation Service — Week 4 (BE-19 partial).

Generates a structured compliance summary PDF using ReportLab.

Report structure:
  Page 1  — Cover: business name, report period, health score, overdue count
  Page 2+ — Deadline table: name, category, status, due date
  Final   — Document inventory: filename, category, upload date

Usage:
    from app.services.pdf_report import build_compliance_report
    pdf_bytes = build_compliance_report(business, deadlines, documents, health_score)
"""
import io
from datetime import date, datetime, timezone
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ── Brand colours ──────────────────────────────────────────────────────────────
PRIMARY = colors.HexColor("#1A1A2E")       # deep navy — header bars
ACCENT = colors.HexColor("#E94560")        # red accent — overdue / danger
SUCCESS = colors.HexColor("#0F9B58")       # green — complete
AMBER = colors.HexColor("#F5A623")         # amber — pending
LIGHT_GREY = colors.HexColor("#F7F7F7")   # alternating row bg
MID_GREY = colors.HexColor("#CCCCCC")     # borders
TEXT = colors.HexColor("#1A1A1A")

PAGE_W, PAGE_H = A4
MARGIN = 2 * cm


# ── Helper: health score colour ───────────────────────────────────────────────
def _score_colour(score: float) -> colors.Color:
    if score >= 80:
        return SUCCESS
    if score >= 50:
        return AMBER
    return ACCENT


# ── Helper: status colour ─────────────────────────────────────────────────────
_STATUS_COLOURS = {
    "complete": SUCCESS,
    "pending": AMBER,
    "missed": ACCENT,
}


def _status_colour(status: str) -> colors.Color:
    return _STATUS_COLOURS.get(status.lower(), TEXT)


# ── Main public function ──────────────────────────────────────────────────────
def build_compliance_report(
    business_name: str,
    burs_tin: Optional[str],
    period_label: str,          # e.g. "January – May 2026"
    health_score: float,        # 0–100
    overdue_count: int,
    deadlines: list[dict],      # [{name, category, status, due_date}]
    documents: list[dict],      # [{filename, category, uploaded_at}]
) -> bytes:
    """
    Build and return a compliance report PDF as raw bytes.

    Args:
        business_name:  Display name of the business.
        burs_tin:       BURS Tax Identification Number (optional).
        period_label:   Human-readable period shown on the cover page.
        health_score:   Compliance health score (0–100).
        overdue_count:  Number of deadlines currently overdue.
        deadlines:      List of deadline dicts for the table section.
        documents:      List of document dicts for the inventory section.

    Returns:
        PDF content as bytes — ready to return via FastAPI Response or
        stream to S3 / local storage.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title=f"Compliance Report — {business_name}",
        author="CompliancePro Botswana",
    )

    styles = getSampleStyleSheet()
    story: list = []

    # ── PAGE 1: Cover ─────────────────────────────────────────────────────────
    story += _build_cover(
        styles, business_name, burs_tin, period_label, health_score, overdue_count
    )

    # ── PAGE 2+: Deadline Table ───────────────────────────────────────────────
    story.append(PageBreak())
    story += _build_deadline_table(styles, deadlines)

    # ── FINAL PAGE: Document Inventory ────────────────────────────────────────
    story.append(PageBreak())
    story += _build_document_inventory(styles, documents)

    doc.build(story, onFirstPage=_add_footer, onLaterPages=_add_footer)
    return buf.getvalue()


# ── Page builders ─────────────────────────────────────────────────────────────

def _build_cover(
    styles,
    business_name: str,
    burs_tin: Optional[str],
    period_label: str,
    health_score: float,
    overdue_count: int,
) -> list:
    """Cover page: branding, business info, KPIs."""
    elements = []

    # Header bar (simulated with a coloured table)
    header_data = [
        [
            Paragraph(
                "<font color='white'><b>CompliancePro Botswana</b></font>",
                ParagraphStyle("hdr", fontSize=18, alignment=TA_LEFT, leading=22),
            ),
            Paragraph(
                "<font color='white'>Compliance Intelligence Platform</font>",
                ParagraphStyle("hdr_sub", fontSize=10, alignment=TA_RIGHT, leading=14),
            ),
        ]
    ]
    header_tbl = Table(header_data, colWidths=[10 * cm, 7.5 * cm])
    header_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PRIMARY),
                ("TOPPADDING", (0, 0), (-1, -1), 14),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
                ("LEFTPADDING", (0, 0), (0, 0), 12),
                ("RIGHTPADDING", (-1, -1), (-1, -1), 12),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    elements.append(header_tbl)
    elements.append(Spacer(1, 1.5 * cm))

    # Report title
    elements.append(
        Paragraph(
            "Compliance Summary Report",
            ParagraphStyle("title", fontSize=24, leading=30, textColor=PRIMARY, spaceAfter=6),
        )
    )
    elements.append(
        Paragraph(
            f"Period: {period_label}",
            ParagraphStyle("period", fontSize=12, leading=16, textColor=MID_GREY, spaceAfter=4),
        )
    )
    elements.append(
        Paragraph(
            f"Generated: {datetime.now(timezone.utc).strftime('%d %B %Y, %H:%M UTC')}",
            ParagraphStyle("gen", fontSize=10, leading=14, textColor=MID_GREY, spaceAfter=20),
        )
    )
    elements.append(HRFlowable(width="100%", thickness=1, color=MID_GREY))
    elements.append(Spacer(1, 0.8 * cm))

    # Business details block
    tin_text = burs_tin or "Not registered"
    details_data = [
        ["Business Name", business_name],
        ["BURS TIN", tin_text],
        ["Report Period", period_label],
    ]
    details_tbl = Table(details_data, colWidths=[4 * cm, 13.5 * cm])
    details_tbl.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 11),
                ("TEXTCOLOR", (0, 0), (0, -1), PRIMARY),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LINEBELOW", (0, -1), (-1, -1), 0.5, MID_GREY),
            ]
        )
    )
    elements.append(details_tbl)
    elements.append(Spacer(1, 1.2 * cm))

    # KPI tiles — Health Score + Overdue Count
    score_col = _score_colour(health_score)
    overdue_col = ACCENT if overdue_count > 0 else SUCCESS

    kpi_data = [
        [
            Paragraph(
                f"<font color='{score_col.hexval()}'><b>{health_score:.0f}</b></font><br/>"
                "<font size='9'>Compliance Health Score</font>",
                ParagraphStyle("kpi", fontSize=28, alignment=TA_CENTER, leading=36),
            ),
            Paragraph(
                f"<font color='{overdue_col.hexval()}'><b>{overdue_count}</b></font><br/>"
                "<font size='9'>Overdue Deadlines</font>",
                ParagraphStyle("kpi2", fontSize=28, alignment=TA_CENTER, leading=36),
            ),
        ]
    ]
    kpi_tbl = Table(kpi_data, colWidths=[8.75 * cm, 8.75 * cm])
    kpi_tbl.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (0, 0), 1, MID_GREY),
                ("BOX", (1, 0), (1, 0), 1, MID_GREY),
                ("TOPPADDING", (0, 0), (-1, -1), 20),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 20),
                ("BACKGROUND", (0, 0), (0, 0), LIGHT_GREY),
                ("BACKGROUND", (1, 0), (1, 0), LIGHT_GREY),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    elements.append(kpi_tbl)
    elements.append(Spacer(1, 0.8 * cm))

    # Score legend
    legend_text = (
        "<b>Score guide:</b> "
        "<font color='#0F9B58'>≥80 — Good</font>  |  "
        "<font color='#F5A623'>50–79 — At risk</font>  |  "
        "<font color='#E94560'>&lt;50 — Critical</font>"
    )
    elements.append(
        Paragraph(
            legend_text,
            ParagraphStyle("legend", fontSize=9, leading=13, alignment=TA_CENTER),
        )
    )

    return elements


def _build_deadline_table(styles, deadlines: list[dict]) -> list:
    """Deadline table section."""
    elements = []

    elements.append(
        Paragraph(
            "Deadline Register",
            ParagraphStyle("h2", fontSize=16, leading=20, textColor=PRIMARY, spaceAfter=6),
        )
    )
    elements.append(HRFlowable(width="100%", thickness=1, color=PRIMARY))
    elements.append(Spacer(1, 0.4 * cm))

    if not deadlines:
        elements.append(
            Paragraph(
                "No deadlines found for this period.",
                ParagraphStyle("empty", fontSize=11, textColor=MID_GREY),
            )
        )
        return elements

    headers = ["Deadline Name", "Category", "Status", "Due Date"]
    col_widths = [7.5 * cm, 2.5 * cm, 2.5 * cm, 3 * cm]

    table_data = [headers]
    for dl in deadlines:
        due_raw = dl.get("due_date")
        if isinstance(due_raw, date):
            due_str = due_raw.strftime("%d %b %Y")
        else:
            due_str = str(due_raw) if due_raw else "—"

        status = dl.get("status", "pending")
        status_col = _status_colour(status)

        table_data.append(
            [
                dl.get("name", "—"),
                dl.get("category", "—"),
                Paragraph(
                    f"<font color='{status_col.hexval()}'><b>{status.upper()}</b></font>",
                    ParagraphStyle("cell_status", fontSize=9, leading=12),
                ),
                due_str,
            ]
        )

    tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
    row_styles = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.4, MID_GREY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    # Alternating row backgrounds
    for i in range(1, len(table_data)):
        if i % 2 == 0:
            row_styles.append(("BACKGROUND", (0, i), (-1, i), LIGHT_GREY))

    tbl.setStyle(TableStyle(row_styles))
    elements.append(tbl)

    return elements


def _build_document_inventory(styles, documents: list[dict]) -> list:
    """Document inventory section."""
    elements = []

    elements.append(
        Paragraph(
            "Document Inventory",
            ParagraphStyle("h2", fontSize=16, leading=20, textColor=PRIMARY, spaceAfter=6),
        )
    )
    elements.append(HRFlowable(width="100%", thickness=1, color=PRIMARY))
    elements.append(Spacer(1, 0.4 * cm))

    if not documents:
        elements.append(
            Paragraph(
                "No documents have been uploaded for this business.",
                ParagraphStyle("empty", fontSize=11, textColor=MID_GREY),
            )
        )
        return elements

    headers = ["Filename", "Category", "Upload Date"]
    col_widths = [9 * cm, 3.5 * cm, 5 * cm]

    table_data = [headers]
    for doc in documents:
        uploaded_raw = doc.get("uploaded_at")
        if isinstance(uploaded_raw, datetime):
            upload_str = uploaded_raw.strftime("%d %b %Y")
        else:
            upload_str = str(uploaded_raw) if uploaded_raw else "—"

        table_data.append(
            [
                doc.get("filename", "—"),
                doc.get("category", "—"),
                upload_str,
            ]
        )

    tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
    row_styles = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.4, MID_GREY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    for i in range(1, len(table_data)):
        if i % 2 == 0:
            row_styles.append(("BACKGROUND", (0, i), (-1, i), LIGHT_GREY))

    tbl.setStyle(TableStyle(row_styles))
    elements.append(tbl)

    return elements


# ── Page footer callback ──────────────────────────────────────────────────────

def _add_footer(canvas, doc):
    """Draw page number and branding on every page."""
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MID_GREY)
    page_text = f"Page {doc.page}"
    canvas.drawString(MARGIN, 1.2 * cm, "CompliancePro Botswana — Confidential")
    canvas.drawRightString(PAGE_W - MARGIN, 1.2 * cm, page_text)
    canvas.restoreState()