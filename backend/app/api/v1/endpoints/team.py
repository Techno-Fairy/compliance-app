# backend/app/api/v1/endpoints/team.py
# BE-21: POST /team/invite, GET /team, DELETE /team/{member_id}
# BE-22: GET /team/clients — accountant's client list for the switcher UI
#        POST /team/accept/{token} — accountant accepts invite
#
# Role rules (enforced via deps):
#   POST /team/invite    → BUSINESS_OWNER only
#   GET  /team           → BUSINESS_OWNER (their team) or ACCOUNTANT (their clients)
#   DELETE /team/{id}    → BUSINESS_OWNER only
#   GET  /team/clients   → ACCOUNTANT only
#   POST /team/accept    → any authenticated user (they become an ACCOUNTANT)

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_user, require_business_owner
from app.db.database import get_db
from app.models.business import BusinessProfile
from app.models.team import TeamMembership
from app.models.user import User, UserRole
from app.services.email_service import send_invite_email, send_test_email

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/team", tags=["team"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: EmailStr


class MemberOut(BaseModel):
    id: int
    invited_email: str
    status: str
    accountant_name: str | None = None
    accountant_id: int | None = None
    invited_at: datetime
    accepted_at: datetime | None = None
    email_sent: bool = False  # informational — did the invite email succeed?

    class Config:
        from_attributes = True


class ClientOut(BaseModel):
    business_id: int
    business_name: str
    owner_name: str
    membership_id: int


class AcceptResponse(BaseModel):
    message: str
    business_name: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_owner_business(user: User, db: Session) -> BusinessProfile:
    profile = (
        db.query(BusinessProfile)
        .filter(BusinessProfile.owner_id == user.id)
        .first()
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Business profile not found. Create one first."},
        )
    return profile


# ── POST /team/invite ─────────────────────────────────────────────────────────

@router.post("/invite", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def invite_team_member(
    body: InviteRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_business_owner),
    db: Session = Depends(get_db),
):
    """
    Invite an accountant to the business by email.

    The invite email is sent as a background task so the API responds
    immediately without blocking on SMTP.  The `email_sent` field in the
    response indicates whether the email was queued (it may still fail in the
    background — check server logs for SMTP errors).

    The invite token is also returned in the response for dev/testing use.
    """
    business = _get_owner_business(current_user, db)

    # Prevent duplicate invites
    existing = (
        db.query(TeamMembership)
        .filter(
            TeamMembership.business_id == business.id,
            TeamMembership.invited_email == body.email.lower(),
            TeamMembership.status.in_(["pending", "active"]),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "ALREADY_INVITED",
                "message": f"{body.email} has already been invited or is already a team member.",
            },
        )

    # Check if the invited user already has an account
    invited_user = (
        db.query(User).filter(User.email == body.email.lower()).first()
    )

    token = secrets.token_urlsafe(32)
    membership = TeamMembership(
        business_id=business.id,
        accountant_id=invited_user.id if invited_user else None,
        invited_email=body.email.lower(),
        status="pending",
        invite_token=token,
        invited_by_id=current_user.id,
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)

    logger.info(
        "[invite] Membership created (id=%d) for %s by user %d (business=%d). "
        "Queuing invite email.",
        membership.id, body.email, current_user.id, business.id,
    )

    # Send invite email in the background — non-blocking
    email_configured = bool(settings.SMTP_HOST)
    if email_configured:
        background_tasks.add_task(
            send_invite_email,
            to=body.email.lower(),
            token=token,
            business_name=business.business_name,
        )
    else:
        logger.warning(
            "[invite] SMTP not configured — invite email NOT sent to %s. "
            "Token: %s — set SMTP_* env vars to enable email delivery.",
            body.email, token,
        )

    return MemberOut(
        id=membership.id,
        invited_email=membership.invited_email,
        status=membership.status,
        accountant_name=invited_user.full_name if invited_user else None,
        accountant_id=invited_user.id if invited_user else None,
        invited_at=membership.invited_at,
        accepted_at=membership.accepted_at,
        email_sent=email_configured,
    )


# ── GET /team ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[MemberOut])
def list_team_members(
    current_user: User = Depends(require_business_owner),
    db: Session = Depends(get_db),
):
    """
    List all team members (pending + active) for the authenticated owner's business.
    """
    business = _get_owner_business(current_user, db)

    memberships = (
        db.query(TeamMembership)
        .filter(
            TeamMembership.business_id == business.id,
            TeamMembership.status != "revoked",
        )
        .order_by(TeamMembership.invited_at.desc())
        .all()
    )

    return [
        MemberOut(
            id=m.id,
            invited_email=m.invited_email,
            status=m.status,
            accountant_name=m.accountant.full_name if m.accountant else None,
            accountant_id=m.accountant_id,
            invited_at=m.invited_at,
            accepted_at=m.accepted_at,
        )
        for m in memberships
    ]


# ── DELETE /team/{member_id} ──────────────────────────────────────────────────

@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team_member(
    member_id: int,
    current_user: User = Depends(require_business_owner),
    db: Session = Depends(get_db),
):
    """
    Revoke a team membership. The accountant loses access immediately.
    Revoked memberships are kept for audit purposes.
    """
    business = _get_owner_business(current_user, db)

    membership = (
        db.query(TeamMembership)
        .filter(
            TeamMembership.id == member_id,
            TeamMembership.business_id == business.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Team member not found."},
        )

    membership.status = "revoked"
    db.commit()
    logger.info(
        "[invite] Membership %d revoked by user %d", member_id, current_user.id
    )


# ── POST /team/accept/{token} ─────────────────────────────────────────────────

@router.post("/accept/{token}", response_model=AcceptResponse)
def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Accept a team invite using the one-time token.
    The token is invalidated after use.
    """
    membership = (
        db.query(TeamMembership)
        .filter(
            TeamMembership.invite_token == token,
            TeamMembership.status == "pending",
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Invite not found or already used."},
        )

    if current_user.email.lower() != membership.invited_email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "FORBIDDEN",
                "message": "This invite was sent to a different email address.",
            },
        )

    membership.accountant_id = current_user.id
    membership.status = "active"
    membership.accepted_at = datetime.now(timezone.utc)
    membership.invite_token = None  # invalidate token

    # Promote to ACCOUNTANT if they have no business of their own
    if current_user.role == UserRole.BUSINESS_OWNER:
        has_own_business = (
            db.query(BusinessProfile)
            .filter(BusinessProfile.owner_id == current_user.id)
            .first()
        )
        if not has_own_business:
            current_user.role = UserRole.ACCOUNTANT

    db.commit()
    db.refresh(membership)

    logger.info(
        "[invite] Token accepted by user %d for business %d",
        current_user.id, membership.business_id,
    )

    return AcceptResponse(
        message="Invite accepted. You now have access to this business.",
        business_name=membership.business.business_name,
    )


# ── GET /team/clients ─────────────────────────────────────────────────────────

@router.get("/clients", response_model=list[ClientOut])
def list_accountant_clients(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return all businesses the authenticated accountant is linked to.
    Used by the FE-19 client-switcher UI.
    """
    if current_user.role not in (UserRole.ACCOUNTANT, UserRole.ADMIN):
        return []

    memberships = (
        db.query(TeamMembership)
        .filter(
            TeamMembership.accountant_id == current_user.id,
            TeamMembership.status == "active",
        )
        .all()
    )

    return [
        ClientOut(
            business_id=m.business_id,
            business_name=m.business.business_name,
            owner_name=m.business.owner.full_name,
            membership_id=m.id,
        )
        for m in memberships
    ]


# ── POST /team/resend-invite/{member_id} ──────────────────────────────────────

@router.post("/resend-invite/{member_id}", status_code=status.HTTP_200_OK)
def resend_invite(
    member_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_business_owner),
    db: Session = Depends(get_db),
):
    """
    Resend the invite email for a pending membership.
    Useful if the original email was missed or landed in spam.
    """
    business = _get_owner_business(current_user, db)

    membership = (
        db.query(TeamMembership)
        .filter(
            TeamMembership.id == member_id,
            TeamMembership.business_id == business.id,
            TeamMembership.status == "pending",
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Pending invite not found."},
        )

    if not membership.invite_token:
        # Regenerate token if it was somehow cleared
        membership.invite_token = secrets.token_urlsafe(32)
        db.commit()
        db.refresh(membership)

    if not settings.SMTP_HOST:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "EMAIL_NOT_CONFIGURED", "message": "SMTP is not configured on this server."},
        )

    background_tasks.add_task(
        send_invite_email,
        to=membership.invited_email,
        token=membership.invite_token,
        business_name=business.business_name,
    )

    logger.info(
        "[invite] Resend queued for membership %d (%s)",
        member_id, membership.invited_email,
    )
    return {"message": f"Invite email resent to {membership.invited_email}."}


# ── GET /team/test-email (dev only) ───────────────────────────────────────────

@router.get("/test-email", include_in_schema=False)
def test_email_config(
    to: str = Query(..., description="Email address to send test to"),
    current_user: User = Depends(get_current_user),
):
    """
    Dev-only endpoint to verify SMTP config.
    Only available when DEBUG=true.
    """
    if not settings.DEBUG:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    success = send_test_email(to=to)
    if success:
        return {"message": f"Test email sent successfully to {to}."}
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "SMTP_ERROR", "message": "Failed to send test email. Check server logs for details."},
    )