import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface QuotedItem {
  material_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface VendorQuote {
  id: string;
  material_request_id: string | null;
  boq_item_id: string | null;
  project_id: string;
  vendor_name: string;
  vendor_contact: string | null;
  vendor_email: string | null;
  quoted_unit_price: number;
  quoted_total: number;
  quote_document_url: string | null;
  validity_date: string | null;
  delivery_days: number | null;
  is_selected: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  // New fields
  quote_drive_link: string | null;
  vendor_bank_name: string | null;
  vendor_account_number: string | null;
  vendor_ifsc: string | null;
  vendor_gst: string | null;
  quoted_items: QuotedItem[] | null;
}

export function useVendorQuotes(materialRequestId?: string, projectId?: string) {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<VendorQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchQuotes = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      let query = supabase
        .from('vendor_quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (materialRequestId) {
        query = query.eq('material_request_id', materialRequestId);
      }
      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) throw error;
      // Parse quoted_items from JSON
      const parsedQuotes = (data || []).map((q: any) => ({
        ...q,
        quoted_items: Array.isArray(q.quoted_items) ? q.quoted_items : [],
      }));
      setQuotes(parsedQuotes as VendorQuote[]);
    } catch (error: any) {
      console.error('Error fetching vendor quotes:', error);
      if (!isMissingTable(error)) toast.error('Failed to load vendor quotes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, [user, materialRequestId, projectId]);

  const addQuote = async (data: Omit<VendorQuote, 'id' | 'created_at' | 'created_by' | 'is_selected'>) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { quoted_items, ...rest } = data;
      const { error } = await supabase
        .from('vendor_quotes')
        .insert({
          ...rest,
          quoted_items: quoted_items || [],
          created_by: user.id,
          is_selected: false,
        } as any);

      if (error) throw error;
      toast.success('Quote added successfully');
      await fetchQuotes();
    } catch (error: any) {
      console.error('Error adding quote:', error);
      toast.error('Failed to add quote');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const selectQuote = async (quoteId: string, materialRequestId: string) => {
    if (!user) return;
    setIsSaving(true);

    try {
      // First, deselect all quotes for this request
      await supabase
        .from('vendor_quotes')
        .update({ is_selected: false })
        .eq('material_request_id', materialRequestId);

      // Then select the chosen quote
      const { error: quoteError } = await supabase
        .from('vendor_quotes')
        .update({ is_selected: true })
        .eq('id', quoteId);

      if (quoteError) throw quoteError;

      // Update material request with selected_quote_id and start approval flow
      // Directly to GM for quote/financial verification
      const { error: requestError } = await supabase
        .from('material_requests')
        .update({
          selected_quote_id: quoteId,
          approval_status: 'pending_gm'
        })
        .eq('id', materialRequestId);

      if (requestError) throw requestError;

      toast.success('Quote selected - Submitted for GM Verification');
      await fetchQuotes();
    } catch (error: any) {
      console.error('Error selecting quote:', error);
      toast.error('Failed to select quote');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteQuote = async (quoteId: string) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('vendor_quotes')
        .delete()
        .eq('id', quoteId);

      if (error) throw error;
      toast.success('Quote deleted');
      await fetchQuotes();
    } catch (error: any) {
      console.error('Error deleting quote:', error);
      toast.error('Failed to delete quote');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    quotes,
    isLoading,
    isSaving,
    addQuote,
    selectQuote,
    deleteQuote,
    refetch: fetchQuotes,
  };
}
