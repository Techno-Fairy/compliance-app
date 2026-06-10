# backend/app/api/v1/endpoints/onboarding.py
"""
Onboarding endpoints — Week 6.

BE-27  GET   /onboarding/steps                  — list all steps with per-business completion status
BE-28  PATCH /onboarding/steps/{step_id}        — mark a step complete or incomplete
BE-29  GET   /onboarding/progress               — lightweight summary
BE-30  POST  /onboarding/sync-local-progress    — Step 5: sync local SQLite progress after guide registration
"""
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, resolve_business_id
from app.db.database import get_db
from app.models.business import BusinessProfile
from app.models.onboarding import OnboardingProgress, OnboardingStep
from app.models.user import User
from app.schemas.onboarding import (
    OnboardingPhaseProgress,
    OnboardingPhaseResponse,
    OnboardingProgressSummary,
    OnboardingStatusResponse,
    OnboardingStepResponse,
    OnboardingStepUpdateRequest,
    OnboardingStepUpdateResponse,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


# ── BE-27: GET /onboarding/steps ──────────────────────────────────────────────
@router.get("/steps", response_model=OnboardingStatusResponse)
def get_onboarding_steps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    business_id: int = Depends(resolve_business_id),
):
    """
    Return all onboarding steps grouped by phase, with completion status for
    the requesting business.
    """
    profile = db.get(BusinessProfile, business_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Business profile not found."},
        )

    steps: list[OnboardingStep] = (
        db.query(OnboardingStep)
        .order_by(OnboardingStep.phase, OnboardingStep.step_number)
        .all()
    )

    if not steps:
        return OnboardingStatusResponse(
            is_onboarding_complete=profile.is_onboarding_complete,
            total_steps=0,
            completed_steps=0,
            overall_progress_pct=0.0,
            phases=[],
        )

    progress_rows: list[OnboardingProgress] = (
        db.query(OnboardingProgress)
        .filter(OnboardingProgress.business_id == business_id)
        .all()
    )
    progress_map: dict[int, OnboardingProgress] = {
        p.step_id: p for p in progress_rows
    }

    phase_buckets: dict[int, list[OnboardingStepResponse]] = defaultdict(list)
    total_steps = len(steps)
    completed_steps = 0

    for step in steps:
        prog = progress_map.get(step.id)
        is_completed = prog.completed if prog else False
        completed_at = prog.completed_at if prog else None

        if is_completed:
            completed_steps += 1

        phase_buckets[step.phase].append(
            OnboardingStepResponse(
                id=step.id,
                phase=step.phase,
                step_number=step.step_number,
                title=step.title,
                description=step.description,
                portal_url=step.portal_url,
                documents=step.documents_list,
                kb_article_id=step.kb_article_id,
                completed=is_completed,
                completed_at=completed_at,
            )
        )

    phases = []
    for phase_num in sorted(phase_buckets.keys()):
        phase_steps = phase_buckets[phase_num]
        phase_completed = sum(1 for s in phase_steps if s.completed)
        phases.append(
            OnboardingPhaseResponse(
                phase=phase_num,
                total_steps=len(phase_steps),
                completed_steps=phase_completed,
                steps=phase_steps,
            )
        )

    overall_pct = round((completed_steps / total_steps) * 100, 1) if total_steps else 0.0

    return OnboardingStatusResponse(
        is_onboarding_complete=profile.is_onboarding_complete,
        total_steps=total_steps,
        completed_steps=completed_steps,
        overall_progress_pct=overall_pct,
        phases=phases,
    )


# ── BE-28: PATCH /onboarding/steps/{step_id} ─────────────────────────────────
@router.patch(
    "/steps/{step_id}",
    response_model=OnboardingStepUpdateResponse,
)
def update_onboarding_step(
    step_id: int,
    body: OnboardingStepUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    business_id: int = Depends(resolve_business_id),
):
    step = db.get(OnboardingStep, step_id)
    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Onboarding step not found."},
        )

    progress = (
        db.query(OnboardingProgress)
        .filter(
            OnboardingProgress.business_id == business_id,
            OnboardingProgress.step_id == step_id,
        )
        .first()
    )
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Progress record not found."},
        )

    progress.completed = body.completed
    progress.completed_at = (
        datetime.now(timezone.utc) if body.completed else None
    )
    progress.completed_by = current_user.id if body.completed else None
    db.commit()
    db.refresh(progress)

    # Recalculate totals
    all_progress = (
        db.query(OnboardingProgress)
        .filter(OnboardingProgress.business_id == business_id)
        .all()
    )
    total_steps = len(all_progress)
    completed_steps = sum(1 for p in all_progress if p.completed)
    overall_pct = (
        round((completed_steps / total_steps) * 100, 1) if total_steps else 0.0
    )
    is_complete = completed_steps == total_steps

    return OnboardingStepUpdateResponse(
        step=OnboardingStepResponse(
            id=step.id,
            phase=step.phase,
            step_number=step.step_number,
            title=step.title,
            description=step.description,
            portal_url=step.portal_url,
            documents=step.documents_list,
            kb_article_id=step.kb_article_id,
            completed=progress.completed,
            completed_at=progress.completed_at,
        ),
        total_steps=total_steps,
        completed_steps=completed_steps,
        overall_progress_pct=overall_pct,
        is_onboarding_complete=is_complete,
    )


# ── BE-29: GET /onboarding/progress ──────────────────────────────────────────
@router.get("/progress", response_model=OnboardingProgressSummary)
def get_onboarding_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    business_id: int = Depends(resolve_business_id),
):
    profile = db.get(BusinessProfile, business_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Business profile not found."},
        )

    progress_rows: list[OnboardingProgress] = (
        db.query(OnboardingProgress)
        .filter(OnboardingProgress.business_id == business_id)
        .all()
    )

    steps_all: list[OnboardingStep] = db.query(OnboardingStep).all()
    progress_map = {p.step_id: p for p in progress_rows}

    phase_data: dict[int, dict] = {}
    for step in steps_all:
        if step.phase not in phase_data:
            phase_data[step.phase] = {"total": 0, "complete": 0}
        phase_data[step.phase]["total"] += 1
        prog = progress_map.get(step.id)
        if prog and prog.completed:
            phase_data[step.phase]["complete"] += 1

    phases = [
        OnboardingPhaseProgress(
            phase=phase_num,
            steps_complete=data["complete"],
            steps_total=data["total"],
            is_complete=data["complete"] == data["total"],
        )
        for phase_num, data in sorted(phase_data.items())
    ]

    steps_complete = sum(p.steps_complete for p in phases)
    steps_total = sum(p.steps_total for p in phases)

    return OnboardingProgressSummary(
        phases_complete=sum(1 for p in phases if p.is_complete),
        steps_complete=steps_complete,
        steps_total=steps_total,
        is_complete=profile.is_onboarding_complete,
        phases=phases,
    )


# ── BE-30: POST /onboarding/sync-local-progress (Step 5) ─────────────────────

class LocalProgressItem(BaseModel):
    step_id: int
    completed_at: str | None = None


class SyncLocalProgressRequest(BaseModel):
    """
    Payload sent by the frontend after a Starter Guide user registers.

    `completed_steps` is the list of steps the user marked done locally,
    with optional completed_at timestamps from the local SQLite store.
    """
    completed_steps: list[LocalProgressItem]


class SyncLocalProgressResponse(BaseModel):
    synced: int
    message: str


@router.post("/sync-local-progress", response_model=SyncLocalProgressResponse)
def sync_local_progress(
    body: SyncLocalProgressRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    business_id: int = Depends(resolve_business_id),
):
    """
    Step 5 — Called once, immediately after register-with-profile succeeds.

    Updates completed_at timestamps on the OnboardingProgress rows that
    were bulk-set to completed=True during registration, using the
    client's local timestamps.

    Only updates rows that are already marked completed=True and belong
    to this business — cannot be used to mark previously incomplete steps
    or to modify another business's data.
    """
    if not body.completed_steps:
        return SyncLocalProgressResponse(synced=0, message="No steps to sync.")

    # Build lookup of existing progress rows for this business
    progress_rows = (
        db.query(OnboardingProgress)
        .filter(OnboardingProgress.business_id == business_id)
        .all()
    )
    progress_map = {p.step_id: p for p in progress_rows}

    synced = 0
    for item in body.completed_steps:
        row = progress_map.get(item.step_id)
        if row is None or not row.completed:
            # Skip: either doesn't exist or not marked complete — don't trust client
            continue

        if item.completed_at:
            try:
                ts = datetime.fromisoformat(item.completed_at.replace("Z", "+00:00"))
                row.completed_at = ts
                synced += 1
            except ValueError:
                pass  # Bad timestamp — leave the server default

    db.commit()

    return SyncLocalProgressResponse(
        synced=synced,
        message=f"Synced timestamps for {synced} completed steps.",
    )