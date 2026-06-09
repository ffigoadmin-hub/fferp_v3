import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Camera, Trash2, Search, User, Clock, Loader2, AlertTriangle, RefreshCw, Database } from 'lucide-react';
import { toast } from 'sonner';
import { getSelfiePublicUrl, extractSelfieFilePath } from '@/utils/selfieUrl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SelfieRecord {
  id: string;
  user_id: string;
  date: string;
  selfie_type: string;
  selfie_url: string;
  captured_at: string;
  expires_at: string;
  profile?: {
    name: string;
    email: string;
    department: string;
  };
}

export function SelfieViewingPage() {
  const { user } = useAuth();
  const [selfies, setSelfies] = useState<SelfieRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk delete state
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleteFromDate, setBulkDeleteFromDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [bulkDeleteToDate, setBulkDeleteToDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [bulkDeleteCount, setBulkDeleteCount] = useState<number | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isCountingBulk, setIsCountingBulk] = useState(false);

  const fetchSelfies = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('selfie_records')
        .select(`
          *,
          profile:profiles!selfie_records_user_id_fkey(name, email, department)
        `)
        .eq('date', selectedDate)
        .order('captured_at', { ascending: false });

      if (error) throw error;
      setSelfies(data || []);
    } catch (err: any) {
      console.error('Error fetching selfies:', err);
      if (!isMissingTable(error)) toast.error('Failed to load selfies');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSelfies();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('selfie-records-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'selfie_records'
        },
        (payload) => {
          console.log('Selfie record change:', payload);
          fetchSelfies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      // First get the record to find the file path
      const record = selfies.find(s => s.id === id);
      if (!record) throw new Error('Record not found');

      // Extract file path from URL using utility
      const filePath = extractSelfieFilePath(record.selfie_url);
      if (!filePath) throw new Error('Could not extract file path');

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('employee-selfies')
        .remove([filePath]);

      if (storageError) {
        console.warn('Storage delete warning:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('selfie_records')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      setSelfies(prev => prev.filter(s => s.id !== id));
      toast.success('Selfie deleted successfully');
    } catch (err: any) {
      console.error('Error deleting selfie:', err);
      toast.error('Failed to delete selfie: ' + err.message);
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  // Count selfies for bulk delete
  const countBulkDeleteSelfies = async () => {
    setIsCountingBulk(true);
    try {
      const { count, error } = await supabase
        .from('selfie_records')
        .select('*', { count: 'exact', head: true })
        .gte('date', bulkDeleteFromDate)
        .lte('date', bulkDeleteToDate);

      if (error) throw error;
      setBulkDeleteCount(count || 0);
    } catch (err: any) {
      console.error('Error counting selfies:', err);
      toast.error('Failed to count selfies');
      setBulkDeleteCount(null);
    } finally {
      setIsCountingBulk(false);
    }
  };

  // Bulk delete selfies
  const handleBulkDelete = async () => {
    if (bulkDeleteCount === 0) {
      toast.info('No selfies to delete in this date range');
      return;
    }

    setIsBulkDeleting(true);
    try {
      // Fetch all selfies in the date range
      const { data: selfiesToDelete, error: fetchError } = await supabase
        .from('selfie_records')
        .select('id, selfie_url')
        .gte('date', bulkDeleteFromDate)
        .lte('date', bulkDeleteToDate)
        .returns<any[]>();

      if (fetchError) throw fetchError;

      if (!selfiesToDelete || selfiesToDelete.length === 0) {
        toast.info('No selfies to delete');
        setShowBulkDelete(false);
        return;
      }

      // Extract file paths from URLs
      const filePaths = selfiesToDelete.map(selfie => {
        const urlParts = selfie.selfie_url.split('/');
        return decodeURIComponent(urlParts.slice(-3).join('/').split('?')[0]);
      });

      // Delete from storage in batches
      const batchSize = 100;
      for (let i = 0; i < filePaths.length; i += batchSize) {
        const batch = filePaths.slice(i, i + batchSize);
        const { error: storageError } = await supabase.storage
          .from('employee-selfies')
          .remove(batch);

        if (storageError) {
          console.warn('Storage batch delete warning:', storageError);
        }
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('selfie_records')
        .delete()
        .gte('date', bulkDeleteFromDate)
        .lte('date', bulkDeleteToDate);

      if (dbError) throw dbError;

      toast.success(`Successfully deleted ${selfiesToDelete.length} selfies`);
      setShowBulkDelete(false);
      setBulkDeleteCount(null);
      fetchSelfies();
    } catch (err: any) {
      console.error('Error bulk deleting selfies:', err);
      toast.error('Failed to bulk delete: ' + err.message);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const getSelfieTypeLabel = (type: string) => {
    switch (type) {
      case 'morning_login':
        return 'Morning (10:00 AM)';
      case 'afternoon_break':
        return 'Lunch (2:45 PM)';
      case 'evening_break':
        return 'Break (5:45 PM)';
      default:
        return type;
    }
  };

  const getSelfieTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'morning_login':
        return 'default';
      case 'afternoon_break':
        return 'secondary';
      case 'evening_break':
        return 'outline';
      default:
        return 'default';
    }
  };

  const filteredSelfies = selfies.filter(selfie => {
    const searchLower = searchTerm.toLowerCase();
    return (
      selfie.profile?.name?.toLowerCase().includes(searchLower) ||
      selfie.profile?.email?.toLowerCase().includes(searchLower) ||
      selfie.profile?.department?.toLowerCase().includes(searchLower)
    );
  });

  // Group selfies by user
  const groupedByUser = filteredSelfies.reduce((acc, selfie) => {
    const key = selfie.user_id;
    if (!acc[key]) {
      acc[key] = {
        profile: selfie.profile,
        selfies: []
      };
    }
    acc[key].selfies.push(selfie);
    return acc;
  }, {} as Record<string, { profile?: SelfieRecord['profile']; selfies: SelfieRecord[] }>);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto"
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Employee Attendance Selfies</h1>
        <p className="text-muted-foreground">View and manage employee attendance selfies</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Button variant="outline" size="icon" onClick={fetchSelfies}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Quick date filters and Bulk Delete */}
      <div className="flex gap-2 mb-6 flex-wrap items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedDate === format(new Date(), 'yyyy-MM-dd') ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
          >
            Today
          </Button>
          <Button
            variant={selectedDate === format(subDays(new Date(), 1), 'yyyy-MM-dd') ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}
          >
            Yesterday
          </Button>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowBulkDelete(true)}
          className="gap-2"
        >
          <Database className="w-4 h-4" />
          Bulk Delete (Free Storage)
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* No selfies */}
      {!isLoading && filteredSelfies.length === 0 && (
        <Card className="p-12 text-center">
          <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No selfies found</h3>
          <p className="text-muted-foreground">
            No attendance selfies for {format(new Date(selectedDate), 'dd MMM yyyy')}
          </p>
        </Card>
      )}

      {/* Selfies grouped by user */}
      {!isLoading && Object.keys(groupedByUser).length > 0 && (
        <div className="space-y-6">
          {Object.entries(groupedByUser).map(([userId, data]) => (
            <Card key={userId} className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{data.profile?.name || 'Unknown'}</h3>
                  <p className="text-sm text-muted-foreground">{data.profile?.department}</p>
                </div>
                <Badge variant="outline" className="ml-auto">
                  {data.selfies.length} selfie{data.selfies.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {data.selfies.map((selfie) => (
                  <div key={selfie.id} className="relative group">
                    <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted">
                      <img
                        src={getSelfiePublicUrl(selfie.selfie_url)}
                        alt={`${data.profile?.name} - ${selfie.selfie_type}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          const publicUrl = getSelfiePublicUrl(selfie.selfie_url);
                          if (img.src !== publicUrl) {
                            img.src = publicUrl;
                          } else {
                            img.src = '/placeholder.svg';
                          }
                        }}
                      />
                    </div>

                    {/* Overlay with info */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 rounded-b-lg">
                      <Badge variant={getSelfieTypeBadgeVariant(selfie.selfie_type) as any} className="mb-1">
                        {getSelfieTypeLabel(selfie.selfie_type)}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-white/80">
                        <Clock className="w-3 h-3" />
                        {format(new Date(selfie.captured_at), 'hh:mm a')}
                      </div>
                    </div>

                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                      onClick={() => setDeleteId(selfie.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Selfie
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this selfie? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-destructive" />
              Bulk Delete Selfies
            </AlertDialogTitle>
            <AlertDialogDescription>
              Delete all selfies within a date range to free up storage space.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <Input
                  type="date"
                  value={bulkDeleteFromDate}
                  onChange={(e) => {
                    setBulkDeleteFromDate(e.target.value);
                    setBulkDeleteCount(null);
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <Input
                  type="date"
                  value={bulkDeleteToDate}
                  onChange={(e) => {
                    setBulkDeleteToDate(e.target.value);
                    setBulkDeleteCount(null);
                  }}
                />
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={countBulkDeleteSelfies}
              disabled={isCountingBulk}
            >
              {isCountingBulk ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Counting...
                </>
              ) : (
                'Count Selfies in Range'
              )}
            </Button>

            {bulkDeleteCount !== null && (
              <div className={`p-4 rounded-lg ${bulkDeleteCount > 0 ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted'}`}>
                <p className="text-center font-medium">
                  {bulkDeleteCount > 0 ? (
                    <>
                      <span className="text-destructive text-2xl">{bulkDeleteCount}</span>
                      <span className="text-muted-foreground block text-sm mt-1">
                        selfies will be permanently deleted
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">No selfies in this date range</span>
                  )}
                </p>
              </div>
            )}

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  This action is irreversible. All selfie images and records in the selected date range will be permanently deleted from storage.
                </p>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting || bulkDeleteCount === null || bulkDeleteCount === 0}
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
