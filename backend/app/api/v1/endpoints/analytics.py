"""
Analytics endpoints — health score and penalty exposure.

Week 2 deliverables (preserved):
  BE-09  GET /analytics/health-score

Week 3 deliverables:
  BE-12  GET /analytics/penalty-exposure — per-deadline BWP calculation

Week 5 deliverables (stub included for completeness):
  BE-23  GET /analytics/trends — 6-month on-time vs. late chart data
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.business import BusinessProfile
from app.models.deadline import Deadline, DeadlineCategory, DeadlineStatus
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ── Health Score Weights ──────────────────────────────────────────────────────
#
# The compliance health score is a weighted average across all non-custom
# deadlines. Each deadline contributes a score based on its status:
#
#   complete  → 100 points
#   pending   → 75  points (not yet due — no penalty risk)
#   pending but overdue → 0 points (missed without being marked)
#   missed    → 0   points (explicitly marked missed)
#
# Category weights reflect regulatory severity in Botswana:
#   BURS   → 0.45  (tax authority — highest penalty risk)
#   CIPA   → 0.25  (company registration — deregistration risk)
#   LABOUR → 0.20  (employment law — tribunal risk)
#   CUSTOM → 0.10  (user-defined — lowest weight)
#
CATEGORY_WEIGHTS: dict[str, float] = {
    DeadlineCategory.BURS:   0.45,
    DeadlineCategory.CIPA:   0.25,
    DeadlineCategory.LABOUR: 0.20,
    DeadlineCategory.CUSTOM: 0.10,
}


def _score_deadline(dl: Deadline, today: date) -> int:
    """Return a 0–100 score for a single deadline."""
    if dl.status == DeadlineStatus.COMPLETE:
        return 100
    if dl.status == DeadlineStatus.MISSED:
        return 0
    # PENDING — check if it is actually overdue
    if dl.due_date < today:
        return 0
    return 75


def _calculate_health_score(
    deadlines: list[Deadline],
    today: date,
) -> tuple[int, list[dict]]:
    """
    Calculate the overall health score and a per-category breakdown.

    Returns:
        (overall_score, breakdown)
        breakdown is a list of dicts: {category, score, total, complete, overdue}
    """
    by_category: dict[str, list[Deadline]] = {c: [] for c in DeadlineCategory}
    for dl in deadlines:
        by_category[dl.category].append(dl)

    category_scores: dict[str, float] = {}
    breakdown = []

    for cat, items in by_category.items():
        if not items:
            category_scores[cat] = 100.0
            continue

        total = len(items)
        complete = sum(1 for d in items if d.status == DeadlineStatus.COMPLETE)
        overdue = sum(
            1 for d in items
            if d.status == DeadlineStatus.MISSED
            or (d.status == DeadlineStatus.PENDING and d.due_date < today)
        )
        raw = sum(_score_deadline(d, today) for d in items) / total
        category_scores[cat] = raw

        breakdown.append({
            "category": cat,
            "score": round(raw),
            "total": total,
            "complete": complete,
            "overdue": overdue,
        })

    total_weight = sum(
        CATEGORY_WEIGHTS[cat]
        for cat, items in by_category.items()
        if items
    ) or 1.0

    overall = sum(
        category_scores[cat] * CATEGORY_WEIGHTS[cat]
        for cat, items in by_category.items()
        if items
    ) / total_weight

    return round(overall), breakdown


# ── Penalty Exposure Engine ───────────────────────────────────────────────────
#
# Formula (from PRD Section 10.3):
#
#   months_overdue = days_overdue / 30
#
#   penalty_today = fixed_penalty
#               + (outstanding_amount * monthly_rate * months_overdue)
#
#   penalty_in_7_days = fixed_penalty
#               + (outstanding_amount * monthly_rate * (months_overdue + 7/30))
#
# If no outstanding amount is set, only the fixed_penalty is shown and
# the UI displays "Minimum BWP X exposure".
#
# Penalty data is stored on the Deadline model (set by the seed script):
#   fixed_penalty_bwp        → e.g. 1000.0 for VAT
#   monthly_interest_rate    → e.g. 0.015 (1.5%)
#   estimated_outstanding_bwp → user-entered; None if not set
#

def _calculate_penalty(dl: Deadline, today: date) -> dict:
    """
    Calculate the BWP penalty exposure for a single overdue deadline.

    Returns a dict matching the PRD API contract (Section 10.4).
    """
    days_overdue = max(0, (today - dl.due_date).days)
    months_overdue = days_overdue / 30.0

    fixed = dl.fixed_penalty_bwp or 0.0
    rate = dl.monthly_interest_rate or 0.0
    outstanding = dl.estimated_outstanding_bwp  # may be None

    if outstanding is not None:
        interest_today = outstanding * rate * months_overdue
        interest_7d = outstanding * rate * (months_overdue + 7 / 30)
    else:
        interest_today = 0.0
        interest_7d = 0.0

    total_today = fixed + interest_today
    total_7d = fixed + interest_7d

    return {
        "deadline_id": dl.id,
        "name": dl.name,
        "category": dl.category,
        "days_overdue": days_overdue,
        "fixed_penalty_bwp": round(fixed, 2),
        "interest_penalty_bwp": round(interest_today, 2),
        "total_penalty_bwp": round(total_today, 2),
        "penalty_in_7_days_bwp": round(total_7d, 2),
        "estimated_outstanding_bwp": outstanding,
        # Flag so the UI can show "Minimum BWP X" when no outstanding amount
        "is_minimum_estimate": outstanding is None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health-score")
def get_health_score(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the current compliance health score for the authenticated
    user's business, plus a per-category breakdown.

    Score bands:
      80–100  → Green  (healthy)
      50–79   → Amber  (attention needed)
      0–49    → Red    (critical)
    """
    business = (
        db.query(BusinessProfile)
        .filter(BusinessProfile.owner_id == current_user.id)
        .first()
    )
    if not business:
        return {
            "score": 100,
            "band": "green",
            "breakdown": [],
            "message": "No business profile found.",
        }

    deadlines = (
        db.query(Deadline)
        .filter(Deadline.business_id == business.id)
        .all()
    )

    if not deadlines:
        return {
            "score": 100,
            "band": "green",
            "breakdown": [],
            "overdue_count": 0,
            "message": "No deadlines found. Run the seed script to populate.",
        }

    today = date.today()
    score, breakdown = _calculate_health_score(deadlines, today)

    overdue_count = sum(
        1 for d in deadlines
        if d.status == DeadlineStatus.MISSED
        or (d.status == DeadlineStatus.PENDING and d.due_date < today)
    )

    if score >= 80:
        band = "green"
    elif score >= 50:
        band = "amber"
    else:
        band = "red"

    return {
        "score": score,
        "band": band,
        "overdue_count": overdue_count,
        "breakdown": sorted(breakdown, key=lambda x: x["category"]),
    }


@router.get("/penalty-exposure")
def get_penalty_exposure(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the total BWP penalty exposure for the authenticated user's business,
    with a per-deadline breakdown.

    Only deadlines that are overdue (MISSED or PENDING past due date) are
    included. Deadlines marked COMPLETE are excluded.

    Response matches the PRD Section 10.4 API contract:
    {
        "total_exposure_bwp": 3500.00,
        "has_minimum_estimates": true,
        "breakdown": [
            {
                "deadline_id": 77,
                "name": "PAYE Remittance - January 2026",
                "category": "BURS",
                "days_overdue": 89,
                "fixed_penalty_bwp": 500.00,
                "interest_penalty_bwp": 0.00,
                "total_penalty_bwp": 500.00,
                "penalty_in_7_days_bwp": 500.00,
                "estimated_outstanding_bwp": null,
                "is_minimum_estimate": true
            }
        ]
    }
    """
    business = (
        db.query(BusinessProfile)
        .filter(BusinessProfile.owner_id == current_user.id)
        .first()
    )
    if not business:
        return {
            "total_exposure_bwp": 0.0,
            "has_minimum_estimates": False,
            "breakdown": [],
        }

    today = date.today()

    # Only fetch overdue deadlines — pending past due date OR explicitly missed
    all_deadlines = (
        db.query(Deadline)
        .filter(Deadline.business_id == business.id)
        .all()
    )

    overdue = [
        d for d in all_deadlines
        if d.status == DeadlineStatus.MISSED
        or (d.status == DeadlineStatus.PENDING and d.due_date < today)
    ]

    breakdown = [_calculate_penalty(dl, today) for dl in overdue]

    # Sort by highest exposure first so the dashboard shows the worst risk
    breakdown.sort(key=lambda x: x["total_penalty_bwp"], reverse=True)

    total = round(sum(b["total_penalty_bwp"] for b in breakdown), 2)
    has_minimum_estimates = any(b["is_minimum_estimate"] for b in breakdown)

    return {
        "total_exposure_bwp": total,
        "has_minimum_estimates": has_minimum_estimates,
        "breakdown": breakdown,
    }


@router.get("/trends")
def get_trends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return monthly on-time vs. late counts for the past 6 months.
    Used to render the trend chart on the Dashboard (Week 5).

    A deadline is counted in the month of its due_date.
    on_time  = status is complete
    late     = status is missed OR pending past due date
    """
    business = (
        db.query(BusinessProfile)
        .filter(BusinessProfile.owner_id == current_user.id)
        .first()
    )
    if not business:
        return {"months": []}

    today = date.today()
    months = []
    for i in range(5, -1, -1):
        first = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        if first.month == 12:
            last = first.replace(year=first.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            last = first.replace(month=first.month + 1, day=1) - timedelta(days=1)
        months.append((first, last))

    result = []
    for first, last in months:
        month_deadlines = (
            db.query(Deadline)
            .filter(
                Deadline.business_id == business.id,
                Deadline.due_date >= first,
                Deadline.due_date <= last,
            )
            .all()
        )
        on_time = sum(1 for d in month_deadlines if d.status == DeadlineStatus.COMPLETE)
        late = sum(
            1 for d in month_deadlines
            if d.status == DeadlineStatus.MISSED
            or (d.status == DeadlineStatus.PENDING and d.due_date < today)
        )
        result.append({
            "month": first.strftime("%b %Y"),
            "on_time": on_time,
            "late": late,
            "total": len(month_deadlines),
        })

    return {"months": result}