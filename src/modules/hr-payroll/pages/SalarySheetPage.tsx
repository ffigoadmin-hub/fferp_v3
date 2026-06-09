// @ts-nocheck
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Pencil, CheckCircle2, Users, Calendar, DollarSign, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchBatchesForHR,
  fetchBatchEmployees,
  hrVerifyBatch,
  type BatchEmployeeRow,
  type SalaryBatchCard,
} from '@/modules/hr-payroll/services/salaryBatchWorkflowService';
import { getLOPSummaryByProfileIds } from '../services/lopResolver';
import { STATUS_BADGE_CLASS } from '@/modules/hr-payroll/lib/salaryBatchWorkflow';
import { supabase } from '@/integrations/supabase/client';

const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SalarySheetPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [detailBatch, setDetailBatch] = useState<SalaryBatchCard | null>(null);
  const [detailRows, setDetailRows] = useState<BatchEmployeeRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['salary-batches-hr'],
    queryFn: fetchBatchesForHR,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
  });

  const verifyMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      await hrVerifyBatch(batchId, user.id);
    },
    onSuccess: () => {
      toast.success('Batch verified and moved to Auditor Salary Audit.');
      queryClient.invalidateQueries({ queryKey: ['salary-batches-hr'] });
      queryClient.invalidateQueries({ queryKey: ['salary-batches-auditor'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Verify failed'),
  });

  const openDetail = async (batch: SalaryBatchCard) => {
    setDetailBatch(batch);
    setLoadingDetail(true);
    try {
      // Fetch batch employees (snapshot data)
      const rows = await fetchBatchEmployees(batch.id);

      // Get profile IDs and prepare for LOP fetching
      const profileIds = rows
        .map(r => r.profile_id)
        .filter(Boolean) as string[];

      // Calculate date range for LOP fetching
      const fromDate = `${batch.year}-${batch.month.toString().padStart(2, '0')}-01`;
      const nextMonth = batch.month === 12 ? 1 : batch.month + 1;
      const nextYear = batch.month === 12 ? batch.year + 1 : batch.year;
      const toDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

      // Fetch live LOP data
      let lopMap: Map<string, { lop_days: number; lop_amount: number }> = new Map();
      try {
        lopMap = await getLOPSummaryByProfileIds(profileIds, fromDate, toDate);
      } catch (lopError) {
        console.error('[SalarySheet] Error fetching LOP data:', lopError);
        lopMap = new Map();
      }

      // Merge LOP data into rows and recalculate
      const mergedRows = rows.map(row => {
        const profileId = row.profile_id;
        const lop = lopMap.get(profileId) || { lop_days: 0, lop_amount: 0 };

        // Calculate per-day salary for LOP amount recalculation
        const daysInMonth = new Date(batch.year, batch.month, 0).getDate();
        const perDaySalary = daysInMonth > 0 ? (row.basic_salary || 0) / daysInMonth : 0;

        // Recalculate LOP amount from fetched LOP days
        const lopAmount = Math.round(lop.lop_days * perDaySalary * 100) / 100;

        // Recalculate final salary: basic + increment + incentive - lop_amount - tds
        const baseSalary = (row.basic_salary || 0) + (row.increment || 0) + (row.incentive || 0);
        const tds = Math.round(baseSalary * 0.01 * 100) / 100; // 1% TDS
        const finalSalary = Math.round((baseSalary - lopAmount - tds) * 100) / 100;

        return {
          ...row,
          lop_days: lop.lop_days, // Use fetched LOP days
          lop_amount: lopAmount,   // Recalculated LOP amount
          final_salary: finalSalary // Recalculated final salary
        };
      });

      setDetailRows(mergedRows);
    } catch {
      setDetailRows([]);
      toast.error('Failed to load batch details');
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Salary Sheet</h1>
        <p className="text-muted-foreground">HR batches with View, Edit and Verify actions.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prepared Batches</CardTitle>
          <CardDescription>Verify to move batch to Auditor Salary Audit page.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading batches...</p>
          ) : batches.length === 0 ? (
            <p className="text-muted-foreground">No draft/rejected batches available.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {batches.map((batch) => (
                <Card key={batch.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{batch.batch_code}</CardTitle>
                      <Badge className={STATUS_BADGE_CLASS[batch.status] ?? ''}>{batch.status}</Badge>
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
                      <span>{fmt(batch.total_net_pay ?? 0)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{batch.month}/{batch.year}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => openDetail(batch)}>
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/hr/employee-master/${batch.id}`)}>
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" onClick={() => verifyMutation.mutate(batch.id)} disabled={verifyMutation.isPending}>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Verify
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailBatch} onOpenChange={() => { setDetailBatch(null); setDetailRows([]); }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Batch Details</DialogTitle>
            <DialogDescription>Read-only details for quick review.</DialogDescription>
          </DialogHeader>
          {loadingDetail ? (
            <p className="text-muted-foreground">Loading details...</p>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Basic Salary</TableHead>
                    <TableHead className="text-right">LOP Days</TableHead>
                    <TableHead className="text-right">LOP Amount</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.employee_name ?? '—'}</TableCell>
                      <TableCell>{r.department ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(r.basic_salary || 0)}</TableCell>
                      <TableCell className="text-right font-mono">{Number(r.lop_days || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(r.lop_amount || 0)}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{fmt((r as any).final_salary ?? r.net_pay ?? 0)}</TableCell>
                      <TableCell>{r.status ?? '—'}</TableCell>
                      <TableCell>
                        {r.profile_id && (
                          <button
                            onClick={() => navigate(`/hr/employee-payroll/${r.profile_id}`)}
                            className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline whitespace-nowrap">
                            <ExternalLink className="w-3 h-3" /> View Profile
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
