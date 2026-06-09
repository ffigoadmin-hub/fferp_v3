// @ts-nocheck
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLOPEntries } from '@/hooks/useLOPEntries';
import { format } from 'date-fns';
import { Check, X, Loader2, RotateCcw, ExternalLink, FileText, AlertTriangle, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ProofLink } from '@/components/ProofLink';

interface LOPReversalApprovalWidgetProps {
  role: 'admin' | 'ceo';
}

interface ReversalEntry {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_email?: string;
  employee_department?: string;
  lop_date: string;
  lop_type: string;
  reason: string;
  source?: string;
  reversal_reason: string;
  reversal_proof_url: string;
  reversal_status: string;
  status: string;
}

export function LOPReversalApprovalWidget({ role }: LOPReversalApprovalWidgetProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Determine which reversal status to filter based on role
  const getReversalStatusFilter = () => {
    switch (role) {
      case 'admin': return 'REV_PENDING_ADMIN';
      case 'ceo': return 'REV_PENDING_CEO';
      default: return 'REV_PENDING_ADMIN';
    }
  };

  // Fetch entries with reversal requests pending for this role
  const { data: pendingReversals, isLoading, refetch } = useQuery({
    queryKey: ['lop-reversals', role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lop_entries')
        .select(`
          *,
          employee:profiles!lop_entries_employee_id_fkey(name, email, department)
        `)
        .eq('reversal_requested', true)
        .eq('reversal_status', getReversalStatusFilter())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((entry: any) => ({
        ...entry,
        employee_name: entry.employee?.name,
        employee_email: entry.employee?.email,
        employee_department: entry.employee?.department,
      })) as ReversalEntry[];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`lop-reversals-${role}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lop_entries'
      }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, refetch]);

  const { adminReviewReversal, ceoApproveReversal } = useLOPEntries();

  const getLOPTypeLabel = (type: string) => {
    switch (type) {
      case '1_day': return '1 Day';
      case '0.5_day': return '0.5 Day';
      case '0.25_day': return '0.25 Day';
      case '0.1_day': return '0.1 Day';
      default: return type;
    }
  };

  const getLOPValue = (type: string): number => {
    switch (type) {
      case '1_day': return 1;
      case '0.5_day': return 0.5;
      case '0.25_day': return 0.25;
      case '0.1_day': return 0.1;
      default: return 0;
    }
  };

  const handleApprove = async (id: string) => {
    setIsSaving(true);
    try {
      if (role === 'admin') {
        await adminReviewReversal(id, 'verify');
      } else if (role === 'ceo') {
        await ceoApproveReversal(id, 'approve');
      }
      refetch();
    } catch (error) {
      console.error('Error approving reversal:', error);
      toast.error('Failed to approve reversal');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedEntry) return;

    setIsSaving(true);
    try {
      if (role === 'admin') {
        await adminReviewReversal(selectedEntry, 'reject', rejectionReason);
      } else if (role === 'ceo') {
        await ceoApproveReversal(selectedEntry, 'reject', rejectionReason);
      }
      refetch();
      setRejectDialogOpen(false);
      setSelectedEntry(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting reversal:', error);
      toast.error('Failed to reject reversal');
    } finally {
      setIsSaving(false);
    }
  };

  const openRejectDialog = (id: string) => {
    setSelectedEntry(id);
    setRejectDialogOpen(true);
  };

  const getRoleTitle = () => {
    switch (role) {
      case 'admin': return 'LOP Reversal Verification';
      case 'ceo': return 'LOP Reversal Final Approval';
      default: return 'LOP Reversal Queue';
    }
  };

  const getRoleDescription = () => {
    switch (role) {
      case 'admin': return 'Verify reversal requests before forwarding to CEO';
      case 'ceo': return 'Final approval - Approving will DELETE the LOP and restore salary';
      default: return 'Review reversal requests';
    }
  };

  const getApproveButtonText = () => {
    switch (role) {
      case 'admin': return 'Verify → CEO';
      case 'ceo': return 'Approve & Delete LOP';
      default: return 'Approve';
    }
  };



  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const entries = pendingReversals || [];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-500" />
                {getRoleTitle()}
              </CardTitle>
              <CardDescription>{getRoleDescription()}</CardDescription>
            </div>
            {entries.length > 0 && (
              <Badge variant="destructive" className="text-lg px-3 py-1">
                {entries.length} Pending
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <RotateCcw className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No pending reversal requests</p>
              <p className="text-sm mt-1">All LOP reversals have been processed</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 border rounded-xl hover:border-primary/50 transition-colors bg-card"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-semibold text-lg">{entry.employee_name}</p>
                        <p className="text-sm text-muted-foreground">{entry.employee_email}</p>
                        <Badge variant="outline" className="mt-1">{entry.employee_department}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm">{format(new Date(entry.lop_date), 'dd MMM yyyy')}</p>
                        <Badge variant="secondary" className="mt-1">
                          {getLOPTypeLabel(entry.lop_type)} ({getLOPValue(entry.lop_type)} days)
                        </Badge>
                      </div>
                    </div>

                    {/* Original LOP Reason */}
                    <div className="bg-muted/50 rounded-lg p-3 mb-3">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Original LOP Reason
                      </p>
                      <p className="text-sm">{entry.reason}</p>
                      {entry.source && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          Source: {entry.source === 'auto' ? 'System Auto-Generated' : 'Manual Entry'}
                        </Badge>
                      )}
                    </div>

                    {/* Reversal Request */}
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                      <p className="text-xs text-amber-600 mb-1 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" /> Reversal Request
                      </p>
                      <p className="text-sm">{entry.reversal_reason}</p>
                      {entry.reversal_proof_url && (
                        <ProofLink
                          pathOrUrl={entry.reversal_proof_url}
                          bucket="payment-documents"
                          label="View Evidence"
                          showPreview={false}
                          className="mt-2"
                        />
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => handleApprove(entry.id)}
                        disabled={isSaving}
                        className={role === 'ceo'
                          ? "flex-1 bg-green-600 hover:bg-green-700"
                          : "flex-1 bg-status-live hover:bg-status-live/80"
                        }
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {getApproveButtonText()}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => openRejectDialog(entry.id)}
                        disabled={isSaving}
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>

                    {role === 'ceo' && (
                      <p className="text-xs text-center text-muted-foreground mt-3">
                        ⚠️ Approving will permanently delete this LOP entry and restore salary deduction
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Reversal Request</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection (required)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isSaving || !rejectionReason.trim()}
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
