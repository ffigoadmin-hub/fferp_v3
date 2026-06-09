import { PaymentRequestData } from '@/hooks/usePaymentRequests';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { 
    validateBatchPayments, 
    getPaymentType, 
    formatAmountForBank, 
    sanitizeBeneficiaryName 
} from './paymentValidation';

/**
 * Kotak Bank Bulk Upload Export Service
 * Generates compliant XLS files for Kotak Bank's bulk payment facility
 */
export class KotakExportService {
    /**
     * Validates if the selected payments have all necessary bank details for Kotak export.
     */
    static validateForExport(requests: PaymentRequestData[]): { isValid: boolean; issues: string[] } {
        const validation = validateBatchPayments(requests);
        return {
            isValid: validation.isValid,
            issues: [...validation.errors, ...validation.warnings]
        };
    }

    /**
     * Generates a CSV file in Kotak file upload format (legacy method).
     */
    static generateExport(requests: PaymentRequestData[], batchId: string): void {
        // Validate first
        const validation = this.validateForExport(requests);
        if (!validation.isValid) {
            throw new Error(`Validation Failed:\n${validation.issues.join('\n')}`);
        }

        // Kotak Bulk Upload Format (Simplified CSV)
        const headers = ['Payment Type', 'Beneficiary Name', 'Account Number', 'IFSC', 'Amount', 'Remarks'];
        const rows = requests.map(r => [
            getPaymentType(Number(r.amount)),
            sanitizeBeneficiaryName(r.beneficiary_name || r.vendor_name),
            r.vendor_account_number || '',
            (r.vendor_ifsc_code || '').toUpperCase(),
            formatAmountForBank(Number(r.amount)),
            `BATCH-${batchId}`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `KOTAK_EXPORT_${batchId}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Generates a true XLS/XLSX file in Kotak Bank compliant format.
     * This is the preferred export method for bank uploads.
     */
    static generateXLS(requests: PaymentRequestData[], batchId: string): void {
        // Validate first
        const validation = this.validateForExport(requests);
        if (!validation.isValid) {
            throw new Error(`Cannot export - validation failed:\n${validation.issues.join('\n')}`);
        }

        // Kotak Bulk Upload Template Format
        const data = requests.map((r, idx) => ({
            'Sr. No': idx + 1,
            'Beneficiary Name': sanitizeBeneficiaryName(r.beneficiary_name || r.vendor_name),
            'Account Number': r.vendor_account_number || '',
            'IFSC Code': (r.vendor_ifsc_code || '').toUpperCase(),
            'Bank Name': r.bank_name || '',
            'Amount': formatAmountForBank(Number(r.amount)),
            'Payment Type': getPaymentType(Number(r.amount)),
            'Remarks': `BATCH-${batchId}`,
            'Email': '', // Optional field
            'Mobile': r.vendor_phone || '' // Optional field
        }));

        // Create workbook and worksheet
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Payments');

        // Set column widths for better readability
        ws['!cols'] = [
            { wch: 8 },   // Sr. No
            { wch: 35 },  // Beneficiary Name
            { wch: 20 },  // Account Number
            { wch: 15 },  // IFSC Code
            { wch: 20 },  // Bank Name
            { wch: 15 },  // Amount
            { wch: 12 },  // Payment Type
            { wch: 20 },  // Remarks
            { wch: 25 },  // Email
            { wch: 15 },  // Mobile
        ];

        // Generate and download
        XLSX.writeFile(wb, `KOTAK_${batchId}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    }

    /**
     * Preview export data without downloading (for UI preview)
     */
    static previewExportData(requests: PaymentRequestData[], batchId: string): {
        headers: string[];
        rows: string[][];
        summary: {
            totalAmount: number;
            neftCount: number;
            rtgsCount: number;
        };
    } {
        const headers = ['Sr.', 'Beneficiary', 'Account', 'IFSC', 'Amount', 'Type'];
        
        let neftCount = 0;
        let rtgsCount = 0;
        let totalAmount = 0;

        const rows = requests.map((r, idx) => {
            const amount = Number(r.amount);
            totalAmount += amount;
            
            const paymentType = getPaymentType(amount);
            if (paymentType === 'NEFT') neftCount++;
            else rtgsCount++;

            return [
                String(idx + 1),
                sanitizeBeneficiaryName(r.beneficiary_name || r.vendor_name).substring(0, 20),
                (r.vendor_account_number || '').slice(-4).padStart(8, '****'),
                (r.vendor_ifsc_code || '').toUpperCase(),
                `₹${amount.toLocaleString()}`,
                paymentType
            ];
        });

        return {
            headers,
            rows,
            summary: {
                totalAmount,
                neftCount,
                rtgsCount
            }
        };
    }
}

export default KotakExportService;
