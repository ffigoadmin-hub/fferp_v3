// @ts-nocheck
/**
 * Employee Ratings Service
 * Handles all rating operations: CRUD, calculations, trending
 */

import { supabase } from '@/integrations/supabase/client';

export interface EmployeeRating {
  id: string;
  employee_id: string;
  rating_month: number;
  rating_year: number;
  rating_period: string;
  overall_rating: number;
  work_quality_rating: number | null;
  punctuality_rating: number | null;
  teamwork_rating: number | null;
  communication_rating: number | null;
  initiative_rating: number | null;
  strengths: string | null;
  areas_for_improvement: string | null;
  manager_comments: string | null;
  rated_by: string;
  rated_at: string;
  is_final: boolean;
  created_at: string;
  updated_at: string;
}

export interface RatingTrendPoint {
  rating_period: string;
  overall_rating: number;
  month: string;
  average_rating: number;
}

// ============================================
// Rating CRUD Operations
// ============================================

export const addRating = async (rating: Omit<EmployeeRating, 'id' | 'created_at' | 'updated_at' | 'rated_at' | 'rated_by'>): Promise<EmployeeRating> => {
  const ratedBy = (await supabase.auth.getSession()).data.session?.user.id;
  
  if (!ratedBy) {
    throw new Error('User not authenticated');
  }

  // Check if rating already exists for this employee/month/year
  const { data: existingRating } = await supabase
    .from('employee_ratings')
    .select('id, is_final')
    .eq('employee_id', rating.employee_id)
    .eq('rating_year', rating.rating_year)
    .eq('rating_month', rating.rating_month)
    .maybeSingle();

  if (existingRating?.is_final) {
    throw new Error('A final rating already exists for this employee and month');
  }

  if (existingRating) {
    throw new Error('A draft rating already exists for this employee and month. Please update the existing rating.');
  }

  const { data, error } = await supabase
    .from('employee_ratings')
    .insert({
      ...rating,
      rated_by: ratedBy,
      rated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const updateRating = async (
  ratingId: string,
  updates: Partial<EmployeeRating>
): Promise<void> => {
  const { id, created_at, updated_at, rated_at, rated_by, ...safeUpdates } = updates;
  const { error } = await supabase
    .from('employee_ratings')
    .update(safeUpdates)
    .eq('id', ratingId);

  if (error) {
    throw error;
  }
};

export const updateDraftRating = async (
  ratingId: string,
  updates: Partial<EmployeeRating>
): Promise<void> => {
  const { id, created_at, updated_at, rated_at, rated_by, ...safeUpdates } = updates;
  const { error } = await supabase
    .from('employee_ratings')
    .update({
      ...safeUpdates,
      is_final: true,
      rated_at: new Date().toISOString(),
    })
    .eq('id', ratingId)
    .eq('is_final', false);

  if (error) {
    throw error;
  }
};

export const finalizeRating = async (ratingId: string): Promise<void> => {
  const { error } = await supabase
    .from('employee_ratings')
    .update({ is_final: true })
    .eq('id', ratingId);

  if (error) {
    throw error;
  }
};

export const deleteRating = async (ratingId: string): Promise<void> => {
  const { error } = await supabase
    .from('employee_ratings')
    .delete()
    .eq('id', ratingId);

  if (error) {
    throw error;
  }
};

// ============================================
// Rating Retrieval
// ============================================

export const getEmployeeRatings = async (employeeId: string, limit: number = 12): Promise<EmployeeRating[]> => {
  const { data, error } = await supabase
    .from('employee_ratings')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('is_final', true)
    .order('rating_period', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
};

export const getMonthlyRating = async (
  employeeId: string,
  year: number,
  month: number
): Promise<EmployeeRating | null> => {
  const { data, error } = await supabase
    .from('employee_ratings')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('rating_year', year)
    .eq('rating_month', month)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data || null;
};

export const getDraftRating = async (
  employeeId: string,
  year: number,
  month: number
): Promise<EmployeeRating | null> => {
  const { data, error } = await supabase
    .from('employee_ratings')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('rating_year', year)
    .eq('rating_month', month)
    .eq('is_final', false)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data || null;
};

// ============================================
// Ratings Analytics
// ============================================

export const getRatingsForPeriod = async (
  employeeId: string,
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number
): Promise<EmployeeRating[]> => {
  // Calculate start date (first day of start month) and end date (last day of end month)
  const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
  const endDate = new Date(endYear, endMonth, 0).toISOString().split('T')[0]; // Last day of end month
  
  const { data, error } = await supabase
    .from('employee_ratings')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('is_final', true)
    .gte('rating_period', startDate)
    .lte('rating_period', endDate)
    .order('rating_period', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
};

export const getAverageRatingTrend = async (employeeId: string): Promise<RatingTrendPoint[]> => {
  const { data, error } = await supabase
    .from('employee_ratings')
    .select('rating_period, overall_rating')
    .eq('employee_id', employeeId)
    .eq('is_final', true)
    .order('rating_period', { ascending: true });

  if (error) {
    throw error;
  }

  return data?.map((d) => ({
    rating_period: d.rating_period,
    overall_rating: d.overall_rating,
    month: new Date(d.rating_period).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    average_rating: d.overall_rating,
  })) || [];
};

export const getCompanyAverageRatings = async (limit: number = 100): Promise<{
  employee_id: string;
  employee_name: string;
  average_rating: number;
}[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, average_rating')
    .not('average_rating', 'is', null)
    .order('average_rating', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []).map((d) => ({
    employee_id: d.id,
    employee_name: d.full_name,
    average_rating: d.average_rating,
  }));
};

// ============================================
// Department/Team Analytics
// ============================================

export const getDepartmentAverageRatings = async (department: string): Promise<{
  employee_id: string;
  employee_name: string;
  average_rating: number;
}[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, average_rating')
    .eq('department', department)
    .not('average_rating', 'is', null)
    .order('average_rating', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((d) => ({
    employee_id: d.id,
    employee_name: d.full_name,
    average_rating: d.average_rating,
  }));
};

export default {
  addRating,
  updateRating,
  updateDraftRating,
  finalizeRating,
  deleteRating,
  getEmployeeRatings,
  getMonthlyRating,
  getDraftRating,
  getRatingsForPeriod,
  getAverageRatingTrend,
  getCompanyAverageRatings,
  getDepartmentAverageRatings,
};
