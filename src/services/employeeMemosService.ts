// @ts-nocheck
/**
 * Employee Memos Service
 * Handles all memo operations: warnings and appreciation records
 */

import { supabase } from '@/integrations/supabase/client';

export type MemoType = 'warning' | 'appreciation' | 'general';
export type MemoSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ViolationType = 'attendance' | 'behavior' | 'performance' | 'policy' | 'safety' | 'other';
export type RecognitionType = 'exceptional_work' | 'team_player' | 'innovation' | 'customer_service' | 'other';

export interface EmployeeMemo {
  id: string;
  employee_id: string;
  memo_type: MemoType;
  memo_title: string;
  memo_description: string;
  severity: MemoSeverity | null;
  violation_type: ViolationType | null;
  action_taken: string | null;
  recognition_type: RecognitionType | null;
  memo_date: string;
  issued_by: string;
  issued_at: string;
  acknowledged_by_employee: boolean;
  acknowledged_at: string | null;
  attachment_urls: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Memo CRUD Operations
// ============================================

export const issueMemo = async (
  memo: Omit<EmployeeMemo, 'id' | 'created_at' | 'updated_at' | 'issued_at' | 'acknowledged_by_employee' | 'acknowledged_at' | 'is_active'>
): Promise<EmployeeMemo> => {
  const userId = (await supabase.auth.getSession()).data.session?.user.id;
  
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('employee_memos')
    .insert({
      ...memo,
      issued_by: userId,
      issued_at: new Date().toISOString(),
      acknowledged_by_employee: false,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const updateMemo = async (
  memoId: string,
  updates: Partial<EmployeeMemo>
): Promise<void> => {
  // Cannot update issued_by or issued_at
  const { error } = await supabase
    .from('employee_memos')
    .update(updates)
    .eq('id', memoId);

  if (error) {
    throw error;
  }
};

export const acknowledgeMemo = async (memoId: string): Promise<void> => {
  const { error } = await supabase
    .from('employee_memos')
    .update({
      acknowledged_by_employee: true,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', memoId);

  if (error) {
    throw error;
  }
};

export const deactivateMemo = async (memoId: string): Promise<void> => {
  const { error } = await supabase
    .from('employee_memos')
    .update({ is_active: false })
    .eq('id', memoId);

  if (error) {
    throw error;
  }
};

export const deleteMemo = async (memoId: string): Promise<void> => {
  const { error } = await supabase
    .from('employee_memos')
    .delete()
    .eq('id', memoId);

  if (error) {
    throw error;
  }
};

// ============================================
// Memo Retrieval
// ============================================

export const getEmployeeMemos = async (employeeId: string, onlyActive: boolean = true): Promise<EmployeeMemo[]> => {
  let query = supabase
    .from('employee_memos')
    .select('*')
    .eq('employee_id', employeeId);

  if (onlyActive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.order('memo_date', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
};

export const getWarningMemos = async (employeeId: string): Promise<EmployeeMemo[]> => {
  const { data, error } = await supabase
    .from('employee_memos')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('memo_type', 'warning')
    .eq('is_active', true)
    .order('memo_date', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
};

export const getAppreciationMemos = async (employeeId: string): Promise<EmployeeMemo[]> => {
  const { data, error } = await supabase
    .from('employee_memos')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('memo_type', 'appreciation')
    .eq('is_active', true)
    .order('memo_date', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
};

export const getUnacknowledgedMemos = async (employeeId: string): Promise<EmployeMemo[]> => {
  const { data, error } = await supabase
    .from('employee_memos')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('acknowledged_by_employee', false)
    .eq('is_active', true)
    .order('memo_date', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
};

// ============================================
// Memo Statistics & Analytics
// ============================================

export const getMemoStats = async (employeeId: string): Promise<{
  total_memos: number;
  warning_memos: number;
  appreciation_memos: number;
  unacknowledged_count: number;
  by_severity: Record<MemoSeverity | 'none', number>;
}> => {
  const allMemos = await getEmployeeMemos(employeeId, false);

  const stats = {
    total_memos: allMemos.length,
    warning_memos: 0,
    appreciation_memos: 0,
    unacknowledged_count: 0,
    by_severity: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
      none: 0,
    },
  };

  allMemos.forEach((memo) => {
    if (memo.memo_type === 'warning') {
      stats.warning_memos++;
      const severity = memo.severity || 'none';
      stats.by_severity[severity as MemoSeverity | 'none']++;
    } else if (memo.memo_type === 'appreciation') {
      stats.appreciation_memos++;
    }

    if (!memo.acknowledged_by_employee && memo.is_active) {
      stats.unacknowledged_count++;
    }
  });

  return stats;
};

export const getRecentMemos = async (
  limit: number = 10,
  offset: number = 0
): Promise<{
  memos: (EmployeeMemo & { employee_name: string; issuer_name: string })[];
  total: number;
}> => {
  const { data, error, count } = await supabase
    .from('employee_memos')
    .select(
      `
      *,
      profiles!employee_id(full_name),
      issued_by_profile:profiles!issued_by(full_name)
    `,
      { count: 'exact' }
    )
    .eq('is_active', true)
    .order('memo_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return {
    memos: (data || []).map((d: any) => ({
      ...d,
      employee_name: d.profiles?.full_name || 'Unknown',
      issuer_name: d.issued_by_profile?.full_name || 'Admin',
    })),
    total: count || 0,
  };
};

// ============================================
// Memo Filtering & Search
// ============================================

export const getMemosBySeverity = async (
  employeeId: string,
  severity: MemoSeverity
): Promise<EmployeeMemo[]> => {
  const { data, error } = await supabase
    .from('employee_memos')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('severity', severity)
    .eq('is_active', true)
    .order('memo_date', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
};

export const getMemosByDateRange = async (
  employeeId: string,
  startDate: string,
  endDate: string
): Promise<EmployeeMemo[]> => {
  const { data, error } = await supabase
    .from('employee_memos')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('memo_date', startDate)
    .lte('memo_date', endDate)
    .eq('is_active', true)
    .order('memo_date', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
};

// ============================================
// Department/Company Level Analytics
// ============================================

export const getDepartmentWarnings = async (
  department: string
): Promise<{
  employee_id: string;
  employee_name: string;
  warning_count: number;
  critical_count: number;
}[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('department', department);

  if (error) {
    throw error;
  }

  const results = [];
  for (const employee of data || []) {
    const memos = await getWarningMemos(employee.id);
    const criticalCount = memos.filter((m) => m.severity === 'critical').length;
    if (memos.length > 0) {
      results.push({
        employee_id: employee.id,
        employee_name: employee.full_name,
        warning_count: memos.length,
        critical_count: criticalCount,
      });
    }
  }

  return results.sort((a, b) => b.critical_count - a.critical_count);
};

export default {
  issueMemo,
  updateMemo,
  acknowledgeMemo,
  deactivateMemo,
  deleteMemo,
  getEmployeeMemos,
  getWarningMemos,
  getAppreciationMemos,
  getUnacknowledgedMemos,
  getMemoStats,
  getRecentMemos,
  getMemosBySeverity,
  getMemosByDateRange,
  getDepartmentWarnings,
};
