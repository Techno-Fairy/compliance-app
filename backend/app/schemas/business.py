from pydantic import BaseModel

from app.models.business import CompanyType


class BusinessProfileCreate(BaseModel):
    business_name: str
    company_type: CompanyType
    cipa_number: str | None = None
    burs_tin: str | None = None
    vat_registered: bool = False
    vat_filing_monthly: bool = True


# BE-24: separate update schema so PATCH can accept is_onboarding_complete
# as an optional override (manual completion) without it leaking into Create.
class BusinessProfileUpdate(BaseModel):
    business_name: str | None = None
    company_type: CompanyType | None = None
    cipa_number: str | None = None
    burs_tin: str | None = None
    vat_registered: bool | None = None
    vat_filing_monthly: bool | None = None
    is_onboarding_complete: bool | None = None


class BusinessProfileResponse(BaseModel):
    id: int
    owner_id: int
    business_name: str
    company_type: CompanyType
    cipa_number: str | None = None
    burs_tin: str | None = None
    vat_registered: bool
    vat_filing_monthly: bool
    # BE-24: included in every profile response so the frontend can gate
    # dashboard vs. onboarding card without a separate request
    is_onboarding_complete: bool

    model_config = {"from_attributes": True}