import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import * as pdfjs from 'pdfjs-dist';
// Import worker from the dist folder directly for Vite compatibility
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface BankStatementRow {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  utr?: string;
  accountNumber?: string;
}

export interface PaymentForExport {
  id: string;
  amount: number;
  beneficiary_name?: string;
  vendor_name: string;
  vendor_account_number?: string;
  vendor_ifsc_code?: string;
  date?: string;
}

export interface MatchResult {
  paymentId: string;
  vendorName: string;
  amount: number;
  matchedUTR: string | null;
  matchedDate: string | null;
  status: 'matched' | 'partial' | 'unmatched';
  confidence: number;
  requiresManualReview?: boolean;
  matchReason?: string;
}

export function parseStatementFile(file: File): Promise<BankStatementRow[]> {
  // Use PDF parser if file is PDF
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return parsePDFStatement(file);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Normalize column names and extract data
        const rows: BankStatementRow[] = jsonData.map((row: any) => {
          // Try to find common column patterns
          const findValue = (patterns: string[]) => {
            for (const pattern of patterns) {
              const key = Object.keys(row).find(k =>
                k.toLowerCase().replace(/[^a-z]/g, '').includes(pattern.toLowerCase().replace(/[^a-z]/g, ''))
              );
              if (key) return row[key];
            }
            return null;
          };

          const rawDesc = findValue(['description', 'narration', 'particulars', 'remarks', 'details']) || '';

          return {
            date: formatTxnDate(findValue(['date', 'txn date', 'value date', 'transaction date', 'sl date']) || ''),
            description: String(rawDesc),
            debit: Math.abs(Number(findValue(['debit', 'withdrawal', 'dr', 'out', 'payment']) || 0)),
            credit: Math.abs(Number(findValue(['credit', 'deposit', 'cr', 'in', 'receipt']) || 0)),
            balance: Number(findValue(['balance', 'closing balance', 'total']) || 0),
            utr: extractUTR(String(rawDesc)),
            accountNumber: findValue(['account', 'acc no', 'beneficiary account', 'to account']) || undefined
          };
        });

        // Filter out empty rows (where both debit and credit are 0)
        resolve(rows.filter(r => r.debit > 0 || r.credit > 0));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function formatTxnDate(rawDate: any): string {
  if (!rawDate) return '';
  if (rawDate instanceof Date) return format(rawDate, 'dd/MM/yyyy');
  const d = new Date(rawDate);
  if (!isNaN(d.getTime())) return format(d, 'dd/MM/yyyy');
  return String(rawDate);
}

// Improved UTR extraction with more patterns and validation
function extractUTR(narration: string): string | undefined {
  if (!narration) return undefined;

  // Common UTR patterns for Indian Banks (NEFT, RTGS, IMPS, UPI, CMS)
  const patterns = [
    /\b([A-Z]{4}[0-9A-Z]{16})\b/i,           // NEFT/RTGS: e.g., KKBK22045...
    /\bUTR[:\s]*([A-Z0-9]{12,22})\b/i,      // Ref with UTR prefix
    /\b([0-9]{12})\b/,                       // UPI Ref (12 digits)
    /\b(N[0-9]{12,})\b/i,                   // NEFT specific prefix
    /\b(R[0-9]{12,})\b/i,                   // RTGS specific prefix
    /\b(CMS[0-9]{9,})\b/i,                  // CMS specific prefix
    /\b([A-Z0-9]{10,22})\b/                 // Generic alphanumeric ref
  ];

  for (const pattern of patterns) {
    const match = narration.match(pattern);
    if (match) {
      const val = match[1].toUpperCase();
      // Basic sanity check: reject if too short or just zeros
      if (val.length >= 8 && !/^[0]+$/.test(val)) {
        return val;
      }
    }
  }

  // Fallback: Just grab the longest alphanumeric token > 5 chars (usually Ref No)
  const tokens = narration.split(/[\s,.\-:\/]+/);
  // Filter out common banking words
  const ignore = ['TRANSFER', 'WITHDRAWAL', 'DEPOSIT', 'PAYMENT', 'ONLINE', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'INB', 'MB', 'MMT', 'REF', 'NO'];

  for (const token of tokens) {
    const tSync = token.toUpperCase();
    if (ignore.includes(tSync)) continue;

    // Mixed alphanumeric (e.g. S382910)
    if (token.length > 5 && /[A-Z]/.test(tSync) && /[0-9]/.test(token)) {
      return tSync;
    }
    // Pure numeric but long enough to be a Ref (e.g. 88392019)
    if (token.length > 7 && /^\d+$/.test(token)) {
      return token;
    }
  }

  return undefined;
}

// Match payments with bank statement
export function matchPaymentsWithStatement(
  payments: PaymentForExport[],
  statementRows: BankStatementRow[]
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const payment of payments) {
    let matches: { row: BankStatementRow; confidence: number; reason: string }[] = [];

    for (const row of statementRows) {
      // Only consider debit transactions (money going out)
      if (row.debit <= 0) continue;

      let confidence = 0;
      let matchReason = "";

      // 1. Amount match (Primary signal)
      const amtDiff = Math.abs(row.debit - payment.amount);
      if (amtDiff < 0.01) {
        confidence += 60;
        matchReason += "Exact amount matched. ";
      } else if (amtDiff / payment.amount < 0.001) {
        confidence += 40;
        matchReason += "Amount matched (minor rounding). ";
      }

      // 2. Account number match (Strong secondary signal)
      if (payment.vendor_account_number) {
        const cleanAcc = payment.vendor_account_number.trim().replace(/^0+/, '');
        const normalizedNarration = row.description.replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '');
        const normalizedRowAcc = (row.accountNumber || '').replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '');

        if (normalizedNarration.includes(cleanAcc) || normalizedRowAcc.includes(cleanAcc)) {
          confidence += 40; // Increased from 35
          matchReason += "Bank account number matched. ";
        }
      }

      // 3. Name match (Fuzzy)
      let vendorName = (payment.beneficiary_name || payment.vendor_name || '').toLowerCase().trim();

      // Remove common prefixes/suffixes for better matching
      const noise = [/m\/s\s+/g, /mr\.\s+/g, /mrs\.\s+/g, /pvt\s+/g, /ltd\s+/g, /private\s+limited/g];
      noise.forEach(n => vendorName = vendorName.replace(n, ''));
      vendorName = vendorName.trim();

      const description = row.description.toLowerCase();

      // Split name into parts, ignore common words
      const ignoreWords = ['private', 'limited', 'pvt', 'ltd', 'and', 'inc', 'co', 'the'];
      const nameParts = vendorName.split(/[\s,.-]+/).filter(p =>
        p.length > 2 && !ignoreWords.includes(p)
      );

      let matchedParts = 0;
      for (const part of nameParts) {
        // Use regex for word boundaries to avoid matching parts of other words
        const partRegex = new RegExp(`\\b${part}\\b`, 'i');
        if (partRegex.test(description)) {
          matchedParts++;
        }
      }

      if (nameParts.length > 0) {
        const matchRatio = matchedParts / nameParts.length;
        if (matchRatio === 1) {
          confidence += 30; // Increased from 25
          matchReason += "Full name matched. ";
        } else if (matchRatio >= 0.5) {
          confidence += 20; // Increased from 15
          matchReason += `Partial name match (${matchedParts}/${nameParts.length} words). `;
        }
      }

      // 4. Exact account match in description (very strong)
      if (payment.vendor_account_number && description.includes(payment.vendor_account_number.trim())) {
        confidence += 40;
        matchReason += "Exact account number found in narration. ";
      }

      if (confidence > 0) {
        // 5. Date proximity match (Bonus confidence)
        if (payment.date && row.date) {
          try {
            const pDate = new Date(payment.date);
            const rParts = row.date.split(/[-\/.]/);
            const rDate = new Date(Number(rParts[2]), Number(rParts[1]) - 1, Number(rParts[0]));

            if (!isNaN(pDate.getTime()) && !isNaN(rDate.getTime())) {
              const diffDays = Math.abs(pDate.getTime() - rDate.getTime()) / (1000 * 60 * 60 * 24);
              if (diffDays <= 2) {
                confidence += 20;
                matchReason += "Date proximity matched (0-2 days). ";
              } else if (diffDays <= 5) {
                confidence += 10;
                matchReason += "Date proximity partial match (3-5 days). ";
              }
            }
          } catch (e) {
            // Ignore date parsing errors
          }
        }
        matches.push({ row, confidence, reason: matchReason.trim() });
      }
    }

    // Sort matches by confidence
    matches.sort((a, b) => b.confidence - a.confidence);
    const bestMatch = matches[0];

    // Status logic:
    // 50+ = Matched (usually Amount + Partial Name or Amount + Account)
    // 40+ = Partial (usually just Amount)
    // < 40 = Unmatched

    results.push({
      paymentId: payment.id,
      vendorName: payment.beneficiary_name || payment.vendor_name,
      amount: payment.amount,
      matchedUTR: bestMatch?.row.utr || null,
      matchedDate: bestMatch?.row.date || null,
      status: bestMatch && bestMatch.confidence > 50 ? 'matched'
        : bestMatch && bestMatch.confidence >= 30 ? 'partial'
          : 'unmatched',
      confidence: Math.min(100, bestMatch?.confidence || 0),
      requiresManualReview: bestMatch && bestMatch.confidence >= 30 && bestMatch.confidence <= 50,
      matchReason: bestMatch?.reason || "No potential matches found in statement."
    });
  }

  return results;
}

// Improved PDF parsing using pdfjs-dist
async function parsePDFStatement(file: File): Promise<BankStatementRow[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // Join items with spaces, preserving some awareness of positioning
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 5);
    const rows: BankStatementRow[] = [];

    // Regex patterns for different statement structures
    const patterns = [
      // Format 1: Date | Description | [Ref] | Withdrawal | Deposit | Balance
      // Handles 5 or 6 columns. Capture 1: Date, Capture 2: Description + optional Ref, 
      // Capture 3-5: Amounts/Balances
      /(\d{2}[-\/.]\d{2}[-\/.]\d{2,4})\s+(.*?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/,
      // Format 2: Date | Description | Ref | Withdrawal | Deposit | Balance (Explicit Ref)
      /(\d{2}[-\/.]\d{2}[-\/.]\d{2,4})\s+(.*?)\s+(\w{5,})\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/,
      // Format 3: Minimal (Date Description Amount)
      /(\d{2}[-\/.]\d{2}[-\/.]\d{2,4})\s+(.*?)\s+([\d,]+\.\d{2})/
    ];

    for (const line of lines) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const isVariant = match.length === 7;
          const date = match[1];
          const desc = match[2];
          const amt1 = isVariant ? match[4] : match[3];
          const amt2 = isVariant ? match[5] : match[4];
          const bal = isVariant ? match[6] : match[5];
          const ref = isVariant ? match[3] : undefined;

          const parseNum = (s: string) => Number(s.replace(/,/g, ''));
          const debit = parseNum(amt1);
          const credit = parseNum(amt2);

          if (debit > 0 || credit > 0) {
            rows.push({
              date,
              description: desc.trim(),
              debit,
              credit,
              balance: parseNum(bal),
              utr: extractUTR(desc) || (ref && ref.length > 8 ? ref : undefined)
            });
            break;
          }
        }
      }
    }

    if (rows.length === 0) {
      console.warn("Table regex failed, trying keyword-based search...");
      // Fallback: Look for anything that looks like a date followed by an amount (with or without decimals)
      const fallbackPattern = /(\d{2}[-\/.]\d{2}[-\/.]\d{2,4}).*?([\d,]+\.\d{0,2})/g;
      let match;
      while ((match = fallbackPattern.exec(fullText)) !== null) {
        const [fullMatch, date, amountStr] = match;
        const amount = Number(amountStr.replace(/,/g, ''));
        if (amount <= 0) continue;

        // Context-based description extraction (grab text between date and amount)
        const startIdx = fullText.indexOf(fullMatch);
        const context = fullText.substring(startIdx, startIdx + 200);

        rows.push({
          date: date,
          description: context,
          debit: amount,
          credit: 0,
          balance: 0,
          utr: extractUTR(context)
        });
      }
    }

    // Secondary fallback: Extract all potential UTRs and try to find nearby amounts
    if (rows.length === 0) {
      const utrs = fullText.match(/[A-Z]{4}[0-9]{12,}|[0-9]{12,22}/g) || [];
      const amts = fullText.match(/[\d,]+\.\d{2}/g) || [];
      // This is very rough but better than nothing
      utrs.forEach((u, i) => {
        if (amts[i]) {
          rows.push({
            date: "Unknown",
            description: `Extracted Ref: ${u}`,
            debit: Number(amts[i].replace(/,/g, '')),
            credit: 0,
            balance: 0,
            utr: u
          });
        }
      });
    }

    return rows;
  } catch (error) {
    console.error("PDF Parsing Error:", error);
    throw new Error("Failed to parse PDF statement. Please try converting it to Excel/CSV if possible.");
  }
}

// Kotak CMS Debit Account Number (company's own Kotak account)
const KOTAK_DEBIT_ACCOUNT = '5949192052';

// Generate Kotak Bulk TXT File (tilde-delimited format for Kotak CMS)
export function generateKotakBulkFile(payments: any[], batchRef: string) {
  const today = format(new Date(), 'dd/MM/yyyy');
  // Kotak CMS format has many trailing empty fields (~36)
  const trailingTildes = '~'.repeat(36);

  const exportRows: any[] = [];

  // Flatten payments to include splits as separate rows
  payments.forEach(p => {
    if (p.is_split_payment && p.splits && p.splits.length > 0) {
      p.splits.forEach((s: any) => {
        exportRows.push({
          vendor_ifsc_code: s.ifsc_code,
          beneficiary_name: s.beneficiary_name || s.payee_name,
          amount: s.amount,
          vendor_account_number: s.account_number,
          upi_id: s.upi_id,
          payment_method: s.payment_method,
          narration: `${p.payment_number || 'BATCH'} - ${s.split_title}`
        });
      });
    } else {
      exportRows.push({
        vendor_ifsc_code: p.vendor_ifsc_code,
        beneficiary_name: p.beneficiary_name || p.vendor_name,
        amount: p.amount,
        vendor_account_number: p.vendor_account_number,
        upi_id: p.vendor_upi,
        payment_method: p.payment_type,
        narration: `${p.payment_number || p.id.slice(0, 8)} - ${p.purpose}`
      });
    }
  });

  const lines = exportRows.map(row => {
    const ifsc = (row.vendor_ifsc_code || '').toUpperCase().trim();
    const upiId = (row.upi_id || '').trim();
    const isUPI = row.payment_method === 'upi' || !!upiId;
    
    // IFT = Internal Fund Transfer (Kotak-to-Kotak), NEFT = external, UPI = UPI
    const paymentMode = isUPI ? 'UPI' : (ifsc.startsWith('KKBK') ? 'IFT' : 'NEFT');
    const beneficiary = (row.beneficiary_name || '').toUpperCase();
    const amount = Math.round(Number(row.amount));
    const account = isUPI ? upiId : (row.vendor_account_number || '').trim();
    const finalIfsc = isUPI ? '' : ifsc;

    // IGONET~RPAY~MODE~~DATE~~DEBIT_ACCT~AMOUNT~M~~BENEFICIARY~~IFSC~ACCT~(trailing)
    return [
      'IGONET',
      'RPAY',
      paymentMode,
      '',
      today,
      '',
      KOTAK_DEBIT_ACCOUNT,
      String(amount),
      'M',
      '',
      beneficiary,
      '',
      finalIfsc,
      account
    ].join('~') + trailingTildes;
  });

  const fileContent = lines.join('\n');

  // Download as .txt
  const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${batchRef}.txt`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Generate Kotak Bulk File for Salary Batches (employee payments)
export interface SalaryEmployeeForExport {
  employee_name: string;
  net_pay: number;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
}

export function generateSalaryKotakFile(employees: SalaryEmployeeForExport[], batchCode: string) {
  const today = format(new Date(), 'dd/MM/yyyy');
  // Kotak CMS format has many trailing empty fields (~36)
  const trailingTildes = '~'.repeat(36);

  const lines = employees.map(row => {
    const ifsc = (row.ifsc_code || '').toUpperCase().trim();
    const paymentMode = ifsc.startsWith('KKBK') ? 'IFT' : 'NEFT';
    const beneficiary = (row.employee_name || '').toUpperCase();
    const amount = Math.round(Number(row.net_pay) || 0);
    const account = (row.account_number || '').trim();

    // IGONET~RPAY~MODE~~DATE~~DEBIT_ACCT~AMOUNT~M~~BENEFICIARY~~IFSC~ACCT~(trailing)
    return [
      'IGONET',
      'RPAY',
      paymentMode,
      '',
      today,
      '',
      KOTAK_DEBIT_ACCOUNT,
      String(amount),
      'M',
      '',
      beneficiary,
      '',
      ifsc,
      account
    ].join('~') + trailingTildes;
  });

  const fileContent = lines.join('\n');

  // Download as .txt
  const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `SALARY_${batchCode}_${format(new Date(), 'yyyyMMdd')}.txt`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportPettyCashSheet(payments: any[], date: Date, approvers: Record<string, string>) {
  const data = payments.map(p => ({
    'Date': format(new Date(p.created_at), 'dd-MM-yyyy'),
    'Requester': p.requester?.name || 'Unknown',
    'Purpose': p.purpose,
    'Vendor': p.vendor_name,
    'Amount': p.amount,
    'Payment Type': p.is_petty_cash ? 'Petty Cash' : 'Direct',
    'Status': p.status,
    'Approved By': p.admin_approved_by ? approvers[p.admin_approved_by] : 'System',
    'UTR': p.utr_number || 'N/A'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Petty Cash');
  XLSX.writeFile(workbook, `PettyCash_${format(date, 'yyyy-MM-dd')}.xlsx`);
}

// Generate Kotak Bulk Bank File for Rental Payments
export function generateRentalKotakBulkFile(rentalRecords: any[], batchRef: string) {
  const today = format(new Date(), 'dd/MM/yyyy');
  const trailingTildes = '~'.repeat(36);

  const exportRows: any[] = [];

  // Flatten rental records to include split payments as separate rows
  rentalRecords.forEach(record => {
    const property = record.rental_properties || {};
    const partners = property.partner_details || [];
    const totalAmount = record.net_payable_amount || 0;

    if (partners.length === 0) {
      // Single owner payment
      exportRows.push({
        vendor_ifsc_code: property.ifsc_code,
        beneficiary_name: property.holder_name || property.owner_name,
        amount: totalAmount,
        vendor_account_number: property.account_number,
        upi_id: null,
        payment_method: 'NEFT',
        narration: `RENT-${property.title}-${format(new Date(record.month_year), 'MMM-yyyy')}`
      });
    } else {
      // Split payment - add main owner
      const totalPartnerShare = partners.reduce((sum: number, p: any) => sum + (totalAmount * (Number(p.share_percent) || 0)) / 100, 0);
      const mainOwnerAmount = totalAmount - totalPartnerShare;

      exportRows.push({
        vendor_ifsc_code: property.ifsc_code,
        beneficiary_name: property.holder_name || property.owner_name,
        amount: mainOwnerAmount,
        vendor_account_number: property.account_number,
        upi_id: null,
        payment_method: 'NEFT',
        narration: `RENT-${property.title}-${format(new Date(record.month_year), 'MMM-yyyy')}-MAIN`
      });

      // Add partner payments
      partners.forEach((partner: any) => {
        const partnerAmount = (totalAmount * (Number(partner.share_percent) || 0)) / 100;
        exportRows.push({
          vendor_ifsc_code: partner.ifsc,
          beneficiary_name: partner.name,
          amount: partnerAmount,
          vendor_account_number: partner.account_number,
          upi_id: null,
          payment_method: 'NEFT',
          narration: `RENT-${property.title}-${format(new Date(record.month_year), 'MMM-yyyy')}-${partner.name}`
        });
      });
    }
  });

  const lines = exportRows.map(row => {
    const ifsc = (row.vendor_ifsc_code || '').toUpperCase().trim();
    const upiId = (row.upi_id || '').trim();
    const isUPI = row.payment_method === 'upi' || !!upiId;
    
    const paymentMode = isUPI ? 'UPI' : (ifsc.startsWith('KKBK') ? 'IFT' : 'NEFT');
    const beneficiary = (row.beneficiary_name || '').toUpperCase();
    const amount = Math.round(Number(row.amount));
    const account = isUPI ? upiId : (row.vendor_account_number || '').trim();
    const finalIfsc = isUPI ? '' : ifsc;

    return [
      'IGONET',
      'RPAY',
      paymentMode,
      '',
      today,
      '',
      KOTAK_DEBIT_ACCOUNT,
      String(amount),
      'M',
      '',
      beneficiary,
      '',
      finalIfsc,
      account
    ].join('~') + trailingTildes;
  });

  const fileContent = lines.join('\n');

  const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `RENTAL_${batchRef}.txt`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
