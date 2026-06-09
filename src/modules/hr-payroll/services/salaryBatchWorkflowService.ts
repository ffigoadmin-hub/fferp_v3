/**
 * Salary batch workflow: fetch by role, status transitions (HR verify, Auditor approve/reject, CEO approve/reject/hold).
 * Uses rejection_reason for auditor/CEO reject and CEO hold with prefixes: AUDITOR_REJECTED:, CEO_REJECTED:, CEO_HOLD:
 */
import { supabase } from '@/integrations/supabase/client';
import {
  SALARY_BATCH_STATUS,
  type SalaryBatchCard,
  HR_VISIBLE_STATUSES,
  AUDITOR_VISIBLE_STATUSES,
  CEO_VISIBLE_STATUSES,
  ACCOUNTS_VISIBLE_STATUSES,
  normalizeSalaryBatchStatus,
} from '../lib/salaryBatchWorkflow';
import { sanitizeDepartmentString } from '../lib/departmentUtils';
export type { SalaryBatchCard } from '../lib/salaryBatchWorkflow';
export type { SalaryBatchStatus } from '../lib/salaryBatchWorkflow';

const PREFIX_AUDITOR_REJECTED = 'AUDITOR_REJECTED:';
const PREFIX_CEO_REJECTED = 'CEO_REJECTED:';
const PREFIX_CEO_HOLD = 'CEO_HOLD:';
const PREFIX_ACCOUNTS_HOLD = 'ACCOUNTS_HOLD:';

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/** Fetch unique departments for a batch from salary_batch_employees */
async function fetchBatchDepartments(batchId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('salary_batch_employees')
      .select('department')
      .eq('batch_id', batchId);
    
    if (error) {
      console.warn('[fetchBatchDepartments] Error fetching departments:', error);
      return [];
    }
    
    const departments = (data || [])
      .map((e: { department?: string | null }) => sanitizeDepartmentString(e.department))
      .filter(Boolean);
    
    return Array.from(new Set(departments));
  } catch (e) {
    console.warn('[fetchBatchDepartments] Exception:', e);
    return [];
  }
}

/** Format departments for display */
function formatDepartmentsDisplay(departments: string[]): string {
  if (!departments || departments.length === 0) {
    return 'Department Not Assigned';
  }
  
  if (departments.length === 1) {
    return `Dept: ${departments[0]}`;
  }
  
  // Multiple departments - show first 2 + count
  const displayList = departments.slice(0, 2);
  const remaining = departments.length - 2;
  
  if (remaining > 0) {
    return `Multi Dept: ${displayList.join(', ')} +${remaining} more`;
  }
  
  return `Multi Dept: ${departments.join(', ')}`;
}

function normalizeStatus(value: string | null | undefined): string {
  if (value == null) return '';
  if (typeof value !== 'string') return '';
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeStatusCompact(value: string | null | undefined): string {
  return normalizeStatus(value).replace(/[^a-z0-9]/g, '');
}

function isHrVerifiedLike(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  return s === 'hr verified';
}

function isAuditorApprovedLike(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  const c = normalizeStatusCompact(status);
  return (
    s === 'auditor approved' ||
    s === 'auditor audited' ||
    s === 'approved' ||
    s === 'ceo pending' ||
    s === 'pending ceo' ||
    s === 'pending ceo approval' ||
    s === 'awaiting ceo approval' ||
    s === 'awaiting ceo' ||
    c === 'auditorapproved' ||
    c === 'auditoraudited' ||
    c === 'pendingceo' ||
    c === 'pendingceoapproval'
  );
}

function isCeoPendingLike(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  const c = normalizeStatusCompact(status);
  return (
    s === 'ceo pending' ||
    s === 'pending ceo' ||
    s === 'pending ceo approval' ||
    s === 'awaiting ceo approval' ||
    s === 'awaiting ceo' ||
    c === 'ceopending' ||
    c === 'pendingceo' ||
    c === 'pendingceoapproval'
  );
}

/** Batch has left the CEO approval_queue (CEO acted, accounts, paid, auditor rejected). */
function isClosedForCeo(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  const c = normalizeStatusCompact(status);
  return [
    'ceo approved',
    'ceo rejected',
    'ceo hold',
    'accounts processing',
    'paid',
    'paid already',
    'auditor rejected',
  ].includes(s) ||
    c === 'ceoapproved' ||
    c === 'ceorejected' ||
    c === 'accountsprocessing';
}

/** Generic "Hold" often conflicts with CEO queue; only treat as closed when clearly accounts/global hold. */
function isHoldLikeClosedForCeo(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  const c = normalizeStatusCompact(status);
  if (s === 'hold' || c === 'hold') return true;
  return false;
}

/**
 * Field-level "already past CEO". Stale accounts/paid/ceo columns are common while status
 * still says CEO Pending / Auditor Approved â€” status wins first.
 */
function isClosedByPostCeoWorkflowFields(row: Record<string, unknown>, status: string | null | undefined): boolean {
  // If status says we're in the CEO queue, never hide the row based on workflow columns alone.
  if (isPendingCeoApprovalByStatus(status)) return false;

  const pastAccountsOrPaid =
    hasValue(row.accounts_processed_at) ||
    hasValue(row.accounts_processed_by) ||
    hasValue(row.paid_at) ||
    hasValue(row.paid_by) ||
    hasValue(row.paid_date);
  if (pastAccountsOrPaid) return true;

  return hasValue(row.ceo_approved_at) || hasValue(row.ceo_approved_by);
}

/**
 * True when CEO must still approve â€” driven by status, not ceo_approved_* columns.
 * Those UUID/timestamp fields can be wrongly populated while status stays "Auditor Approved",
 * which previously hid every batch on the CEO page.
 */
function isPendingCeoApprovalByStatus(status: string | null | undefined): boolean {
  return isAuditorApprovedLike(status) || isCeoPendingLike(status);
}

/** Optional columns (if present on row) â€” logged for debugging; DB may only have `status`. */
const CEO_DEBUG_STATUS_ALIASES = [
  'workflow_status',
  'approval_status',
  'current_stage',
  'current_status',
  'auditor_status',
  'auditor_approved',
  'ceo_status',
  'batch_status',
] as const;

function pickDebugWorkflowFields(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of CEO_DEBUG_STATUS_ALIASES) {
    if (key in row && row[key] !== undefined) out[key] = row[key];
  }
  return out;
}

export type CeoQueueEval = { pass: boolean; reason: string };

/**
 * True if this row should appear on the CEO Salary Approval page.
 * Hold: generic `Hold` must NOT hide rows that already have auditor approval / CEO-queue status
 * (ordering bug caused 100% filter-out when legacy `released_*` pulled Hold rows into the candidate set).
 */
function evaluateCeoQueueRow(row: any): CeoQueueEval {
  const st = row?.status as string | null | undefined;

  if (isClosedForCeo(st)) return { pass: false, reason: 'terminal_or_post_ceo_status' };

  const explicitAuditor =
    hasValue(row?.auditor_approved_at) || hasValue(row?.auditor_approved_by);
  const statusMatchesCeoVisible = CEO_VISIBLE_STATUSES.some(
    (s) => normalizeStatus(s) === normalizeStatus(st),
  );
  const pendingByStatus = isPendingCeoApprovalByStatus(st);
  const auditorLikeByStatus = isAuditorApprovedLike(st);

  // Still HR/Draft: stale auditor_* from older workflows must not put the batch on the CEO queue.
  if (
    (isHrVerifiedLike(st) || normalizeStatus(st) === 'draft') &&
    !(pendingByStatus || auditorLikeByStatus || statusMatchesCeoVisible)
  ) {
    return { pass: false, reason: 'pre_ceo_queue_hr_or_draft' };
  }

  const inCeoQueueBySignals =
    explicitAuditor || statusMatchesCeoVisible || pendingByStatus || auditorLikeByStatus;

  if (isHoldLikeClosedForCeo(st) && !inCeoQueueBySignals) {
    return { pass: false, reason: 'hold_without_auditor_or_ceo_queue_signals' };
  }

  if (explicitAuditor) return { pass: true, reason: 'explicit_auditor_approved_columns' };
  if (statusMatchesCeoVisible) return { pass: true, reason: 'status_matches_ceo_visible_list' };
  if (pendingByStatus) return { pass: true, reason: 'status_pending_ceo_or_auditor_approved_pattern' };
  if (auditorLikeByStatus) return { pass: true, reason: 'status_auditor_approved_like_pattern' };

  const legacyRelease = hasValue(row?.released_at) || hasValue(row?.released_by);
  if (!legacyRelease) return { pass: false, reason: 'no_auditor_fields_no_matching_status_no_release' };

  if (isHrVerifiedLike(st) || normalizeStatus(st) === 'draft') {
    return { pass: false, reason: 'legacy_release_but_pre_auditor_status_hr_or_draft' };
  }

  if (isClosedByPostCeoWorkflowFields(row, st)) {
    return { pass: false, reason: 'legacy_release_past_accounts_paid_or_ceo_columns' };
  }
  return { pass: true, reason: 'legacy_released_post_hr_row' };
}

function shouldShowInCeoQueue(row: any): boolean {
  return evaluateCeoQueueRow(row).pass;
}

function parseRejectionReason(rejection_reason: string | null): {
  auditor_rejected_reason: string | null;
  ceo_rejected_reason: string | null;
  ceo_hold_reason: string | null;
  accounts_hold_reason: string | null;
} {
  if (!rejection_reason?.trim()) {
    return { auditor_rejected_reason: null, ceo_rejected_reason: null, ceo_hold_reason: null, accounts_hold_reason: null };
  }
  const s = rejection_reason.trim();
  if (s.startsWith(PREFIX_AUDITOR_REJECTED)) {
    return { auditor_rejected_reason: s.slice(PREFIX_AUDITOR_REJECTED.length).trim() || null, ceo_rejected_reason: null, ceo_hold_reason: null, accounts_hold_reason: null };
  }
  if (s.startsWith(PREFIX_CEO_REJECTED)) {
    return { auditor_rejected_reason: null, ceo_rejected_reason: s.slice(PREFIX_CEO_REJECTED.length).trim() || null, ceo_hold_reason: null, accounts_hold_reason: null };
  }
  if (s.startsWith(PREFIX_CEO_HOLD)) {
    return { auditor_rejected_reason: null, ceo_rejected_reason: null, ceo_hold_reason: s.slice(PREFIX_CEO_HOLD.length).trim() || null, accounts_hold_reason: null };
  }
  if (s.startsWith(PREFIX_ACCOUNTS_HOLD)) {
    return { auditor_rejected_reason: null, ceo_rejected_reason: null, ceo_hold_reason: null, accounts_hold_reason: s.slice(PREFIX_ACCOUNTS_HOLD.length).trim() || null };
  }
  return { auditor_rejected_reason: s, ceo_rejected_reason: null, ceo_hold_reason: null, accounts_hold_reason: null };
}

export function parseBatchRejectionReasons(row: { rejection_reason?: string | null }): {
  auditor_rejected_reason: string | null;
  ceo_rejected_reason: string | null;
  ceo_hold_reason: string | null;
  accounts_hold_reason: string | null;
} {
  return parseRejectionReason(row.rejection_reason ?? null);
}

const BATCH_SELECT = `
  id, batch_code, department, status, total_employees, total_salary, total_net_pay, total_lop_amount, total_tds,
  created_at, updated_at, created_by, prepared_by, hr_verified_by, hr_verified_at,
  auditor_approved_by, auditor_approved_at, ceo_approved_by, ceo_approved_at,
  accounts_processed_by, accounts_processed_at, paid_by, paid_at, paid_date, released_by, released_at,
  rejection_reason, month, year, from_day, to_day
`;

/** CEO queue: select all columns so any future workflow fields are present in logs and mapping. */
const BATCH_SELECT_CEO_STAR = '*';

export async function fetchBatchesForHR(): Promise<SalaryBatchCard[]> {
  const { data, error } = await supabase
    .from('salary_batches')
    .select(BATCH_SELECT)
    .in('status', HR_VISIBLE_STATUSES)
    .order('created_at', { ascending: false });
  if (error) throw error;
  
  // Additional client-side filter to ensure only HR-visible batches are shown
  const rows = (data || []).filter((row: any) => {
    const normalizedStatus = normalizeSalaryBatchStatus(row.status);
    // Only allow Draft, Auditor Rejected, CEO Rejected
    return (
      normalizedStatus === SALARY_BATCH_STATUS.DRAFT ||
      normalizedStatus === SALARY_BATCH_STATUS.AUDITOR_REJECTED ||
      normalizedStatus === SALARY_BATCH_STATUS.CEO_REJECTED
    );
  });
  
  // Fetch departments for each batch from salary_batch_employees
  const batchCards = await Promise.all(
    rows.map(async (row: any) => {
      const departments = await fetchBatchDepartments(row.id);
      return toBatchCard(row, departments);
    })
  );
  
  return batchCards;
}

export async function fetchBatchesForAuditor(): Promise<SalaryBatchCard[]> {
  const { data, error } = await supabase
    .from('salary_batches')
    .select(BATCH_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data || []).filter((row: any) => {
    const normalizedStatus = normalizeSalaryBatchStatus(row.status);
    // Show HR verified batches that haven't been auditor processed yet
    return normalizedStatus === SALARY_BATCH_STATUS.HR_VERIFIED &&
           !row.auditor_approved_by &&
           !row.ceo_approved_by;
  });
  
  // Fetch departments for each batch from salary_batch_employees
  const batchCards = await Promise.all(
    rows.map(async (row: any) => {
      const departments = await fetchBatchDepartments(row.id);
      return toBatchCard(row, departments);
    })
  );
  
  return batchCards;
}

/** PostgREST `or` segment: exact status match (quoted for spaces/special chars). */
function statusEqOrSegment(statusValue: string): string {
  const escaped = String(statusValue).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `status.eq."${escaped}"`;
}

/** Values for `status=not.in.(...)` â€” must match server-stored strings (see get_ceo_salary_batches). */
function quotedPostgrestInList(values: string[]): string {
  return `(${values
    .map((v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',')})`;
}

/** Exclude terminal / post-CEO rows at fetch time so we do not pull batches that only matched `auditor_*` from a prior cycle. */
const CEO_QUEUE_FETCH_EXCLUDED_STATUSES: string[] = [
  SALARY_BATCH_STATUS.CEO_APPROVED,
  SALARY_BATCH_STATUS.CEO_REJECTED,
  SALARY_BATCH_STATUS.CEO_HOLD,
  SALARY_BATCH_STATUS.ACCOUNTS_PROCESSING,
  SALARY_BATCH_STATUS.PAID,
  SALARY_BATCH_STATUS.PAID_ALREADY,
  SALARY_BATCH_STATUS.AUDITOR_REJECTED,
  SALARY_BATCH_STATUS.HOLD,
];

export async function fetchBatchesForCEO(): Promise<SalaryBatchCard[]> {
  const { data, error } = await supabase
    .from('salary_batches')
    .select(BATCH_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[CEOQueue] fetch error', error);
    throw error;
  }

  const normalizedCeoVisibleStatuses = new Set(
    CEO_VISIBLE_STATUSES.map((status) => normalizeSalaryBatchStatus(status)),
  );
  const normalizedExcludedStatuses = new Set(
    CEO_QUEUE_FETCH_EXCLUDED_STATUSES.map((status) => normalizeSalaryBatchStatus(status)),
  );

  const rows = (data || []).filter((row: any) => {
    const normalizedStatus = normalizeSalaryBatchStatus(row.status);
    const isExcludedStatus = normalizedExcludedStatuses.has(normalizedStatus);

    // Explicitly exclude Draft and HR Verified - CEO should only see auditor-approved batches
    const isPreAuditorStatus =
      normalizedStatus === SALARY_BATCH_STATUS.DRAFT ||
      normalizedStatus === SALARY_BATCH_STATUS.HR_VERIFIED;

    const hasAuditorApprovalColumns = Boolean(
      row.auditor_approved_at || row.auditor_approved_by || row.released_at || row.released_by,
    );
    const statusSignalsAuditorApproval =
      normalizedCeoVisibleStatuses.has(normalizedStatus) ||
      isAuditorApprovedLike(row.status) ||
      isCeoPendingLike(row.status);
    const hasAuditorApproval = hasAuditorApprovalColumns || statusSignalsAuditorApproval;

    const hasHrVerificationSignal = Boolean(
      row.hr_verified_at ||
        row.hr_verified_by ||
        normalizedStatus === SALARY_BATCH_STATUS.HR_VERIFIED ||
        statusSignalsAuditorApproval,
    );

    const hasNoCeoDecision = !row.ceo_approved_at && !row.ceo_approved_by;
    const hasNoDownstreamProcessing =
      !row.accounts_processed_at &&
      !row.accounts_processed_by &&
      !row.paid_at &&
      !row.paid_by &&
      !row.paid_date;

    const passesFilter =
      !isPreAuditorStatus && // NEW: Exclude Draft and HR Verified
      hasHrVerificationSignal &&
      hasAuditorApproval &&
      hasNoCeoDecision &&
      hasNoDownstreamProcessing &&
      !isExcludedStatus;

    return passesFilter;
  });

  // Fetch departments for each batch from salary_batch_employees
  const batchCards = await Promise.all(
    rows.map(async (row: any) => {
      const departments = await fetchBatchDepartments(row.id);
      return toBatchCard(row, departments);
    })
  );

  return batchCards;
}
export async function fetchBatchesForAccounts(): Promise<SalaryBatchCard[]> {
  const { data, error } = await supabase
    .from('salary_batches')
    .select(BATCH_SELECT)
    .order('updated_at', { ascending: false });
  
  if (error) {
    console.error('[AccountsQueue] Supabase error:', error);
    throw error;
  }

  const rows = (data || []).filter((row: any) => {
    const normalizedRowStatus = normalizeStatus(row.status);
    const normalizedCeoApproved = normalizeStatus(SALARY_BATCH_STATUS.CEO_APPROVED);
    const statusApproved = normalizedRowStatus === normalizedCeoApproved;
    const statusInAccounts = ACCOUNTS_VISIBLE_STATUSES
      .map((s) => normalizeStatus(s))
      .includes(normalizedRowStatus);
    
    return statusApproved || statusInAccounts;
  });
  
  // Fetch departments for each batch from salary_batch_employees
  const batchCards = await Promise.all(
    rows.map(async (row: any) => {
      const departments = await fetchBatchDepartments(row.id);
      return toBatchCard(row, departments);
    })
  );
  
  return batchCards;
}

function toBatchCard(row: any, employeeDepartments?: string[]): SalaryBatchCard {
  const parsed = parseRejectionReason(row.rejection_reason ?? null);
  
  // Use provided employee departments or fall back to row.department
  const departments = employeeDepartments && employeeDepartments.length > 0
    ? employeeDepartments
    : (row.department ? [row.department] : []);
  
  const departmentsDisplay = formatDepartmentsDisplay(departments);
  
  return {
    id: row.id,
    batch_code: row.batch_code ?? '',
    batch_name: row.batch_code ?? undefined,
    department: departments[0] || null,
    departments_display: departmentsDisplay,
    total_employees: row.total_employees ?? 0,
    total_salary: row.total_salary ?? 0,
    total_net_pay: row.total_net_pay ?? null,
    total_lop_amount: row.total_lop_amount ?? null,
    total_tds: row.total_tds ?? null,
    status: row.status ?? SALARY_BATCH_STATUS.DRAFT,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    prepared_by: row.prepared_by,
    hr_verified_by: row.hr_verified_by,
    hr_verified_at: row.hr_verified_at,
    auditor_approved_by: row.auditor_approved_by,
    auditor_approved_at: row.auditor_approved_at,
    auditor_rejected_reason: parsed.auditor_rejected_reason,
    ceo_approved_by: row.ceo_approved_by,
    ceo_approved_at: row.ceo_approved_at,
    ceo_rejected_reason: parsed.ceo_rejected_reason,
    ceo_hold_reason: parsed.ceo_hold_reason,
    accounts_hold_reason: parsed.accounts_hold_reason,
    rejection_reason: row.rejection_reason,
    month: row.month,
    year: row.year,
    from_day: row.from_day,
    to_day: row.to_day,
    creator_name: row.creator?.name ?? null,
  };
}

export async function fetchCreatorName(userId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('name').eq('id', userId).single();
  return data?.name ?? null;
}

export async function hrVerifyBatch(batchId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('salary_batches')
    .update({
      status: SALARY_BATCH_STATUS.HR_VERIFIED,
      hr_verified_by: userId,
      hr_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', batchId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Unable to update batch status to HR Verified');
}

export async function auditorApproveBatch(batchId: string, userId: string): Promise<void> {
  // First, try the RPC function (bypasses RLS with SECURITY DEFINER)
  console.info('[SalaryWorkflow][AuditorApprove] Attempting RPC approach', { batchId, userId });

  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('auditor_approve_salary_batch', {
      p_batch_id: batchId,
      p_auditor_id: userId,
    });

    console.info('[SalaryWorkflow][AuditorApprove] RPC result', { rpcResult, rpcError });

    if (rpcError) {
      console.warn('[SalaryWorkflow][AuditorApprove] RPC failed, falling back to direct update', { rpcError });
    } else if ((rpcResult as any)?.success === true) {
      console.info('[SalaryWorkflow][AuditorApprove] RPC succeeded', rpcResult);
      return;
    } else {
      console.warn('[SalaryWorkflow][AuditorApprove] RPC returned failure', rpcResult);
    }
  } catch (e) {
    console.warn('[SalaryWorkflow][AuditorApprove] RPC threw exception', e);
  }

  // Fallback to direct update if RPC fails
  console.info('[SalaryWorkflow][AuditorApprove] Falling back to direct update', { batchId, userId });

  const { data: beforeRow, error: beforeErr } = await supabase
    .from('salary_batches')
    .select(
      'id,status,hr_verified_by,hr_verified_at,auditor_approved_by,auditor_approved_at,ceo_approved_by,ceo_approved_at,accounts_processed_by,accounts_processed_at',
    )
    .eq('id', batchId)
    .maybeSingle();
  if (beforeErr) {
    console.warn('[SalaryWorkflow][AuditorApprove] pre-update read failed', { batchId, beforeErr });
  } else {
    console.info('[SalaryWorkflow][AuditorApprove] previous row before approve', {
      batchId,
      previousStatus: beforeRow?.status,
      previousAuditorAt: beforeRow?.auditor_approved_at,
      previousAuditorBy: beforeRow?.auditor_approved_by,
      previousCeoAt: beforeRow?.ceo_approved_at,
      previousCeoBy: beforeRow?.ceo_approved_by,
    });
  }

  const now = new Date().toISOString();
  const nextStatus = SALARY_BATCH_STATUS.AUDITOR_APPROVED;
  const updatePayload = {
    status: nextStatus,
    auditor_approved_by: userId,
    auditor_approved_at: now,
    released_by: userId,
    released_at: now,
    updated_at: now,
    ceo_approved_by: null,
    ceo_approved_at: null,
    accounts_processed_by: null,
    accounts_processed_at: null,
    paid_by: null,
    paid_at: null,
    paid_date: null,
    rejection_reason: null,
  };

  console.info('[SalaryWorkflow][AuditorApprove] before update', { batchId, userId });
  console.info('[SalaryWorkflow][AuditorApprove] update payload', updatePayload);
  console.info('[SalaryWorkflow][AuditorApprove] status transition', {
    batchId,
    from: beforeRow?.status ?? '(unknown)',
    to: nextStatus,
  });

  const { data, error } = await supabase
    .from('salary_batches')
    .update(updatePayload)
    .eq('id', batchId)
    .select(
      'id,status,auditor_approved_by,auditor_approved_at,hr_verified_by,hr_verified_at,ceo_approved_by,ceo_approved_at,released_at,released_by',
    )
    .maybeSingle();

  console.info('[SalaryWorkflow][AuditorApprove] update response', { data, error });
  if (error) throw error;
  if (!data?.id) {
    console.warn('[SalaryWorkflow][AuditorApprove] update returned no row payload after write', {
      batchId,
      userId,
    });
  }

  const { data: savedRow, error: readBackError } = await supabase
    .from('salary_batches')
    .select(
      'id,status,hr_verified_by,hr_verified_at,auditor_approved_by,auditor_approved_at,ceo_approved_by,ceo_approved_at,accounts_processed_by,accounts_processed_at,paid_by,paid_at,paid_date,released_at,released_by',
    )
    .eq('id', batchId)
    .maybeSingle();

  console.info('[SalaryWorkflow][AuditorApprove] updated row readback', {
    data: savedRow,
    error: readBackError,
    final_status: savedRow?.status,
    final_auditor_approved_at: savedRow?.auditor_approved_at,
    final_auditor_approved_by: savedRow?.auditor_approved_by,
  });

  if (readBackError) {
    throw new Error(`Failed to verify auditor approval save: ${readBackError.message}`);
  }

  const isPersistedInCeoQueueState =
    Boolean(savedRow?.id) &&
    Boolean(savedRow?.auditor_approved_by) &&
    Boolean(savedRow?.auditor_approved_at) &&
    isAuditorApprovedLike(savedRow?.status) &&
    !savedRow?.ceo_approved_by &&
    !savedRow?.ceo_approved_at &&
    !savedRow?.accounts_processed_by &&
    !savedRow?.accounts_processed_at &&
    !savedRow?.paid_by &&
    !savedRow?.paid_at &&
    !savedRow?.paid_date;

  if (isPersistedInCeoQueueState) {
    return;
  }

  console.warn('[SalaryWorkflow][AuditorApprove] readback not in CEO-queue-eligible state, running fallback', {
    batchId,
    savedRow,
  });

  const fallbackNow = new Date().toISOString();
  const { data: fallbackRow, error: fallbackError } = await supabase
    .from('salary_batches')
    .update({
      status: SALARY_BATCH_STATUS.AUDITOR_APPROVED,
      auditor_approved_by: userId,
      auditor_approved_at: fallbackNow,
      released_by: userId,
      released_at: fallbackNow,
      updated_at: fallbackNow,
      ceo_approved_by: null,
      ceo_approved_at: null,
      accounts_processed_by: null,
      accounts_processed_at: null,
      paid_by: null,
      paid_at: null,
      paid_date: null,
      rejection_reason: null,
    })
    .eq('id', batchId)
    .select(
      'id,status,auditor_approved_by,auditor_approved_at,ceo_approved_by,ceo_approved_at,accounts_processed_by,accounts_processed_at,paid_by,paid_at,paid_date,released_at,released_by',
    )
    .maybeSingle();

  console.warn('[SalaryWorkflow][AuditorApprove] fallback write response', {
    data: fallbackRow,
    error: fallbackError,
  });
  if (fallbackError) throw fallbackError;

  const { data: fallbackReadback, error: fallbackReadbackError } = await supabase
    .from('salary_batches')
    .select(
      'id,status,auditor_approved_by,auditor_approved_at,ceo_approved_by,ceo_approved_at,accounts_processed_by,accounts_processed_at,paid_by,paid_at,paid_date,released_at,released_by',
    )
    .eq('id', batchId)
    .maybeSingle();

  console.info('[SalaryWorkflow][AuditorApprove] fallback readback', {
    data: fallbackReadback,
    error: fallbackReadbackError,
    final_status: fallbackReadback?.status,
    final_auditor_approved_at: fallbackReadback?.auditor_approved_at,
    final_auditor_approved_by: fallbackReadback?.auditor_approved_by,
  });

  if (fallbackReadbackError) {
    throw new Error(`Failed to verify fallback approval save: ${fallbackReadbackError.message}`);
  }

  const fallbackPersisted =
    Boolean(fallbackReadback?.id) &&
    Boolean(fallbackReadback?.auditor_approved_by) &&
    Boolean(fallbackReadback?.auditor_approved_at) &&
    isAuditorApprovedLike(fallbackReadback?.status) &&
    !fallbackReadback?.ceo_approved_by &&
    !fallbackReadback?.ceo_approved_at &&
    !fallbackReadback?.accounts_processed_by &&
    !fallbackReadback?.accounts_processed_at &&
    !fallbackReadback?.paid_by &&
    !fallbackReadback?.paid_at &&
    !fallbackReadback?.paid_date;

  if (!fallbackPersisted) {
    throw new Error('Auditor approval did not persist with CEO-queue-eligible values. Please retry.');
  }
}
export async function auditorRejectBatch(batchId: string, userId: string, reason: string): Promise<void> {
  if (!reason?.trim()) throw new Error('Rejection reason is mandatory');
  const { data, error } = await supabase
    .from('salary_batches')
    .update({
      status: SALARY_BATCH_STATUS.AUDITOR_REJECTED,
      updated_at: new Date().toISOString(),
      rejection_reason: PREFIX_AUDITOR_REJECTED + reason.trim(),
    })
    .eq('id', batchId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Unable to reject batch from Auditor stage');
}

export async function ceoApproveBatch(batchId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('salary_batches')
    .update({
      status: SALARY_BATCH_STATUS.CEO_APPROVED,
      ceo_approved_by: userId,
      ceo_approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', batchId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Unable to update batch status to CEO Approved');
}

export async function ceoRejectBatch(batchId: string, userId: string, reason: string): Promise<void> {
  if (!reason?.trim()) throw new Error('Rejection reason is mandatory');
  const { data, error } = await supabase
    .from('salary_batches')
    .update({
      status: SALARY_BATCH_STATUS.CEO_REJECTED,
      updated_at: new Date().toISOString(),
      rejection_reason: PREFIX_CEO_REJECTED + reason.trim(),
    })
    .eq('id', batchId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Unable to reject batch from CEO stage');
}

export async function ceoHoldBatch(batchId: string, userId: string, reason: string): Promise<void> {
  if (!reason?.trim()) throw new Error('Hold reason is mandatory');
  const { data, error } = await supabase
    .from('salary_batches')
    .update({
      status: SALARY_BATCH_STATUS.CEO_HOLD,
      updated_at: new Date().toISOString(),
      rejection_reason: PREFIX_CEO_HOLD + reason.trim(),
    })
    .eq('id', batchId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Unable to hold batch from CEO stage');
}

export async function accountsHoldBatch(batchId: string, reason: string): Promise<void> {
  if (!reason?.trim()) throw new Error('Hold reason is mandatory');
  const { error } = await supabase
    .from('salary_batches')
    .update({
      status: SALARY_BATCH_STATUS.HOLD,
      updated_at: new Date().toISOString(),
      rejection_reason: PREFIX_ACCOUNTS_HOLD + reason.trim(),
    })
    .eq('id', batchId);
  if (error) throw error;
}

export async function setBatchAccountsProcessing(batchId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('salary_batches')
    .update({
      status: SALARY_BATCH_STATUS.ACCOUNTS_PROCESSING,
      accounts_processed_by: userId,
      accounts_processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId);
  if (error) throw error;
}

export async function setBatchFullyPaid(batchId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('salary_batches')
    .update({
      status: SALARY_BATCH_STATUS.PAID,
      paid_by: userId,
      paid_at: new Date().toISOString(),
      paid_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId);
  if (error) throw error;
}

export async function setBatchPaidAlready(batchId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('salary_batches')
    .update({
      status: SALARY_BATCH_STATUS.PAID_ALREADY,
      paid_by: userId,
      paid_at: new Date().toISOString(),
      paid_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId);
  if (error) throw error;
}

export interface BatchEmployeeRow {
  id: string;
  batch_id: string;
  profile_id: string;
  employee_id: string | null;
  employee_name: string | null;
  department: string | null;
  net_pay: number;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  status: string;
  /** Optional salary breakdown for CEO/Auditor full-detail view */
  basic_salary?: number;
  earned_salary?: number;
  lop_days?: number;
  lop_amount?: number;
  incentive?: number;
  increment?: number;
  tds?: number;
  per_day_salary?: number;
}

export async function fetchBatchEmployees(batchId: string): Promise<BatchEmployeeRow[]> {
  const { data, error } = await supabase
    .from('salary_batch_employees')
    .select('id, batch_id, profile_id, employee_id, employee_name, department, net_pay, bank_name, account_number, ifsc_code, status, basic_salary, earned_salary, lop_days, lop_amount, incentive, increment, tds, per_day_salary')
    .eq('batch_id', batchId)
    .order('employee_name', { ascending: true });
  if (error) throw error;
  return (data || []) as BatchEmployeeRow[];
}

export async function updateBatchEmployeeStatus(
  rowId: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from('salary_batch_employees')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', rowId);
  if (error) throw error;
}

/** Update a single employee row in salary_batch_employees by batch_id and profile_id (or employee_id). Keeps batch snapshot in sync with HR/CEO edits. */
export async function updateBatchEmployeeRow(
  batchId: string,
  profileId: string,
  payload: {
    department?: string;
    employee_name?: string;
    basic_salary?: number;
    days_in_month?: number;
    selected_days?: number;
    per_day_salary?: number;
    earned_salary?: number;
    lop_days?: number;
    lop_amount?: number;
    lop_bucket?: string;
    incentive?: number;
    increment?: number;
    tds?: number;
    net_pay?: number;
    bank_name?: string | null;
    account_number?: string | null;
    ifsc_code?: string | null;
  }
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    ...payload,
  };
  if (payload.lop_days != null && payload.lop_bucket == null) {
    updatePayload.lop_bucket = getLopBucket(payload.lop_days);
  }
  const { data: rows } = await supabase
    .from('salary_batch_employees')
    .select('id')
    .eq('batch_id', batchId)
    .or(`profile_id.eq.${profileId},employee_id.eq.${profileId}`);
  if (!rows?.length) return;
  const { error } = await supabase
    .from('salary_batch_employees')
    .update(updatePayload)
    .eq('id', rows[0].id);
  if (error) throw error;
}

/** Update a single salary_batch_employees row by primary row id. */
export async function updateBatchEmployeeRowById(
  rowId: string,
  payload: {
    department?: string;
    employee_name?: string;
    basic_salary?: number;
    days_in_month?: number;
    selected_days?: number;
    per_day_salary?: number;
    earned_salary?: number;
    lop_days?: number;
    lop_amount?: number;
    lop_bucket?: string;
    incentive?: number;
    increment?: number;
    tds?: number;
    net_pay?: number;
    bank_name?: string | null;
    account_number?: string | null;
    ifsc_code?: string | null;
  }
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    ...payload,
  };
  if (payload.lop_days != null && payload.lop_bucket == null) {
    updatePayload.lop_bucket = getLopBucket(payload.lop_days);
  }
  const { error } = await supabase
    .from('salary_batch_employees')
    .update(updatePayload)
    .eq('id', rowId);
  if (error) throw error;
}

/** Recalculate batch totals from salary_batch_employees and update salary_batches. Call after editing rows. */
export async function recalculateBatchTotals(batchId: string): Promise<void> {
  const { data: employees, error: fetchErr } = await supabase
    .from('salary_batch_employees')
    .select('net_pay, lop_amount, incentive, increment, tds')
    .eq('batch_id', batchId);
  if (fetchErr) throw fetchErr;
  if (!employees?.length) return;
  const total_employees = employees.length;
  const total_net_pay = employees.reduce((s, e) => s + Number(e.net_pay ?? 0), 0);
  const total_lop_amount = employees.reduce((s, e) => s + Number(e.lop_amount ?? 0), 0);
  const total_tds = employees.reduce((s, e) => s + Number(e.tds ?? 0), 0);
  const total_salary = total_net_pay + total_lop_amount + total_tds;
  const { error: updateErr } = await supabase
    .from('salary_batches')
    .update({
      total_employees,
      total_net_pay,
      total_lop_amount,
      total_salary,
      total_tds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId);
  if (updateErr) throw updateErr;
}

export async function getBatchById(batchId: string): Promise<SalaryBatchCard | null> {
  const { data, error } = await supabase
    .from('salary_batches')
    .select(BATCH_SELECT)
    .eq('id', batchId)
    .single();
  if (error || !data) return null;
  
  // Fetch departments for this batch
  const departments = await fetchBatchDepartments(batchId);
  return toBatchCard(data, departments);
}

/** Payroll row shape for bulk batch creation (from getEmployeesWithProfile + filter by department) */
export interface PayrollRowForBatch {
  id: string;
  name: string;
  department: string;
  basic_salary: number;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  increment: number;
  incentive: number;
  lop_days: number;
  lop_amount: number;
  tds: number;
  days_in_month: number;
  selected_days: number;
  final_salary: number;
  earned_salary?: number;
  per_day_salary?: number;
}

function getLopBucket(lopDays: number): string {
  const d = Number(lopDays) || 0;
  if (d <= 0) return 'NO_LOP';
  if (d < 1) return '0_0_9';
  if (d < 2) return '1_1_99';
  if (d < 3) return '2_2_99';
  return '3_PLUS';
}

/** Create a salary batch from payroll employee list (Bulk Prepare). Returns batch id. */
export async function createBulkBatch(
  employees: PayrollRowForBatch[],
  month: number,
  year: number,
  createdBy: string,
  departmentLabel: string,
  fromDay: number,
  toDay: number
): Promise<{ batchId: string; batchCode: string }> {
  if (!employees.length) throw new Error('No employees to add to batch');
  const safe = (v: unknown) => (v != null && v !== '' ? Number(v) : 0);
  const totalNetPay = employees.reduce((s, e) => s + safe(e.final_salary), 0);
  const totalLop = employees.reduce((s, e) => s + safe(e.lop_amount), 0);
  const totalTds = employees.reduce((s, e) => s + safe(e.tds), 0);
  const batchCode = `BATCH-${month}-${year}-${Date.now()}`;
  const { data: batch, error: batchError } = await supabase
    .from('salary_batches')
    .insert({
      month,
      year,
      from_day: fromDay,
      to_day: toDay,
      department: departmentLabel,
      status: SALARY_BATCH_STATUS.DRAFT,
      total_employees: employees.length,
      total_salary: totalNetPay + totalLop + totalTds,
      total_net_pay: totalNetPay,
      total_lop_amount: totalLop,
      total_tds: totalTds,
      batch_code: batchCode,
      created_by: createdBy,
    })
    .select('id')
    .single();
  if (batchError || !batch) throw new Error(batchError?.message ?? 'Failed to create batch');
  const batchId = batch.id;
  const profileIdCol = await detectProfileIdColumn();
  const rows = employees.map((e) => {
    const days = safe(e.days_in_month) || 30;
    const sel = safe(e.selected_days) || days;
    const perDay = days > 0 ? safe(e.final_salary) / days : 0;
    const earned = safe(e.earned_salary) || perDay * sel;
    return {
      batch_id: batchId,
      ...(profileIdCol === 'profile_id' ? { profile_id: e.id } : { employee_id: e.id }),
      employee_name: e.name,
      department: e.department,
      days_in_month: days,
      selected_days: sel,
      per_day_salary: perDay,
      earned_salary: earned,
      lop_days: safe(e.lop_days),
      lop_bucket: getLopBucket(e.lop_days),
      lop_amount: safe(e.lop_amount),
      incentive: safe(e.incentive),
      increment: safe(e.increment),
      tds: safe(e.tds),
      net_pay: safe(e.final_salary),
      bank_name: e.bank_name ?? null,
      account_number: e.account_number ?? null,
      ifsc_code: e.ifsc_code ?? null,
      status: SALARY_BATCH_STATUS.DRAFT,
    };
  });
  const { error: insertErr } = await supabase.from('salary_batch_employees').insert(rows as any);
  if (insertErr) {
    await supabase.from('salary_batches').delete().eq('id', batchId);
    throw new Error(insertErr.message);
  }
  return { batchId, batchCode };
}

/** Delete a salary batch and its employees. Caller should only allow for Draft batches. */
export async function deleteSalaryBatch(batchId: string): Promise<void> {
  const { error: empErr } = await supabase
    .from('salary_batch_employees')
    .delete()
    .eq('batch_id', batchId);
  if (empErr) throw new Error(empErr.message);
  const { error: batchErr } = await supabase
    .from('salary_batches')
    .delete()
    .eq('id', batchId);
  if (batchErr) throw new Error(batchErr.message);
}

async function detectProfileIdColumn(): Promise<'profile_id' | 'employee_id'> {
  const { error: profileErr } = await supabase.from('salary_batch_employees').select('profile_id').limit(1);
  if (!profileErr) return 'profile_id';
  const { error: empErr } = await supabase.from('salary_batch_employees').select('employee_id').limit(1);
  if (!empErr) return 'employee_id';
  return 'profile_id';
}

