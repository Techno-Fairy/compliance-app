from pydantic import BaseModel
from app.models.business import CompanyType


class BusinessProfileCreate(BaseModel):
    business_name: str
    company_type: CompanyType
    cipa_number: str | None = None
    burs_tin: str | None = None
    vat_registered: bool = False
    vat_filing_monthly: bool = True


class BusinessProfileResponse(BusinessProfileCreate):
    id: int
    owner_id: int

    model_config = {"from_attributes": True}
