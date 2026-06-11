# backend/app/api/v1/endpoints/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.database import get_db
from app.models.business import BusinessProfile, CompanyType
from app.models.onboarding import OnboardingProgress, OnboardingStep
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    RegisterWithProfileRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _tokens(user: User) -> TokenResponse:
    payload = {"sub": str(user.id), "email": user.email}
    return TokenResponse(
        access_token=create_access_token(payload),
        refresh_token=create_refresh_token(payload),
    )


# ── Existing register (unchanged) ────────────────────────────────────────────
@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(
            status_code=422,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "Email already registered.",
                "field": "email",
            },
        )
    user = User(
        full_name=body.full_name,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _tokens(user)


# ── Step 4: register-with-profile (used after completing Starter Guide) ───────
@router.post(
    "/register-with-profile",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_with_profile(
    body: RegisterWithProfileRequest, db: Session = Depends(get_db)
):
    """
    One-shot registration for users who completed the public Starter Guide.

    Creates:
      1. User account
      2. BusinessProfile with all supplied details
         → is_onboarding_complete = True  (guide was completed offline)

    The `after_insert` trigger on BusinessProfile normally seeds
    onboarding_progress rows with completed=False.  We override them all
    to completed=True immediately after the insert so the backend state
    matches what the user achieved in the guide.

    The frontend follows up with POST /onboarding/sync-local-progress to
    supply accurate completed_at timestamps from the local SQLite store.
    """
    # ── 1. Check email uniqueness ─────────────────────────────────────────
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(
            status_code=422,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "Email already registered.",
                "field": "email",
            },
        )

    # ── 2. Create user ────────────────────────────────────────────────────
    user = User(
        full_name=body.full_name,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    db.flush()  # assigns user.id without committing

    # ── 3. Create BusinessProfile (is_onboarding_complete = True) ─────────
    profile = BusinessProfile(
        owner_id=user.id,
        business_name=body.business_name,
        company_type=CompanyType(body.company_type),
        cipa_number=body.cipa_number,
        burs_tin=body.burs_tin,
        vat_registered=body.vat_registered,
        vat_filing_monthly=body.vat_filing_monthly,
        is_onboarding_complete=True,
    )
    db.add(profile)
    db.flush()  # assigns profile.id; triggers after_insert → seeds progress rows

    # ── 4. Override all seeded rows to completed=True ─────────────────────
    # The after_insert trigger already inserted rows with completed=False.
    # We bulk-update them here so the backend immediately reflects completion.
    db.query(OnboardingProgress).filter(
        OnboardingProgress.business_id == profile.id
    ).update(
        {"completed": True},
        synchronize_session=False,
    )

    db.commit()
    db.refresh(user)
    return _tokens(user)


# ── Existing login (unchanged) ────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail={"code": "AUTH_ERROR", "message": "Invalid credentials."},
        )
    return _tokens(user)


# ── Existing refresh (unchanged) ─────────────────────────────────────────────
@router.post("/refresh", response_model=TokenResponse)
def refresh_token(body: RefreshRequest):
    try:
        data = decode_token(body.refresh_token)
        if data.get("type") != "refresh":
            raise ValueError
    except (ValueError, Exception):
        raise HTTPException(
            status_code=401,
            detail={"code": "AUTH_ERROR", "message": "Invalid refresh token."},
        )
    payload = {"sub": data["sub"], "email": data["email"]}
    return TokenResponse(
        access_token=create_access_token(payload),
        refresh_token=create_refresh_token(payload),
    )


@router.delete("/session", status_code=status.HTTP_204_NO_CONTENT)
def logout():
    return


# ── GET /auth/me ──────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Return the currently authenticated user's profile.
    Used by the frontend for role-based UI (e.g. accountant client switcher).
    """
    return current_user