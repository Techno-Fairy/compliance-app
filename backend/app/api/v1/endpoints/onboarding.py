"""
Onboarding endpoints — Week 6.

BE-27  GET   /onboarding/steps             — list all steps with per-business completion status
BE-28  PATCH /onboarding/steps/{step_id}   — mark a step complete or incomplete
BE-29  GET   /onboarding/progress          — lightweight summary: phases_complete, steps_complete, steps_total, is_complete
"""
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
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


@router.get("/steps", response_model=OnboardingStatusResponse)
def get_onboarding_steps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    business_id: int = Depends(resolve_business_id),
):
    """
    Return all onboarding steps grouped by phase, with completion status for
    the requesting business.

    - Business owners always see their own profile's progress.
    - Accountants pass X-Client-Business-ID to view a client's progress.

    Response includes overall + per-phase completion counts and a convenience
    `overall_progress_pct` field (0–100) for the frontend progress bar.
    """
    # ── 1. Fetch the business profile (needed for is_onboarding_complete) ────
    profile = db.get(BusinessProfile, business_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Business profile not found."},
        )

    # ── 2. Fetch all steps ordered by phase → step_number ───────────────────
    steps: list[OnboardingStep] = (
        db.query(OnboardingStep)
        .order_by(OnboardingStep.phase, OnboardingStep.step_number)
        .all()
    )

    if not steps:
        # Seed migration hasn't run yet — return an empty but valid response
        return OnboardingStatusResponse(
            is_onboarding_complete=profile.is_onboarding_complete,
            total_steps=0,
            completed_steps=0,
            overall_progress_pct=0.0,
            phases=[],
        )

    # ── 3. Fetch this business's progress rows in one query ──────────────────
    progress_rows: list[OnboardingProgress] = (
        db.query(OnboardingProgress)
        .filter(OnboardingProgress.business_id == business_id)
        .all()
    )

    # Build a fast lookup: step_id → OnboardingProgress
    progress_map: dict[int, OnboardingProgress] = {
        p.step_id: p for p in progress_rows
    }

    # ── 4. Assemble per-phase groups ─────────────────────────────────────────
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

    # ── 5. Build phase summaries ─────────────────────────────────────────────
    phases: list[OnboardingPhaseResponse] = []
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


@router.patch("/steps/{step_id}", response_model=OnboardingStepUpdateResponse)
def update_onboarding_step(
    step_id: int,
    body: OnboardingStepUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    business_id: int = Depends(resolve_business_id),
):
    """
    Mark a single onboarding step as complete or incomplete for the
    requesting business.

    - Setting completed=True records completed_at (UTC) and completed_by.
    - Setting completed=False clears both fields (undo support).
    - After updating, checks if ALL steps are now complete and automatically
      sets BusinessProfile.is_onboarding_complete=True (or back to False on undo).

    Accountants may act on behalf of a client via X-Client-Business-ID header.
    """
    # ── 1. Validate the step exists ──────────────────────────────────────────
    step = db.get(OnboardingStep, step_id)
    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": f"Onboarding step {step_id} not found."},
        )

    # ── 2. Fetch (or guard-create) the progress row ──────────────────────────
    # Progress rows are seeded at BusinessProfile creation (BE-26), but we
    # guard here so the endpoint is robust against edge-case gaps.
    progress = (
        db.query(OnboardingProgress)
        .filter(
            OnboardingProgress.business_id == business_id,
            OnboardingProgress.step_id == step_id,
        )
        .first()
    )
    if not progress:
        progress = OnboardingProgress(
            business_id=business_id,
            step_id=step_id,
            completed=False,
        )
        db.add(progress)
        db.flush()  # get an id without committing

    # ── 3. Apply the update ──────────────────────────────────────────────────
    progress.completed = body.completed
    if body.completed:
        progress.completed_at = datetime.now(timezone.utc)
        progress.completed_by = current_user.id
    else:
        progress.completed_at = None
        progress.completed_by = None

    # ── 4. Auto-set is_onboarding_complete on the business profile ───────────
    profile = db.get(BusinessProfile, business_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Business profile not found."},
        )

    total_steps = db.query(OnboardingStep).count()
    # Flush progress change so the count below reflects the current state
    db.flush()
    completed_count = (
        db.query(OnboardingProgress)
        .filter(
            OnboardingProgress.business_id == business_id,
            OnboardingProgress.completed == True,  # noqa: E712
        )
        .count()
    )
    profile.is_onboarding_complete = completed_count == total_steps and total_steps > 0

    db.commit()
    db.refresh(progress)
    db.refresh(profile)

    # ── 5. Build response ────────────────────────────────────────────────────
    overall_pct = round((completed_count / total_steps) * 100, 1) if total_steps else 0.0

    step_response = OnboardingStepResponse(
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
    )

    return OnboardingStepUpdateResponse(
        step=step_response,
        total_steps=total_steps,
        completed_steps=completed_count,
        overall_progress_pct=overall_pct,
        is_onboarding_complete=profile.is_onboarding_complete,
    )


@router.get("/progress", response_model=OnboardingProgressSummary)
def get_onboarding_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    business_id: int = Depends(resolve_business_id),
):
    """
    Return a lightweight onboarding progress summary for the requesting business.

    Designed for the dashboard onboarding card (FE-23) and the useOnboardingProgress
    hook (FE-22) — returns counts and flags only, not full step detail.

    Response fields:
    - phases_complete: number of phases where every step is marked complete (0–4)
    - steps_complete / steps_total: overall counts
    - is_complete: mirrors BusinessProfile.is_onboarding_complete
    - phases: per-phase breakdown (phase number, steps_complete, steps_total, is_complete)
    """
    # ── 1. Verify business exists ────────────────────────────────────────────
    profile = db.get(BusinessProfile, business_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Business profile not found."},
        )

    # ── 2. Fetch step counts grouped by phase in one query ───────────────────
    # Pull all steps (lightweight — only id and phase needed)
    all_steps = (
        db.query(OnboardingStep.id, OnboardingStep.phase)
        .order_by(OnboardingStep.phase)
        .all()
    )

    if not all_steps:
        return OnboardingProgressSummary(
            phases_complete=0,
            steps_complete=0,
            steps_total=0,
            is_complete=profile.is_onboarding_complete,
            phases=[],
        )

    # Build phase → set of step_ids map
    phase_step_ids: dict[int, list[int]] = defaultdict(list)
    for step_id, phase in all_steps:
        phase_step_ids[phase].append(step_id)

    # ── 3. Fetch completed step ids for this business in one query ───────────
    completed_step_ids: set[int] = set(
        db.query(OnboardingProgress.step_id)
        .filter(
            OnboardingProgress.business_id == business_id,
            OnboardingProgress.completed == True,  # noqa: E712
        )
        .scalars()
        .all()
    )

    # ── 4. Build per-phase summaries ─────────────────────────────────────────
    phase_summaries: list[OnboardingPhaseProgress] = []
    phases_complete = 0

    for phase_num in sorted(phase_step_ids.keys()):
        step_ids = phase_step_ids[phase_num]
        phase_done = sum(1 for sid in step_ids if sid in completed_step_ids)
        phase_total = len(step_ids)
        phase_is_complete = phase_done == phase_total and phase_total > 0

        if phase_is_complete:
            phases_complete += 1

        phase_summaries.append(
            OnboardingPhaseProgress(
                phase=phase_num,
                steps_complete=phase_done,
                steps_total=phase_total,
                is_complete=phase_is_complete,
            )
        )

    total_steps = len(all_steps)
    total_complete = len(completed_step_ids)

    return OnboardingProgressSummary(
        phases_complete=phases_complete,
        steps_complete=total_complete,
        steps_total=total_steps,
        is_complete=profile.is_onboarding_complete,
        phases=phase_summaries,
    )