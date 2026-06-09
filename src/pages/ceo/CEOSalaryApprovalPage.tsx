import { isMissingTable } from '@/lib/supabase-error-guard';
import { useEffect, useState } from 'react';
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
import { useNavigate } from 'react-router-dom';
import { Users, DollarSign, Calendar, Eye, CheckCircle2, XCircle, Pause, Pencil, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  fetchBatchesForCEO,
  fetchBatchEmployees,
  ceoApproveBatch,
  ceoRejectBatch,
  ceoHoldBatch,
  fetchCreatorName,
  type SalaryBatchCard,
  type BatchEmployeeRow,
} from '@/modules/hr-payroll/services/salaryBatchWorkflowService';
import { STATUS_BADGE_CLASS } from '@/modules/hr-payroll/lib/salaryBatchWorkflow';
import { supabase } from '@/integrations/supabase/client';

const fmt = (v: number) =>
  `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function CEOSalaryApprovalPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [detailBatch, setDetailBatch] = useState<SalaryBatchCard | null>(null);
  const [rejectBatch, setRejectBatch] = useState<SalaryBatchCard | null>(null);
  const [holdBatch, setHoldBatch] = useState<SalaryBatchCard | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [holdReason, setHoldReason] = useState('');
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

  const { data: batches = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['salary-batches-ceo'],
    queryFn: fetchBatchesForCEO,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!isLoading && !isError) {
      console.info('[CEOSalaryApprovalPage] CEO queue fetch result', {
        totalBatches: batches.length,
        batchIds: batches.map((b) => b.id),
        batchCodes: batches.map((b) => b.batch_code),
        statuses: batches.map((b) => b.status),
        auditorApprovedFields: batches.map((b) => ({
          id: b.id,
          batch_code: b.batch_code,
          auditor_approved_at: b.auditor_approved_at,
          auditor_approved_by: b.auditor_approved_by,
        })),
      });
    }
  }, [batches, isLoading, isError]);

  useEffect(() => {
    const channel = supabase
      .channel('ceo-salary-batches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salary_batches' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['salary-batches-ceo'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const approveMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      await ceoApproveBatch(batchId, user.id);
    },
    onSuccess: () => {
      toast.success('Batch approved. It will now appear on the Accounts page.');
      setDetailBatch(null);
      queryClient.invalidateQueries({ queryKey: ['salary-batches-ceo'] });
      queryClient.invalidateQueries({ queryKey: ['salary-batches-accounts'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Approve failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ batchId, reason }: { batchId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      await ceoRejectBatch(batchId, user.id, reason);
    },
    onSuccess: () => {
      toast.success('Batch rejected.');
      setRejectBatch(null);
      setRejectReason('');
      setDetailBatch(null);
      queryClient.invalidateQueries({ queryKey: ['salary-batches-ceo'] });
      queryClient.invalidateQueries({ queryKey: ['salary-batches-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['salary-batches-hr'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Reject failed'),
  });

  const holdMutation = useMutation({
    mutationFn: async ({ batchId, reason }: { batchId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      await ceoHoldBatch(batchId, user.id, reason);
    },
    onSuccess: () => {
      toast.success('Batch put on hold.');
      setHoldBatch(null);
      setHoldReason('');
      setDetailBatch(null);
      queryClient.invalidateQueries({ queryKey: ['salary-batches-ceo'] });
      queryClient.invalidateQueries({ queryKey: ['salary-batches-accounts'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Hold failed'),
  });

  const statusBadgeClass = (s: string) => STATUS_BADGE_CLASS[s] ?? 'bg-gray-100 text-gray-800';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">CEO Salary Approval</h1>
        <p className="text-muted-foreground">
          Approve, reject, or put batches on hold. Approved batches move to Accounts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Batches Pending CEO Action</CardTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-3 h-3 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <CardDescription>
            View, edit, approve, reject, or hold. Reject and Hold require a reason.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading batches…</p>
          ) : isError ? (
            <div className="rounded-md border border-red-300/40 bg-red-50/40 dark:bg-red-950/20 p-4 space-y-2">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4" />
                <p className="font-medium">Failed to load CEO salary batches</p>
              </div>
              <p className="text-sm text-red-700/90 dark:text-red-300/90">
                {(error as Error)?.message || 'Unknown query error'}
              </p>
              <p className="text-xs text-muted-foreground">
                This usually means role/data visibility (RLS) or status inconsistency in salary_batches.
              </p>
            </div>
          ) : batches.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No auditor-approved batches at the moment.
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
                      <span>Created: {formatDateTime(batch.created_at)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs pt-1">
                      <Badge variant="outline" className="font-normal">
                        HR Verified Status: {batch.hr_verified_at ? 'Verified' : 'Pending'}
                      </Badge>
                      <Badge variant="outline" className="font-normal">
                        Auditor Approved Status: {batch.auditor_approved_at ? 'Approved' : 'Pending'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => openDetail(batch)}>
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/hr/employee-master/${batch.id}`)}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
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
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setHoldBatch(batch)}
                      >
                        <Pause className="w-3 h-3 mr-1" />
                        Hold
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
                <p><strong>HR verified by:</strong> {detailHrVerifiedName ?? detailBatch.hr_verified_by ?? '—'}</p>
                <p><strong>Auditor approved by:</strong> {detailAuditorName ?? detailBatch.auditor_approved_by ?? '—'}</p>
                <p><strong>Created at:</strong> {formatDateTime(detailBatch.created_at)}</p>
                <p><strong>Updated at:</strong> {formatDateTime(detailBatch.updated_at)}</p>
                <p><strong>Created by:</strong> {detailCreatorName ?? detailBatch.created_by ?? '—'}</p>
                <p><strong>Status:</strong> <span className={statusBadgeClass(detailBatch.status)}>{detailBatch.status}</span></p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Employees</h4>
                {loadingDetailEmployees ? (
                  <p className="text-muted-foreground">Loading employees…</p>
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
                            <TableCell className="text-right">{emp.lop_days ?? '—'}</TableCell>
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
            {detailBatch && (
              <Button variant="outline" onClick={() => { setDetailBatch(null); setDetailEmployees([]); navigate(`/hr/employee-master/${detailBatch.id}`); }}>
                Edit batch
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject reason modal */}
      <Dialog open={!!rejectBatch} onOpenChange={(open) => !open && setRejectBatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject batch</DialogTitle>
            <DialogDescription>Rejection reason is mandatory.</DialogDescription>
          </DialogHeader>
          {rejectBatch && (
            <>
              <p className="text-sm">Batch: <strong>{rejectBatch.batch_code}</strong></p>
              <div className="space-y-2">
                <Label htmlFor="ceo-reject-reason">Rejection reason *</Label>
                <Textarea
                  id="ceo-reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter reason..."
                  rows={4}
                  className="resize-none"
                />
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectBatch(null); setRejectReason(''); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectBatch &&
                rejectReason.trim() &&
                rejectMutation.mutate({ batchId: rejectBatch.id, reason: rejectReason.trim() })
              }
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold reason modal */}
      <Dialog open={!!holdBatch} onOpenChange={(open) => !open && setHoldBatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Put batch on hold</DialogTitle>
            <DialogDescription>Hold reason is mandatory.</DialogDescription>
          </DialogHeader>
          {holdBatch && (
            <>
              <p className="text-sm">Batch: <strong>{holdBatch.batch_code}</strong></p>
              <div className="space-y-2">
                <Label htmlFor="ceo-hold-reason">Hold reason *</Label>
                <Textarea
                  id="ceo-hold-reason"
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="Enter reason for hold..."
                  rows={4}
                  className="resize-none"
                />
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setHoldBatch(null); setHoldReason(''); }}>Cancel</Button>
            <Button
              onClick={() =>
                holdBatch &&
                holdReason.trim() &&
                holdMutation.mutate({ batchId: holdBatch.id, reason: holdReason.trim() })
              }
              disabled={!holdReason.trim() || holdMutation.isPending}
            >
              {holdMutation.isPending ? 'Saving…' : 'Hold'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
