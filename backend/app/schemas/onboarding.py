"""
Onboarding Pydantic schemas — Week 6.

OnboardingStepResponse        — BE-27: single step with per-business completion status.
OnboardingPhaseResponse       — BE-27: a phase group containing its steps.
OnboardingStatusResponse      — BE-27: full GET /onboarding/steps response payload.
OnboardingStepUpdateRequest   — BE-28: PATCH body (completed flag).
OnboardingStepUpdateResponse  — BE-28: updated step + new overall progress summary.
"""
from datetime import datetime

from pydantic import BaseModel


class OnboardingStepResponse(BaseModel):
    """
    One row from onboarding_steps joined with the caller's onboarding_progress row.
    `completed` and `completed_at` reflect THIS business's progress.
    """

    id: int
    phase: int
    step_number: int
    title: str
    description: str
    portal_url: str | None = None
    documents: list[str]
    kb_article_id: int | None = None

    # Progress fields — sourced from onboarding_progress for the requesting business
    completed: bool
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class OnboardingPhaseResponse(BaseModel):
    """All steps belonging to a single phase, with a summary completion count."""

    phase: int
    total_steps: int
    completed_steps: int
    steps: list[OnboardingStepResponse]


class OnboardingStatusResponse(BaseModel):
    """
    Full response for GET /onboarding/steps.

    `is_onboarding_complete` mirrors BusinessProfile.is_onboarding_complete so
    the frontend can gate the dashboard without a second request.
    `overall_progress_pct` is a convenience field (0–100) for the progress bar.
    """

    is_onboarding_complete: bool
    total_steps: int
    completed_steps: int
    overall_progress_pct: float
    phases: list[OnboardingPhaseResponse]


# ── BE-28 ─────────────────────────────────────────────────────────────────────

class OnboardingStepUpdateRequest(BaseModel):
    """
    PATCH /onboarding/steps/{step_id} request body.

    Only `completed` is required. Sending False un-marks a step,
    which also clears completed_at and completed_by.
    """
    completed: bool


class OnboardingStepUpdateResponse(BaseModel):
    """
    Response after marking a step complete/incomplete.

    Returns the updated step plus a lightweight progress summary so the
    frontend can refresh its progress bar without a second GET /onboarding/steps.
    Also includes the new value of `is_onboarding_complete` on the business
    profile, in case this PATCH triggered auto-completion.
    """
    step: OnboardingStepResponse
    total_steps: int
    completed_steps: int
    overall_progress_pct: float
    is_onboarding_complete: bool


# ── BE-29 ─────────────────────────────────────────────────────────────────────

class OnboardingPhaseProgress(BaseModel):
    """Completion summary for a single phase."""
    phase: int
    steps_complete: int
    steps_total: int
    is_complete: bool


class OnboardingProgressSummary(BaseModel):
    """
    Lightweight response for GET /onboarding/progress.

    Designed for the dashboard onboarding card and the FE-22 hook — the
    frontend only needs counts and flags, not full step detail.
    `phases_complete` is the count of phases where every step is done (0–4).
    """
    phases_complete: int
    steps_complete: int
    steps_total: int
    is_complete: bool
    phases: list[OnboardingPhaseProgress]