import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, Users, DollarSign, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

// ─── helpers ─────────────────────────────────────────────────────────────────
const num = (v: unknown) => (v != null && v !== '' ? Number(v) : 0);
const fmt = (v: number) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const hh12 = hh % 12 || 12;
  return `${dd}-${mm}-${yyyy} ${hh12}:${min} ${ampm}`;
};

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ─── types ───────────────────────────────────────────────────────────────────
interface BatchRow {
  id: string;
  batch_code: string | null;
  month: number;
  year: number;
  department: string | null;
  status: string;
  total_employees: number;
  total_net_pay: number;
  total_lop_amount: number;
  total_tds: number;
  created_at: string;
}

// ─── status badge ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  'CEO Approved':        { label: 'CEO Approved',        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  'Accounts Processing': { label: 'Accounts Processing', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  'Ready for Payment':   { label: 'Ready for Payment',   className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  'Paid Completed':      { label: 'Paid Completed',      className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
  'Accounts Hold':       { label: 'Accounts Hold',       className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
};

const statusBadge = (s: string) => {
  const cfg = STATUS_CONFIG[s] ?? { label: s.replace(/_/g, ' '), className: 'bg-gray-100 text-gray-700' };
  return <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>;
};

// ─── API helpers ──────────────────────────────────────────────────────────────
const fetchAccountsPendingBatches = async (): Promise<BatchRow[]> => {
  const { data, error } = await (supabase as any)
    .from('salary_batches')
    .select('id, batch_code, month, year, department, status, total_employees, total_net_pay, total_lop_amount, total_tds, created_at')
    .in('status', ['CEO Approved', 'Accounts Processing', 'Ready for Payment'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

// ─── main component ───────────────────────────────────────────────────────────
export default function AccountsSalarySheetPage() {
  const navigate = useNavigate();

  // ── fetch batches ──────────────────────────────────────────────────────────
  const { data: batches = [], isLoading, refetch } = useQuery({
    queryKey: ['salary-batches-accounts-pending'],
    queryFn: fetchAccountsPendingBatches,
  });

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Accounts Salary Sheet</h1>
          <p className="text-muted-foreground">Review CEO-approved salary batches ready for payment processing</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Batches Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pending Salary Batches
          </CardTitle>
          <CardDescription>
            Salary batches that have been approved by CEO and are ready for accounts processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">Loading batches…</div>
          ) : batches.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No pending salary batches for payment processing.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Name</TableHead>
                    <TableHead>Month / Year</TableHead>
                    <TableHead className="text-center">Total Employees</TableHead>
                    <TableHead className="text-right">Total Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created Date / Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map(batch => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">
                        {batch.batch_code ?? `Batch ${batch.id.substring(0, 8)}`}
                      </TableCell>
                      <TableCell>
                        {MONTHS[(batch.month ?? 1) - 1]} {batch.year}
                        {batch.department ? ` · ${batch.department}` : ''}
                      </TableCell>
                      <TableCell className="text-center">
                        {batch.total_employees}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-green-700 dark:text-green-400">
                        {fmt(batch.total_net_pay)}
                      </TableCell>
                      <TableCell>{statusBadge(batch.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmtDate(batch.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/accounts/salary-execution`)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Process Payment
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
