# backend/app/schemas/auth.py
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RegisterWithProfileRequest(BaseModel):
    """
    Used by POST /auth/register-with-profile.

    Combines user account creation with business profile creation in one
    transaction.  Sent by the frontend after the user completes the
    public Starter Guide.

    CIPA number and BURS TIN are optional at registration — the user may
    not have them yet at Phase 4 Step 1, and can add them later via
    PATCH /business/profile.
    """
    # ── Personal ──────────────────────────────────────────────────────────
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    # ── Business ──────────────────────────────────────────────────────────
    business_name: str = Field(min_length=1, max_length=255)
    company_type: str  # validated against CompanyType enum in the endpoint
    cipa_number: str | None = None
    burs_tin: str | None = None
    vat_registered: bool = False
    vat_filing_monthly: bool = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str