import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CafeSettings {
  id: string;
  upi_id: string;
  qr_code_url: string | null;
  merchant_name: string;
  updated_at: string;
  updated_by: string | null;
  is_open: boolean | null;
}

export function useCafeSettings() {
  const queryClient = useQueryClient();

  // Real-time subscription so canteen open/close takes effect instantly for all users
  useEffect(() => {
    const channel = supabase
      .channel('cafe-settings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_settings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['cafe-settings'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['cafe-settings'],
    queryFn: async () => {
      // Use limit(1) to be safe if multiple rows exist
      const { data, error } = await (supabase as any)
        .from('cafe_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('[useCafeSettings] Fetch error:', error);
        return null;
      }
      return data as CafeSettings;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<CafeSettings>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Re-fetch current settings to avoid stale closure state
      const { data: current, error: fetchError } = await (supabase as any)
        .from('cafe_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const payload: any = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // 2. Sanitize UUIDs
      const isUuid = (val: any) => typeof val === 'string' && val.length === 36 && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);

      if (user?.id && isUuid(user.id)) {
        payload.updated_by = user.id;
      } else {
        delete payload.updated_by; // Don't even set it to undefined
      }

      const existingId = current?.id;

      if (existingId && isUuid(existingId)) {
        console.log('[useCafeSettings] Performing UPDATE for ID:', existingId, payload);
        const { data, error } = await (supabase as any)
          .from('cafe_settings')
          .update(payload)
          .eq('id', existingId)
          .select()
          .single();
        if (error) {
          console.error('[useCafeSettings] Update failed:', error);
          throw error;
        }
        return data as CafeSettings;
      } else {
        console.log('[useCafeSettings] Performing INSERT:', payload);
        const { data, error } = await (supabase as any)
          .from('cafe_settings')
          .insert({
            ...payload,
            upi_id: payload.upi_id || 'not_set', // Provide required value if missing
          })
          .select()
          .single();
        if (error) {
          console.error('[useCafeSettings] Insert failed:', error);
          throw error;
        }
        return data as CafeSettings;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-settings'] });
    },
  });

  return {
    settings,
    isLoading,
    updateSettings,
  };
}
