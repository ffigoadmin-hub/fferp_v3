/**
 * Onboarding Module TypeScript Types
 * 
 * This file contains all type definitions for the employee onboarding workflow:
 * HR → CEO → Admin → Email
 */

// ============================================
// Enums and Constants
// ============================================

export type OnboardingStatus = 
  | 'pending_ceo_review'
  | 'ceo_selected'
  | 'ceo_rejected'
  | 'admin_completed'
  | 'documents_submitted'
  | 'pending_hr'
  | 'hr_review'
  | 'hr_verified'
  | 'correction_requested'
  | 'rejected'
  | 'active';

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  pending_ceo_review: 'Pending CEO Review',
  ceo_selected: 'CEO Selected',
  ceo_rejected: 'Rejected',
  admin_completed: 'Completed',
  documents_submitted: 'Documents Submitted',
  pending_hr: 'Pending HR',
  hr_review: 'HR Review',
  hr_verified: 'HR Verified',
  correction_requested: 'Correction Requested',
  rejected: 'Rejected',
  active: 'Active',
};

export const ONBOARDING_STATUS_COLORS: Record<OnboardingStatus, string> = {
  pending_ceo_review: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ceo_selected: 'bg-blue-100 text-blue-800 border-blue-200',
  ceo_rejected: 'bg-red-100 text-red-800 border-red-200',
  admin_completed: 'bg-green-100 text-green-800 border-green-200',
  documents_submitted: 'bg-purple-100 text-purple-800 border-purple-200',
  pending_hr: 'bg-orange-100 text-orange-800 border-orange-200',
  hr_review: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  hr_verified: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  correction_requested: 'bg-amber-100 text-amber-800 border-amber-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  active: 'bg-green-100 text-green-800 border-green-200',
};

// Department to Role mapping
export const DEPARTMENT_ROLE_MAP: Record<string, string> = {
  'HR': 'hr',
  'Admin': 'admin',
  'Accounts': 'accounts',
  'Marketing': 'marketing',
  'Sales': 'sales',
  'IT': 'employee',
  'Operations': 'employee',
  'Farm': 'employee',
  'Purchase': 'employee',
};

// Available departments for dropdown
export const DEPARTMENTS = [
  'HR',
  'Admin',
  'Accounts',
  'Marketing',
  'Sales',
  'IT',
  'Operations',
  'Farm',
  'Purchase',
] as const;

export type Department = typeof DEPARTMENTS[number];

// ============================================
// Database Types (from Supabase)
// ============================================

export interface OnboardingRequest {
  id: string;
  full_name: string;
  email: string;
  department: string;
  resume_url: string | null;
  resume_path: string | null;
  status: OnboardingStatus;
  ceo_action_by: string | null;
  ceo_action_at: string | null;
  ceo_rejection_reason: string | null;
  admin_action_by: string | null;
  admin_action_at: string | null;
  generated_username: string | null;
  generated_password_temp: string | null;
  email_sent: boolean;
  email_sent_at: string | null;
  auth_user_id: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  // Token fields
  activation_token: string | null;
  activation_link: string | null;
  token_expires_at: string | null;
  // Contact fields
  contact_number: string | null;
  emergency_contact_number: string | null;
  parents_number: string | null;
  permanent_address: string | null;
  current_address: string | null;
  // Document URLs
  aadhaar_url: string | null;
  passbook_url: string | null;
  marksheet_10_url: string | null;
  marksheet_12_url: string | null;
  degree_marksheet_url: string | null;
  resume_doc_url: string | null;
  photo_url: string | null;
  hr_policy_url: string | null;
  offer_letter_url: string | null;
  // Acknowledgements
  hr_policy_accepted: boolean;
  offer_letter_accepted: boolean;
  // HR review fields
  documents_submitted_at: string | null;
  hr_verified_at: string | null;
  hr_verified_by: string | null;
  hr_notes: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  correction_requested_at: string | null;
  correction_notes: string | null;
}

// ============================================
// Form Types
// ============================================

export interface NewUserFormData {
  fullName: string;
  email: string;
  department: Department;
  resume: File | null;
}

export interface OnboardingFormProps {
  onSubmit: (data: NewUserFormData) => Promise<void>;
  isSubmitting?: boolean;
}

// ============================================
// Component Props Types
// ============================================

export interface OnboardingStatusBadgeProps {
  status: OnboardingStatus;
  className?: string;
}

export interface ResumeViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  resumeUrl: string | null;
  candidateName: string;
}

export interface CeoActionButtonsProps {
  requestId: string;
  onSelect: (id: string) => Promise<void>;
  onReject: (id: string, remark?: string) => Promise<void>;
  isLoading?: boolean;
}

export interface AdminCredentialPreviewProps {
  username: string;
  password: string;
  fullName: string;
}

export interface OnboardingTableRow {
  id: string;
  full_name: string;
  email: string;
  department: string;
  resume_url: string | null;
  status: OnboardingStatus;
  created_at: string;
  ceo_action_at: string | null;
  generated_username: string | null;
  generated_password_temp: string | null;
}

// ============================================
// API Response Types
// ============================================

export interface SubmitOnboardingResponse {
  success: boolean;
  data?: OnboardingRequest;
  error?: string;
}

export interface CeoActionResponse {
  success: boolean;
  error?: string;
}

export interface AdminCompleteResponse {
  success: boolean;
  message?: string;
  step?: 'env_validation' | 'body_parse' | 'field_validation' | 'authentication' | 'role_verification' | 'fetch_onboarding' | 'create_auth_user' | 'create_profile' | 'update_onboarding' | 'send_email' | 'finalize';
  details?: string;
  data?: {
    userId?: string;
    email?: string;
    username?: string;
    temporaryPassword?: string;
    emailSent?: boolean;
    isExistingUser?: boolean;
    activationLink?: string;
    alreadyCompleted?: boolean;
  };
  // Legacy fields for backwards compatibility
  userId?: string;
  emailSent?: boolean;
  emailError?: string | null;
  error?: string;
}

// ============================================
// Service Function Types
// ============================================

export interface UploadResumeResult {
  url: string;
  path: string;
}

export interface GenerateCredentialsResult {
  username: string;
  password: string;
}

// ============================================
// Filter Types for Pages
// ============================================

export interface CeoQueueFilter {
  status: 'pending_ceo_review';
}

export interface AdminQueueFilter {
  status: 'ceo_selected';
}

// ============================================
// Utility Types
// ============================================

export type OnboardingRequestWithCreator = OnboardingRequest & {
  creator?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

export type OnboardingRequestWithCeoAction = OnboardingRequest & {
  ceo_action_user?: {
    full_name: string | null;
  } | null;
};

export type OnboardingRequestWithAdminAction = OnboardingRequest & {
  admin_action_user?: {
    full_name: string | null;
  } | null;
};
