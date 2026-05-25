"""
seed_deadlines.py — Botswana Regulatory Deadline Seeder
========================================================
Run once after alembic upgrade head to populate BURS and CIPA
deadlines for a given business profile.

Usage:
    python seed_deadlines.py --business-id 1
    python seed_deadlines.py --business-id 1 --year 2026

The script is idempotent — running it twice will not create duplicates.

Week 3 update: each deadline now includes penalty engine fields
(fixed_penalty_bwp, monthly_interest_rate) and portal_url so the
penalty exposure calculator works immediately after seeding.
"""

import argparse
from datetime import date

from sqlalchemy.orm import Session

# Register all models with SQLAlchemy's mapper before any query runs
from app.models import user, business, deadline, document, history  # noqa: F401

from app.db.database import SessionLocal
from app.models.deadline import Deadline, DeadlineCategory, DeadlineStatus

BURS_PORTAL = "https://eservices.burs.org.bw"
CIPA_PORTAL  = "https://obrs.gov.bw"
LABOUR_PORTAL = "https://www.gov.bw/ministries/ministry-employment-labour-productivity"

# ── Botswana 2026 Regulatory Deadline Calendar ────────────────────────────────
#
# Sources:
#   BURS: www.burs.org.bw — VAT returns due last day of month following
#         the tax period; PAYE due 15th of following month;
#         CIT provisional returns due 25th of 6th & 12th month of tax year.
#   CIPA: companies.org.bw — annual return due within 30 days of
#         anniversary of incorporation (we use a representative date).
#
# Tuple format:
#   (name, category, due_date, penalty_info, recurrence,
#    fixed_penalty_bwp, monthly_interest_rate, portal_url)
# ─────────────────────────────────────────────────────────────────────────────

def _burs_vat_monthly(year: int) -> list[tuple]:
    """VAT returns - due last day of the month following the tax period."""
    deadlines = []
    periods = [
        ("January",   date(year, 2, 28)),
        ("February",  date(year, 3, 31)),
        ("March",     date(year, 4, 30)),
        ("April",     date(year, 5, 31)),
        ("May",       date(year, 6, 30)),
        ("June",      date(year, 7, 31)),
        ("July",      date(year, 8, 31)),
        ("August",    date(year, 9, 30)),
        ("September", date(year, 10, 31)),
        ("October",   date(year, 11, 30)),
        ("November",  date(year, 12, 31)),
        ("December",  date(year + 1, 1, 31)),
    ]
    for period, due in periods:
        deadlines.append((
            f"VAT Return - {period} {year}",
            DeadlineCategory.BURS,
            due,
            "BWP 1,000 fixed penalty + 1.5% interest per month on unpaid tax.",
            "monthly",
            1000.0,   # fixed_penalty_bwp
            0.015,    # monthly_interest_rate (1.5%)
            BURS_PORTAL,
        ))
    return deadlines


def _burs_paye(year: int) -> list[tuple]:
    """PAYE - due 15th of the month following the payroll period."""
    deadlines = []
    months = [
        ("January",   date(year, 2, 15)),
        ("February",  date(year, 3, 15)),
        ("March",     date(year, 4, 15)),
        ("April",     date(year, 5, 15)),
        ("May",       date(year, 6, 15)),
        ("June",      date(year, 7, 15)),
        ("July",      date(year, 8, 15)),
        ("August",    date(year, 9, 15)),
        ("September", date(year, 10, 15)),
        ("October",   date(year, 11, 15)),
        ("November",  date(year, 12, 15)),
        ("December",  date(year + 1, 1, 15)),
    ]
    for month, due in months:
        deadlines.append((
            f"PAYE Remittance - {month} {year}",
            DeadlineCategory.BURS,
            due,
            "BWP 500 fixed penalty + 1.5% interest per month on unpaid PAYE.",
            "monthly",
            500.0,    # fixed_penalty_bwp
            0.015,    # monthly_interest_rate (1.5%)
            BURS_PORTAL,
        ))
    return deadlines


def _burs_cit(year: int) -> list[tuple]:
    """
    Corporate Income Tax - provisional returns due 25th of the 6th and
    12th month of the tax year (assumes Jan–Dec tax year).
    Final return due 90 days after year end (31 March of following year).
    """
    return [
        (
            f"CIT Provisional Return (1st) - {year}",
            DeadlineCategory.BURS,
            date(year, 6, 25),
            "Penalty: 5% of estimated tax if provisional return not filed.",
            "annually",
            2000.0,   # fixed_penalty_bwp (CIT)
            0.015,
            BURS_PORTAL,
        ),
        (
            f"CIT Provisional Return (2nd) - {year}",
            DeadlineCategory.BURS,
            date(year, 12, 25),
            "Penalty: 5% of estimated tax if provisional return not filed.",
            "annually",
            2000.0,
            0.015,
            BURS_PORTAL,
        ),
        (
            f"CIT Final Return - {year} Tax Year",
            DeadlineCategory.BURS,
            date(year + 1, 3, 31),
            (
                "BWP 2,000 penalty for late filing + "
                "1.5% interest per month on unpaid tax."
            ),
            "annually",
            2000.0,
            0.015,
            BURS_PORTAL,
        ),
    ]


def _cipa_deadlines(year: int) -> list[tuple]:
    """
    CIPA Annual Return - due within 30 days of anniversary of incorporation.
    We seed a representative date (30 June) as a reminder.
    Update the due_date to match the business's actual incorporation anniversary.
    """
    return [
        (
            f"CIPA Annual Return - {year}",
            DeadlineCategory.CIPA,
            date(year, 6, 30),
            (
                "BWP 250 per month late fee for Pty Ltd. "
                "Risk of company deregistration after 3 months."
            ),
            "annually",
            250.0,    # BWP 250 per month (monthly accrual — first month)
            None,     # No interest rate; penalty is per-month flat fee
            CIPA_PORTAL,
        ),
        (
            f"CIPA Business Name Renewal - {year}",
            DeadlineCategory.CIPA,
            date(year, 6, 30),
            "BWP 100 late renewal fee for sole trader business names.",
            "annually",
            100.0,
            None,
            CIPA_PORTAL,
        ),
    ]


def _labour_deadlines(year: int) -> list[tuple]:
    """
    Employment Act compliance reminders - annual review checkpoints.
    No monetary fixed penalty defined by the Act for missed reviews,
    but non-compliance creates Industrial Court liability.
    """
    return [
        (
            f"Employment Contracts Review - {year}",
            DeadlineCategory.LABOUR,
            date(year, 3, 31),
            (
                "Non-compliant contracts expose the business to "
                "Industrial Court claims under the Employment Act."
            ),
            "annually",
            None,     # No fixed BURS-style penalty
            None,
            LABOUR_PORTAL,
        ),
        (
            f"Annual Leave Records Audit - {year}",
            DeadlineCategory.LABOUR,
            date(year, 6, 30),
            "Failure to grant statutory leave: BWP 5,000 fine per employee.",
            "annually",
            5000.0,
            None,
            LABOUR_PORTAL,
        ),
        (
            f"Workplace Safety Compliance Review - {year}",
            DeadlineCategory.LABOUR,
            date(year, 9, 30),
            (
                "Factories Act violations: fines up to BWP 10,000 "
                "+ potential closure order."
            ),
            "annually",
            10000.0,
            None,
            LABOUR_PORTAL,
        ),
    ]


def build_deadline_calendar(year: int) -> list[tuple]:
    """Return the full set of deadlines for a given year."""
    return (
        _burs_vat_monthly(year)
        + _burs_paye(year)
        + _burs_cit(year)
        + _cipa_deadlines(year)
        + _labour_deadlines(year)
    )


# ── Seeder ────────────────────────────────────────────────────────────────────

def seed(business_id: int, year: int, db: Session) -> int:
    """
    Insert deadline records for the given business and year.
    Skips any deadline whose (business_id, name) pair already exists
    so the function is safe to run multiple times.

    Week 3: also backfills penalty engine fields on existing records
    if they are missing (safe to re-run after upgrading from Week 2).
    """
    existing: dict[str, Deadline] = {
        dl.name: dl
        for dl in db.query(Deadline)
        .filter(Deadline.business_id == business_id)
        .all()
    }

    calendar = build_deadline_calendar(year)
    inserted = 0
    updated = 0

    for row in calendar:
        name, category, due_date, penalty_info, recurrence, fixed_penalty, interest_rate, portal_url = row

        if name in existing:
            # Backfill penalty fields if they are missing (idempotent upgrade)
            dl = existing[name]
            changed = False
            if dl.fixed_penalty_bwp is None and fixed_penalty is not None:
                dl.fixed_penalty_bwp = fixed_penalty
                changed = True
            if dl.monthly_interest_rate is None and interest_rate is not None:
                dl.monthly_interest_rate = interest_rate
                changed = True
            if dl.portal_url is None and portal_url:
                dl.portal_url = portal_url
                changed = True
            if changed:
                updated += 1
            continue

        dl = Deadline(
            business_id=business_id,
            name=name,
            category=category,
            due_date=due_date,
            status=DeadlineStatus.PENDING,
            is_custom=False,
            penalty_info=penalty_info,
            recurrence=recurrence,
            fixed_penalty_bwp=fixed_penalty,
            monthly_interest_rate=interest_rate,
            portal_url=portal_url,
        )
        db.add(dl)
        inserted += 1

    db.commit()
    return inserted


# ── CLI entry point ───────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed Botswana regulatory deadlines for a business."
    )
    parser.add_argument(
        "--business-id",
        type=int,
        required=True,
        help="ID of the BusinessProfile to seed deadlines for.",
    )
    parser.add_argument(
        "--year",
        type=int,
        default=date.today().year,
        help="Calendar year to seed (default: current year).",
    )
    args = parser.parse_args()

    db: Session = SessionLocal()
    try:
        count = seed(business_id=args.business_id, year=args.year, db=db)
        print(f"Seeded/updated {count} deadlines for business_id={args.business_id} ({args.year}).")
    finally:
        db.close()


if __name__ == "__main__":
    main()