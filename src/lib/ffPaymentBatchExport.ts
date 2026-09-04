// ─────────────────────────────────────────────────────────────
//  Accounts Execution Desk — Kotak bulk-file export & bank
//  statement UTR matching for FF vendor payments.
//
//  Adapted from the sibling IGO Group ERP's src/lib/kotakBankExport.ts
//  (same Kotak CMS bulk-transfer format), reshaped for
//  ff_vendor_payments + its joined vendor bank details. The debit
//  account number is NOT hardcoded here — that file's constant was
//  IGO Group's own Kotak account, not this company's, and getting a
//  debit account wrong on a real bank file is not something to guess;
//  it's collected as a form field at batch-creation time instead.
// ─────────────────────────────────────────────────────────────

import { format } from 'date-fns';

export interface BatchPaymentForExport {
  id: string;
  amount: number;              // net amount to pay
  vendor_name: string;
  vendor_account_number?: string;
  vendor_ifsc_code?: string;
}

export interface BankStatementRow {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  utr?: string;
  accountNumber?: string;
}

export interface MatchResult {
  paymentId: string;
  vendorName: string;
  amount: number;
  matchedUTR: string | null;
  matchedDate: string | null;
  status: 'matched' | 'partial' | 'unmatched';
  confidence: number;
  matchReason?: string;
}

// ── Generate the Kotak CMS bulk-transfer .txt file ─────────────
// IGONET~RPAY~MODE~~DATE~~DEBIT_ACCT~AMOUNT~M~~BENEFICIARY~~IFSC~ACCT~(36 trailing ~)
export function generateFFKotakBulkFile(
  payments: BatchPaymentForExport[],
  batchRef: string,
  debitAccountNumber: string,
) {
  const today = format(new Date(), 'dd/MM/yyyy');
  const trailingTildes = '~'.repeat(36);

  const lines = payments.map(row => {
    const ifsc = (row.vendor_ifsc_code || '').toUpperCase().trim();
    // IFT = Internal Fund Transfer (Kotak-to-Kotak), NEFT = external bank
    const paymentMode = ifsc.startsWith('KKBK') ? 'IFT' : 'NEFT';
    const beneficiary = (row.vendor_name || '').toUpperCase();
    const amount = Math.round(Number(row.amount));
    const account = (row.vendor_account_number || '').trim();

    return [
      'IGONET', 'RPAY', paymentMode, '', today, '',
      debitAccountNumber, String(amount), 'M', '',
      beneficiary, '', ifsc, account,
    ].join('~') + trailingTildes;
  });

  const fileContent = lines.join('\n');
  const safeFilename = batchRef.replace(/\s+/g, '');
  const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${safeFilename}.txt`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Parse the bank's returned statement (xls/csv) ──────────────
export function parseFFBankStatement(file: File): Promise<BankStatementRow[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const findValue = (row: any, patterns: string[]) => {
            for (const pattern of patterns) {
              const key = Object.keys(row).find(k =>
                k.toLowerCase().replace(/[^a-z]/g, '').includes(pattern.toLowerCase().replace(/[^a-z]/g, ''))
              );
              if (key) return row[key];
            }
            return null;
          };

          const rows: BankStatementRow[] = (jsonData as any[]).map((row) => {
            const rawDesc = findValue(row, ['description', 'narration', 'particulars', 'remarks', 'details']) || '';
            return {
              date: formatTxnDate(findValue(row, ['date', 'txn date', 'value date', 'transaction date']) || ''),
              description: String(rawDesc),
              debit: Math.abs(Number(findValue(row, ['debit', 'withdrawal', 'dr', 'out', 'payment']) || 0)),
              credit: Math.abs(Number(findValue(row, ['credit', 'deposit', 'cr', 'in', 'receipt']) || 0)),
              balance: Number(findValue(row, ['balance', 'closing balance', 'total']) || 0),
              utr: extractUTR(String(rawDesc)),
              accountNumber: findValue(row, ['account', 'acc no', 'beneficiary account', 'to account']) || undefined,
            };
          });

          resolve(rows.filter(r => r.debit > 0 || r.credit > 0));
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    } catch (error) {
      reject(error);
    }
  });
}

function formatTxnDate(rawDate: any): string {
  if (!rawDate) return '';
  if (rawDate instanceof Date) return format(rawDate, 'dd/MM/yyyy');
  const d = new Date(rawDate);
  if (!isNaN(d.getTime())) return format(d, 'dd/MM/yyyy');
  return String(rawDate);
}

function extractUTR(narration: string): string | undefined {
  if (!narration) return undefined;
  const patterns = [
    /\b([A-Z]{4}[0-9A-Z]{16})\b/i,
    /\bUTR[:\s]*([A-Z0-9]{12,22})\b/i,
    /\b([0-9]{12})\b/,
    /\b(N[0-9]{12,})\b/i,
    /\b(R[0-9]{12,})\b/i,
    /\b(CMS[0-9]{9,})\b/i,
    /\b([A-Z0-9]{10,22})\b/,
  ];
  for (const pattern of patterns) {
    const match = narration.match(pattern);
    if (match) {
      const val = match[1].toUpperCase();
      if (val.length >= 8 && !/^[0]+$/.test(val)) return val;
    }
  }
  const tokens = narration.split(/[\s,.\-:\/]+/);
  const ignore = ['TRANSFER', 'WITHDRAWAL', 'DEPOSIT', 'PAYMENT', 'ONLINE', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'INB', 'MB', 'MMT', 'REF', 'NO'];
  for (const token of tokens) {
    const t = token.toUpperCase();
    if (ignore.includes(t)) continue;
    if (token.length > 5 && /[A-Z]/.test(t) && /[0-9]/.test(token)) return t;
    if (token.length > 7 && /^\d+$/.test(token)) return token;
  }
  return undefined;
}

// ── Match batch payments against the uploaded statement ────────
export function matchFFPayments(
  payments: BatchPaymentForExport[],
  statementRows: BankStatementRow[],
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const payment of payments) {
    const matches: { row: BankStatementRow; confidence: number; reason: string }[] = [];

    for (const row of statementRows) {
      if (row.debit <= 0) continue;
      let confidence = 0;
      let matchReason = '';

      const amtDiff = Math.abs(row.debit - payment.amount);
      if (amtDiff < 0.01) { confidence += 60; matchReason += 'Exact amount matched. '; }
      else if (amtDiff / payment.amount < 0.001) { confidence += 40; matchReason += 'Amount matched (minor rounding). '; }

      if (payment.vendor_account_number) {
        const cleanAcc = payment.vendor_account_number.trim().replace(/^0+/, '');
        const normalizedNarration = row.description.replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '');
        const normalizedRowAcc = (row.accountNumber || '').replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '');
        if (normalizedNarration.includes(cleanAcc) || normalizedRowAcc.includes(cleanAcc)) {
          confidence += 40; matchReason += 'Bank account number matched. ';
        }
      }

      let vendorName = (payment.vendor_name || '').toLowerCase().trim();
      const noise = [/m\/s\s+/g, /mr\.\s+/g, /mrs\.\s+/g, /pvt\s+/g, /ltd\s+/g, /private\s+limited/g];
      noise.forEach(n => vendorName = vendorName.replace(n, ''));
      vendorName = vendorName.trim();

      const description = row.description.toLowerCase();
      const ignoreWords = ['private', 'limited', 'pvt', 'ltd', 'and', 'inc', 'co', 'the'];
      const nameParts = vendorName.split(/[\s,.-]+/).filter(p => p.length > 2 && !ignoreWords.includes(p));

      let matchedParts = 0;
      for (const part of nameParts) {
        const partRegex = new RegExp(`\\b${part}\\b`, 'i');
        if (partRegex.test(description)) matchedParts++;
      }
      if (nameParts.length > 0) {
        const matchRatio = matchedParts / nameParts.length;
        if (matchRatio === 1) { confidence += 30; matchReason += 'Full name matched. '; }
        else if (matchRatio >= 0.5) { confidence += 20; matchReason += `Partial name match (${matchedParts}/${nameParts.length} words). `; }
      }

      if (confidence > 0) matches.push({ row, confidence, reason: matchReason.trim() });
    }

    matches.sort((a, b) => b.confidence - a.confidence);
    const bestMatch = matches[0];

    results.push({
      paymentId: payment.id,
      vendorName: payment.vendor_name,
      amount: payment.amount,
      matchedUTR: bestMatch?.row.utr || null,
      matchedDate: bestMatch?.row.date || null,
      status: bestMatch && bestMatch.confidence > 50 ? 'matched'
        : bestMatch && bestMatch.confidence >= 30 ? 'partial'
        : 'unmatched',
      confidence: Math.min(100, bestMatch?.confidence || 0),
      matchReason: bestMatch?.reason || 'No potential match found in statement.',
    });
  }

  return results;
}
