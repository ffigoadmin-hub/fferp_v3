// @ts-nocheck
/**
 * Employee Profile Service
 * Handles all profile-related operations: picture uploads, info retrieval, updates
 */

import { supabase } from '@/integrations/supabase/client';

export interface EmployeeProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  department: string;
  destination: string | null;
  office_number: string | null;
  profile_picture_url: string | null;
  date_of_birth: string | null;
  joining_date: string | null;
  bio: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  average_rating: number | null;
  current_rating: number | null;
  total_ratings: number;
}

// ============================================
// Profile Picture Management
// ============================================

export const uploadProfilePicture = async (userId: string, file: File): Promise<string> => {
  // Validate file
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File must be less than 5MB');
  }

  const validFormats = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validFormats.includes(file.type)) {
    throw new Error('Only JPG, PNG, and WEBP formats are allowed');
  }

  // Determine file extension
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const filePath = `${userId}/profile.${ext}`;

  try {
    // Upload file (upsert = true replaces existing)
    const { data, error } = await supabase.storage
      .from('employee-profile-pictures')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      const message =
        error.message?.includes('Bucket not found') ||
        error.message?.includes('bucket does not exist') ||
        error.details?.includes('Bucket not found')
          ? 'Storage bucket "employee-profile-pictures" not found. Please create the Supabase storage bucket "employee-profile-pictures" and configure public access if required.'
          : error.message || 'Failed to upload profile picture.';
      throw new Error(message);
    }

    // Get public URL
    const { data: publicData, error: publicUrlError } = supabase.storage
      .from('employee-profile-pictures')
      .getPublicUrl(filePath);

    if (publicUrlError || !publicData?.publicUrl) {
      const message = publicUrlError?.message || 'Failed to get public URL for profile picture.';
      throw new Error(message);
    }

    return publicData.publicUrl;
  } catch (error: any) {
    console.error('Error uploading profile picture:', error);
    if (error.message?.includes('Storage bucket "employee-profile-pictures" not found')) {
      throw error;
    }
    throw new Error(error.message || 'Error uploading profile picture. Please verify the "employee-profile-pictures" bucket exists in Supabase Storage.');
  }
};

export const updateProfilePictureUrl = async (
  userId: string,
  pictureUrl: string
): Promise<void> => {
  const currentUserId = (await supabase.auth.getSession()).data.session?.user.id;

  // Users can update their own profile picture using the secure RPC function
  if (currentUserId === userId) {
    const { error } = await supabase
      .rpc('update_own_profile_picture_url', { p_picture_url: pictureUrl });

    if (error) {
      throw error;
    }

    return;
  }

  // Admins can update any profile picture via direct table update
  const { error } = await supabase
    .from('profiles')
    .update({ profile_picture_url: pictureUrl })
    .eq('id', userId);

  if (error) {
    throw error;
  }
};

export const deleteProfilePicture = async (userId: string): Promise<void> => {
  try {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('employee-profile-pictures')
      .remove([`${userId}/profile.jpg`, `${userId}/profile.png`, `${userId}/profile.webp`]);

    if (storageError) {
      console.warn('Error deleting picture from storage:', storageError);
    }

    // Clear URL from profile
    await updateProfilePictureUrl(userId, '');
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    throw error;
  }
};

// ============================================
// Profile Information
// ============================================

export const getEmployeeProfile = async (userId: string): Promise<EmployeeProfile> => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Profile not found for user ID: ${userId}`);
      }
      throw new Error(`Failed to fetch profile: ${error.message}`);
    }

    if (!data) {
      throw new Error(`No profile data returned for user ID: ${userId}`);
    }

    return data;
  } catch (err: any) {
    console.error('getEmployeeProfile error:', err);
    throw err;
  }
};

export const updateEmployeeProfile = async (
  userId: string,
  updates: Partial<EmployeeProfile>
): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    throw error;
  }
};

export const getTeamProfiles = async (managerId: string): Promise<EmployeeProfile[]> => {
  // Get all employees in manager's department
  const { data: manager, error: managerError } = await supabase
    .from('profiles')
    .select('department')
    .eq('id', managerId)
    .single();

  if (managerError) {
    throw managerError;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('department', manager?.department);

  if (error) {
    throw error;
  }

  return data || [];
};

export const getAllProfiles = async (limit: number = 100, offset: number = 0) => {
  const { data, error, count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return { profiles: data || [], total: count };
};

// ============================================
// Profile Statistics Helpers
// ============================================

export const getProfileStatistics = async (userId: string) => {
  try {
    // Get ratings summary
    const { data: ratingsData, error: ratingsError } = await supabase
      .rpc('get_employee_ratings_summary', { p_employee_id: userId });

    if (ratingsError && ratingsError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is ok
      console.warn('Error getting ratings summary:', ratingsError);
    }

    // Get achievements count
    const { data: achievementsData, error: achievementsError } = await supabase
      .rpc('get_employee_achievements_count', { p_employee_id: userId });

    if (achievementsError && achievementsError.code !== 'PGRST116') {
      console.warn('Error getting achievements count:', achievementsError);
    }

    // Get memos count
    const { data: memosData, error: memosError } = await supabase
      .rpc('get_employee_memos_count', { p_employee_id: userId });

    if (memosError && memosError.code !== 'PGRST116') {
      console.warn('Error getting memos count:', memosError);
    }

    return {
      ratings: ratingsData?.[0],
      achievements: achievementsData?.[0],
      memos: memosData?.[0],
    };
  } catch (error) {
    console.error('Error getting profile statistics:', error);
    return {
      ratings: null,
      achievements: null,
      memos: null,
    };
  }
};

// ============================================
// Career Summary Update
// ============================================

export const updateCareerSummary = async (
  userId: string,
  careerSummary: {
    years_of_service?: number;
    career_changes?: number;
    promotions?: number;
  }
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        years_of_service: careerSummary.years_of_service,
        career_changes: careerSummary.career_changes,
        promotions: careerSummary.promotions,
      })
      .eq('id', userId);

    if (error) {
      // If the fields don't exist yet, we'll handle this gracefully
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        console.warn('Career summary fields not yet available in database. Skipping update.');
        return;
      }
      throw error;
    }
  } catch (error) {
    // If it's a column doesn't exist error, we'll silently skip for now
    if (error.message?.includes('column') && error.message?.includes('does not exist')) {
      console.warn('Career summary fields not yet available in database. Update skipped.');
      return;
    }
    throw new Error(`Failed to update career summary: ${error.message}`);
  }
};

export default {
  uploadProfilePicture,
  updateProfilePictureUrl,
  deleteProfilePicture,
  getEmployeeProfile,
  updateEmployeeProfile,
  getTeamProfiles,
  getAllProfiles,
  getProfileStatistics,
  updateCareerSummary,
};
