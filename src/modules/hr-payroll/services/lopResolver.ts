// @ts-nocheck
/**
 * Schema-safe LOP resolver: detects lop_entries column names at runtime
 * and never hardcodes lop_days in queries (DB may have lop_type only).
 */
import { supabase } from '@/integrations/supabase/client';

export interface LopColumns {
  profileKey: string;   // employee_id | profile_id
  dateCol: string;     // lop_date | date | entry_date | created_at
  daysCol: string | null;  // lop_days | lop_day | days | lop_value | value | null (derive from lop_type)
  amountCol: string | null; // lop_amount | amount | deduction_amount | null
  lopTypeCol: string | null; // lop_type (for deriving days when daysCol missing)
  statusCol: string | null; // status column name or null if doesn't exist
}

let cachedColumns: LopColumns | null = null;

/** Convert lop_type string to numeric days (when table has lop_type, no lop_days) */
function lopTypeToDays(lopType: string | null | undefined): number {
  if (!lopType || typeof lopType !== 'string') return 0;
  const t = lopType.toLowerCase().replace(/[_\s]/g, '');
  if (t.includes('0.25')) return 0.25;
  if (t.includes('0.5')) return 0.5;
  if (t.includes('1day') || t === '1') return 1;
  const num = parseFloat(lopType);
  if (!Number.isNaN(num) && num >= 0 && num <= 31) return num;
  return 0;
}

/**
 * Detect real lop_entries columns via select('*').limit(1).
 * Resolves: profile key, date column, days (column or from lop_type), amount (optional).
 */
export async function detectLopColumns(): Promise<LopColumns> {
  if (cachedColumns) return cachedColumns;

  const { data, error } = await supabase
    .from('lop_entries')
    .select('*')
    .limit(1);

  const row = Array.isArray(data) && data.length > 0 ? data[0] : (data as Record<string, unknown>) || {};
  const keys = Object.keys(row);

  // Detect if status column exists
  const hasStatusCol = keys.includes('status');

  const profileKey = keys.includes('employee_id') ? 'employee_id'
    : keys.includes('profile_id') ? 'profile_id'
    : 'employee_id';
  const dateCol = keys.includes('lop_date') ? 'lop_date'
    : keys.includes('date') ? 'date'
    : keys.includes('entry_date') ? 'entry_date'
    : keys.includes('created_at') ? 'created_at'
    : 'lop_date';
  const daysCol = keys.includes('lop_days') ? 'lop_days'
    : keys.includes('lop_day') ? 'lop_day'
    : keys.includes('days') ? 'days'
    : keys.includes('lop_value') ? 'lop_value'
    : keys.includes('value') ? 'value'
    : null;
  const amountCol = keys.includes('lop_amount') ? 'lop_amount'
    : keys.includes('amount') ? 'amount'
    : keys.includes('deduction_amount') ? 'deduction_amount'
    : null;
  const lopTypeCol = keys.includes('lop_type') ? 'lop_type' : null;
  const statusCol = hasStatusCol ? 'status' : null;

  cachedColumns = {
    profileKey,
    dateCol,
    daysCol,
    amountCol,
    lopTypeCol,
    statusCol,
  };

  // Dev log: detected columns + sample
  const colLog = `lop_entries columns: profileKey=${profileKey} dateCol=${dateCol} daysCol=${daysCol ?? 'null(derive from lop_type)'} amountCol=${amountCol ?? 'null'} lopTypeCol=${lopTypeCol ?? 'null'}`;
  console.log('[lopResolver]', colLog);
  return cachedColumns;
}

export interface LopSummaryItem {
  lop_days: number;
  lop_amount: number;
}

/**
 * Fetch LOP summary by profile_id for selected date range.
 * Inputs: profileIds, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD inclusive).
 * Returns map profile_id -> { lop_days, lop_amount }.
 * Uses resolved columns only; aggregates sumDays and sumAmount (if amount col exists).
 */
export async function getLOPSummaryByProfileIds(
  profileIds: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, LopSummaryItem>> {
  const result = new Map<string, LopSummaryItem>();
  if (profileIds.length === 0) return result;

  const cols = await detectLopColumns();

  const selectList = [cols.profileKey, cols.dateCol];
  if (cols.daysCol) selectList.push(cols.daysCol);
  if (cols.amountCol) selectList.push(cols.amountCol);
  if (cols.lopTypeCol) selectList.push(cols.lopTypeCol);
  const selectStr = selectList.join(', ');

  // Build query conditionally based on detected columns
  let query = supabase
    .from('lop_entries')
    .select(selectStr)
    .in(cols.profileKey, profileIds)
    .gte(cols.dateCol, startDate)
    .lte(cols.dateCol, endDate);
  
  // Only filter by status if the column exists
  if (cols.statusCol) {
    query = query.in('status', ['approved', 'pending_admin', 'pending_boi']);
  }
  
  const { data, error } = await query;

  console.log('[lopResolver] DEBUG - Query details:', {
    selectStr,
    profileKey: cols.profileKey,
    dateCol: cols.dateCol,
    statusCol: cols.statusCol,
    profileIdsCount: profileIds.length,
    profileIdsSample: profileIds.slice(0, 3),
    startDate,
    endDate,
    statusFilter: cols.statusCol ? ['approved', 'pending_admin', 'pending_boi'] : 'N/A (no status column)'
  });

  if (error) {
    console.error('[lopResolver] getLOPSummaryByProfileIds error:', error);
    return result;
  }

  const rows = (data || []) as Record<string, unknown>[];
  console.log('[lopResolver] Fetched lop_entries count:', rows.length, '| detected columns:', cols);
  
  // Debug: Show sample raw entries
  if (rows.length > 0) {
    console.log('[lopResolver] DEBUG - Sample raw entries (first 3):', rows.slice(0, 3).map(row => ({
      [cols.profileKey]: row[cols.profileKey],
      [cols.dateCol]: row[cols.dateCol],
      status: row.status,
      [cols.daysCol || 'lop_type']: row[cols.daysCol] || row[cols.lopTypeCol],
      [cols.amountCol || 'no_amount']: row[cols.amountCol] || 'null'
    })));
  }

  for (const row of rows) {
    const pid = String(row[cols.profileKey] ?? '');
    if (!pid) continue;

    let days = 0;
    // First try to use daysCol if it exists and has a valid numeric value
    if (cols.daysCol && typeof row[cols.daysCol] === 'number' && row[cols.daysCol] > 0) {
      days = Number(row[cols.daysCol]);
    } else if (cols.daysCol && row[cols.daysCol] != null && Number(row[cols.daysCol]) > 0) {
      // Handle case where value is string or other type but convertible to positive number
      days = Number(row[cols.daysCol]) || 0;
    } else if (cols.lopTypeCol && row[cols.lopTypeCol]) {
      // Fallback: derive days from lop_type when lop_days is null/0/missing
      days = lopTypeToDays(String(row[cols.lopTypeCol]));
    }

    let amount = 0;
    if (cols.amountCol && (typeof row[cols.amountCol] === 'number' || row[cols.amountCol] != null)) {
      amount = Number(row[cols.amountCol]) || 0;
    }
    // If amount is 0 but we have days, we could calculate it later - leave as 0 for now

    const existing = result.get(pid) ?? { lop_days: 0, lop_amount: 0 };
    const newValues = {
      lop_days: Math.round((existing.lop_days + days) * 100) / 100,
      lop_amount: Math.round((existing.lop_amount + amount) * 100) / 100,
    };
    result.set(pid, newValues);
    
    // Debug: Show detailed processing for each entry
    console.log(`[lopResolver] DEBUG - Processing entry for ${pid}:`, {
      rawDaysFromCol: cols.daysCol ? row[cols.daysCol] : 'N/A (no daysCol)',
      rawLopType: cols.lopTypeCol ? row[cols.lopTypeCol] : 'N/A (no lopTypeCol)',
      processedDays: days,
      rawAmountFromCol: cols.amountCol ? row[cols.amountCol] : 'N/A (no amountCol)',
      processedAmount: amount
    });
  }

  // Debug: Show final results
  console.log('[lopResolver] DEBUG - Final LOP summary results:', {
    totalProfiles: result.size,
    results: Array.from(result.entries()).slice(0, 3).map(([pid, data]) => ({
      profile_id: pid,
      lop_days: data.lop_days,
      lop_amount: data.lop_amount
    }))
  });

  return result;
}

/**
 * Upsert a monthly LOP summary row for one employee.
 * Uses resolved columns; date = first day of month (YYYY-MM-01).
 * Only persists when table has a days column (e.g. lop_days); otherwise no-op (UI state only).
 */
export async function upsertLOPMonthlySummary(
  profileId: string,
  year: number,
  month: number,
  lopDays: number
): Promise<{ ok: boolean; error?: string }> {
  const cols = await detectLopColumns();
  if (!cols.daysCol) {
    return { ok: true }; // Table has no lop_days column; UI keeps state only
  }
  const dateVal = `${year}-${String(month).padStart(2, '0')}-01`;
  const payload: Record<string, unknown> = {
    [cols.profileKey]: profileId,
    [cols.dateCol]: dateVal,
    [cols.daysCol]: lopDays,
    reason: 'Employee Master monthly summary',
    updated_at: new Date().toISOString(),
  };
  
  // Only add status if the column exists
  if (cols.statusCol) {
    payload.status = 'approved';
  }
  const { error } = await supabase.from('lop_entries').upsert(payload, {
    onConflict: `${cols.profileKey},${cols.dateCol}`,
  });
  if (error) {
    console.error('[lopResolver] upsertLOPMonthlySummary error:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
