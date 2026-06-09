import { isMissingTable } from '@/lib/supabase-error-guard';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Eye, Pencil, CheckCircle2, PauseCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchBatchesForAccounts,
  fetchBatchEmployees,
  accountsHoldBatch,
  setBatchAccountsProcessing,
  setBatchFullyPaid,
  setBatchPaidAlready,
  updateBatchEmployeeStatus,
  type BatchEmployeeRow,
  type SalaryBatchCard,
} from '@/modules/hr-payroll/services/salaryBatchWorkflowService';
import { STATUS_BADGE_CLASS } from '@/modules/hr-payroll/lib/salaryBatchWorkflow';
import { generateSalaryKotakFile } from '@/lib/kotakBankExport';

const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AccountsSalaryExecutionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBatch, setSelectedBatch] = useState<SalaryBatchCard | null>(null);
  const [rows, setRows] = useState<BatchEmployeeRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [holdOpen, setHoldOpen] = useState(false);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [paidConfirmOpen, setPaidConfirmOpen] = useState(false);
  const [kotakFilePreviewOpen, setKotakFilePreviewOpen] = useState(false);
  const [kotakFileData, setKotakFileData] = useState<{
    batchCode: string;
    totalAmount: number;
    employeeCount: number;
    invalidEmployees: { name: string; reason: string }[];
  } | null>(null);

  // Helper function to validate employees have required bank details for Kotak export
  const validateEmployeesForExport = (employees: BatchEmployeeRow[]) => {
    const invalid: { name: string; reason: string }[] = [];
    employees.forEach(emp => {
      if (!emp.account_number || emp.account_number.trim().length < 5) {
        invalid.push({ name: emp.employee_name || 'Unknown', reason: 'Missing or invalid account number' });
      } else if (!emp.ifsc_code || emp.ifsc_code.trim().length < 5) {
        invalid.push({ name: emp.employee_name || 'Unknown', reason: 'Missing or invalid IFSC code' });
      } else if (!emp.net_pay || emp.net_pay <= 0) {
        invalid.push({ name: emp.employee_name || 'Unknown', reason: 'Missing or invalid net pay amount' });
      }
    });
    return invalid;
  };

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['salary-batches-accounts'],
    queryFn: fetchBatchesForAccounts,
  });

  const openBatch = async (batch: SalaryBatchCard, showDetails = false): Promise<void> => {
    setSelectedBatch(batch);
    setLoadingRows(true);
    try {
      const data = await fetchBatchEmployees(batch.id);
      setRows(data);
      if (showDetails) setViewDetailsOpen(true);
    } catch {
      setRows([]);
      if (!isMissingTable(error)) toast.error('Failed to fetch batch details');
    } finally {
      setLoadingRows(false);
    }
  };

  const paidMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBatch) throw new Error('No batch selected');
      
      // Step 1: Validate only CEO-approved or Accounts Processing batches can be marked paid
      const validStatuses = ['CEO Approved', 'ceo_approved', 'Accounts Processing', 'accounts_processing'];
      const normalizedStatus = selectedBatch.status.toLowerCase().replace(/_/g, ' ');
      if (!validStatuses.some(s => normalizedStatus.includes(s.toLowerCase()))) {
        throw new Error(`Cannot mark as Paid: Batch must be CEO Approved or Accounts Processing. Current status: ${selectedBatch.status}`);
      }

      // Step 2: Validate employees have required bank details
      const invalidEmployees = validateEmployeesForExport(rows);
      if (invalidEmployees.length > 0) {
        throw new Error(`Cannot generate Kotak file: ${invalidEmployees.length} employee(s) missing bank details`);
      }

      // Step 3: Generate Kotak bulk file FIRST (must succeed before marking paid)
      try {
        generateSalaryKotakFile(rows, selectedBatch.batch_code);
      } catch (error) {
        console.error('Kotak file generation failed:', error);
        throw new Error('Failed to generate Kotak bulk payment file. Batch NOT marked as paid.');
      }

      // Step 4: Only after successful file generation, mark batch as paid
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      
      await setBatchAccountsProcessing(selectedBatch.id, user.id);
      await Promise.all(rows.map((r) => updateBatchEmployeeStatus(r.id, 'Paid')));
      await setBatchFullyPaid(selectedBatch.id, user.id);
    },
    onSuccess: () => {
      toast.success('Batch marked Paid - Kotak bulk file generated successfully');
      queryClient.invalidateQueries({ queryKey: ['salary-batches-accounts'] });
      setPaidConfirmOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paidAlreadyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBatch) throw new Error('No batch selected');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      await setBatchAccountsProcessing(selectedBatch.id, user.id);
      await Promise.all(rows.map((r) => updateBatchEmployeeStatus(r.id, 'Paid Already')));
      await setBatchPaidAlready(selectedBatch.id, user.id);
    },
    onSuccess: () => {
      toast.success('Batch marked Paid Already');
      queryClient.invalidateQueries({ queryKey: ['salary-batches-accounts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const holdMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBatch) throw new Error('No batch selected');
      if (!holdReason.trim()) throw new Error('Hold reason is required');
      await Promise.all(rows.map((r) => updateBatchEmployeeStatus(r.id, 'Hold')));
      await accountsHoldBatch(selectedBatch.id, holdReason.trim());
    },
    onSuccess: () => {
      toast.success('Batch moved to Hold');
      setHoldOpen(false);
      setHoldReason('');
      setSelectedBatch(null);
      setRows([]);
      queryClient.invalidateQueries({ queryKey: ['salary-batches-accounts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalNetPay = useMemo(() => rows.reduce((s, r) => s + Number(r.net_pay ?? 0), 0), [rows]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Accounts Salary Execution</h1>
        <p className="text-muted-foreground">View, edit, Paid, Hold and Paid Already with one-time Kotak bulk check.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Approved Batches</CardTitle>
          <CardDescription>Shows CEO approved / processing batches for Accounts execution.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading batches...</p>
          ) : batches.length === 0 ? (
            <p className="text-muted-foreground">No batches pending accounts action.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {batches.map((b) => (
                <Card key={b.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{b.batch_code}</CardTitle>
                      <Badge className={STATUS_BADGE_CLASS[b.status] ?? ''}>{b.status}</Badge>
                    </div>
                    <CardDescription>{b.departments_display}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm">Net Pay: <span className="font-mono">{fmt(b.total_net_pay ?? 0)}</span></div>
                    <div className="text-sm">Employees: {b.total_employees}</div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => openBatch(b, true)}>
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/hr/employee-master/${b.id}`)}>
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          await openBatch(b);
                          setPaidConfirmOpen(true);
                        }}
                        disabled={paidMutation.isPending}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Paid
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          await openBatch(b);
                          setHoldOpen(true);
                        }}
                      >
                        <PauseCircle className="w-3 h-3 mr-1" />
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

      {selectedBatch && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedBatch.batch_code}</CardTitle>
            <CardDescription>Total Net Pay: {fmt(totalNetPay)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => openBatch(selectedBatch, true)}>
                <Eye className="w-3 h-3 mr-1" /> View
              </Button>
              <Button variant="outline" onClick={() => navigate(`/hr/employee-master/${selectedBatch.id}`)}>
                <Pencil className="w-3 h-3 mr-1" /> Edit
              </Button>
              <Button onClick={() => paidMutation.mutate()} disabled={paidMutation.isPending}>
                <CheckCircle2 className="w-3 h-3 mr-1" /> Paid
              </Button>
              <Button variant="secondary" onClick={() => setHoldOpen(true)}>
                <PauseCircle className="w-3 h-3 mr-1" /> Hold
              </Button>
            </div>

            {loadingRows ? (
              <p className="text-muted-foreground">Loading rows...</p>
            ) : (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee Name</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>File Check Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.employee_name ?? '—'}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(r.net_pay ?? 0)}</TableCell>
                        <TableCell>{r.status ?? 'Accounts Processing'}</TableCell>
                        <TableCell>{r.status === 'Paid Already' ? 'Matched in Kotak file' : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={holdOpen} onOpenChange={(open) => { if (!open) { setHoldOpen(false); setHoldReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hold Batch</DialogTitle>
            <DialogDescription>Enter hold reason before moving this batch to Hold.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="hold-reason">Reason *</Label>
            <Textarea id="hold-reason" rows={4} value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="Enter reason for hold..." />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setHoldOpen(false); setHoldReason(''); }}>Cancel</Button>
            <Button onClick={() => holdMutation.mutate()} disabled={!holdReason.trim() || holdMutation.isPending}>
              {holdMutation.isPending ? 'Saving…' : 'Save Hold'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={paidConfirmOpen} onOpenChange={setPaidConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Batch as Paid</DialogTitle>
            <DialogDescription>
              Confirm that this batch has been fully paid. This will update the payment status.
            </DialogDescription>
          </DialogHeader>
          {selectedBatch && (
            <p className="text-sm">Batch: <strong>{selectedBatch.batch_code}</strong> — {selectedBatch.total_employees} employees, Net: {fmt(totalNetPay)}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPaidConfirmOpen(false)}>Cancel</Button>
            <Button onClick={() => paidMutation.mutate()} disabled={paidMutation.isPending}>
              {paidMutation.isPending ? 'Updating…' : 'Confirm Paid'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Batch Details - {selectedBatch?.batch_code}</DialogTitle>
            <DialogDescription>
              Full employee list with net pay. Total: {fmt(totalNetPay)}
            </DialogDescription>
          </DialogHeader>
          {loadingRows ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.employee_name ?? '—'}</TableCell>
                      <TableCell>{r.department ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(r.net_pay ?? 0)}</TableCell>
                      <TableCell>{r.status ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Kotak File Validation Error Dialog */}
      <Dialog open={kotakFilePreviewOpen} onOpenChange={setKotakFilePreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600">Cannot Generate Kotak File</DialogTitle>
            <DialogDescription>
              The following employees are missing required bank details. Please update their information before marking as Paid.
            </DialogDescription>
          </DialogHeader>
          {kotakFileData && (
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Batch: {kotakFileData.batchCode}
                </p>
                <p className="text-sm text-red-600 dark:text-red-300">
                  {kotakFileData.invalidEmployees.length} of {kotakFileData.employeeCount} employees have missing bank details
                </p>
              </div>
              <div className="border rounded-md overflow-x-auto max-h-60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee Name</TableHead>
                      <TableHead>Issue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kotakFileData.invalidEmployees.map((emp, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell className="text-red-600 text-sm">{emp.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setKotakFilePreviewOpen(false)}>Close</Button>
            <Button onClick={() => { setKotakFilePreviewOpen(false); navigate(`/hr/employee-master/${selectedBatch?.id}`); }}>
              Edit Batch
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
