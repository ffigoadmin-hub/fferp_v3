import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CafeAd {
  id: string;
  image_url: string;
  message: string | null;
  is_active: boolean;
  created_at: string;
}

export function useCafeAds() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch active ads
  const { data: activeAds, isLoading } = useQuery({
    queryKey: ['cafe-ads-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cafe_ads')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CafeAd[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch all ads (for manager)
  const { data: allAds, isLoading: allLoading } = useQuery({
    queryKey: ['cafe-ads-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cafe_ads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CafeAd[];
    },
  });

  const createAd = useMutation({
    mutationFn: async ({ imageUrl, message }: { imageUrl: string; message?: string }) => {
      const { data, error } = await supabase
        .from('cafe_ads')
        .insert({
          image_url: imageUrl,
          message: message || null,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return data as CafeAd;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-ads-active'] });
      queryClient.invalidateQueries({ queryKey: ['cafe-ads-all'] });
    },
  });

  const toggleAd = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('cafe_ads')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-ads-active'] });
      queryClient.invalidateQueries({ queryKey: ['cafe-ads-all'] });
    },
  });

  const deleteAd = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cafe_ads')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-ads-active'] });
      queryClient.invalidateQueries({ queryKey: ['cafe-ads-all'] });
    },
  });

  return {
    activeAds,
    allAds,
    isLoading,
    allLoading,
    createAd,
    toggleAd,
    deleteAd,
  };
}
