import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VendorMaster {
  id: string;
  vendor_code: string | null;
  company_name: string;
  contact_person: string;
  phone: string;
  alternate_phone: string | null;
  email: string | null;
  state: string;
  city: string;
  address: string | null;
  work_types: string[];
  gst_number: string | null;
  pan_number: string | null;
  aadhar_drive_link: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  is_verified: boolean;
  verification_notes: string | null;
  status: 'active' | 'inactive' | 'blacklisted';
  sourced_by: string | null;
  sourced_on: string | null;
  rating: number;
  total_orders: number;
  created_at: string;
  updated_at: string;
}

export interface VendorFilters {
  state?: string;
  city?: string;
  work_type?: string;
  status?: string;
  search?: string;
}

export interface VendorStats {
  total: number;
  byState: Record<string, number>;
  byWorkType: Record<string, number>;
  todayCount: number;
}

export function useVendorMaster() {
  const [vendors, setVendors] = useState<VendorMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchVendors = async (filters?: VendorFilters) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('vendor_master')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.state) {
        query = query.eq('state', filters.state);
      }
      if (filters?.city) {
        query = query.ilike('city', `%${filters.city}%`);
      }
      if (filters?.work_type) {
        query = query.contains('work_types', [filters.work_type]);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.search) {
        query = query.or(`company_name.ilike.%${filters.search}%,contact_person.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setVendors(data as VendorMaster[]);
    } catch (error: any) {
      toast({
        title: 'Error fetching vendors',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addVendor = async (vendorData: Omit<VendorMaster, 'id' | 'vendor_code' | 'created_at' | 'updated_at' | 'rating' | 'total_orders' | 'is_verified' | 'sourced_by' | 'sourced_on'>) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('vendor_master')
        .insert({
          ...vendorData,
          sourced_by: user.id,
          sourced_on: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Vendor added successfully',
        description: `${vendorData.company_name} has been added to the database.`,
      });

      await fetchVendors();
      return data as VendorMaster;
    } catch (error: any) {
      toast({
        title: 'Error adding vendor',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const updateVendor = async (id: string, updates: Partial<VendorMaster>) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('vendor_master')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Vendor updated',
        description: 'Vendor details have been updated.',
      });

      await fetchVendors();
    } catch (error: any) {
      toast({
        title: 'Error updating vendor',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getVendorsByWorkType = async (workType: string): Promise<VendorMaster[]> => {
    try {
      const { data, error } = await supabase
        .from('vendor_master')
        .select('*')
        .contains('work_types', [workType])
        .eq('status', 'active')
        .order('rating', { ascending: false });

      if (error) throw error;
      return data as VendorMaster[];
    } catch (error: any) {
      toast({
        title: 'Error fetching vendors',
        description: error.message,
        variant: 'destructive',
      });
      return [];
    }
  };

  const getVendorStats = async (): Promise<VendorStats> => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: allVendors, error } = await supabase
        .from('vendor_master')
        .select('state, work_types, sourced_on');

      if (error) throw error;

      const stats: VendorStats = {
        total: allVendors?.length || 0,
        byState: {},
        byWorkType: {},
        todayCount: 0,
      };

      allVendors?.forEach((vendor: any) => {
        // Count by state
        if (vendor.state) {
          stats.byState[vendor.state] = (stats.byState[vendor.state] || 0) + 1;
        }
        
        // Count by work type
        vendor.work_types?.forEach((wt: string) => {
          stats.byWorkType[wt] = (stats.byWorkType[wt] || 0) + 1;
        });

        // Count today's additions
        if (vendor.sourced_on === today) {
          stats.todayCount++;
        }
      });

      return stats;
    } catch (error: any) {
      toast({
        title: 'Error fetching stats',
        description: error.message,
        variant: 'destructive',
      });
      return { total: 0, byState: {}, byWorkType: {}, todayCount: 0 };
    }
  };

  const getTodayVendors = async (): Promise<VendorMaster[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('vendor_master')
        .select('*')
        .eq('sourced_by', user.id)
        .eq('sourced_on', today)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as VendorMaster[];
    } catch (error: any) {
      toast({
        title: 'Error fetching today\'s vendors',
        description: error.message,
        variant: 'destructive',
      });
      return [];
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchVendors();
  }, []);

  // Set up real-time subscription for vendor master
  useEffect(() => {
    const channel = supabase
      .channel('vendor-master-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_master'
        },
        (payload) => {
          console.log('[VendorMaster] Real-time update:', payload.eventType);
          // Refetch without filters to update state
          fetchVendors();
        }
      )
      .subscribe((status) => {
        console.log('[VendorMaster] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    vendors,
    isLoading,
    isSaving,
    fetchVendors,
    addVendor,
    updateVendor,
    getVendorsByWorkType,
    getVendorStats,
    getTodayVendors,
    refetch: fetchVendors,
  };
}
