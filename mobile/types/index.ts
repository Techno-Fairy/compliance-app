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
  days_remaining?: number;
  fixed_penalty_bwp?: number;
  monthly_interest_rate?: number;
  estimated_outstanding_bwp?: number;
  portal_url?: string;
}

export interface Document {
  id: number;
  business_id: number;
  deadline_id?: number | null;
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  category: string;
  expiry_date?: string | null;
  uploaded_at: string;
  // Present only immediately after upload
  download_url?: string;
  download_url_expires_in_seconds?: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface HealthScoreBreakdown {
  category: string;
  score: number;
  total: number;
  complete: number;
  overdue: number;
}

export interface HealthScore {
  score: number;
  band: "green" | "amber" | "red";
  overdue_count: number;
  breakdown: HealthScoreBreakdown[];
}

export interface PenaltyBreakdownItem {
  deadline_id: number;
  name: string;
  category: string;
  days_overdue: number;
  fixed_penalty_bwp: number;
  interest_penalty_bwp: number;
  total_penalty_bwp: number;
  penalty_in_7_days_bwp: number;
  estimated_outstanding_bwp: number | null;
  is_minimum_estimate: boolean;
}

export interface PenaltyExposure {
  total_exposure_bwp: number;
  has_minimum_estimates: boolean;
  breakdown: PenaltyBreakdownItem[];
}

export interface FilingHistoryEntry {
  id: number;
  business_id: number;
  deadline_id?: number | null;
  action: string;
  description: string;
  performed_by?: string | null;
  created_at: string;
  // Joined fields returned by the API (may be null if not applicable)
  deadline_name?: string | null;
  document_filename?: string | null;
  notes?: string | null;
  user_email?: string | null;
}
// ── Onboarding (Week 6 — BE-27, BE-28, BE-29) ─────────────────────────────────

export interface OnboardingStep {
  id: number;
  phase: number;
  step_number: number;
  title: string;
  description: string;
  portal_url?: string | null;
  documents: string[];
  kb_article_id?: number | null;
  completed: boolean;
  completed_at?: string | null;
}

export interface OnboardingPhase {
  phase: number;
  total_steps: number;
  completed_steps: number;
  steps: OnboardingStep[];
}

export interface OnboardingStatus {
  is_onboarding_complete: boolean;
  total_steps: number;
  completed_steps: number;
  overall_progress_pct: number;
  phases: OnboardingPhase[];
}

export interface OnboardingPhaseProgress {
  phase: number;
  steps_complete: number;
  steps_total: number;
  is_complete: boolean;
}

export interface OnboardingProgressSummary {
  phases_complete: number;
  steps_complete: number;
  steps_total: number;
  is_complete: boolean;
  phases: OnboardingPhaseProgress[];
}

export interface MarkStepCompleteBody {
  completed: boolean;
}

export interface OnboardingStepUpdateResponse {
  step: OnboardingStep;
  total_steps: number;
  completed_steps: number;
  overall_progress_pct: number;
  is_onboarding_complete: boolean;
}