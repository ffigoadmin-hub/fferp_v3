import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  is_marquee: boolean;
  created_by: string;
  created_by_name?: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export function useAnnouncements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeAnnouncements, setActiveAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchAnnouncements = async () => {
    if (!user) return;
    
    try {
      // For admin/CEO, fetch all
      // For others, only active non-expired
      const role = user.role.toLowerCase();
      const isAdmin = ['admin', 'ceo'].includes(role);
      
      let query = supabase
        .from('announcements')
        .select(`
          *,
          creator:profiles!announcements_created_by_fkey(name)
        `)
        .order('created_at', { ascending: false });
      
      if (!isAdmin) {
        query = query.eq('is_active', true).gt('expires_at', new Date().toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const formatted = (data || []).map((a: any) => ({
        ...a,
        created_by_name: a.creator?.name,
      }));
      
      if (isAdmin) {
        setAnnouncements(formatted);
        setActiveAnnouncements(formatted.filter((a: Announcement) => 
          a.is_active && new Date(a.expires_at) > new Date()
        ));
      } else {
        setActiveAnnouncements(formatted);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    
    // Set up real-time subscription for new announcements
    const channel = supabase
      .channel('announcements-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => fetchAnnouncements()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const createAnnouncement = async (data: {
    title: string;
    message: string;
    priority: 'urgent' | 'high' | 'normal' | 'low';
    is_marquee: boolean;
    expires_at: string;
  }) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('announcements')
        .insert({
          ...data,
          created_by: user.id,
        });

      if (error) throw error;
      
      toast.success('Announcement created');
      await fetchAnnouncements();
      return { success: true };
    } catch (error) {
      console.error('Error creating announcement:', error);
      toast.error('Failed to create announcement');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const updateAnnouncement = async (id: string, data: Partial<Announcement>) => {
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('announcements')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Announcement updated');
      await fetchAnnouncements();
      return { success: true };
    } catch (error) {
      console.error('Error updating announcement:', error);
      toast.error('Failed to update announcement');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Announcement deleted');
      await fetchAnnouncements();
      return { success: true };
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast.error('Failed to delete announcement');
      return { success: false, error };
    }
  };

  return {
    announcements,
    activeAnnouncements,
    isLoading,
    isSaving,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    refetch: fetchAnnouncements,
  };
}
