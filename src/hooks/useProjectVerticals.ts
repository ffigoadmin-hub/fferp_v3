import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ProjectVertical {
  id: string;
  category: 'DIRECT' | 'JV';
  code: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export function useProjectVerticals(category?: 'DIRECT' | 'JV') {
  const { user } = useAuth();
  const [verticals, setVerticals] = useState<ProjectVertical[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVerticals = async () => {
    try {
      let query = supabase
        .from('project_verticals')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      setVerticals((data || []) as ProjectVertical[]);
    } catch (error) {
      console.error('Error fetching verticals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVerticals();
  }, [category]);

  const addVertical = async (vertical: Omit<ProjectVertical, 'id' | 'created_at' | 'is_active'>) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { data, error } = await supabase
        .from('project_verticals')
        .insert({
          ...vertical,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      setVerticals(prev => [...prev, data as ProjectVertical]);
      toast.success('Vertical added successfully');
      return { success: true, data };
    } catch (error: any) {
      toast.error(error.message || 'Failed to add vertical');
      return { success: false, error };
    }
  };

  const updateVertical = async (id: string, updates: Partial<ProjectVertical>) => {
    try {
      const { data, error } = await supabase
        .from('project_verticals')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setVerticals(prev => prev.map(v => v.id === id ? data as ProjectVertical : v));
      toast.success('Vertical updated');
      return { success: true, data };
    } catch (error: any) {
      toast.error(error.message || 'Failed to update vertical');
      return { success: false, error };
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    return updateVertical(id, { is_active: isActive });
  };

  return {
    verticals,
    isLoading,
    addVertical,
    updateVertical,
    toggleActive,
    refetch: fetchVerticals,
  };
}
