import { useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Download, Calendar, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface LOPExportData {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  role: string;
  department: string;
  lop_date: string;
  lop_amount: number;
  reason: string;
  status: string;
  source: string;
  reversal_requested: string;
}

export default function LOPExportWidget() {
  const [startDate, setStartDate] = useState(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [isExporting, setIsExporting] = useState(false);

  const getLOPValue = (type: string): number => {
    if (type === '0.1_day' || type.includes('0.1')) return 0.1;
    if (type.includes('1') || type === '1_day') return 1;
    if (type.includes('0.5') || type === '0.5_day') return 0.5;
    if (type.includes('0.25') || type === '0.25_day') return 0.25;
    return 0;
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      // Fetch all LOP entries with pagination
      while (hasMore) {
        const { data, error } = await supabase
          .from('lop_entries')
          .select(`
            *,
            employee:profiles!lop_entries_employee_id_fkey(id, name, email, role, department)
          `)
          .gte('lop_date', startDate)
          .lte('lop_date', endDate)
          .order('lop_date', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = allData.concat(data);
          hasMore = data.length === pageSize;
          page++;
        }
      }

      if (allData.length === 0) {
        toast.info('No LOP entries found for the selected date range');
        setIsExporting(false);
        return;
      }

      const data = allData;

      // Transform data for export
      const exportData: LOPExportData[] = data.map((entry: any) => ({
        employee_id: entry.employee?.id || '',
        employee_name: entry.employee?.name || 'Unknown',
        employee_email: entry.employee?.email || '',
        role: entry.employee?.role || '',
        department: entry.employee?.department || '',
        lop_date: format(new Date(entry.lop_date), 'dd-MM-yyyy'),
        lop_amount: getLOPValue(entry.lop_type),
        reason: entry.reason || entry.auto_reason || '',
        status: entry.status,
        source: entry.source || 'manual',
        reversal_requested: entry.reversal_requested ? 'Yes' : 'No',
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData.map(row => ({
        'Employee ID': row.employee_id,
        'Name': row.employee_name,
        'Email': row.employee_email,
        'Role': row.role,
        'Department': row.department,
        'Date': row.lop_date,
        'LOP Amount': row.lop_amount,
        'Reason': row.reason,
        'Status': row.status,
        'Source': row.source,
        'Reversal Requested': row.reversal_requested,
      })));

      // Set column widths
      worksheet['!cols'] = [
        { wch: 36 }, // Employee ID
        { wch: 25 }, // Name
        { wch: 30 }, // Email
        { wch: 12 }, // Role
        { wch: 15 }, // Department
        { wch: 12 }, // Date
        { wch: 12 }, // LOP Amount
        { wch: 40 }, // Reason
        { wch: 15 }, // Status
        { wch: 20 }, // Source
        { wch: 18 }, // Reversal Requested
      ];

      // Create workbook and download
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'LOP Report');

      const filename = `LOP_Report_${format(new Date(startDate), 'ddMMMyyyy')}_to_${format(new Date(endDate), 'ddMMMyyyy')}.xlsx`;
      XLSX.writeFile(workbook, filename);

      toast.success(`✅ Exported ${allData.length} LOP entries`);
    } catch (error) {
      console.error('Error exporting LOP data:', error);
      toast.error('Failed to export LOP data');
    } finally {
      setIsExporting(false);
    }
  };

  // Quick date range presets
  const setLastMonth = () => {
    const lastMonth = subMonths(new Date(), 1);
    setStartDate(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
  };

  const setThisMonth = () => {
    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          LOP Report Export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={setLastMonth}>
            Last Month
          </Button>
          <Button variant="outline" size="sm" onClick={setThisMonth}>
            This Month
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <Button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Download LOP Report (XLSX)
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Export includes: Employee details, LOP amount, reason, status, and reversal info
        </p>
      </CardContent>
    </Card>
  );
}
