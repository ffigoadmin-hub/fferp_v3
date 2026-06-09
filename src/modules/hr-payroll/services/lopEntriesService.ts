import { supabase } from '@/integrations/supabase/client';

// Helper function to convert lop_type to numeric days
function lopTypeToDays(lop_type: string): number {
  if (!lop_type) return 0;
  
  // Handle formats like "0.25_day", "0.5_day", "1_day", "0.25 day", etc.
  const cleanType = lop_type.toLowerCase().replace(/[_\s]/g, '');
  
  if (cleanType.includes('0.25')) return 0.25;
  if (cleanType.includes('0.5')) return 0.5;
  if (cleanType.includes('1')) return 1;
  if (cleanType.includes('0.1')) return 0.1; // For selfie violations
  
  console.warn(`Unknown lop_type: ${lop_type}, returning 0`);
  return 0;
}

export interface LOPEntry {
  id?: string;
  employee_id: string; // UUID referencing profiles.id
  lop_type: string; // "1_day", "0.5_day", "0.25_day", etc.
  reason: string;
  evidence_url?: string;
  lop_date: string; // DATE field
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LOPEntryWithProfile extends LOPEntry {
  profile_name?: string;
  department?: string;
}

// Fetch LOP entries for specific employees and date range
export async function getLOPEntriesForEmployees(employeeIds: string[], daysBack: number = 60): Promise<LOPEntry[]> {
  if (employeeIds.length === 0) return [];
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  
  const { data, error } = await supabase
    .from('lop_entries')
    .select('*')
    .in('employee_id', employeeIds)
    .gte('lop_date', startDate.toISOString().split('T')[0])
    .order('lop_date', { ascending: false });

  if (error) {
    console.error('Failed to fetch LOP entries:', error);
    throw new Error(`Failed to fetch LOP entries: ${error.message}`);
  }

  return data || [];
}

// Compute LOP days per employee from lop_entries
export async function getLOPDaysByEmployee(employeeIds: string[], daysBack: number = 60): Promise<Map<string, number>> {
  const entries = await getLOPEntriesForEmployees(employeeIds, daysBack);
  const lopMap = new Map<string, number>();
  
  entries.forEach(entry => {
    const days = lopTypeToDays(entry.lop_type);
    const currentTotal = lopMap.get(entry.employee_id) || 0;
    lopMap.set(entry.employee_id, currentTotal + days);
  });
  
  return lopMap;
}

export async function getLOPEntries(): Promise<LOPEntryWithProfile[]> {
  // Fetch LOP entries with profile join
  const { data, error } = await supabase
    .from('lop_entries')
    .select(`
      *,
      profiles!employee_id (
        name,
        department
      )
    `)
    .order('lop_date', { ascending: false });

  if (error) {
    console.error('Failed to fetch LOP entries:', error);
    throw new Error(`Failed to fetch LOP entries: ${error.message}`);
  }

  // Map to include profile info
  return (data || []).map(entry => ({
    ...entry,
    profile_name: entry.profiles?.name,
    department: entry.profiles?.department
  }));
}

// Legacy function - use getLOPDaysByEmployee instead
export async function getLOPTotalsByProfile(): Promise<Map<string, number>> {
  const entries = await getLOPEntries();
  const lopMap = new Map<string, number>();
  
  entries.forEach(entry => {
    const days = lopTypeToDays(entry.lop_type);
    const currentTotal = lopMap.get(entry.employee_id) || 0;
    lopMap.set(entry.employee_id, currentTotal + days);
  });
  
  return lopMap;
}
