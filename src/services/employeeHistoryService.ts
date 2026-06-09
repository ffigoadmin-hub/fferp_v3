// @ts-nocheck
/**
 * Employee History Service
 * Handles career progression and change tracking
 */

import { supabase } from '@/integrations/supabase/client';

export type ChangeType = 'role_change' | 'department_change' | 'team_change' | 'promotion' | 'transfer' | 'status_change' | 'other';

export interface EmployeeHistoryEntry {
  id: string;
  employee_id: string;
  change_type: ChangeType;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  change_date: string;
  effective_date: string | null;
  change_reason: string | null;
  notes: string | null;
  changed_by: string | null;
  changed_at: string;
  created_at: string;
}

// ============================================
// History CRUD Operations
// ============================================

export const addHistoryEntry = async (
  entry: Omit<EmployeeHistoryEntry, 'id' | 'changed_at' | 'created_at' | 'changed_by'>
): Promise<EmployeeHistoryEntry> => {
  const changedBy = (await supabase.auth.getSession()).data.session?.user.id;
  
  if (!changedBy) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await (supabase.from('employee_history') as any)
    .insert({
      ...entry,
      changed_by: changedBy,
      changed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as EmployeeHistoryEntry;
};

export const updateHistoryEntry = async (
  historyId: string,
  updates: Partial<EmployeeHistoryEntry>
): Promise<void> => {
  const { error } = await (supabase.from('employee_history') as any)
    .update(updates)
    .eq('id', historyId);

  if (error) {
    throw error;
  }
};

export const deleteHistoryEntry = async (historyId: string): Promise<void> => {
  const { error } = await (supabase.from('employee_history') as any)
    .delete()
    .eq('id', historyId);

  if (error) {
    throw error;
  }
};

// ============================================
// History Retrieval
// ============================================

export const getEmployeeHistory = async (
  employeeId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{
  history: EmployeeHistoryEntry[];
  total: number;
}> => {
  const { data, error, count } = await (supabase.from('employee_history') as any)
    .select('*', { count: 'exact' })
    .eq('employee_id', employeeId)
    .order('change_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return {
    history: (data || []) as EmployeeHistoryEntry[],
    total: count || 0,
  };
};

export const getFullEmployeeTimeline = async (employeeId: string): Promise<EmployeeHistoryEntry[]> => {
  const { data, error } = await (supabase.from('employee_history') as any)
    .select('*')
    .eq('employee_id', employeeId)
    .order('change_date', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []) as EmployeeHistoryEntry[];
};

// ============================================
// History by Change Type
// ============================================

export const getRoleChanges = async (employeeId: string): Promise<EmployeeHistoryEntry[]> => {
  const { data, error } = await (supabase.from('employee_history') as any)
    .select('*')
    .eq('employee_id', employeeId)
    .eq('change_type', 'role_change')
    .order('change_date', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as EmployeeHistoryEntry[];
};

export const getDepartmentChanges = async (employeeId: string): Promise<EmployeeHistoryEntry[]> => {
  const { data, error } = await (supabase.from('employee_history') as any)
    .select('*')
    .eq('employee_id', employeeId)
    .eq('change_type', 'department_change')
    .order('change_date', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as EmployeeHistoryEntry[];
};

export const getTeamChanges = async (employeeId: string): Promise<EmployeeHistoryEntry[]> => {
  const { data, error } = await (supabase.from('employee_history') as any)
    .select('*')
    .eq('employee_id', employeeId)
    .eq('change_type', 'team_change')
    .order('change_date', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as EmployeeHistoryEntry[];
};

export const getPromotions = async (employeeId: string): Promise<EmployeeHistoryEntry[]> => {
  const { data, error } = await (supabase.from('employee_history') as any)
    .select('*')
    .eq('employee_id', employeeId)
    .eq('change_type', 'promotion')
    .order('change_date', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as EmployeeHistoryEntry[];
};

// ============================================
// History Statistics
// ============================================

export const getCareerStats = async (employeeId: string): Promise<{
  total_changes: number;
  role_changes: number;
  promotions: number;
  transfers: number;
  years_of_service: number;
}> => {
  const history = await getFullEmployeeTimeline(employeeId);
  
  // Get joining date from profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('joining_date')
    .eq('id', employeeId)
    .single();

  if (profileError) {
    throw profileError;
  }

  const joiningDate = profile?.joining_date ? new Date(profile.joining_date) : new Date();
  const yearsOfService = Math.floor((Date.now() - joiningDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  return {
    total_changes: history.length,
    role_changes: history.filter((h) => h.change_type === 'role_change').length,
    promotions: history.filter((h) => h.change_type === 'promotion').length,
    transfers: history.filter((h) => h.change_type === 'transfer').length,
    years_of_service: yearsOfService,
  };
};

// ============================================
// History by Date Range
// ============================================

export const getHistoryByDateRange = async (
  employeeId: string,
  startDate: string,
  endDate: string
): Promise<EmployeeHistoryEntry[]> => {
  const { data, error } = await (supabase.from('employee_history') as any)
    .select('*')
    .eq('employee_id', employeeId)
    .gte('change_date', startDate)
    .lte('change_date', endDate)
    .order('change_date', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as EmployeeHistoryEntry[];
};

// ============================================
// Department/Company Level History
// ============================================

export const getDepartmentHistory = async (
  department: string,
  limit: number = 100
): Promise<(EmployeeHistoryEntry & { employee_name: string })[]> => {
  const { data: historyData, error: historyError } = await (supabase.from('employee_history') as any)
    .select('*')
    .in(
      'employee_id',
      (
        await supabase.from('profiles').select('id').eq('department', department)
      ).data?.map((p) => p.id) || []
    )
    .order('change_date', { ascending: false })
    .limit(limit);

  if (historyError) {
    throw historyError;
  }

  // Fetch employee names
  const enrichedData = [];
  for (const entry of historyData || []) {
    const { data: employee } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', entry.employee_id)
      .single();

    enrichedData.push({
      ...entry,
      employee_name: employee?.full_name || 'Unknown',
    });
  }

  return enrichedData;
};

// ============================================
// Career Path Analysis
// ============================================

export const getCareerPath = async (employeeId: string): Promise<{
  current_role: string | null;
  current_department: string | null;
  role_progression: { date: string; old_role: string; new_role: string }[];
  department_progression: { date: string; old_dept: string; new_dept: string }[];
}> => {
  const history = await getFullEmployeeTimeline(employeeId);

  // Get current role and department
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, department')
    .eq('id', employeeId)
    .single();

  const roleProgression = history
    .filter((h) => h.change_type === 'role_change')
    .map((h) => ({
      date: h.change_date,
      old_role: h.old_value || 'Unknown',
      new_role: h.new_value || 'Unknown',
    }));

  const deptProgression = history
    .filter((h) => h.change_type === 'department_change')
    .map((h) => ({
      date: h.change_date,
      old_dept: h.old_value || 'Unknown',
      new_dept: h.new_value || 'Unknown',
    }));

  return {
    current_role: profile?.role || null,
    current_department: profile?.department || null,
    role_progression: roleProgression,
    department_progression: deptProgression,
  };
};

export default {
  addHistoryEntry,
  updateHistoryEntry,
  deleteHistoryEntry,
  getEmployeeHistory,
  getFullEmployeeTimeline,
  getRoleChanges,
  getDepartmentChanges,
  getTeamChanges,
  getPromotions,
  getCareerStats,
  getHistoryByDateRange,
  getDepartmentHistory,
  getCareerPath,
};
