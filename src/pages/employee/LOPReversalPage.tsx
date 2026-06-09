import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { AlertTriangle, CheckCircle, FileText, Info, User, Calendar as CalendarIcon, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { FileUpload } from '@/components/FileUpload';
import { ProofLink } from '@/components/ProofLink';

interface LOPEntry {
  id: string;
  lop_type: string;
  lop_date: string;
  reason: string;
  status: string;
  source: string;
  auto_reason: string;
  reversal_requested: boolean;
  reversal_reason: string;
  reversal_proof_url: string;
  reversal_status: string;
  created_at: string;
  created_by: string;
  evidence_url: string;
  created_by_name?: string;
  created_by_role?: string;
}

interface LOPAuditLog {
  id: string;
  lop_date: string;
  lop_days: number;
  reason: string;
  reversal_reason: string;
  reversed_at: string;
}

interface LOPReversalPageProps {
  embedded?: boolean;
}

const MIN_REASON_LENGTH = 20;

export default function LOPReversalPage({
  embedded = false
}: LOPReversalPageProps) {
  const {
    user
  } = useAuth();
  const [entries, setEntries] = useState<LOPEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<LOPAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<LOPEntry | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalProofUrl, setReversalProofUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  const fetchMyLOPs = async () => {
    if (!user) return;
    try {
      const start = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

      // Fetch LOP entries for selected month
      const {
        data: lopData,
        error: lopError
      } = await supabase.from('lop_entries')
        .select('*')
        .eq('employee_id', user.id)
        .gte('lop_date', start)
        .lte('lop_date', end)
        .order('lop_date', {
          ascending: false
        });
      if (lopError) throw lopError;
      setEntries(lopData || []);

      // Fetch reversed LOP audit logs for "Reversed" count for selected month
      // Note: audit logs track 'reversed_at' but the LOP itself had a 'lop_date'.
      // If we want to show reversed entries belonging to this month's payroll window, we should check lop_date.
      const {
        data: auditData,
        error: auditError
      } = await supabase.from('lop_audit_logs')
        .select('*')
        .eq('employee_id', user.id)
        .gte('lop_date', start)
        .lte('lop_date', end)
        .order('reversed_at', {
          ascending: false
        });
      if (auditError) {
        console.error('Error fetching audit logs:', auditError);
      } else {
        setAuditLogs(auditData || []);
      }
    } catch (error) {
      console.error('Error fetching LOP entries:', error);
      if (!isMissingTable(error)) toast.error('Failed to fetch LOP entries');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchMyLOPs();
  }, [user, selectedMonth]);

  // Real-time subscription for LOP status updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('lop-reversal-updates').on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'lop_entries',
      filter: `employee_id=eq.${user.id}`
    }, payload => {
      const updated = payload.new as LOPEntry;
      // Optimistically update if in current view, otherwise fetch logic handles it on month change
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));

      // Show toast for reversal status changes
      if (updated.reversal_status === 'REV_PENDING_ADMIN') {
        toast.info('Your reversal request is now pending Admin review');
      } else if (updated.reversal_status === 'REV_PENDING_CEO') {
        toast.info('Your reversal request has been forwarded to CEO for final approval');
      } else if (updated.reversal_status === 'REV_APPROVED') {
        toast.success('🎉 Your LOP reversal has been approved!');
      } else if (updated.reversal_status === 'REV_REJECTED') {
        toast.error('Your LOP reversal request was rejected');
      }
    }).on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'lop_entries',
      filter: `employee_id=eq.${user.id}`
    }, payload => {
      // LOP was deleted (reversed and removed by CEO)
      setEntries(prev => prev.filter(e => e.id !== (payload.old as LOPEntry).id));
      toast.success('🎉 LOP entry has been reversed and removed! Salary impact restored.');
      // Refetch to ensure everything is synced (especially if we need to see it in audit logs now)
      fetchMyLOPs();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedMonth]); // Add selectedMonth dependency to ensure fetch uses correct range if called

  const handleRequestReversal = async () => {
    if (!selectedEntry) return;

    // Validation
    if (!reversalReason.trim()) {
      toast.error('Please provide a reason for reversal');
      return;
    }
    if (reversalReason.trim().length < MIN_REASON_LENGTH) {
      toast.error(`Reason must be at least ${MIN_REASON_LENGTH} characters`);
      return;
    }
    if (!reversalProofUrl) {
      toast.error('Evidence upload is required for reversal request');
      return;
    }
    setIsSaving(true);
    try {
      // Submit reversal request - starts at BOI review per spec
      const { error } = await (supabase
        .from('lop_entries') as any)
        .update({
          reversal_requested: true,
          reversal_requested_at: new Date().toISOString(),
          reversal_reason: reversalReason,
          reversal_proof_url: reversalProofUrl,
          reversal_status: 'REV_PENDING_ADMIN' // Bypass BOI, go straight to Admin per new workflow
        }).eq('id', selectedEntry.id).eq('employee_id', user?.id); // Security: ensure employee owns this entry

      if (error) throw error;
      toast.success('Reversal request submitted - pending BOI review');
      setSelectedEntry(null);
      setReversalReason('');
      setReversalProofUrl('');
      fetchMyLOPs();
    } catch (error) {
      console.error('Error requesting reversal:', error);
      toast.error('Failed to submit reversal request');
    } finally {
      setIsSaving(false);
    }
  };
  const getLOPValue = (type: string): number => {
    if (type === '0.1_day' || type.includes('0.1')) return 0.1; // Check 0.1 first
    if (type === '0.25_day' || type.includes('0.25')) return 0.25;
    if (type === '0.5_day' || type.includes('0.5')) return 0.5;
    if (type === '1_day' || type.includes('1')) return 1;
    return 0;
  };
  const getRaisedByLabel = (entry: LOPEntry): string => {
    if (entry.source === 'admin' || entry.source === 'manual') {
      if (entry.created_by_name) {
        return `${entry.created_by_name} ${entry.created_by_role ? `(${entry.created_by_role.toUpperCase()})` : ''}`;
      }
      return 'Admin (Manual)';
    }
    return 'System Auto';
  };
  const getStatusBadge = (entry: LOPEntry) => {
    // Check reversal status first
    if (entry.reversal_status === 'REV_APPROVED') {
      return <Badge className="bg-green-500 text-white">Reversed</Badge>;
    }
    if (entry.reversal_status === 'REV_REJECTED') {
      return <Badge variant="destructive">Reversal Rejected</Badge>;
    }
    if (entry.reversal_requested && entry.reversal_status) {
      const statusMap: Record<string, {
        label: string;
        className: string;
      }> = {
        'REV_PENDING_BOI': {
          label: 'Pending BOI Review',
          className: 'text-amber-600 border-amber-500'
        },
        'REV_PENDING_ADMIN': {
          label: 'Pending Admin Review',
          className: 'text-blue-600 border-blue-500'
        },
        'REV_PENDING_CEO': {
          label: 'Pending CEO Approval',
          className: 'text-purple-600 border-purple-500'
        }
      };
      const status = statusMap[entry.reversal_status];
      if (status) {
        return <Badge variant="outline" className={status.className}>{status.label}</Badge>;
      }
    }

    // LOP approval status
    const statusConfig: Record<string, {
      label: string;
      className: string;
    }> = {
      'pending_boi': {
        label: 'PENDING_BOI',
        className: 'bg-amber-500'
      },
      'pending_admin': {
        label: 'PENDING_ADMIN',
        className: 'bg-blue-500'
      },
      'pending_ceo': {
        label: 'PENDING_CEO',
        className: 'bg-purple-500'
      },
      'approved': {
        label: 'APPROVED',
        className: 'bg-red-500'
      },
      'rejected': {
        label: 'REJECTED',
        className: 'bg-gray-500'
      }
    };
    const config = statusConfig[entry.status] || {
      label: entry.status,
      className: 'bg-gray-500'
    };
    return <Badge className={`${config.className} text-white`}>{config.label}</Badge>;
  };

  // Reversal eligibility per spec: PENDING_ADMIN, PENDING_CEO, or APPROVED + no active reversal
  const canRequestReversal = (entry: LOPEntry) => {
    const eligibleStatuses = ['pending_admin', 'pending_ceo', 'approved'];
    const hasNoActiveReversal = !entry.reversal_requested || entry.reversal_status === 'REV_REJECTED'; // Can re-request after rejection

    return eligibleStatuses.includes(entry.status) && hasNoActiveReversal;
  };

  // Calculate DB-driven totals
  const approvedEntries = entries.filter(e => e.status === 'approved' && e.reversal_status !== 'REV_APPROVED');
  const totalLOP = parseFloat(approvedEntries.reduce((sum, e) => sum + getLOPValue(e.lop_type), 0).toFixed(2));
  const pendingReversalCount = entries.filter(e => e.reversal_requested && ['REV_PENDING_BOI', 'REV_PENDING_ADMIN', 'REV_PENDING_CEO'].includes(e.reversal_status || '')).length;

  // Reversed count from audit logs (deleted LOPs)
  const reversedCount = auditLogs.length;

  return <div className={embedded ? "" : "p-6 max-w-4xl mx-auto"}>
    {/* Header - Hidden when embedded */}
    {!embedded && <div className="mb-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <AlertTriangle className="w-6 h-6 text-amber-500" />
        My LOP / Discipline
      </h1>
      <p className="text-muted-foreground">View and request reversal of Loss of Pay entries</p>
    </div>}

    {/* Info Banner - Premium Design */}
    <div className="mb-6 relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 md:p-5">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/10 rounded-full blur-xl -ml-8 -mb-8" />
      <div className="relative flex gap-3 md:gap-4">
        <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Info className="w-5 h-5 md:w-6 md:h-6 text-primary" />
        </div>
        <div className="space-y-2 min-w-0 flex-1">
          <h3 className="font-semibold text-foreground text-sm md:text-base">Understanding LOP Entries</h3>
          <ul className="text-xs md:text-sm text-muted-foreground space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <span>LOP is <strong className="text-foreground">documented accountability</strong> applied uniformly</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <span>Penalties are <strong className="text-foreground">system-driven</strong> and cannot be modified</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <span>Request reversal with <strong className="text-foreground">valid reason + evidence</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
              <span>Final decision rests with <strong className="text-foreground">CEO</strong></span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    {/* Month Filter */}
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedMonth(prev => subMonths(prev, 1))}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="px-2 font-medium min-w-[120px] text-center">
          {format(selectedMonth, 'MMMM yyyy')}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedMonth(prev => addMonths(prev, 1))}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {(selectedMonth.getMonth() !== new Date().getMonth() || selectedMonth.getFullYear() !== new Date().getFullYear()) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedMonth(new Date())}
          className="text-xs"
        >
          Jump to Current
        </Button>
      )}
    </div>

    {/* Summary Cards - DB-driven READ-ONLY */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{totalLOP}</p>
          <p className="text-sm text-muted-foreground">Total LOP Days</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{entries.length}</p>
          <p className="text-sm text-muted-foreground">Total Entries</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{pendingReversalCount}</p>
          <p className="text-sm text-muted-foreground">Pending Reversals</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{reversedCount}</p>
          <p className="text-sm text-muted-foreground">Reversed</p>
        </CardContent>
      </Card>
    </div>

    {/* LOP Entries List */}
    <Card>
      <CardHeader>
        <CardTitle>LOP History</CardTitle>
        <CardDescription>
          LOP entries for {format(selectedMonth, 'MMMM yyyy')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : entries.length === 0 ? <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
          <p className="text-muted-foreground">No LOP entries found for this month - great job!</p>
        </div> : <div className="space-y-4">
          {entries.map(entry => <div key={entry.id} className="p-4 rounded-lg bg-muted/30 border space-y-3">
            {/* Main row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                {/* LOP Amount */}
                <div className="text-center p-3 rounded-lg bg-red-500/10 min-w-[70px]">
                  <p className="text-xl font-bold text-red-500">{getLOPValue(entry.lop_type).toFixed(2).replace(/\.00$/, '')}</p>
                  <p className="text-xs text-muted-foreground">Day(s)</p>
                </div>

                {/* Details */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                    <p className="font-medium">{format(new Date(entry.lop_date), 'dd MMM yyyy')}</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {entry.reason || entry.auto_reason || 'No reason specified'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span>Raised By: {getRaisedByLabel(entry)}</span>
                  </div>
                </div>
              </div>

              {/* Status & Action */}
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(entry)}
                {canRequestReversal(entry) && <Button size="sm" variant="outline" onClick={() => {
                  setSelectedEntry(entry);
                  setReversalReason('');
                  setReversalProofUrl('');
                }}>
                  Request Reversal
                </Button>}
                {entry.reversal_requested && !canRequestReversal(entry) && <span className="text-xs text-muted-foreground">Reversal in progress</span>}
              </div>
            </div>

            {/* Explanation text */}
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border-l-2 border-amber-500">
              This penalty was {entry.source === 'admin' || entry.source === 'manual' ? 'raised by Admin' : 'generated automatically due to compliance violation'}.
              You may request reversal if you have a valid reason and proof.
            </div>

            {entry.reversal_requested && entry.reversal_reason && (
              <div className="mt-4 bg-muted/20 dark:bg-muted/10 border rounded-lg p-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-2xl -mr-6 -mt-6 transition-all group-hover:bg-amber-500/10" />

                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Your Reversal Request
                </h4>

                <div className="pl-3.5 border-l-2 border-border/60 dark:border-border/40 py-1 mb-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {entry.reversal_reason}
                  </p>
                </div>

                {entry.reversal_proof_url ? (
                  <ProofLink
                    pathOrUrl={entry.reversal_proof_url}
                    bucket="payment-documents"
                    label="View Attached Evidence"
                    showPreview={false}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground italic flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded w-fit">
                    <Info className="w-3 h-3" /> No evidence attached
                  </span>
                )}
              </div>
            )}
          </div>)}
        </div>}
      </CardContent>
    </Card>

    {/* Reversed LOPs from Audit Log */}
    {auditLogs.length > 0 && <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          Reversed LOPs
        </CardTitle>
        <CardDescription>
          LOPs that were successfully reversed and removed from payroll in {format(selectedMonth, 'MMMM yyyy')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {auditLogs.map(log => <div key={log.id} className="p-3 rounded-lg border border-green-200 bg-secondary">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {log.lop_days} Day(s) - {format(new Date(log.lop_date), 'dd MMM yyyy')}
                </p>
                <p className="text-sm text-muted-foreground">{log.reason}</p>
              </div>
              <Badge className="bg-green-500 text-white">Reversed</Badge>
            </div>
            <p className="text-xs text-green-700 dark:text-green-300 mt-2">
              Reversed on {format(new Date(log.reversed_at), 'dd MMM yyyy')} - {log.reversal_reason}
            </p>
          </div>)}
        </div>
      </CardContent>
    </Card>}

    {/* Reversal Request Dialog */}
    <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
      <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            Request LOP Reversal
          </DialogTitle>
          <DialogDescription>
            Submit a reversal request with valid justification and evidence.
            Approval flow: Admin → CEO (final authority).
          </DialogDescription>
        </DialogHeader>

        {selectedEntry && (
          <>
            <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
              {/* LOP Details */}
              <div className="p-4 rounded-lg bg-muted/30 border">
                <p className="font-medium mb-2">LOP Details</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <span className="ml-2 font-medium">{format(new Date(selectedEntry.lop_date), 'dd MMM yyyy')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="ml-2 font-medium text-red-500">{getLOPValue(selectedEntry.lop_type).toFixed(2).replace(/\.00$/, '')} day(s)</span>
                  </div>
                </div>
                <p className="text-sm mt-2">
                  <span className="text-muted-foreground">Reason:</span>
                  <span className="ml-2">{selectedEntry.reason || selectedEntry.auto_reason}</span>
                </p>
              </div>

              {/* Reversal Reason */}
              <div>
                <Label className="text-sm font-medium">
                  Reason for Reversal * <span className="text-muted-foreground font-normal">(min {MIN_REASON_LENGTH} characters)</span>
                </Label>
                <Textarea
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  placeholder="Explain why this LOP should be reversed. Example: 'Client meeting ran late, location proof attached...'"
                  rows={4}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {reversalReason.length}/{MIN_REASON_LENGTH} characters
                  {reversalReason.length >= MIN_REASON_LENGTH && <CheckCircle className="w-3 h-3 inline ml-1 text-green-500" />}
                </p>
              </div>

              {/* Evidence Upload */}
              <div>
                <Label className="text-sm font-medium">
                  Evidence / Proof * <span className="text-muted-foreground font-normal">(required)</span>
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Upload supporting evidence: site photo, client message, GPS/location proof, medical slip, etc.
                </p>
                <FileUpload onUploadComplete={url => setReversalProofUrl(url)} label="Upload proof" accept="image/*,.pdf" />
                {reversalProofUrl && (
                  <Badge variant="outline" className="mt-2 gap-1 bg-green-50 text-green-700 border-green-300">
                    <CheckCircle className="w-3 h-3" />
                    Evidence uploaded
                  </Badge>
                )}
              </div>

              {/* Warning */}
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs">
                  Submission requires both reason and evidence. Final decision rests with the CEO.
                  No draft saves - ensure your information is complete before submitting.
                </AlertDescription>
              </Alert>
            </div>

            {/* Actions - Fixed at bottom */}
            <div className="p-6 pt-4 border-t flex gap-2 justify-end bg-background">
              <Button variant="outline" onClick={() => setSelectedEntry(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleRequestReversal}
                disabled={isSaving || reversalReason.trim().length < MIN_REASON_LENGTH || !reversalProofUrl}
              >
                {isSaving ? 'Submitting...' : 'Submit Reversal Request'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  </div>;
}
