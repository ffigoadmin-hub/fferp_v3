import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BOQTemplateItem {
  id: string;
  template_id: string;
  material_name: string;
  specification: string | null;
  unit: string;
  category: 'material' | 'labour' | 'equipment';
  default_quantity: number;
  default_unit_cost: number;
  sort_order: number;
  phase_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface BOQTemplate {
  id: string;
  vertical_code: string;
  vertical_name: string;
  is_system: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  items: BOQTemplateItem[];
}

export function useBOQTemplates() {
  const [templates, setTemplates] = useState<BOQTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTemplates = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      // Fetch templates
      const { data: templateData, error: templateError } = await supabase
        .from('boq_templates')
        .select('*')
        .order('vertical_name', { ascending: true });

      if (templateError) throw templateError;

      // Fetch all items
      const { data: itemsData, error: itemsError } = await supabase
        .from('boq_template_items')
        .select('*')
        .order('sort_order', { ascending: true });

      if (itemsError) throw itemsError;

      // Group items by template
      const templatesWithItems: BOQTemplate[] = (templateData || []).map(template => ({
        ...template,
        is_system: template.is_system ?? false,
        items: (itemsData || [])
          .filter(item => item.template_id === template.id)
          .map(item => ({
            ...item,
            specification: item.specification ?? null,
            phase_name: item.phase_name ?? null,
            category: item.category as 'material' | 'labour' | 'equipment',
          })),
      }));

      setTemplates(templatesWithItems);
    } catch (error) {
      console.error('Error fetching templates:', error);
      if (!isMissingTable(error)) toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async (verticalCode: string, verticalName: string) => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('boq_templates')
        .insert({
          vertical_code: verticalCode.toLowerCase().replace(/\s+/g, '_'),
          vertical_name: verticalName,
          is_system: false,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchTemplates();
      toast.success('Template created successfully');
      return data;
    } catch (error: any) {
      console.error('Error creating template:', error);
      if (error.code === '23505') {
        toast.error('Template with this code already exists');
      } else {
        toast.error('Failed to create template');
      }
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const updateTemplate = async (id: string, updates: { vertical_name?: string; vertical_code?: string }) => {
    setIsSaving(true);
    // Optimistic update
    const previousTemplates = templates;
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    
    try {
      const { error } = await supabase
        .from('boq_templates')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast.success('Template updated');
      return true;
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
      // Revert on error
      setTemplates(previousTemplates);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    setIsSaving(true);
    // Optimistic update - remove from local state immediately
    const previousTemplates = templates;
    setTemplates(prev => prev.filter(t => t.id !== id));
    
    try {
      const { error } = await supabase
        .from('boq_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Template deleted');
      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
      // Revert on error
      setTemplates(previousTemplates);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const addItem = async (templateId: string, item: Omit<BOQTemplateItem, 'id' | 'template_id' | 'created_at' | 'updated_at'>) => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('boq_template_items')
        .insert({
          template_id: templateId,
          material_name: item.material_name,
          specification: item.specification,
          unit: item.unit,
          category: item.category,
          default_quantity: item.default_quantity,
          default_unit_cost: item.default_unit_cost,
          sort_order: item.sort_order,
          phase_name: item.phase_name || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      const newItem: BOQTemplateItem = {
        ...data,
        specification: data.specification ?? null,
        phase_name: data.phase_name ?? null,
        category: data.category as 'material' | 'labour' | 'equipment',
      };
      
      setTemplates(prev => prev.map(t => 
        t.id === templateId 
          ? { ...t, items: [...t.items, newItem] }
          : t
      ));

      toast.success('Item added to template');
      return true;
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const updateItem = async (id: string, updates: Partial<BOQTemplateItem>) => {
    setIsSaving(true);
    // Optimistic update
    const previousTemplates = templates;
    setTemplates(prev => prev.map(t => ({
      ...t,
      items: t.items.map(item => item.id === id ? { ...item, ...updates } : item)
    })));
    
    try {
      const { error } = await supabase
        .from('boq_template_items')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast.success('Item updated');
      return true;
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
      // Revert on error
      setTemplates(previousTemplates);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    setIsSaving(true);
    // Optimistic update - remove item from local state immediately
    const previousTemplates = templates;
    setTemplates(prev => prev.map(t => ({
      ...t,
      items: t.items.filter(item => item.id !== id)
    })));
    
    try {
      const { error } = await supabase
        .from('boq_template_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Item removed');
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to remove item');
      // Revert on error
      setTemplates(previousTemplates);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    templates,
    isLoading,
    isSaving,
    refetch: fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    addItem,
    updateItem,
    deleteItem,
  };
}
