// @ts-nocheck
/**
 * Employee Achievements Service
 * Handles all achievement operations: CRUD, filtering, visibility
 */

import { supabase } from '@/integrations/supabase/client';

export type AchievementCategory = 'work' | 'personal' | 'award';
export type RecognitionLevel = 'team' | 'department' | 'company' | 'industry';

export interface EmployeeAchievement {
  id: string;
  employee_id: string;
  achievement_title: string;
  achievement_description: string | null;
  achievement_category: AchievementCategory;
  achievement_date: string;
  proof_url: string | null;
  recognition_level: RecognitionLevel | null;
  added_by: string;
  added_at: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Achievement CRUD Operations
// ============================================

export const addAchievement = async (
  achievement: Omit<EmployeeAchievement, 'id' | 'created_at' | 'updated_at' | 'added_at'>
): Promise<EmployeeAchievement> => {
  const userId = (await supabase.auth.getSession()).data.session?.user.id;
  
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await (supabase.from('employee_achievements') as any)
    .insert({
      ...achievement,
      added_by: userId,
      added_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as EmployeeAchievement;
};

export const updateAchievement = async (
  achievementId: string,
  updates: Partial<EmployeeAchievement>
): Promise<void> => {
  const { error } = await (supabase.from('employee_achievements') as any)
    .update(updates)
    .eq('id', achievementId);

  if (error) {
    throw error;
  }
};

export const deleteAchievement = async (achievementId: string): Promise<void> => {
  const { error } = await (supabase.from('employee_achievements') as any)
    .delete()
    .eq('id', achievementId);

  if (error) {
    throw error;
  }
};

// ============================================
// Achievement Retrieval
// ============================================

export const getEmployeeAchievements = async (
  employeeId: string,
  onlyPublic: boolean = false
): Promise<EmployeeAchievement[]> => {
  let query = (supabase.from('employee_achievements') as any)
    .select('*')
    .eq('employee_id', employeeId);

  if (onlyPublic) {
    query = query.eq('is_public', true);
  }

  const { data, error } = await query.order('achievement_date', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as EmployeeAchievement[];
};

export const getAchievementsByCategory = async (
  employeeId: string,
  category: AchievementCategory,
  onlyPublic: boolean = false
): Promise<EmployeeAchievement[]> => {
  let query = (supabase.from('employee_achievements') as any)
    .select('*')
    .eq('employee_id', employeeId)
    .eq('achievement_category', category);

  if (onlyPublic) {
    query = query.eq('is_public', true);
  }

  const { data, error } = await query.order('achievement_date', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as EmployeeAchievement[];
};

export const getPublicAchievements = async (limit: number = 50): Promise<EmployeeAchievement[]> => {
  const { data, error } = await (supabase.from('employee_achievements') as any)
    .select('*')
    .eq('is_public', true)
    .order('achievement_date', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []) as EmployeeAchievement[];
};

// ============================================
// Achievement Statistics
// ============================================

export const getAchievementStats = async (employeeId: string): Promise<{
  total: number;
  by_category: Record<AchievementCategory, number>;
  by_recognition_level: Record<RecognitionLevel | 'none', number>;
}> => {
  const achievements = await getEmployeeAchievements(employeeId);

  const stats = {
    total: achievements.length,
    by_category: {
      work: 0,
      personal: 0,
      award: 0,
    },
    by_recognition_level: {
      team: 0,
      department: 0,
      company: 0,
      industry: 0,
      none: 0,
    },
  };

  achievements.forEach((achievement) => {
    stats.by_category[achievement.achievement_category]++;
    const level = achievement.recognition_level || 'none';
    if (level in stats.by_recognition_level) {
      stats.by_recognition_level[level as RecognitionLevel | 'none']++;
    }
  });

  return stats;
};

export const getRecentAchievements = async (
  limit: number = 10,
  offset: number = 0
): Promise<{
  achievements: (EmployeeAchievement & { employee_name: string })[];
  total: number;
}> => {
  const { data, error, count } = await (supabase.from('employee_achievements') as any)
    .select(
      `
      *,
      profiles!added_by(full_name)
    `,
      { count: 'exact' }
    )
    .eq('is_public', true)
    .order('achievement_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return {
    achievements: (data || []).map((d: any) => ({
      ...d,
      employee_name: d.profiles?.full_name || 'Unknown',
    })),
    total: count || 0,
  };
};

// ============================================
// Achievement Filtering
// ============================================

export const searchAchievements = async (
  searchTerm: string,
  category?: AchievementCategory
): Promise<EmployeeAchievement[]> => {
  let query = (supabase.from('employee_achievements') as any)
    .select('*')
    .eq('is_public', true);

  if (category) {
    query = query.eq('achievement_category', category);
  }

  const { data, error } = await query.order('achievement_date', { ascending: false });

  if (error) {
    throw error;
  }

  // Filter by search term (client-side for simplicity)
  return ((data || []) as EmployeeAchievement[]).filter(
    (a) =>
      a.achievement_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.achievement_description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );
};

export default {
  addAchievement,
  updateAchievement,
  deleteAchievement,
  getEmployeeAchievements,
  getAchievementsByCategory,
  getPublicAchievements,
  getAchievementStats,
  getRecentAchievements,
  searchAchievements,
};
