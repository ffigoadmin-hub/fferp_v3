/**
 * Pre-Joining Onboarding Types
 * Complete HR Verification + ERP Account Activation System
 */

// ============================================================
// ENUMS
// ============================================================

export type OnboardingStatus =
  | 'invited'
  | 'details_submitted'
  | 'hr_verified'
  | 'correction_requested'
  | 'rejected'
  | 'active';

export type DepartmentCode =
  | 'HR'
  | 'IT'
  | 'Admin'
  | 'Accounts'
  | 'Marketing'
  | 'Sales'
  | 'Operations'
  | 'Farm'
  | 'Purchase'
  | 'R&D';

// ============================================================
// MAIN ONBOARDING REQUEST TYPE
// ============================================================

export interface EmployeeOnboardingRequest {
  // Primary identification
  id: string;
  full_name: string;
  email: string;
  department: string;
  
  // Generated credentials
  generated_username?: string;
  temporary_password_hint?: string;
  
  // Activation
  activation_token?: string;
  activation_link?: string;
  token_expires_at?: string;
  
  // Email tracking
  email_sent: boolean;
  email_sent_at?: string;
  
  // Contact details
  contact_number?: string;
  emergency_contact_number?: string;
  parents_number?: string;
  permanent_address?: string;
  current_address?: string;
  
  // Documents
  aadhaar_url?: string;
  aadhaar_path?: string;
  passbook_url?: string;
  passbook_path?: string;
  marksheet_10_url?: string;
  marksheet_10_path?: string;
  marksheet_12_url?: string;
  marksheet_12_path?: string;
  degree_marksheet_url?: string;
  degree_marksheet_path?: string;
  resume_url?: string;
  resume_path?: string;
  photo_url?: string;
  photo_path?: string;
  
  // HR Policy & Offer Letter
  hr_policy_url?: string;
  hr_policy_path?: string;
  hr_policy_accepted: boolean;
  offer_letter_url?: string;
  offer_letter_path?: string;
  offer_letter_accepted: boolean;
  
  // Status
  status: OnboardingStatus;
  
  // Verification
  hr_verified_by?: string;
  hr_verified_at?: string;
  correction_reason?: string;
  correction_requested_at?: string;
  rejected_reason?: string;
  rejected_at?: string;
  
  // System
  auth_user_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// FORM DATA TYPES
// ============================================================

export interface NewUserInvitationFormData {
  fullName: string;
  email: string;
  department: string;
}

export interface EmployeeOnboardingFormData {
  // Readonly from invitation
  fullName: string;
  email: string;
  department: string;
  
  // Contact details
  contactNumber: string;
  emergencyContactNumber: string;
  parentsNumber: string;
  
  // Address
  permanentAddress: string;
  currentAddress: string;
  
  // Documents (files)
  aadhaarFile?: File;
  passbookFile?: File;
  marksheet10File?: File;
  marksheet12File?: File;
  degreeMarksheetFile?: File;
  resumeFile?: File;
  photoFile?: File;
  
  // HR Policy & Offer Letter
  hrPolicyFile?: File;
  offerLetterFile?: File;
  hrPolicyAccepted: boolean;
  offerLetterAccepted: boolean;
}

// ============================================================
// RESPONSE TYPES
// ============================================================

export interface CreateInvitationResponse {
  success: boolean;
  data?: EmployeeOnboardingRequest;
  error?: string;
  activationLink?: string;
}

export interface SubmitOnboardingDetailsResponse {
  success: boolean;
  error?: string;
}

export interface HrVerificationResponse {
  success: boolean;
  error?: string;
}

export interface GetOnboardingByTokenResponse {
  success: boolean;
  data?: EmployeeOnboardingRequest;
  error?: string;
  expired?: boolean;
}

// ============================================================
// CREDENTIAL TYPES
// ============================================================

export interface GeneratedCredentials {
  username: string;
  password: string;
}

// ============================================================
// DOCUMENT UPLOAD TYPES
// ============================================================

export interface DocumentUploadResult {
  url: string;
  path: string;
}

export interface DocumentUploadField {
  label: string;
  fieldName: keyof EmployeeOnboardingFormData;
  acceptedTypes: string;
  maxSize: number; // in bytes
  required: boolean;
}

// ============================================================
// HR ACTION TYPES
// ============================================================

export interface HrVerifyAction {
  onboardingId: string;
  remarks?: string;
}

export interface HrCorrectionRequest {
  onboardingId: string;
  reason: string;
}

export interface HrRejectAction {
  onboardingId: string;
  reason: string;
}

// ============================================================
// FILTER & QUERY TYPES
// ============================================================

export interface OnboardingFilterOptions {
  status?: OnboardingStatus;
  department?: string;
  searchQuery?: string;
}

// ============================================================
// UI DISPLAY TYPES
// ============================================================

export interface OnboardingListItem {
  id: string;
  full_name: string;
  email: string;
  department: string;
  generated_username?: string;
  status: OnboardingStatus;
  contact_number?: string;
  created_at: string;
  hasDocuments: boolean;
}

export interface OnboardingDetailView extends EmployeeOnboardingRequest {
  // Additional computed fields for display
  daysSinceSubmitted?: number;
  documentCount: number;
  isOverdue: boolean;
}

// ============================================================
// STATUS CONFIG
// ============================================================

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  invited: 'Invited',
  details_submitted: 'Details Submitted',
  hr_verified: 'HR Verified',
  correction_requested: 'Correction Requested',
  rejected: 'Rejected',
  active: 'Active',
};

export const ONBOARDING_STATUS_COLORS: Record<OnboardingStatus, string> = {
  invited: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  details_submitted: 'bg-blue-100 text-blue-800 border-blue-200',
  hr_verified: 'bg-green-100 text-green-800 border-green-200',
  correction_requested: 'bg-orange-100 text-orange-800 border-orange-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

// ============================================================
// DEPARTMENT MAPPING
// ============================================================

export const DEPARTMENT_SHORT_CODES: Record<string, string> = {
  'HR': 'hr',
  'IT': 'it',
  'Admin': 'adm',
  'Accounts': 'acc',
  'Marketing': 'mkt',
  'Sales': 'sal',
  'Operations': 'ops',
  'Farm': 'fm',
  'Purchase': 'pur',
  'R&D': 'rd',
  'Chennai Warehouse': 'cw',
};

// ============================================================
// EMAIL TEMPLATE TYPE
// ============================================================

export interface OnboardingEmailData {
  fullName: string;
  email: string;
  username: string;
  password: string;
  activationLink: string;
}
