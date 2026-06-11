# backend/app/api/v1/endpoints/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

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
    UpdateAccountRequest,
    UserResponse,
)
from app.core.deps import get_current_user

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


# ── register-with-profile (unchanged) ────────────────────────────────────────
@router.post(
    "/register-with-profile",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_with_profile(
    body: RegisterWithProfileRequest, db: Session = Depends(get_db)
):
    """One-shot registration for users who completed the public Starter Guide."""
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
    db.flush()

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
    db.flush()

    db.query(OnboardingProgress).filter(
        OnboardingProgress.business_id == profile.id
    ).update({"completed": True}, synchronize_session=False)

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


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


# ── Step 2: PATCH /auth/me — edit email and/or password ──────────────────────
@router.patch("/me", response_model=UserResponse)
def update_account(
    body: UpdateAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the current user's email and/or password.

    Rules:
    - `current_password` is always required to authorise any change.
    - `new_email` is optional; if supplied it must not already be in use.
    - `new_password` is optional; if supplied it must be ≥ 8 chars.
    - At least one of new_email or new_password must be provided.

    Returns the updated UserResponse so the frontend can refresh its
    cached user data.  New JWT tokens are NOT issued — the existing
    access token remains valid until its natural expiry.
    """
    # ── 1. Verify current password ────────────────────────────────────────
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_ERROR",
                "message": "Current password is incorrect.",
            },
        )

    # ── 2. Require at least one change ────────────────────────────────────
    if not body.new_email and not body.new_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "Provide a new email, a new password, or both.",
            },
        )

    # ── 3. Apply email update ─────────────────────────────────────────────
    if body.new_email:
        normalised = body.new_email.strip().lower()
        if normalised != current_user.email.lower():
            existing = (
                db.query(User).filter(User.email == normalised).first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "code": "VALIDATION_ERROR",
                        "message": "Email address is already in use.",
                        "field": "new_email",
                    },
                )
            current_user.email = normalised

    # ── 4. Apply password update ──────────────────────────────────────────
    if body.new_password:
        current_user.hashed_password = hash_password(body.new_password)

    db.commit()
    db.refresh(current_user)
    return current_user