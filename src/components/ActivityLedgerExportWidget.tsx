import { useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useEmployeeDataExport } from '@/hooks/useEmployeeDataExport';
import { exportToExcel } from '@/lib/exportUtils';
import { toast } from 'sonner';

export default function ActivityLedgerExportWidget() {
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [isExporting, setIsExporting] = useState(false);
    const { fetchEmployeeDataRange } = useEmployeeDataExport();

    const handleExport = async () => {
        setIsExporting(true);

        try {
            if (startDate > endDate) {
                toast.error('Start date cannot be after end date');
                return;
            }

            toast.info('Fetching ledger data... This may take a moment.');
            const data = await fetchEmployeeDataRange(new Date(startDate), new Date(endDate));

            if (!data || data.length === 0) {
                toast.info('No activity data found for the selected date range');
                setIsExporting(false);
                return;
            }

            const headers = [
                { key: 'serial_no', label: 'S.No' },
                { key: 'date', label: 'Date' },
                { key: 'employee_id', label: 'Employee ID' },
                { key: 'name', label: 'Name' },
                { key: 'department', label: 'Department' },
                { key: 'role', label: 'Role' },
                { key: 'location_zone', label: 'Location' },
                { key: 'login_time', label: 'Login Time' },
                { key: 'late_login_minutes', label: 'Late Login (min)' },
                { key: 'day_plan_submitted', label: 'Day Plan ?' },
                { key: 'day_plan_tasks', label: 'Planned Tasks' },
                { key: 'hourly_reports_count', label: 'Reports Count' },
                { key: 'late_reports_count', label: 'Late Reports' },
                { key: 'eod_submitted', label: 'EOD ?' },
                { key: 'eod_completion_percentage', label: 'Completion %' },
                { key: 'attendance_status', label: 'Attestation' },
                { key: 'selfie_url', label: 'Selfie URL' },
            ];

            const filename = `Activity_Ledger_${format(new Date(startDate), 'ddMMMyyyy')}_to_${format(new Date(endDate), 'ddMMMyyyy')}`;

            const exportData = data.map((row, index) => ({
                serial_no: index + 1,
                ...row
            }));

            exportToExcel(exportData, filename, headers);

            toast.success(`Exported ${data.length} records successfully`);
        } catch (error) {
            console.error('Error exporting activity ledger:', error);
            toast.error('Failed to export activity ledger');
        } finally {
            setIsExporting(false);
        }
    };

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
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                    Member Activity Ledger
                </CardTitle>
                <CardDescription>
                    Export detailed activity log for all employees over a date range.
                </CardDescription>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                    {isExporting ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating Ledger...
                        </>
                    ) : (
                        <>
                            <Download className="w-4 h-4 mr-2" />
                            Download Master Ledger (Excel)
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}
