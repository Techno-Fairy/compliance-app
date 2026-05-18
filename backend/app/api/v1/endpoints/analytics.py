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
    # Group by category
    by_category: dict[str, list[Deadline]] = {c: [] for c in DeadlineCategory}
    for dl in deadlines:
        by_category[dl.category].append(dl)

    category_scores: dict[str, float] = {}
    breakdown = []

    for cat, items in by_category.items():
        if not items:
            category_scores[cat] = 100.0  # No deadlines = fully compliant
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

    # Weighted overall score
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


@router.get("/trends")
def get_trends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return monthly on-time vs. late counts for the past 6 months.
    Used to render the trend chart on the Dashboard (Week 5).

    A deadline is counted in the month of its due_date.
    on_time  = status is complete AND was not overdue when completed
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
    # Build 6-month window ending this month
    months = []
    for i in range(5, -1, -1):
        # First day of each month going back
        first = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        # Last day of that month
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