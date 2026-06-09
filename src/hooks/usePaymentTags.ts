import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PaymentTag {
  id: string;
  name: string;
  code: string;
  description: string | null;
  color: string;
  departments: string[];
  is_active: boolean;
  display_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTagData {
  name: string;
  code: string;
  description?: string;
  color: string;
  departments?: string[];
  display_order?: number;
}

export interface UpdateTagData {
  name?: string;
  code?: string;
  description?: string;
  color?: string;
  departments?: string[];
  is_active?: boolean;
  display_order?: number;
}

// Color mapping for Tailwind classes
export const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
};

export const AVAILABLE_COLORS = Object.keys(TAG_COLORS);

// Module-level cache so all instances of usePaymentTags share data instantly
let _tagCache: PaymentTag[] | null = null;
let _tagCachePromise: Promise<PaymentTag[]> | null = null;

async function fetchTagsOnce(): Promise<PaymentTag[]> {
  if (_tagCache) return _tagCache;
  if (_tagCachePromise) return _tagCachePromise;
  _tagCachePromise = (async () => {
    const { data, error } = await (supabase
      .from('payment_tags') as any)
      .select('*')
      .order('display_order', { ascending: true });
    if (error) { console.error('Error fetching payment tags:', error); return []; }
    const result = (data || []) as PaymentTag[];
    _tagCache = result;
    return result;
  })();
  return _tagCachePromise;
}

export function usePaymentTags(options?: { includeInactive?: boolean; department?: string }) {
  const { user } = useAuth();
  const [tags, setTags] = useState<PaymentTag[]>(_tagCache || []);
  const [isLoading, setIsLoading] = useState(!_tagCache);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTags = useCallback(async () => {
    try {
      if (!_tagCache) setIsLoading(true);
      const allTags = await fetchTagsOnce();

      let result = [...allTags];

      // Filter by active status if needed
      if (!options?.includeInactive) {
        result = result.filter(t => t.is_active);
      }

      // Filter by department if provided
      if (options?.department) {
        const dept = options.department.toLowerCase();
        result = result.filter(t =>
          t.departments.length === 0 || // Global tags (empty array = all departments)
          t.departments.some(d => d.toLowerCase() === dept)
        );
      }

      setTags(result);
    } catch (error) {
      console.error('Error fetching payment tags:', error);
    } finally {
      setIsLoading(false);
    }
  }, [options?.includeInactive, options?.department]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const createTag = async (data: CreateTagData): Promise<{ success: boolean; error?: any }> => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      const { error } = await (supabase
        .from('payment_tags') as any)
        .insert({
          name: data.name,
          code: data.code,
          description: data.description || null,
          color: data.color,
          departments: data.departments || [],
          display_order: data.display_order || 0,
          created_by: user.id,
        });

      if (error) throw error;

      toast.success('Payment tag created');
      _tagCache = null; _tagCachePromise = null;
      await fetchTags();
      return { success: true };
    } catch (error: any) {
      console.error('Error creating tag:', error);
      toast.error(error.message || 'Failed to create tag');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const updateTag = async (id: string, data: UpdateTagData): Promise<{ success: boolean; error?: any }> => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.code !== undefined) updateData.code = data.code;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.departments !== undefined) updateData.departments = data.departments;
      if (data.is_active !== undefined) updateData.is_active = data.is_active;
      if (data.display_order !== undefined) updateData.display_order = data.display_order;

      const { error } = await (supabase
        .from('payment_tags') as any)
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success('Payment tag updated');
      _tagCache = null; _tagCachePromise = null;
      await fetchTags();
      return { success: true };
    } catch (error: any) {
      console.error('Error updating tag:', error);
      toast.error(error.message || 'Failed to update tag');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTag = async (id: string): Promise<{ success: boolean; error?: any }> => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      // Soft delete by setting is_active to false
      const { error } = await (supabase
        .from('payment_tags') as any)
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast.success('Payment tag disabled');
      _tagCache = null; _tagCachePromise = null;
      await fetchTags();
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting tag:', error);
      toast.error(error.message || 'Failed to delete tag');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean): Promise<{ success: boolean; error?: any }> => {
    return updateTag(id, { is_active: isActive });
  };

  // Helper to get tag by code
  const getTagByCode = (code: string): PaymentTag | undefined => {
    return tags.find(t => t.code === code);
  };

  // Helper to get multiple tags by codes
  const getTagsByCodes = (codes: string[]): PaymentTag[] => {
    return codes.map(code => tags.find(t => t.code === code)).filter(Boolean) as PaymentTag[];
  };

  return {
    tags,
    isLoading,
    isSaving,
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
    toggleActive,
    getTagByCode,
    getTagsByCodes,
  };
}
