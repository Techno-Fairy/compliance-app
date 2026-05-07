export interface User {
  id: number;
  full_name: string;
  email: string;
  role: "business_owner" | "accountant" | "admin";
}

export interface BusinessProfile {
  id: number;
  owner_id: number;
  business_name: string;
  company_type: "sole_trader" | "pty_ltd" | "partnership" | "ngo";
  cipa_number?: string;
  burs_tin?: string;
  vat_registered: boolean;
  vat_filing_monthly: boolean;
}

export interface Deadline {
  id: number;
  name: string;
  category: "BURS" | "CIPA" | "LABOUR" | "CUSTOM";
  due_date: string;
  status: "pending" | "complete" | "missed";
  is_custom: boolean;
  penalty_info?: string;
  notes?: string;
  recurrence?: string;
}

export interface Document {
  id: number;
  filename: string;
  category: string;
  expiry_date?: string;
  uploaded_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
