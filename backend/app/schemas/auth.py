# backend/app/schemas/auth.py
from pydantic import BaseModel, EmailStr, Field


class UserResponse(BaseModel):
    """Returned by GET /auth/me and PATCH /auth/me."""
    id: int
    full_name: str
    email: str
    role: str

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RegisterWithProfileRequest(BaseModel):
    """Used by POST /auth/register-with-profile."""
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    business_name: str = Field(min_length=1, max_length=255)
    company_type: str
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


# ── Step 2: Edit account details ──────────────────────────────────────────────

class UpdateAccountRequest(BaseModel):
    """
    Body for PATCH /auth/me.

    current_password is always required to authorize any change.
    Provide new_email, new_password, or both.
    """
    current_password: str = Field(min_length=1)
    new_email: EmailStr | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=128)