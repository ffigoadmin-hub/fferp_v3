import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface VendorRating {
  id: string;
  vendor_id: string;
  project_id?: string;
  work_request_id?: string;
  material_request_id?: string;
  quality_rating?: number;
  timeliness_rating?: number;
  communication_rating?: number;
  overall_rating?: number;
  review_text?: string;
  rated_by: string;
  rated_at: string;
  created_at: string;
  vendor?: {
    company_name: string;
    contact_person?: string;
  };
  project?: {
    project_name: string;
  };
  rater?: {
    name: string;
  };
}

export interface CreateVendorRatingData {
  vendor_id: string;
  project_id?: string;
  work_request_id?: string;
  material_request_id?: string;
  quality_rating?: number;
  timeliness_rating?: number;
  communication_rating?: number;
  review_text?: string;
}

export function useVendorRatings(vendorId?: string) {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<VendorRating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchRatings = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('vendor_ratings')
        .select(`
          *,
          vendor:vendor_master(company_name, contact_person),
          project:projects(project_name),
          rater:profiles!vendor_ratings_rated_by_fkey(name)
        `)
        .order('rated_at', { ascending: false });

      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRatings((data || []) as unknown as VendorRating[]);
    } catch (error) {
      console.error('Error fetching vendor ratings:', error);
      if (!isMissingTable(error)) toast.error('Failed to load vendor ratings');
    } finally {
      setIsLoading(false);
    }
  };

  const addRating = async (data: CreateVendorRatingData) => {
    if (!user) return null;

    try {
      setIsSaving(true);
      const { data: rating, error } = await supabase
        .from('vendor_ratings')
        .insert({
          ...data,
          rated_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Vendor rated successfully');
      await fetchRatings();
      return rating;
    } catch (error) {
      console.error('Error adding vendor rating:', error);
      toast.error('Failed to add vendor rating');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const updateRating = async (id: string, data: Partial<CreateVendorRatingData>) => {
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('vendor_ratings')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      toast.success('Rating updated');
      await fetchRatings();
    } catch (error) {
      console.error('Error updating rating:', error);
      toast.error('Failed to update rating');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRating = async (id: string) => {
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('vendor_ratings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Rating deleted');
      await fetchRatings();
    } catch (error) {
      console.error('Error deleting rating:', error);
      toast.error('Failed to delete rating');
    } finally {
      setIsSaving(false);
    }
  };

  const getVendorAverageRating = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from('vendor_ratings')
        .select('overall_rating')
        .eq('vendor_id', vendorId);

      if (error) throw error;

      if (!data || data.length === 0) return null;

      const validRatings = data.filter(r => r.overall_rating !== null);
      if (validRatings.length === 0) return null;

      const sum = validRatings.reduce((acc, r) => acc + (r.overall_rating || 0), 0);
      return Math.round((sum / validRatings.length) * 10) / 10;
    } catch (error) {
      console.error('Error fetching vendor average rating:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchRatings();
  }, [vendorId]);

  return {
    ratings,
    isLoading,
    isSaving,
    addRating,
    updateRating,
    deleteRating,
    getVendorAverageRating,
    refetch: fetchRatings
  };
}
