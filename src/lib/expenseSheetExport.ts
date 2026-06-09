import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface PaymentAuditEntry {
  role: string;
  action: string;
  by: string;
  at: string;
  remarks?: string;
}

interface ExpenseSheetPayment {
  id: string;
  payment_number?: number;
  created_at: string;
  purpose: string;
  vendor_name: string;
  amount: number;
  urgency: string;
  status: string;
  department?: string;
  is_petty_cash?: boolean;
  is_split_payment?: boolean;
  splits?: any[];

  // Requester
  requester?: { name: string; department?: string };

  // Bank Details
  beneficiary_name?: string | null;
  vendor_account_number?: string | null;
  vendor_ifsc_code?: string | null;
  bank_name?: string | null;

  // Proof URLs
  bill_url?: string;
  work_proof_url?: string;
  payment_proof_url?: string;
  payment_proof_screenshot?: string;

  // Approval Trail
  smo_approved_by?: string | null;
  smo_approved_at?: string | null;
  gmo_approved_by?: string | null;
  gmo_approved_at?: string | null;
  boi_approved_by?: string | null;
  boi_approved_at?: string | null;
  gm_approved_by?: string | null;
  gm_approved_at?: string | null;
  director_approved_by?: string | null;
  director_approved_at?: string | null;
  admin_approved_by?: string | null;
  admin_approved_at?: string | null;
  ceo_approved_by?: string | null;
  ceo_approved_at?: string | null;

  // Execution
  utr_number?: string | null;
  paid_at?: string | null;
  accounts_executed_by?: string | null;
  payment_type?: string | null;
  upi_id?: string | null;

  // Transport details
  is_transport_payment?: boolean;
  transport_trips?: any[];

  // Audit timeline (JSON)
  audit_timeline?: PaymentAuditEntry[];
}

interface ExpenseSheetRow {
  "S.No": number;
  "Payment #": string;
  "Date": string;
  "Raised By": string;
  "Department": string;
  "Purpose/Title": string;
  "Vendor Name": string;
  "Beneficiary Name": string;
  "Account Number": string;
  "IFSC Code": string;
  "Bank Name": string;
  "Amount (₹)": number;
  "Urgency": string;
  "Petty Cash": string;
  "Status": string;

  // Approval Trail
  "SMO Approved": string;
  "SMO Time": string;
  "GMO Approved": string;
  "GMO Time": string;
  "BOI Approved": string;
  "BOI Time": string;
  "GM Approved": string;
  "GM Time": string;
  "Director Approved": string;
  "Director Time": string;
  "Admin Approved": string;
  "Admin Time": string;
  "CEO Approved": string;
  "CEO Time": string;

  // Execution
  "UTR Number": string;
  "Paid At": string;
  "Executed By": string;

  // Proofs
  "Proof Folder": string;
  "Work Proof URL": string;
  "Payment Proof URL": string;
}

export function exportDailyExpenseSheet(
  payments: ExpenseSheetPayment[],
  dateRange: { start: Date; end: Date },
  approverNames: Record<string, string> // Map of user IDs to names
): void {
  const exportRows: any[] = [];

  payments.forEach((p) => {
    if (p.is_split_payment && p.splits && p.splits.length > 0) {
      p.splits.forEach((s) => {
        exportRows.push({
          "Payment #": `PAY-${String(p.payment_number || 0).padStart(6, '0')}`,
          "Date": format(new Date(p.created_at), 'dd/MM/yyyy'),
          "Raised By": p.requester?.name || 'N/A',
          "Department": p.department || p.requester?.department || 'Others',
          "Purpose/Title": s.split_title || p.purpose,
          "Vendor Name": s.payee_name,
          "Beneficiary Name": s.beneficiary_name || s.payee_name,
          "Account Number": (s.payment_method === 'bank_transfer' ? s.account_number : (s.upi_id || 'UPI')) || 'N/A',
          "IFSC Code": (s.payment_method === 'bank_transfer' ? s.ifsc_code : 'UPI') || 'N/A',
          "Bank Name": (s.payment_method === 'bank_transfer' ? s.bank_name : (s.payment_method || 'UPI')) || 'N/A',
          "Amount (₹)": Number(s.amount),
          "Urgency": p.urgency,
          "Petty Cash": p.is_petty_cash ? 'Yes' : 'No',
          "Status": p.status.replace(/_/g, ' ').toUpperCase(),

          // Approval Trail (Same for all splits)
          "SMO Approved": p.smo_approved_by ? (approverNames[p.smo_approved_by] || 'Yes') : '-',
          "SMO Time": p.smo_approved_at ? format(new Date(p.smo_approved_at), 'dd/MM HH:mm') : '-',
          "GMO Approved": p.gmo_approved_by ? (approverNames[p.gmo_approved_by] || 'Yes') : '-',
          "GMO Time": p.gmo_approved_at ? format(new Date(p.gmo_approved_at), 'dd/MM HH:mm') : '-',
          "BOI Approved": p.boi_approved_by ? (approverNames[p.boi_approved_by] || 'Yes') : '-',
          "BOI Time": p.boi_approved_at ? format(new Date(p.boi_approved_at), 'dd/MM HH:mm') : '-',
          "GM Approved": p.gm_approved_by ? (approverNames[p.gm_approved_by] || 'Yes') : '-',
          "GM Time": p.gm_approved_at ? format(new Date(p.gm_approved_at), 'dd/MM HH:mm') : '-',
          "Director Approved": p.director_approved_by ? (approverNames[p.director_approved_by] || 'Yes') : '-',
          "Director Time": p.director_approved_at ? format(new Date(p.director_approved_at), 'dd/MM HH:mm') : '-',
          "Admin Approved": p.admin_approved_by ? (approverNames[p.admin_approved_by] || 'Yes') : '-',
          "Admin Time": p.admin_approved_at ? format(new Date(p.admin_approved_at), 'dd/MM HH:mm') : '-',
          "CEO Approved": p.ceo_approved_by ? (approverNames[p.ceo_approved_by] || 'Yes') : '-',
          "CEO Time": p.ceo_approved_at ? format(new Date(p.ceo_approved_at), 'dd/MM HH:mm') : '-',

          // Execution (Per split)
          "UTR Number": s.utr_number || '-',
          "Paid At": s.paid_at ? format(new Date(s.paid_at), 'dd/MM/yyyy HH:mm') : (p.paid_at ? format(new Date(p.paid_at), 'dd/MM/yyyy HH:mm') : '-'),
          "Executed By": p.accounts_executed_by ? (approverNames[p.accounts_executed_by] || 'Accounts') : '-',

          // Proofs
          "Proof Folder": p.bill_url || '-',
          "Work Proof URL": p.work_proof_url || '-',
          "Payment Proof URL": s.payment_proof_url || p.payment_proof_url || p.payment_proof_screenshot || '-'
        });
      });
    } else if (p.is_transport_payment && p.transport_trips && p.transport_trips.length > 0) {
      p.transport_trips.forEach((t, idx) => {
        exportRows.push({
          "Payment #": `PAY-${String(p.payment_number || 0).padStart(6, '0')}`,
          "Date": format(new Date(t.date || p.created_at), 'dd/MM/yyyy'),
          "Raised By": p.requester?.name || 'N/A',
          "Department": p.department || p.requester?.department || 'Others',
          "Purpose/Title": `[Trip ${idx + 1}] ${t.from} -> ${t.to} (${t.purpose || p.purpose})`,
          "Vendor Name": t.vendor_name || p.vendor_name,
          "Beneficiary Name": t.beneficiary_name || p.beneficiary_name || t.vendor_name || p.vendor_name,
          "Account Number": t.account_number || p.vendor_account_number || (p.payment_type === 'upi' ? (p.upi_id || 'UPI') : 'N/A'),
          "IFSC Code": t.ifsc_code || p.vendor_ifsc_code || (p.payment_type === 'upi' ? 'UPI' : 'N/A'),
          "Bank Name": t.bank_name || p.bank_name || (p.payment_type === 'upi' ? 'UPI' : 'N/A'),
          "Amount (₹)": Number(t.amount),
          "Urgency": p.urgency,
          "Petty Cash": p.is_petty_cash ? 'Yes' : 'No',
          "Status": p.status.replace(/_/g, ' ').toUpperCase(),

          // Approval Trail
          "SMO Approved": p.smo_approved_by ? (approverNames[p.smo_approved_by] || 'Yes') : '-',
          "SMO Time": p.smo_approved_at ? format(new Date(p.smo_approved_at), 'dd/MM HH:mm') : '-',
          "GMO Approved": p.gmo_approved_by ? (approverNames[p.gmo_approved_by] || 'Yes') : '-',
          "GMO Time": p.gmo_approved_at ? format(new Date(p.gmo_approved_at), 'dd/MM HH:mm') : '-',
          "BOI Approved": p.boi_approved_by ? (approverNames[p.boi_approved_by] || 'Yes') : '-',
          "BOI Time": p.boi_approved_at ? format(new Date(p.boi_approved_at), 'dd/MM HH:mm') : '-',
          "GM Approved": p.gm_approved_by ? (approverNames[p.gm_approved_by] || 'Yes') : '-',
          "GM Time": p.gm_approved_at ? format(new Date(p.gm_approved_at), 'dd/MM HH:mm') : '-',
          "Director Approved": p.director_approved_by ? (approverNames[p.director_approved_by] || 'Yes') : '-',
          "Director Time": p.director_approved_at ? format(new Date(p.director_approved_at), 'dd/MM HH:mm') : '-',
          "Admin Approved": p.admin_approved_by ? (approverNames[p.admin_approved_by] || 'Yes') : '-',
          "Admin Time": p.admin_approved_at ? format(new Date(p.admin_approved_at), 'dd/MM HH:mm') : '-',
          "CEO Approved": p.ceo_approved_by ? (approverNames[p.ceo_approved_by] || 'Yes') : '-',
          "CEO Time": p.ceo_approved_at ? format(new Date(p.ceo_approved_at), 'dd/MM HH:mm') : '-',

          // Execution
          "UTR Number": p.utr_number || '-',
          "Paid At": p.paid_at ? format(new Date(p.paid_at), 'dd/MM/yyyy HH:mm') : '-',
          "Executed By": p.accounts_executed_by ? (approverNames[p.accounts_executed_by] || 'Accounts') : '-',

          // Proofs
          "Proof Folder": p.bill_url || '-',
          "Work Proof URL": p.work_proof_url || '-',
          "Payment Proof URL": p.payment_proof_url || p.payment_proof_screenshot || '-'
        });
      });
    } else {
      exportRows.push({
        "Payment #": `PAY-${String(p.payment_number || 0).padStart(6, '0')}`,
        "Date": format(new Date(p.created_at), 'dd/MM/yyyy'),
        "Raised By": p.requester?.name || 'N/A',
        "Department": p.department || p.requester?.department || 'Others',
        "Purpose/Title": p.purpose,
        "Vendor Name": p.vendor_name,
        "Beneficiary Name": p.beneficiary_name || p.vendor_name,
        "Account Number": p.vendor_account_number || (p.payment_type === 'upi' ? (p.upi_id || 'UPI') : 'N/A'),
        "IFSC Code": p.vendor_ifsc_code || (p.payment_type === 'upi' ? 'UPI' : 'N/A'),
        "Bank Name": p.bank_name || (p.payment_type === 'upi' ? 'UPI' : 'N/A'),
        "Amount (₹)": Number(p.amount),
        "Urgency": p.urgency,
        "Petty Cash": p.is_petty_cash ? 'Yes' : 'No',
        "Status": p.status.replace(/_/g, ' ').toUpperCase(),

        // Approval Trail
        "SMO Approved": p.smo_approved_by ? (approverNames[p.smo_approved_by] || 'Yes') : '-',
        "SMO Time": p.smo_approved_at ? format(new Date(p.smo_approved_at), 'dd/MM HH:mm') : '-',
        "GMO Approved": p.gmo_approved_by ? (approverNames[p.gmo_approved_by] || 'Yes') : '-',
        "GMO Time": p.gmo_approved_at ? format(new Date(p.gmo_approved_at), 'dd/MM HH:mm') : '-',
        "BOI Approved": p.boi_approved_by ? (approverNames[p.boi_approved_by] || 'Yes') : '-',
        "BOI Time": p.boi_approved_at ? format(new Date(p.boi_approved_at), 'dd/MM HH:mm') : '-',
        "GM Approved": p.gm_approved_by ? (approverNames[p.gm_approved_by] || 'Yes') : '-',
        "GM Time": p.gm_approved_at ? format(new Date(p.gm_approved_at), 'dd/MM HH:mm') : '-',
        "Director Approved": p.director_approved_by ? (approverNames[p.director_approved_by] || 'Yes') : '-',
        "Director Time": p.director_approved_at ? format(new Date(p.director_approved_at), 'dd/MM HH:mm') : '-',
        "Admin Approved": p.admin_approved_by ? (approverNames[p.admin_approved_by] || 'Yes') : '-',
        "Admin Time": p.admin_approved_at ? format(new Date(p.admin_approved_at), 'dd/MM HH:mm') : '-',
        "CEO Approved": p.ceo_approved_by ? (approverNames[p.ceo_approved_by] || 'Yes') : '-',
        "CEO Time": p.ceo_approved_at ? format(new Date(p.ceo_approved_at), 'dd/MM HH:mm') : '-',

        // Execution
        "UTR Number": p.utr_number || '-',
        "Paid At": p.paid_at ? format(new Date(p.paid_at), 'dd/MM/yyyy HH:mm') : '-',
        "Executed By": p.accounts_executed_by ? (approverNames[p.accounts_executed_by] || 'Accounts') : '-',

        // Proofs
        "Proof Folder": p.bill_url || '-',
        "Work Proof URL": p.work_proof_url || '-',
        "Payment Proof URL": p.payment_proof_url || p.payment_proof_screenshot || '-'
      });
    }
  });

  const finalRows: ExpenseSheetRow[] = exportRows.map((row, index) => ({
    "S.No": index + 1,
    ...row
  }));

  // Create workbook
  const worksheet = XLSX.utils.json_to_sheet(finalRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Expense Sheet');

  // Add summary sheet
  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const pettyCashTotal = payments
    .filter(p => p.is_petty_cash)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const summaryData = [
    { "Metric": "Report Period", "Value": `${format(dateRange.start, 'dd/MM/yyyy')} - ${format(dateRange.end, 'dd/MM/yyyy')}` },
    { "Metric": "Total Payments", "Value": payments.length },
    { "Metric": "Total Amount (₹)", "Value": totalAmount },
    { "Metric": "Petty Cash Amount (₹)", "Value": pettyCashTotal },
    { "Metric": "Regular Payments Amount (₹)", "Value": totalAmount - pettyCashTotal },
    { "Metric": "Generated On", "Value": format(new Date(), 'dd/MM/yyyy HH:mm:ss') }
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Set column widths
  worksheet['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 14 }, // Payment #
    { wch: 12 }, // Date
    { wch: 20 }, // Raised By
    { wch: 15 }, // Department
    { wch: 40 }, // Purpose
    { wch: 25 }, // Vendor Name
    { wch: 25 }, // Beneficiary
    { wch: 18 }, // Account
    { wch: 15 }, // IFSC
    { wch: 20 }, // Bank
    { wch: 12 }, // Amount
    { wch: 10 }, // Urgency
    { wch: 10 }, // Petty Cash
    { wch: 15 }, // Status
    // Approvals
    { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 12 },
    // Execution
    { wch: 25 }, { wch: 18 }, { wch: 15 },
    // Proofs
    { wch: 50 }, { wch: 50 }, { wch: 50 }
  ];

  const filename = `DailyExpenseSheet_${format(dateRange.start, 'yyyyMMdd')}_${format(dateRange.end, 'yyyyMMdd')}`;
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

// Export Petty Cash Sheet
export function exportPettyCashSheet(
  payments: ExpenseSheetPayment[],
  dateRange: { start: Date; end: Date },
  approverNames: Record<string, string>
): void {
  const pettyCashPayments = payments.filter(p => p.is_petty_cash);

  const rows = pettyCashPayments.map((p, index) => ({
    "S.No": index + 1,
    "Date": format(new Date(p.created_at), 'dd/MM/yyyy'),
    "Purpose": p.purpose,
    "Vendor/Payee": p.vendor_name,
    "Amount (₹)": Number(p.amount),
    "Department": p.department || 'Others',
    "Raised By": p.requester?.name || 'N/A',
    "Approved By": p.admin_approved_by ? (approverNames[p.admin_approved_by] || 'Admin') : '-',
    "UTR/Reference": p.utr_number || 'Cash',
    "Status": p.status.replace(/_/g, ' ').toUpperCase(),
    "Proof Folder": p.bill_url || '-',
    "Payment Proof URL": p.payment_proof_url || p.payment_proof_screenshot || '-'
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Petty Cash');

  // Summary
  const total = pettyCashPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const summaryData = [
    { "Metric": "Report Period", "Value": `${format(dateRange.start, 'dd/MM/yyyy')} - ${format(dateRange.end, 'dd/MM/yyyy')}` },
    { "Metric": "Total Entries", "Value": pettyCashPayments.length },
    { "Metric": "Total Amount (₹)", "Value": total },
    { "Metric": "Generated On", "Value": format(new Date(), 'dd/MM/yyyy HH:mm:ss') }
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  const filename = `PettyCash_${format(dateRange.start, 'yyyyMMdd')}_${format(dateRange.end, 'yyyyMMdd')}`;
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
