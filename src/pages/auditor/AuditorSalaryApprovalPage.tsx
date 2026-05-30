import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Users, DollarSign, Calendar, Eye, CheckCircle2, XCircle } from 'lucide-react';
import {
  fetchBatchesForAuditor,
  auditorApproveBatch,
  auditorRejectBatch,
  fetchBatchEmployees,
  fetchCreatorName,
  type SalaryBatchCard,
  type BatchEmployeeRow,
} from '@/modules/hr-payroll/services/salaryBatchWorkflowService';
import { STATUS_BADGE_CLASS } from '@/modules/hr-payroll/lib/salaryBatchWorkflow';
import { supabase } from '@/integrations/supabase/client';

const fmt = (v: number) =>
  `â‚¹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatDateTime(iso: string | null) {
  if (!iso) return 'â€”';
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function AuditorSalaryApprovalPage() {
  const queryClient = useQueryClient();
  const [detailBatch, setDetailBatch] = useState<SalaryBatchCard | null>(null);
  const [rejectBatch, setRejectBatch] = useState<SalaryBatchCard | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  
  const [detailCreatorName, setDetailCreatorName] = useState<string | null>(null);
  const [detailHrVerifiedName, setDetailHrVerifiedName] = useState<string | null>(null);
  const [detailAuditorName, setDetailAuditorName] = useState<string | null>(null);
  const [detailEmployees, setDetailEmployees] = useState<BatchEmployeeRow[]>([]);
  const [loadingDetailEmployees, setLoadingDetailEmployees] = useState(false);

  const openDetail = async (batch: SalaryBatchCard) => {
    setDetailBatch(batch);
    setDetailEmployees([]);
    setDetailCreatorName(null);
    setDetailHrVerifiedName(null);
    setDetailAuditorName(null);
    if (batch.created_by) fetchCreatorName(batch.created_by).then(setDetailCreatorName);
    if (batch.hr_verified_by) fetchCreatorName(batch.hr_verified_by).then(setDetailHrVerifiedName);
    if (batch.auditor_approved_by) fetchCreatorName(batch.auditor_approved_by).then(setDetailAuditorName);
    setLoadingDetailEmployees(true);
    try {
      const list = await fetchBatchEmployees(batch.id);
      setDetailEmployees(list);
    } catch (e) {
      if (!isMissingTable(error)) toast.error('Failed to load employees');
      setDetailEmployees([]);
    } finally {
      setLoadingDetailEmployees(false);
    }
  };

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['salary-batches-auditor'],
    queryFn: fetchBatchesForAuditor,
    staleTime: 0,
    refetchOnMount: true,
  });

  const approveMutation = useMutation({
    mutationFn: async (batchId: string) => {
      console.info('[AuditorSalaryApprovalPage] ðŸ”„ Approve clicked for batch', { batchId });

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      console.info('[AuditorSalaryApprovalPage] ðŸ”„ User authenticated', { userId: user.id });

      // Get batch before approval to log batch code
      const { data: beforeBatch, error: beforeErr } = await supabase
        .from('salary_batches')
        .select('id,status,batch_code,auditor_approved_at,auditor_approved_by,hr_verified_at,hr_verified_by')
        .eq('id', batchId)
        .single();

      if (beforeErr) {
        console.warn('[AuditorSalaryApprovalPage] âš ï¸ Pre-approval read failed', { beforeErr });
      } else {
        console.info('[AuditorSalaryApprovalPage] ðŸ“Š Batch before approval', {
          batchId,
          batchCode: beforeBatch?.batch_code,
          status: beforeBatch?.status,
          auditor_approved_at: beforeBatch?.auditor_approved_at,
          auditor_approved_by: beforeBatch?.auditor_approved_by,
          hr_verified_at: beforeBatch?.hr_verified_at,
          hr_verified_by: beforeBatch?.hr_verified_by,
        });
      }

      // Approve the batch
      console.info('[AuditorSalaryApprovalPage] ðŸš€ Calling auditorApproveBatch', { batchId, batchCode: beforeBatch?.batch_code, userId: user.id });
      await auditorApproveBatch(batchId, user.id);

      // Immediate verification - check if batch was updated correctly
      console.info('[AuditorSalaryApprovalPage] ðŸ” Post-approval verification query');
      const { data: verifiedBatch, error: verifyError } = await supabase
        .from('salary_batches')
        .select('id,status,auditor_approved_at,auditor_approved_by,accounts_processed_at,accounts_processed_by,paid_at,paid_by,ceo_approved_at,ceo_approved_by,hr_verified_at,hr_verified_by,released_at,released_by')
        .eq('id', batchId)
        .single();

      if (verifyError) {
        console.error('[AuditorSalaryApprovalPage] verification query failed', { verifyError });
        throw new Error(`Approval verification failed: ${verifyError.message}`);
      } else {
        console.info('[AuditorSalaryApprovalPage] post-approval verification result', {
          batchId,
          status: verifiedBatch?.status,
          auditor_approved_at: verifiedBatch?.auditor_approved_at,
          auditor_approved_by: verifiedBatch?.auditor_approved_by,
          hr_verified_at: verifiedBatch?.hr_verified_at,
          hr_verified_by: verifiedBatch?.hr_verified_by,
          accounts_processed_at: verifiedBatch?.accounts_processed_at,
          accounts_processed_by: verifiedBatch?.accounts_processed_by,
          paid_at: verifiedBatch?.paid_at,
          paid_by: verifiedBatch?.paid_by,
          ceo_approved_at: verifiedBatch?.ceo_approved_at,
          ceo_approved_by: verifiedBatch?.ceo_approved_by,
          released_at: verifiedBatch?.released_at,
          released_by: verifiedBatch?.released_by,
        });

        // Check if batch should appear on CEO page
        const normalizedStatus = String(verifiedBatch?.status ?? '')
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();
        const statusSignalsAuditorApproval = [
          'auditor approved',
          'auditor audited',
          'approved',
          'ceo pending',
          'pending ceo',
          'pending ceo approval',
          'awaiting ceo approval',
          'awaiting ceo',
        ].includes(normalizedStatus);
        const hasAuditorApproval = Boolean(
          verifiedBatch?.auditor_approved_at ||
            verifiedBatch?.auditor_approved_by ||
            verifiedBatch?.released_at ||
            verifiedBatch?.released_by ||
            statusSignalsAuditorApproval,
        );
        const hasNoDownstreamProcessing =
          !verifiedBatch?.accounts_processed_at &&
          !verifiedBatch?.accounts_processed_by &&
          !verifiedBatch?.paid_at &&
          !verifiedBatch?.paid_by &&
          !verifiedBatch?.ceo_approved_at &&
          !verifiedBatch?.ceo_approved_by;

        const shouldBeOnCeoPage = hasAuditorApproval && hasNoDownstreamProcessing;

        console.info('[AuditorSalaryApprovalPage] CEO page eligibility check', {
          batchId,
          normalizedStatus,
          statusSignalsAuditorApproval,
          hasAuditorApproval,
          hasNoDownstreamProcessing,
          shouldBeOnCeoPage,
        });

        if (!shouldBeOnCeoPage) {
          console.warn('[AuditorSalaryApprovalPage] warning: batch may not appear on CEO page', {
            reason: !hasAuditorApproval
              ? 'missing auditor approval fields'
              : !hasNoDownstreamProcessing
                ? 'already processed downstream'
                : 'unknown',
            batchData: verifiedBatch,
          });
          throw new Error(
            'Approval did not persist in CEO queue state. Please retry and check workflow fields.',
          );
        } else {
          console.info('[AuditorSalaryApprovalPage] batch should appear on CEO page', { batchId });
        }
      }
    },
    onSuccess: async () => {
      toast.success('Batch approved. It will now appear on the CEO page.');
      setDetailBatch(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['salary-batches-auditor'] }),
        queryClient.invalidateQueries({ queryKey: ['salary-batches-ceo'] }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['salary-batches-auditor'] }),
        queryClient.refetchQueries({ queryKey: ['salary-batches-ceo'] }),
      ]);
    },
    onError: (e: Error) => toast.error(e.message || 'Approve failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ batchId, reason }: { batchId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      await auditorRejectBatch(batchId, user.id, reason);
    },
    onSuccess: () => {
      toast.success('Batch rejected. It will return to HR with your reason.');
      setRejectBatch(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['salary-batches-auditor'] });
      queryClient.invalidateQueries({ queryKey: ['salary-batches-hr'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Reject failed'),
  });

  const statusBadgeClass = (s: string) => STATUS_BADGE_CLASS[s] ?? 'bg-gray-100 text-gray-800';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Auditor Salary Audit</h1>
        <p className="text-muted-foreground">
          View HR-verified batches. Approve to send to CEO or reject to return to HR (reason required).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batches Pending Audit</CardTitle>
          <CardDescription>
            Read-only view. Use Approve or Reject with a mandatory reason for reject.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading batchesâ€¦</p>
          ) : batches.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No HR-verified batches at the moment.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {batches.map((batch) => (
                <Card key={batch.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{batch.batch_code}</CardTitle>
                      <Badge className={statusBadgeClass(batch.status)}>{batch.status}</Badge>
                    </div>
                    <CardDescription>{batch.departments_display}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>{batch.total_employees} employees</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span>Net: {fmt(batch.total_net_pay ?? 0)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDateTime(batch.created_at)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetail(batch)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate(batch.id)}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setRejectBatch(batch)}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View details modal */}
      <Dialog open={!!detailBatch} onOpenChange={(open) => { if (!open) { setDetailBatch(null); setDetailEmployees([]); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Batch details</DialogTitle>
            <DialogDescription>
              Batch summary and full employee list with salary breakdown.
            </DialogDescription>
          </DialogHeader>
          {detailBatch && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <p><strong>Batch:</strong> {detailBatch.batch_code}</p>
                <p><strong>Department:</strong> {detailBatch.departments_display}</p>
                <p><strong>Total employees:</strong> {detailBatch.total_employees}</p>
                <p><strong>Gross salary:</strong> {fmt(detailBatch.total_salary ?? 0)}</p>
                <p><strong>Net pay:</strong> {fmt(detailBatch.total_net_pay ?? 0)}</p>
                <p><strong>HR verified by:</strong> {detailHrVerifiedName ?? detailBatch.hr_verified_by ?? 'â€”'}</p>
                <p><strong>Auditor approved by:</strong> {detailAuditorName ?? detailBatch.auditor_approved_by ?? 'â€”'}</p>
                <p><strong>Created at:</strong> {formatDateTime(detailBatch.created_at)}</p>
                <p><strong>Updated at:</strong> {formatDateTime(detailBatch.updated_at)}</p>
                <p><strong>Created by:</strong> {detailCreatorName ?? detailBatch.created_by ?? 'â€”'}</p>
                <p><strong>Status:</strong> <span className={statusBadgeClass(detailBatch.status)}>{detailBatch.status}</span></p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Employees</h4>
                {loadingDetailEmployees ? (
                  <p className="text-muted-foreground">Loading employeesâ€¦</p>
                ) : (
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead className="text-right">Basic salary</TableHead>
                          <TableHead className="text-right">LOP days</TableHead>
                          <TableHead className="text-right">Earned salary</TableHead>
                          <TableHead className="text-right">Incentive</TableHead>
                          <TableHead className="text-right">Increment</TableHead>
                          <TableHead className="text-right">TDS</TableHead>
                          <TableHead className="text-right">Net pay</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailEmployees.map((emp) => (
                          <TableRow key={emp.id}>
                            <TableCell className="font-medium">{emp.employee_name ?? '—'}</TableCell>
                            <TableCell>
                              <span className="text-sm">
                                <span className="text-muted-foreground">Department: </span>
                                <span className="font-medium">{emp.department ?? 'Not Assigned'}</span>
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono">{fmt(emp.basic_salary ?? 0)}</TableCell>
                            <TableCell className="text-right">{emp.lop_days ?? 'â€”'}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(emp.earned_salary ?? 0)}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(emp.incentive ?? 0)}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(emp.increment ?? 0)}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(emp.tds ?? 0)}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(emp.net_pay ?? 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDetailBatch(null); setDetailEmployees([]); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject reason modal */}
      <Dialog open={!!rejectBatch} onOpenChange={(open) => !open && setRejectBatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject batch</DialogTitle>
            <DialogDescription>
              Rejection reason is mandatory. The batch will return to HR with this reason.
            </DialogDescription>
          </DialogHeader>
          {rejectBatch && (
            <>
              <p className="text-sm">
                Batch: <strong>{rejectBatch.batch_code}</strong>
              </p>
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Rejection reason *</Label>
                <Textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={4}
                  className="resize-none"
                />
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectBatch(null); setRejectReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectBatch &&
                rejectReason.trim() &&
                rejectMutation.mutate({ batchId: rejectBatch.id, reason: rejectReason.trim() })
              }
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejectingâ€¦' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

