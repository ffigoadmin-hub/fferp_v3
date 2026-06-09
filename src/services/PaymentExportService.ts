import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface PaymentExportData {
    paymentNumber: string;
    type: string;
    vendor: string;
    amount: number;
    purpose: string;
    status: string;
    approvalDate: string;
    approvedBy: string;
    screenshotUrl: string;
    convertedFromBatch: string;
    originalBatchId: string;
    department: string;
}

export class PaymentExportService {
    /**
     * Export payments to CSV with date range filter
     */
    static async exportPaymentsToCSV(
        startDate: Date,
        endDate: Date,
        paymentType: 'all' | 'batch' | 'direct' | 'converted' = 'all'
    ): Promise<void> {
        try {
            // Build query
            let query = (supabase as any)
                .from('payment_requests')
                .select(`
          *,
          requester:profiles!payment_requests_requester_id_fkey(name, department),
          batch:bulk_batches!payment_requests_bulk_batch_id_fkey(batch_reference),
          original_batch:bulk_batches!payment_requests_original_batch_id_fkey(batch_reference)
        `)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .order('created_at', { ascending: false });

            // Apply payment type filter
            if (paymentType === 'batch') {
                query = query.not('bulk_batch_id', 'is', null);
            } else if (paymentType === 'direct') {
                query = query.is('bulk_batch_id', null).eq('converted_from_batch', false);
            } else if (paymentType === 'converted') {
                query = query.eq('converted_from_batch', true);
            }

            const { data: paymentsData, error } = await query;

            if (error) throw error;
            if (!paymentsData || paymentsData.length === 0) {
                throw new Error('No payments found for the selected date range');
            }

            const payments = [...paymentsData];

            // Fetch associated splits
            const splitPaymentIds = payments.filter(p => p.is_split_payment).map(p => p.id);
            if (splitPaymentIds.length > 0) {
                const { data: splitsData, error: splitsError } = await supabase
                    .from('split_payments' as any)
                    .select('*')
                    .in('parent_payment_id', splitPaymentIds);

                if (!splitsError && splitsData) {
                    payments.forEach(p => {
                        if (p.is_split_payment) {
                            p.splits = splitsData.filter((s: any) => s.parent_payment_id === p.id);
                        }
                    });
                }
            }

            // Fetch approver names
            const approverIds = new Set<string>();
            payments.forEach((p: any) => {
                ['smo_approved_by', 'gm_approved_by',
                    'director_approved_by', 'admin_approved_by', 'ceo_approved_by',
                    'accounts_executed_by', 'converted_by'].forEach(field => {
                        if (p[field]) approverIds.add(p[field]);
                    });
            });

            const { data: approvers } = await supabase
                .from('profiles')
                .select('id, name, role')
                .in('id', Array.from(approverIds));

            const approverMap: Record<string, { name: string; role: string }> = {};
            approvers?.forEach((a: any) => {
                approverMap[a.id] = { name: a.name, role: a.role };
            });

            // Transform data for CSV
            const csvData: PaymentExportData[] = [];
            
            payments.forEach((p: any) => {
                const paymentTypeLabel = p.bulk_batch_id
                    ? 'Batch'
                    : p.converted_from_batch
                        ? 'Direct (Converted)'
                        : 'Direct';

                const approvalDate = p.ceo_approved_at || p.admin_approved_at || p.created_at;
                const approvedBy = approverMap[p.ceo_approved_by || p.admin_approved_by || '']?.name || 'Pending';

                if (p.is_split_payment && p.splits && p.splits.length > 0) {
                    p.splits.forEach((s: any) => {
                        csvData.push({
                            paymentNumber: `PAY-${String(p.payment_number || 0).padStart(6, '0')}`,
                            type: `${paymentTypeLabel} (Split)`,
                            vendor: s.payee_name || '',
                            amount: Number(s.amount),
                            purpose: `${p.purpose} - ${s.split_title}`,
                            status: p.status || '',
                            approvalDate: approvalDate ? format(new Date(approvalDate), 'dd-MM-yyyy HH:mm') : '',
                            approvedBy,
                            screenshotUrl: s.payment_proof_url || p.payment_proof_screenshot || p.payment_proof_url || '',
                            convertedFromBatch: p.converted_from_batch ? 'Yes' : 'No',
                            originalBatchId: p.original_batch?.batch_reference || '',
                            department: p.department || p.requester?.department || ''
                        });
                    });
                } else {
                    csvData.push({
                        paymentNumber: `PAY-${String(p.payment_number || 0).padStart(6, '0')}`,
                        type: paymentTypeLabel,
                        vendor: p.vendor_name || '',
                        amount: Number(p.amount),
                        purpose: p.purpose || '',
                        status: p.status || '',
                        approvalDate: approvalDate ? format(new Date(approvalDate), 'dd-MM-yyyy HH:mm') : '',
                        approvedBy,
                        screenshotUrl: p.payment_proof_screenshot || p.payment_proof_url || '',
                        convertedFromBatch: p.converted_from_batch ? 'Yes' : 'No',
                        originalBatchId: p.original_batch?.batch_reference || '',
                        department: p.department || p.requester?.department || ''
                    });
                }
            });

            // Generate CSV
            this.downloadCSV(csvData, startDate, endDate);
        } catch (error) {
            console.error('Export error:', error);
            throw error;
        }
    }

    /**
     * Generate and download CSV file
     */
    private static downloadCSV(data: PaymentExportData[], startDate: Date, endDate: Date): void {
        const headers = [
            'Payment Number',
            'Type',
            'Vendor',
            'Amount',
            'Purpose',
            'Status',
            'Approval Date',
            'Approved By',
            'Screenshot URL',
            'Converted from Batch',
            'Original Batch ID',
            'Department'
        ];

        const csvRows = [
            headers.join(','),
            ...data.map(row => [
                row.paymentNumber,
                row.type,
                `"${row.vendor.replace(/"/g, '""')}"`,
                row.amount,
                `"${row.purpose.replace(/"/g, '""')}"`,
                row.status,
                row.approvalDate,
                row.approvedBy,
                row.screenshotUrl,
                row.convertedFromBatch,
                row.originalBatchId,
                row.department
            ].join(','))
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        const fileName = `payment_export_${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
