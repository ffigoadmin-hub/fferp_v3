import { jsPDF } from 'jspdf';

export interface PayslipData {
  employee_name: string;
  employee_id: string;
  department: string;
  designation?: string;
  month: number;
  year: number;
  days_in_month: number;
  selected_days: number;
  lop_days: number;
  basic_salary: number;
  incentive: number;
  increment: number;
  tds: number;
  lop_amount: number;
  net_pay: number;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Clean currency format
function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('en-IN').format(amount);
  return 'Rs. ' + formatted;
}

// Number to words
function convertToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function convertLessThanOneThousand(n: number): string {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const remainder = n % 10;
      return tens[ten] + (remainder ? ' ' + ones[remainder] : '');
    }
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    return ones[hundred] + ' Hundred' + (remainder ? ' and ' + convertLessThanOneThousand(remainder) : '');
  }
  
  function convertNumber(n: number): string {
    if (n === 0) return 'Zero';
    
    const crores = Math.floor(n / 10000000);
    const lakhs = Math.floor((n % 10000000) / 100000);
    const thousands = Math.floor((n % 100000) / 1000);
    const remainder = n % 1000;
    
    let result = '';
    
    if (crores > 0) result += convertLessThanOneThousand(crores) + ' Crore ';
    if (lakhs > 0) result += convertLessThanOneThousand(lakhs) + ' Lakh ';
    if (thousands > 0) result += convertLessThanOneThousand(thousands) + ' Thousand ';
    if (remainder > 0) result += convertLessThanOneThousand(remainder);
    
    return result.trim();
  }
  
  return 'Rupees ' + convertNumber(Math.floor(amount)) + ' Only';
}

export function generatePayslipPDF(payslip: PayslipData): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  
  // === TITLE ===
  doc.setFontSize(16);
  doc.setTextColor(33, 37, 41);
  doc.setFont('helvetica', 'bold');
  doc.text('Salary Slip For The Month of', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setTextColor(76, 175, 80);
  doc.text(MONTHS[payslip.month - 1], pageWidth / 2, 28, { align: 'center' });
  
  // === EMPLOYEE DETAILS ===
  let currentY = 40;
  
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2);
  
  currentY += 8;
  
  // Employee details - 2 column layout
  const col1LabelX = margin;
  const col1ValueX = margin + 45;
  const col2LabelX = margin + 95;
  const col2ValueX = margin + 135;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Row 1
  doc.setTextColor(100, 100, 100);
  doc.text('Employee ID:', col1LabelX, currentY);
  doc.setTextColor(0, 0, 0);
  doc.text(payslip.employee_id, col1ValueX, currentY);
  
  doc.setTextColor(100, 100, 100);
  doc.text('Name:', col2LabelX, currentY);
  doc.setTextColor(0, 0, 0);
  doc.text(payslip.employee_name, col2ValueX, currentY);
  currentY += 7;
  
  // Row 2
  doc.setTextColor(100, 100, 100);
  doc.text('Designation:', col1LabelX, currentY);
  doc.setTextColor(0, 0, 0);
  doc.text(payslip.designation || 'N/A', col1ValueX, currentY);
  
  doc.setTextColor(100, 100, 100);
  doc.text('Department:', col2LabelX, currentY);
  doc.setTextColor(0, 0, 0);
  doc.text(payslip.department || 'N/A', col2ValueX, currentY);
  currentY += 7;
  
  // Row 3
  doc.setTextColor(100, 100, 100);
  doc.text('Pay Period:', col1LabelX, currentY);
  doc.setTextColor(0, 0, 0);
  doc.text(`${MONTHS[payslip.month - 1]} ${payslip.year}`, col1ValueX, currentY);
  
  const paidDays = payslip.selected_days - payslip.lop_days;
  doc.setTextColor(100, 100, 100);
  doc.text('Paid Days:', col2LabelX, currentY);
  doc.setTextColor(0, 0, 0);
  doc.text(`${paidDays}/${payslip.days_in_month}`, col2ValueX, currentY);
  
  currentY += 10;
  doc.line(margin, currentY, pageWidth - margin, currentY);
  
  // === SALARY BREAKDOWN ===
  currentY += 12;
  
  const colWidth = (contentWidth - 15) / 2;
  
  // Left column - Earnings
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text('Basic Salary:', margin, currentY);
  doc.setTextColor(0, 0, 0);
  doc.text(formatCurrency(payslip.basic_salary), margin + colWidth - 5, currentY, { align: 'right' });
  currentY += 8;
  
  // Right column header
  doc.setTextColor(100, 100, 100);
  doc.text('Allowance:', margin + colWidth + 15, currentY - 8);
  doc.setTextColor(0, 0, 0);
  doc.text(formatCurrency(payslip.incentive + payslip.increment), margin + colWidth * 2 + 10, currentY - 8, { align: 'right' });
  
  doc.setTextColor(100, 100, 100);
  doc.text('Deduction:', margin + colWidth + 15, currentY);
  doc.setTextColor(200, 50, 50);
  doc.text(formatCurrency(payslip.tds + payslip.lop_amount), margin + colWidth * 2 + 10, currentY, { align: 'right' });
  
  currentY += 15;
  doc.line(margin, currentY - 5, pageWidth - margin, currentY - 5);
  
  // Net Salary
  currentY += 10;
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text('Net Salary Amount:', margin, currentY);
  doc.setTextColor(0, 100, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(payslip.net_pay), margin + 50, currentY);
  
  // Amount in words
  currentY += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Amount in Words:', margin, currentY);
  doc.setTextColor(0, 0, 0);
  const words = convertToWords(payslip.net_pay);
  const wordsDisplay = words.length > 70 ? words.substring(0, 67) + '...' : words;
  doc.text(wordsDisplay, margin + 40, currentY);
  
  currentY += 15;
  doc.line(margin, currentY, pageWidth - margin, currentY);
  
  // === FOOTER ===
  currentY += 20;
  
  const halfWidth = contentWidth / 2;
  
  // Prepared By
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text('Prepared By:', margin, currentY);
  doc.line(margin, currentY + 5, margin + 40, currentY + 5);
  
  // Approved By
  doc.text('Approved By:', margin + halfWidth + 20, currentY);
  doc.line(margin + halfWidth + 20, currentY + 5, margin + halfWidth + 60, currentY + 5);
  
  // Company footer
  currentY += 20;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('IGO Agri Techfarms Pvt Ltd | www.igotechfarms.com', pageWidth / 2, currentY, { align: 'center' });
  doc.text('This is a computer-generated payslip.', pageWidth / 2, currentY + 5, { align: 'center' });
  
  return doc;
}

export function downloadPayslipPDF(payslip: PayslipData): void {
  const doc = generatePayslipPDF(payslip);
  const fileName = `Payslip_${payslip.employee_name.replace(/\s+/g, '_')}_${MONTHS[payslip.month - 1]}_${payslip.year}.pdf`;
  doc.save(fileName);
}
