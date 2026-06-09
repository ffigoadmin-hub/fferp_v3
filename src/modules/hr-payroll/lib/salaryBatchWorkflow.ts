/**
 * HR Payroll Salary Batch Workflow
 * Status pipeline and role-based visibility for salary batches.
 */

export const SALARY_BATCH_STATUS = {
  DRAFT: 'Draft',
  HR_VERIFIED: 'HR Verified',
  AUDITOR_APPROVED: 'Auditor Approved',
  CEO_PENDING: 'CEO Pending',
  AUDITOR_REJECTED: 'Auditor Rejected',
  CEO_APPROVED: 'CEO Approved',
  CEO_REJECTED: 'CEO Rejected',
  CEO_HOLD: 'CEO Hold',
  ACCOUNTS_PROCESSING: 'Accounts Processing',
  HOLD: 'Hold',
  PAID: 'Paid',
  PAID_ALREADY: 'Paid Already',
} as const;

export type SalaryBatchStatus = (typeof SALARY_BATCH_STATUS)[keyof typeof SALARY_BATCH_STATUS];

/** Statuses visible on HR Access page (batches HR can act on). Exclude HR Verified so verified batches move to Auditor. */
export const HR_VISIBLE_STATUSES: string[] = [
  SALARY_BATCH_STATUS.DRAFT,
  'DRAFT',
  SALARY_BATCH_STATUS.AUDITOR_REJECTED,
  SALARY_BATCH_STATUS.CEO_REJECTED,
];

/** Statuses visible on Auditor page (HR Verified batches) */
export const AUDITOR_VISIBLE_STATUSES: string[] = [
  SALARY_BATCH_STATUS.HR_VERIFIED,
  // Backward-compatible variants from older rows; canonical write remains "HR Verified"
  'HR verified',
  'hr verified',
  'hr_verified',
  'HR_VERIFIED',
];

/** Statuses visible on CEO page (Auditor Approved batches) */
export const CEO_VISIBLE_STATUSES: string[] = [
  SALARY_BATCH_STATUS.AUDITOR_APPROVED,
  // Backward-compatible variants from older rows; canonical write remains "Auditor Approved"
  'Auditor approved',
  'auditor approved',
  'auditor_approved',
  'AUDITOR_APPROVED',
  'ceo pending',
  'CEO pending',
  'pending ceo',
  'Pending CEO',
  'pending_ceo',
  'pending ceo approval',
  'Pending CEO approval',
  'awaiting ceo approval',
  'Awaiting CEO approval',
  // Legacy / mis-tagged auditor-complete labels (canonical flow still uses Auditor Approved / CEO Pending)
  'Verified',
  'verified',
  'completed',
  'Completed',
  'COMPLETED',
];

/** Statuses visible on Accounts page */
export const ACCOUNTS_VISIBLE_STATUSES: string[] = [
  SALARY_BATCH_STATUS.CEO_APPROVED,
  SALARY_BATCH_STATUS.ACCOUNTS_PROCESSING,
  SALARY_BATCH_STATUS.CEO_HOLD,
  SALARY_BATCH_STATUS.HOLD,
];

export const STATUS_BADGE_CLASS: Record<string, string> = {
  [SALARY_BATCH_STATUS.DRAFT]: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  [SALARY_BATCH_STATUS.HR_VERIFIED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  [SALARY_BATCH_STATUS.AUDITOR_APPROVED]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
  [SALARY_BATCH_STATUS.CEO_PENDING]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
  [SALARY_BATCH_STATUS.AUDITOR_REJECTED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  [SALARY_BATCH_STATUS.CEO_APPROVED]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
  [SALARY_BATCH_STATUS.CEO_REJECTED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  [SALARY_BATCH_STATUS.CEO_HOLD]: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  [SALARY_BATCH_STATUS.ACCOUNTS_PROCESSING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  [SALARY_BATCH_STATUS.HOLD]: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
  [SALARY_BATCH_STATUS.PAID]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200',
  [SALARY_BATCH_STATUS.PAID_ALREADY]: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200',
};

/**
 * Normalize salary batch status to canonical form for consistent processing
 * Maps legacy/variant statuses to their canonical equivalents
 */
export function normalizeSalaryBatchStatus(status: string | null | undefined): string {
  if (!status) return SALARY_BATCH_STATUS.DRAFT;

  const normalized = status
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Map to canonical statuses
  switch (normalized) {
    case 'draft':
      return SALARY_BATCH_STATUS.DRAFT;
    case 'hr verified':
    case 'hr_verified':
      return SALARY_BATCH_STATUS.HR_VERIFIED;
    case 'auditor approved':
    case 'auditor_approved':
    case 'auditor audited':
    case 'approved':
    case 'ceo pending':
    case 'pending ceo':
    case 'pending ceo approval':
    case 'awaiting ceo approval':
    case 'awaiting ceo':
    case 'pending_ceo_approval':
      return SALARY_BATCH_STATUS.AUDITOR_APPROVED; // Canonical status for CEO-visible batches
    case 'auditor rejected':
      return SALARY_BATCH_STATUS.AUDITOR_REJECTED;
    case 'ceo approved':
      return SALARY_BATCH_STATUS.CEO_APPROVED;
    case 'ceo rejected':
      return SALARY_BATCH_STATUS.CEO_REJECTED;
    case 'ceo hold':
      return SALARY_BATCH_STATUS.CEO_HOLD;
    case 'accounts processing':
      return SALARY_BATCH_STATUS.ACCOUNTS_PROCESSING;
    case 'hold':
      return SALARY_BATCH_STATUS.HOLD;
    case 'paid':
      return SALARY_BATCH_STATUS.PAID;
    case 'paid already':
      return SALARY_BATCH_STATUS.PAID_ALREADY;
    default:
      // For unknown statuses, check if they match CEO-visible patterns
      if (normalized.includes('auditor') && normalized.includes('approved')) {
        return SALARY_BATCH_STATUS.AUDITOR_APPROVED;
      }
      if (normalized.includes('ceo') && normalized.includes('pending')) {
        return SALARY_BATCH_STATUS.AUDITOR_APPROVED;
      }
      return SALARY_BATCH_STATUS.DRAFT;
  }
}

export interface SalaryBatchCard {
  id: string;
  batch_code: string;
  batch_name?: string;
  department: string | null;
  departments_display: string; // comma-separated for multi
  total_employees: number;
  total_salary: number;
  total_net_pay: number | null;
  total_lop_amount: number | null;
  total_tds: number | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  created_by: string;
  prepared_by: string | null;
  hr_verified_by: string | null;
  hr_verified_at: string | null;
  auditor_approved_by: string | null;
  auditor_approved_at: string | null;
  auditor_rejected_reason: string | null;
  ceo_approved_by: string | null;
  ceo_approved_at: string | null;
  ceo_rejected_reason: string | null;
  ceo_hold_reason: string | null;
  accounts_hold_reason: string | null;
  rejection_reason: string | null;
  month: number;
  year: number;
  from_day: number;
  to_day: number;
  creator_name?: string | null;
}
