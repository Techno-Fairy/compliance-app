"""BE-25: create onboarding_steps table and seed 14 Botswana compliance steps

Revision ID: f2a0b5c83d49
Revises: e1f9a4b72c38
Create Date: 2026-06-09 09:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f2a0b5c83d49"
down_revision: Union[str, None] = "e1f9a4b72c38"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ---------------------------------------------------------------------------
# Seed rows — 14 steps across 4 phases
# portal_url is NULL for internal CompliancePro steps (Phase 4)
# documents is a JSON array stored as TEXT
# ---------------------------------------------------------------------------
STEPS = [
    # ── Phase 1 — Register Your Business ────────────────────────────────────
    {
        "phase": 1,
        "step_number": 1,
        "title": "Reserve your company / business name",
        "description": (
            "Search for and reserve your preferred company or business name through "
            "the CIPA Online Business Registration System (OBRS). Submit three proposed "
            "names in order of preference. A BWP 80 fee applies. "
            "Approval typically takes 1–3 business days."
        ),
        "portal_url": "https://obrs.gov.bw",
        "documents": '["3 proposed names", "Copy of National ID (omang) or passport", "BWP 80 registration fee"]',
    },
    {
        "phase": 1,
        "step_number": 2,
        "title": "Incorporate or register the business",
        "description": (
            "Complete the full registration on OBRS. For a Private Company (Pty Ltd) "
            "file the Memorandum and Articles of Association. For a sole trader or "
            "partnership complete the business registration form. "
            "The fee varies by company type."
        ),
        "portal_url": "https://obrs.gov.bw",
        "documents": '["Memorandum & Articles of Association (Pty Ltd only)", "Registration form (sole trader / partnership)", "Copy of ID for all directors/members", "Proof of registered office address"]',
    },
    {
        "phase": 1,
        "step_number": 3,
        "title": "Collect your Certificate of Incorporation / Registration",
        "description": (
            "Download or collect your official Certificate of Incorporation (Pty Ltd) "
            "or Certificate of Registration (sole trader/partnership) from CIPA. "
            "Keep the original safe — it is required for BURS registration, opening a "
            "bank account, and applying for a trade licence."
        ),
        "portal_url": "https://obrs.gov.bw",
        "documents": '["CIPA certificate (keep original)", "Company registration number (for all future filings)"]',
    },
    # ── Phase 2 — Set Up Your Taxes ─────────────────────────────────────────
    {
        "phase": 2,
        "step_number": 1,
        "title": "Register for a Tax Identification Number (TIN)",
        "description": (
            "Register your business with BURS to obtain a Tax Identification Number "
            "(TIN). You must do this before trading. Registration is done via the BURS "
            "e-Services portal or in person at a BURS office. "
            "Your TIN is used on all tax returns and BURS correspondence."
        ),
        "portal_url": "https://eservices.burs.org.bw",
        "documents": '["CIPA Certificate of Incorporation / Registration", "Copy of director/owner National ID or passport", "Proof of business address (lease or utility bill)", "Completed BURS registration form (available on portal)"]',
    },
    {
        "phase": 2,
        "step_number": 2,
        "title": "Assess your VAT registration obligation",
        "description": (
            "You must register for VAT if your taxable turnover meets or exceeds "
            "BWP 1,000,000 in any 12-month period, or if you reasonably expect it to "
            "do so. Voluntary registration is also available. Once registered you must "
            "file VAT returns and charge 14% VAT on taxable supplies."
        ),
        "portal_url": "https://eservices.burs.org.bw",
        "documents": '["TIN", "12-month turnover projection or actuals", "Completed VAT registration form (VAT 1)"]',
    },
    {
        "phase": 2,
        "step_number": 3,
        "title": "Register for PAYE (if employing staff)",
        "description": (
            "If you employ staff who earn above the tax-free threshold, register as a "
            "PAYE employer with BURS. As employer you deduct income tax from salaries "
            "each month and remit to BURS by the 15th of the following month."
        ),
        "portal_url": "https://eservices.burs.org.bw",
        "documents": '["TIN", "List of employees with ID numbers and salaries", "Employment contracts", "Completed PAYE registration form"]',
    },
    {
        "phase": 2,
        "step_number": 4,
        "title": "Register for Withholding Tax (if applicable)",
        "description": (
            "Withholding Tax (WHT) applies if your business pays dividends, royalties, "
            "management fees, or interest to non-residents. Rates vary (typically "
            "7.5–15%) depending on payment type and any applicable double-taxation "
            "agreement. Register with BURS if any of these payments apply."
        ),
        "portal_url": "https://eservices.burs.org.bw",
        "documents": '["TIN", "Details of non-resident payees", "Nature of payment (dividend / royalty / management fee)"]',
    },
    # ── Phase 3 — Employment & Licensing ────────────────────────────────────
    {
        "phase": 3,
        "step_number": 1,
        "title": "Obtain a Trade Licence",
        "description": (
            "A Trade Licence is required before you can legally operate a business in "
            "Botswana. Apply through MITI or your local city/town council. "
            "The licence specifies permitted business activities and must be renewed "
            "annually. Certain sectors require additional licences."
        ),
        "portal_url": "https://www.miti.gov.bw",
        "documents": '["Completed trade licence application form", "CIPA Certificate of Incorporation / Registration", "Lease agreement for business premises", "Copy of director/owner National ID or passport", "Recent passport-size photos", "Application fee (varies by council)"]',
    },
    {
        "phase": 3,
        "step_number": 2,
        "title": "Prepare employment contracts",
        "description": (
            "Under Section 28 of the Botswana Employment Act, every employee must "
            "receive a written contract within the first month of employment. "
            "The contract must state job title, duties, remuneration, working hours, "
            "and leave entitlement. Check the current MITI minimum wage schedule for "
            "your sector before setting salaries."
        ),
        "portal_url": "https://www.miti.gov.bw",
        "documents": '["Signed written employment contract (per employee)", "MITI minimum wage schedule for your sector", "Employee ID copies for HR records"]',
    },
    {
        "phase": 3,
        "step_number": 3,
        "title": "Register for Workers Compensation (BOCCIM)",
        "description": (
            "While not mandatory, registering with BOCCIM (Botswana Confederation of "
            "Commerce, Industry and Manpower) gives access to employer liability cover "
            "and industry support networks. Recommended for any business with employees."
        ),
        "portal_url": "https://boccim.co.bw",
        "documents": '["CIPA certificate", "Trade licence", "List of employees", "BOCCIM membership application form"]',
    },
    {
        "phase": 3,
        "step_number": 4,
        "title": "Set up payroll and leave records",
        "description": (
            "The Employment Act requires written leave records for each employee. "
            "Set up a payroll system that tracks gross salary, PAYE deductions, net "
            "pay, and leave balances. Issue payslips each pay period. "
            "Retain payroll records for at least five years as required by BURS."
        ),
        "portal_url": "https://www.miti.gov.bw",
        "documents": '["Monthly payroll register (per employee)", "Leave record sheets or system", "Payslips issued each pay period"]',
    },
    # ── Phase 4 — Activate Ongoing Compliance ───────────────────────────────
    {
        "phase": 4,
        "step_number": 1,
        "title": "Review your pre-loaded compliance deadlines",
        "description": (
            "Your CompliancePro dashboard is pre-seeded with key Botswana deadlines: "
            "BURS VAT returns, PAYE remittances, Corporate Income Tax, CIPA annual "
            "return, and Labour Act checkpoints. Review each and dismiss any that do "
            "not apply to your business."
        ),
        "portal_url": None,
        "documents": "[]",
    },
    {
        "phase": 4,
        "step_number": 2,
        "title": "Enable push notifications",
        "description": (
            "Go to Settings → Notifications and turn on deadline reminders. "
            "Choose your preferred lead time (30, 14, or 3 days) per category. "
            "Penalty alerts are recommended — they fire when a missed deadline "
            "triggers a BURS late-filing penalty."
        ),
        "portal_url": None,
        "documents": "[]",
    },
    {
        "phase": 4,
        "step_number": 3,
        "title": "Upload your founding documents to the Vault",
        "description": (
            "Upload your CIPA certificate, BURS TIN letter, and Trade Licence to the "
            "CompliancePro Document Vault. Starting your evidence trail now saves time "
            "when BURS audits or CIPA annual return queries arise. "
            "Set a renewal reminder for your Trade Licence."
        ),
        "portal_url": None,
        "documents": '["CIPA Certificate of Incorporation / Registration", "BURS TIN confirmation letter", "Trade Licence (current year)"]',
    },
    {
        "phase": 4,
        "step_number": 4,
        "title": "Mark Setup Complete",
        "description": (
            "You have completed the foundational compliance setup for your business "
            "in Botswana. Tap 'Finish Setup' to activate your compliance health score, "
            "penalty exposure engine, and trend tracking. "
            "You can re-access this guide at any time from Settings → Business Setup Guide."
        ),
        "portal_url": None,
        "documents": "[]",
    },
]


def upgrade() -> None:
    onboarding_steps = op.create_table(
        "onboarding_steps",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("phase", sa.Integer(), nullable=False),
        sa.Column("step_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("portal_url", sa.String(500), nullable=True),
        sa.Column("documents", sa.Text(), nullable=False, server_default="[]"),
        # kb_article_id left NULL for all seed rows; linked manually after KB-01–03 are seeded
        sa.Column("kb_article_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["kb_article_id"], ["knowledge_articles.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_onboarding_steps_id", "onboarding_steps", ["id"])
    op.create_index("ix_onboarding_steps_phase", "onboarding_steps", ["phase"])

    op.bulk_insert(onboarding_steps, STEPS)


def downgrade() -> None:
    op.drop_index("ix_onboarding_steps_phase", table_name="onboarding_steps")
    op.drop_index("ix_onboarding_steps_id", table_name="onboarding_steps")
    op.drop_table("onboarding_steps")