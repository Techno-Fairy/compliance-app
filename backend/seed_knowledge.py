#!/usr/bin/env python3
"""
seed_knowledge.py — Populate the knowledge_articles table with
plain-language Botswana compliance articles.

Run from the backend/ directory:
    python seed_knowledge.py

The script is idempotent — it checks for existing articles by title
before inserting to avoid duplicates on re-runs.
"""
import os
import sys

# Allow running directly without installing the package
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.db.database import Base
from app.models.knowledge import KBCategory, KnowledgeArticle

ARTICLES = [
    # ── VAT ──────────────────────────────────────────────────────────────────
    {
        "title": "Understanding VAT in Botswana",
        "category": KBCategory.VAT,
        "summary": "A plain-language guide to Value Added Tax (VAT) — who must register, "
                   "what rate applies, and when to file.",
        "tags": "vat,registration,rate,threshold",
        "body": """## What is VAT?

Value Added Tax (VAT) is a consumption tax levied on the supply of most goods and services in Botswana. It is administered by the Botswana Unified Revenue Service (BURS) under the Value Added Tax Act (Cap 50:03).

## Who Must Register?

Any business whose annual taxable turnover exceeds **BWP 1,000,000** in the previous 12 months, or is expected to exceed that threshold in the next 12 months, must register for VAT.

Voluntary registration is permitted for businesses below the threshold.

## The VAT Rate

The standard VAT rate is **12%** on taxable supplies. Certain supplies (e.g. basic foodstuffs, medical supplies, educational materials) are **zero-rated** at 0%. Some supplies are **exempt** (e.g. financial services, residential rental).

## Filing Frequency

- **Monthly filing**: Businesses with annual turnover above BWP 12 million, or those who elected monthly filing.
- **Bi-monthly (every 2 months)**: All other VAT-registered businesses.

Returns and payments are due on the **last day of the month** following the end of the tax period.

## How to File

VAT returns are submitted on the **BURS e-Services portal** at [eservices.burs.org.bw](https://eservices.burs.org.bw). You will need:
- Your VAT registration number (VRN)
- Total taxable sales for the period
- Input tax (VAT you paid on purchases)
- Output tax (VAT you charged customers)

## Penalties for Late Filing

- **Fixed penalty**: BWP 1,000 per outstanding return.
- **Interest**: 1.5% per month on any unpaid tax.

## Pre-Filing Checklist

- [ ] Gather all tax invoices issued during the period
- [ ] Gather all tax invoices received (purchases)
- [ ] Reconcile your sales ledger to the period
- [ ] Calculate output tax (sales × 12%)
- [ ] Calculate input tax (purchases × 12%)
- [ ] Log in to BURS e-Services and complete the VAT return form
- [ ] Upload this filing receipt to your CompliancePro Evidence Locker
""",
    },
    {
        "title": "How to Claim VAT Input Tax",
        "category": KBCategory.VAT,
        "summary": "Input tax is the VAT you paid on business purchases. You can deduct it "
                   "from the VAT you collected — but only with valid tax invoices.",
        "tags": "vat,input tax,invoices,refund",
        "body": """## What is Input Tax?

Input tax is the VAT you paid when purchasing goods or services for your business. BURS allows you to deduct this from the VAT you charged your customers (output tax). The difference is what you pay to (or claim back from) BURS.

## Requirements for Claiming Input Tax

To claim input tax, you must hold a **valid tax invoice** from your supplier. The invoice must show:
- Supplier's name and VAT registration number (VRN)
- Date of supply
- Description of goods/services
- Amount excluding VAT and the VAT amount separately

**You cannot claim input tax without a valid tax invoice.** BURS inspectors will disallow undocumented claims during an audit.

## Pro-Rata Apportionment

If your business makes both taxable and exempt supplies, you can only claim the portion of input tax that relates to taxable supplies. The apportionment formula is:

    Claimable input tax = Total input tax × (Taxable turnover / Total turnover)

## Refunds

If your input tax exceeds output tax in a period (common for exporters or during a startup phase), BURS will issue a refund. Refunds are processed within 21 days of a verified return.

## Record Keeping

Keep all tax invoices for **at least 5 years**. Upload digital copies to your Evidence Locker so they are accessible if BURS requests them during an audit.
""",
    },
    # ── PAYE ─────────────────────────────────────────────────────────────────
    {
        "title": "PAYE: Pay As You Earn — Employer Obligations",
        "category": KBCategory.PAYE,
        "summary": "If you employ staff in Botswana, you must deduct PAYE from their "
                   "salaries and remit it to BURS monthly.",
        "tags": "paye,employees,salary,withholding,monthly",
        "body": """## What is PAYE?

PAYE (Pay As You Earn) is the system by which employers deduct income tax from employee salaries and wages and remit it to BURS on behalf of employees. It is governed by the Income Tax Act (Cap 52:01).

## Who Must Deduct PAYE?

Any employer paying remuneration (salary, wages, overtime, bonuses, allowances, benefits-in-kind) to an employee must register as an employer with BURS and deduct PAYE.

## Tax Bands (2024/25 — Individuals)

| Annual Taxable Income (BWP) | Rate |
|-----------------------------|------|
| 0 – 48,000                  | 0%   |
| 48,001 – 84,000             | 5%   |
| 84,001 – 120,000            | 12.5%|
| 120,001 – 156,000           | 18.75%|
| Above 156,000               | 25%  |

*Always verify the current bands at [burs.org.bw](https://burs.org.bw) before filing.*

## Filing Frequency

PAYE returns (ITW7) are due **monthly** — by the **15th of the month** following the payroll period. If the 15th falls on a weekend or public holiday, the due date moves to the next business day.

## How to File

1. Calculate each employee's gross salary for the month.
2. Deduct allowances (basic allowance currently BWP 4,000/month).
3. Apply the tax band to the net taxable income.
4. Submit the ITW7 return on BURS e-Services.
5. Pay the deducted PAYE by the 15th.

## Year-End: ITW3 Certificate

At year end (30 June), issue each employee a **Tax Deduction Card (ITW3)** showing total remuneration and tax deducted for the year. File the ITW3 summary with BURS by **31 July**.

## Penalties

- BWP 1,000 fixed penalty per late return.
- 1.5% monthly interest on unpaid PAYE.
- Directors can be held personally liable for unpaid PAYE.
""",
    },
    # ── CIT ──────────────────────────────────────────────────────────────────
    {
        "title": "Corporate Income Tax (CIT) — Provisional and Final Returns",
        "category": KBCategory.CIT,
        "summary": "Botswana companies pay CIT at 22% on taxable profit. Two provisional "
                   "returns are due during the year, with a final return after year-end.",
        "tags": "cit,corporate tax,provisional,annual return",
        "body": """## What is CIT?

Corporate Income Tax (CIT) is levied on the taxable income (profit) of companies incorporated or deemed resident in Botswana. The standard rate is **22%**. Certain sectors (e.g. approved manufacturing companies) may qualify for reduced rates under the Income Tax Act.

## Tax Year

The default tax year runs from **1 July to 30 June**. Companies can apply to BURS to use a different year-end date.

## Provisional Returns

Companies must file **two provisional tax returns** per year, each covering an estimated half of the annual tax liability:

| Return | Period | Due Date |
|--------|---------|----------|
| 1st Provisional (BIT1) | First 6 months | 31 December (end of month 6) |
| 2nd Provisional (BIT2) | Second 6 months | 30 June (year-end) |

Provisional amounts are estimates — you are not penalised for underestimating, but an underpayment of more than 10% of the final liability attracts a 10% surcharge.

## Final Return

The final CIT return (BIT3) is due **within 3 months of the company's financial year-end**. This reconciles the provisional payments with the actual taxable profit.

## How to File

All CIT returns are submitted on the **BURS e-Services portal**. You will need:
- Audited or management accounts for the period
- Adjusted taxable income (accounting profit ± tax adjustments)
- Record of provisional payments already made

## Allowable Deductions

Common tax deductions include:
- Salaries and wages
- Rent and utilities used for business
- Depreciation (at BURS-specified rates — not accounting depreciation)
- Interest on business loans
- Marketing and advertising costs

## Penalties

- Late return: BWP 1,000 fixed penalty.
- Late payment: 1.5% per month on outstanding tax.
""",
    },
    # ── WHT ──────────────────────────────────────────────────────────────────
    {
        "title": "Withholding Tax (WHT) — What to Deduct and When",
        "category": KBCategory.WHT,
        "summary": "Botswana businesses must withhold tax on certain payments to residents "
                   "and non-residents — including dividends, interest, royalties, and contractor fees.",
        "tags": "wht,withholding,dividends,interest,royalties,non-resident",
        "body": """## What is Withholding Tax?

Withholding Tax (WHT) is tax deducted at source by the payer before remitting a payment to the recipient. The payer is responsible for deducting and remitting WHT to BURS.

## WHT Rates (Resident Payments)

| Payment Type | Rate |
|---|---|
| Dividends (to resident individuals) | 7.5% |
| Interest (to resident individuals from banks) | 10% |
| Commercial royalties | 15% |
| Payments to contractors / sub-contractors | 3% |
| Payments for management / consulting fees | 10% |

## WHT on Non-Residents

Payments to non-residents are subject to WHT at the following standard rates (reduced rates may apply under a double-tax agreement):

| Payment Type | Standard Rate |
|---|---|
| Dividends | 7.5% |
| Interest | 15% |
| Royalties | 15% |
| Fees for technical / management services | 15% |

## Filing and Payment

WHT is due on the **15th of the month** following the month in which the payment was made. File the WHT return (form IT10) on BURS e-Services and pay the withheld amount.

## Double Tax Agreements

Botswana has DTA treaties with several countries (including South Africa, UK, Mauritius, Zimbabwe). Payments to recipients in DTA countries may qualify for reduced WHT rates. Always check the treaty before applying the standard rate.

## Record Keeping

Issue WHT certificates to recipients and retain copies. Upload them to your Evidence Locker.
""",
    },
    # ── CIPA ─────────────────────────────────────────────────────────────────
    {
        "title": "CIPA Annual Returns — Keeping Your Company in Good Standing",
        "category": KBCategory.CIPA,
        "summary": "Every company registered with CIPA must file an annual return to "
                   "confirm its details and pay the statutory fee — or risk deregistration.",
        "tags": "cipa,annual return,company,obrs,deregistration",
        "body": """## What is the CIPA Annual Return?

The Companies and Intellectual Property Authority (CIPA) requires every registered company to file an **Annual Return** each year. This confirms that the company is still active, updates any changes to directors or registered address, and pays the annual fee. It is governed by the Companies Act (Cap 42:01).

## Who Must File?

All companies registered with CIPA, including:
- Private companies (Pty Ltd)
- Public companies (Ltd)
- External (foreign) companies registered in Botswana
- Partnerships and sole traders registered under business names

## When is it Due?

Annual returns are due within **30 days of the company's anniversary date** (the date of incorporation). For example, if your company was incorporated on 14 March 2019, your annual return is due by **13 April** each year.

## How to File

Annual returns are filed on the **OBRS portal** at [obrs.gov.bw](https://obrs.gov.bw). You will need:
- Your company registration number
- Current list of directors and shareholders
- Registered office address
- Annual return fee (varies by company type — check CIPA fee schedule)

## What Happens if You Don't File?

CIPA can **deregister** a company that fails to file its annual return. Deregistration means the company loses its legal personality — it cannot enter contracts, own property, or operate legally. Restoration requires a court order and is expensive.

## Pro Tip

Upload your CIPA certificate and annual return acknowledgement to your Evidence Locker. When applying for tenders, suppliers frequently request proof of company registration and good standing.
""",
    },
    {
        "title": "How to Change Company Directors with CIPA",
        "category": KBCategory.CIPA,
        "summary": "Adding or removing directors requires filing a Form 5 (Notice of "
                   "Change of Directors) with CIPA through the OBRS portal.",
        "tags": "cipa,directors,form 5,change,obrs",
        "body": """## When to File a Change of Directors

You must notify CIPA within **14 days** of any change to your company's directors — whether a new appointment, resignation, or change of address.

## The Process

1. Log in to the OBRS portal at [obrs.gov.bw](https://obrs.gov.bw).
2. Navigate to your company's profile.
3. Select **"Change of Directors"** and complete the Form 5 (Notice of Change of Directors).
4. Upload supporting documents (ID/passport of the new director, signed consent to act as director).
5. Pay the prescribed fee.
6. CIPA will update the company register and issue a confirmation.

## Required Documents

For each new director:
- Certified copy of national ID (Omang) or passport
- Proof of residential address (utility bill or bank statement)
- Signed Form 5

For a resigning director:
- Resignation letter or board resolution

## Why This Matters

Your company's CIPA register must accurately reflect current directors. Banks, tender authorities, and regulators check the CIPA register. An inaccurate register can delay loan applications, contract awards, and regulatory approvals.
""",
    },
    # ── LABOUR ───────────────────────────────────────────────────────────────
    {
        "title": "Employment Contracts — What the Botswana Labour Act Requires",
        "category": KBCategory.LABOUR,
        "summary": "Botswana's Employment Act requires written contracts for all employees "
                   "and sets minimum terms on hours, leave, and termination.",
        "tags": "labour,employment contract,leave,termination,employment act",
        "body": """## Legal Basis

Employment in Botswana is governed primarily by the **Employment Act (Cap 47:01)** and the **Trade Disputes Act (Cap 48:02)**. Non-compliance exposes employers to Industrial Court claims for unfair dismissal or breach of contract.

## Written Contract Requirement

Every employee must be given a written contract of employment before commencing work (or within 48 hours of starting). The contract must include:

- Name and address of employer and employee
- Date employment commenced
- Job title and description of duties
- Place of work
- Hours of work
- Remuneration (basic pay + any allowances)
- Basis of payment (monthly, weekly, etc.)
- Leave entitlement
- Notice period for termination

## Minimum Leave Entitlements

| Type | Minimum Entitlement |
|------|---------------------|
| Annual leave | 15 working days per year (after 12 months) |
| Sick leave | Up to 36 days per year with medical certificate |
| Maternity leave | 12 weeks (may not be required to work 6 weeks before/after birth) |
| Public holidays | All 12 Botswana public holidays |

## Notice Periods

| Length of Service | Minimum Notice |
|---|---|
| Less than 6 months | 1 week |
| 6 months – 1 year | 2 weeks |
| 1 – 5 years | 1 month |
| More than 5 years | 2 months |

## Disciplinary and Dismissal Process

Dismissal without following a fair procedure is **unfair dismissal** under Botswana law. Before dismissing an employee you must:

1. Issue a written notice of alleged misconduct.
2. Hold a disciplinary hearing — give the employee a chance to respond.
3. Issue a written outcome with reasons.
4. Allow the employee to appeal.

Keep records of every step. Upload disciplinary hearing notes and outcome letters to your Evidence Locker.

## Penalties

Employers who violate the Employment Act can be fined and ordered to reinstate or compensate the employee. The Industrial Court can award up to **24 months' remuneration** for unfair dismissal.
""",
    },
    {
        "title": "Minimum Wage in Botswana — Current Rates",
        "category": KBCategory.LABOUR,
        "summary": "Botswana sets sector-specific minimum wages by statutory instrument. "
                   "Check the current rate for your sector before setting employee pay.",
        "tags": "labour,minimum wage,sector,rates",
        "body": """## Who Sets Minimum Wages?

The Minister of Employment, Labour Productivity and Skills Development sets minimum wages by Statutory Instrument, usually revised every 12–24 months. Minimum wages are sector-specific.

## Key Sectors (Verify Current Rates at DPSM/MLHA)

| Sector | Approximate Monthly Minimum (BWP) |
|--------|-----------------------------------|
| Retail and wholesale trade | ~1,600 |
| Construction | ~1,750 |
| Hotel and catering | ~1,600 |
| Security | ~1,650 |
| Domestic workers | ~1,000 |
| Agriculture | ~900 |

*These figures are illustrative — always confirm with the Ministry of Employment or the latest Statutory Instrument before setting salaries.*

## Important Notes

- Minimum wages are **gross** amounts — PAYE is deducted on top.
- Housing, transport, and other allowances may or may not count toward the minimum depending on the sector's Statutory Instrument.
- Paying below minimum wage is a criminal offence.

## How to Stay Compliant

1. Identify the Statutory Instrument that applies to your sector.
2. Confirm the minimum rate in force.
3. Update payroll before the effective date of any revision.
4. Keep copies of pay slips for at least 3 years.
""",
    },
    # ── GENERAL ──────────────────────────────────────────────────────────────
    {
        "title": "Understanding BURS Audit Risk — What Triggers an Audit",
        "category": KBCategory.GENERAL,
        "summary": "BURS uses a risk-based audit selection system. Understanding what "
                   "flags a business for audit helps you stay prepared.",
        "tags": "audit,burs,risk,compliance,inspection",
        "body": """## How BURS Selects Businesses for Audit

BURS uses a combination of risk indicators and random selection to choose which businesses to audit. Common triggers include:

- **Frequent VAT refund claims** — especially for businesses that consistently show input tax exceeding output tax.
- **Inconsistency between VAT returns and CIT returns** — mismatched turnover figures between different returns.
- **Large cash transactions** — businesses that deal predominantly in cash attract closer scrutiny.
- **Industry benchmarking** — BURS compares your gross profit margin to sector averages. A margin significantly below the industry average suggests underreported income.
- **Third-party information** — BURS receives data from banks, other government agencies, and suppliers. Unreported income identified from third-party sources is a major audit trigger.
- **Late filing history** — businesses with a pattern of late returns are perceived as higher risk.
- **Anonymous tip-offs** — BURS has a formal tip-off programme.

## What Happens During an Audit

1. BURS issues a written notice of audit, specifying the tax type(s) and period(s) under review.
2. You are given time to prepare and produce records.
3. BURS auditors review your books, returns, invoices, and bank statements.
4. If discrepancies are found, BURS issues an assessment.
5. You have the right to object to any assessment within **30 days**.

## How to Prepare

The best audit preparation is ongoing good record keeping:
- Keep all tax invoices (sales and purchases) for 5 years.
- Reconcile your VAT returns to your accounting records each period.
- Ensure your CIT return turnover matches your VAT return turnover.
- Upload all filing receipts and certificates to your Evidence Locker so they are ready on demand.

## Your Rights as a Taxpayer

- You are entitled to be treated professionally and with respect.
- You can be represented by a tax agent or lawyer.
- You can object to any BURS assessment within 30 days.
- You can appeal to the Tax Appeals Tribunal if your objection is rejected.
""",
    },
    {
        "title": "Tax Clearance Certificate — How to Obtain One",
        "category": KBCategory.GENERAL,
        "summary": "A BURS Tax Clearance Certificate (TCC) proves your business has no "
                   "outstanding tax obligations. Most tenders and government contracts require it.",
        "tags": "tax clearance,tcc,tender,burs,certificate",
        "body": """## What is a Tax Clearance Certificate?

A Tax Clearance Certificate (TCC) is a letter issued by BURS confirming that your business has no outstanding tax obligations — all returns are filed and all taxes are paid up to date. It is commonly required for:

- Government tender applications
- Bank loan applications
- Liquor licence renewals
- Trade licence renewals
- Applying to be an approved supplier to large corporates

## Eligibility

Your business must be **fully tax compliant** to receive a TCC:
- All VAT returns filed and paid.
- All PAYE returns filed and paid.
- All CIT provisional and final returns filed and paid.
- No outstanding objections or disputes (or disputes under formal appeal).

## How to Apply

1. Log in to the **BURS e-Services portal** at [eservices.burs.org.bw](https://eservices.burs.org.bw).
2. Navigate to **Tax Clearance Certificate** under the services menu.
3. Submit the application.
4. BURS will review your tax account and issue the TCC (usually within 2–5 business days if compliant).

## Validity

TCCs are typically valid for **6 months** from the date of issue. Tender requirements may specify a more recent TCC — check before applying.

## Pro Tip

Upload your TCC to your CompliancePro Evidence Locker as soon as it is issued. This makes it instantly available when a tender deadline is approaching and you need to produce it quickly.
""",
    },
]


def main():
    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    inserted = 0
    skipped = 0

    try:
        for article_data in ARTICLES:
            exists = (
                db.query(KnowledgeArticle)
                .filter(KnowledgeArticle.title == article_data["title"])
                .first()
            )
            if exists:
                skipped += 1
                continue

            article = KnowledgeArticle(**article_data)
            db.add(article)
            inserted += 1

        db.commit()
        print(f"✅ Knowledge base seeded — {inserted} inserted, {skipped} skipped (duplicates).")
    except Exception as exc:
        db.rollback()
        print(f"❌ Seeding failed: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()