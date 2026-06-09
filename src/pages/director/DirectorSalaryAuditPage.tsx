import { isMissingTable } from '@/lib/supabase-error-guard';
// @ts-nocheck
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
import { Users, DollarSign, Calendar, Eye, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import {
  fetchBatchesForAuditor,
  fetchBatchEmployees,
  auditorApproveBatch,
  auditorRejectBatch,
  getBatchById,
  type SalaryBatchCard,
  type BatchEmployeeRow,
} from '@/modules/hr-payroll/services/salaryBatchWorkflowService';
import { SALARY_BATCH_STATUS, STATUS_BADGE_CLASS } from '@/modules/hr-payroll/lib/salaryBatchWorkflow';
import type { SalaryBatchStatus } from '@/modules/hr-payroll/lib/salaryBatchWorkflow';
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

export default function DirectorSalaryAuditPage() {
  const queryClient = useQueryClient();
  const [detailBatch, setDetailBatch] = useState<SalaryBatchCard | null>(null);
  const [detailEmployees, setDetailEmployees] = useState<BatchEmployeeRow[]>([]);
  const [loadingDetailEmployees, setLoadingDetailEmployees] = useState(false);
  const [rejectBatch, setRejectBatch] = useState<SalaryBatchCard | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const openDetail = async (batch: SalaryBatchCard) => {
    setDetailBatch(batch);
    setDetailEmployees([]);
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
  });

  const approveMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      await auditorApproveBatch(batchId, user.id);
      const updated = await getBatchById(batchId);
      const approvedStatuses = new Set([
        SALARY_BATCH_STATUS.AUDITOR_APPROVED,
        SALARY_BATCH_STATUS.CEO_PENDING,
      ]);
      if (!updated || !approvedStatuses.has(updated.status as SalaryBatchStatus)) {
        throw new Error('Approval saved, but batch status did not move into the CEO approval queue');
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
        <h1 className="text-3xl font-bold">Salary Audit</h1>
        <p className="text-muted-foreground">
          View HR-verified batches. Approve to send to CEO or reject to return to HR (reason required).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batches Pending Approval</CardTitle>
          <CardDescription>
            Read-only view. Use Approve or Reject with a mandatory reason for reject.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading batches…</p>
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
                      <span>Gross: {fmt(batch.total_salary ?? 0)} · Net: {fmt(batch.total_net_pay ?? 0)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Created: {formatDateTime(batch.created_at)}</span>
                    </div>
                    {batch.hr_verified_at && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verified: {formatDateTime(batch.hr_verified_at)}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetail(batch)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View details
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

      {/* View details (read-only) modal */}
      <Dialog open={!!detailBatch} onOpenChange={(open) => { if (!open) { setDetailBatch(null); setDetailEmployees([]); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Batch details (read-only)</DialogTitle>
            <DialogDescription>
              Batch summary and full employee list. Use Approve or Reject from the card.
            </DialogDescription>
          </DialogHeader>
          {detailBatch && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <p><strong>Batch:</strong> {detailBatch.batch_code}</p>
                <p><strong>Departments:</strong> {detailBatch.departments_display}</p>
                <p><strong>Employees:</strong> {detailBatch.total_employees}</p>
                <p><strong>Total gross:</strong> {fmt(detailBatch.total_salary ?? 0)}</p>
                <p><strong>Total net pay:</strong> {fmt(detailBatch.total_net_pay ?? 0)}</p>
                <p><strong>Created:</strong> {formatDateTime(detailBatch.created_at)}</p>
                <p><strong>Verified at:</strong> {formatDateTime(detailBatch.hr_verified_at)}</p>
                {detailBatch.hr_verified_by && (
                  <p><strong>HR verified by:</strong> {detailBatch.hr_verified_by}</p>
                )}
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
                            <TableCell>{emp.department ?? '—'}</TableCell>
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
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
