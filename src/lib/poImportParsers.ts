// ─────────────────────────────────────────────────────────────
//  PO Import parsers — PDF / CSV / XLSX
//  Parses the Zoho-style "Purchase Order" export (one PO per PDF
//  page, or one row-group per PO in CSV/XLSX) into a normalized
//  shape the Import dialog can review and edit before committing.
//  Never writes to the DB itself — always returns data for the
//  caller to show in a review screen first.
// ─────────────────────────────────────────────────────────────

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ParsedPOItem {
  name: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface ParsedPO {
  sourceRef: string;       // original PO number / row ref from the file, for traceability only
  hubRaw: string;
  vendorRaw: string;
  date: string;             // yyyy-MM-dd if parseable, else raw string
  items: ParsedPOItem[];
  parsedTotal: number;      // sum of item amounts
  declaredTotal: number | null; // "Total" line read from the file, if present — for a sanity check
}

const UNIT_WORDS = ['kg', 'pcs', 'box', 'ltr', 'litre', 'dozen', 'batch'];

export function toISODate(raw: string): string {
  const m = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return raw;
  let [, d, mo, y] = m;
  if (y.length === 2) y = `20${y}`;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function parseAmount(token: string): number {
  return parseFloat(token.replace(/,/g, '')) || 0;
}

// ── PDF ─────────────────────────────────────────────────────

export interface Line { y: number; text: string; x: number; }

export async function extractPageLines(page: any): Promise<Line[]> {
  const textContent = await page.getTextContent();
  const items: any[] = textContent.items;
  const groups: Record<string, { x: number; str: string }[]> = {};
  const tolerance = 4;

  for (const item of items) {
    const y = Math.round(item.transform[5]);
    const x = item.transform[4];
    const key = Object.keys(groups).find(k => Math.abs(parseInt(k, 10) - y) < tolerance) ?? String(y);
    (groups[key] ??= []).push({ x, str: item.str });
  }

  return Object.entries(groups)
    .map(([y, parts]) => {
      parts.sort((a, b) => a.x - b.x);
      return { y: parseInt(y, 10), x: parts[0]?.x ?? 0, text: parts.map(p => p.str).join(' ').replace(/\s+/g, ' ').trim() };
    })
    .filter(l => l.text)
    .sort((a, b) => b.y - a.y); // top of page first
}

export function parseItemRows(lines: Line[]): ParsedPOItem[] {
  const items: ParsedPOItem[] = [];
  let expectedIdx = 1;
  let current: { idx: number; text: string } | null = null;

  const flush = () => {
    if (!current) return;
    const body = current.text.replace(/^\d+\s*/, '');
    // Amount: the last well-formed "1,234.56" style number in the row.
    const amountMatch = [...body.matchAll(/(\d[\d,]*\.\d{2})/g)];
    // Qty: the first standalone number (with or without decimals) in the row.
    const qtyMatch = body.match(/(\d[\d,]*\.?\d*)/);
    if (amountMatch.length && qtyMatch) {
      const amount = parseAmount(amountMatch[amountMatch.length - 1][1]);
      const qty = parseAmount(qtyMatch[1]);
      const unitFound = UNIT_WORDS.find(u => new RegExp(`\\b${u}\\b`, 'i').test(body));
      // Name = everything before the qty number, trimmed of trailing item-code noise.
      const nameEnd = body.indexOf(qtyMatch[1]);
      let name = (nameEnd > 0 ? body.slice(0, nameEnd) : body).trim();
      name = name.replace(/^\d{4}-/, ''); // strip a leading "2023-" style catalog prefix
      if (name && qty > 0) {
        items.push({ name, qty, unit: unitFound ?? 'unit', rate: amount / qty, amount });
      }
    }
    current = null;
  };

  for (const line of lines) {
    const m = line.text.match(/^(\d{1,2})\s+(.*)/);
    if (m && parseInt(m[1], 10) === expectedIdx) {
      flush();
      current = { idx: expectedIdx, text: line.text };
      expectedIdx++;
    } else if (current && !/^(sub\s*total|total|authorized signature)/i.test(line.text)) {
      current.text += ' ' + line.text;
    } else if (/^(sub\s*total|total|authorized signature)/i.test(line.text)) {
      flush();
      break;
    }
  }
  flush();
  return items;
}

export async function parsePOsFromPDF(file: File): Promise<ParsedPO[]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
  const results: ParsedPO[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const lines = await extractPageLines(page);
    const fullText = lines.map(l => l.text).join('\n');

    const poMatch     = fullText.match(/#\s*(PO-?\S+)/i);
    const dateMatch    = fullText.match(/Date\s*:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    const hubMatch     = fullText.match(/(FF\s*-\s*[A-Z][A-Za-z]+)/);
    const vendorLine   = lines.find(l => /vendor address/i.test(l.text));
    const vendorIdx    = vendorLine ? lines.indexOf(vendorLine) : -1;
    const vendorMatch  = vendorIdx >= 0 ? lines[vendorIdx + 1]?.text : undefined;
    const subTotalMatch = fullText.match(/Sub\s*Total\s*([\d,]+\.\d{2})/i);
    const totalMatch    = fullText.match(/(?<!Sub )Total\s*₹?\s*([\d,]+\.\d{2})/i);

    const items = parseItemRows(lines);
    if (!items.length) continue; // skip pages that aren't a PO (e.g. blank/cover pages)

    results.push({
      sourceRef:     poMatch?.[1] ?? `page-${p}`,
      hubRaw:        hubMatch?.[1]?.replace(/\s+/g, ' ').trim() ?? '',
      vendorRaw:     vendorMatch ?? '',
      date:          dateMatch ? toISODate(dateMatch[1]) : new Date().toISOString().slice(0, 10),
      items,
      parsedTotal:   items.reduce((s, i) => s + i.amount, 0),
      declaredTotal: totalMatch ? parseAmount(totalMatch[1]) : (subTotalMatch ? parseAmount(subTotalMatch[1]) : null),
    });
  }
  return results;
}

// ── CSV / XLSX ──────────────────────────────────────────────
// Expected columns (case-insensitive, flexible naming):
//   PO Number / PO# | Vendor | Hub | Date | Item / Item & Description | Qty | Unit | Rate | Amount
// Rows sharing the same PO Number/ref are grouped into one PO.

function pick(row: Record<string, any>, ...keys: string[]): string {
  const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]));
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function rowsToPOs(rows: Record<string, any>[]): ParsedPO[] {
  const groups = new Map<string, Record<string, any>[]>();
  rows.forEach((r, i) => {
    const ref = pick(r, 'po number', 'po#', 'po', 'ref') || `row-${i}`;
    (groups.get(ref) ?? groups.set(ref, []).get(ref)!).push(r);
  });

  const results: ParsedPO[] = [];
  for (const [ref, group] of groups) {
    const first = group[0];
    const items: ParsedPOItem[] = group.map(r => {
      const qty = parseFloat(pick(r, 'qty', 'quantity')) || 0;
      const amountRaw = pick(r, 'amount', 'total');
      const rateRaw = pick(r, 'rate', 'price');
      const amount = amountRaw ? parseAmount(amountRaw) : (parseAmount(rateRaw) * qty);
      const rate = qty > 0 ? amount / qty : parseAmount(rateRaw);
      return {
        name: pick(r, 'item', 'item & description', 'item name', 'product'),
        qty, unit: pick(r, 'unit') || 'unit', rate, amount,
      };
    }).filter(i => i.name && i.qty > 0);

    if (!items.length) continue;
    results.push({
      sourceRef: ref,
      hubRaw: pick(first, 'hub'),
      vendorRaw: pick(first, 'vendor'),
      date: pick(first, 'date') ? toISODate(pick(first, 'date')) : new Date().toISOString().slice(0, 10),
      items,
      parsedTotal: items.reduce((s, i) => s + i.amount, 0),
      declaredTotal: null,
    });
  }
  return results;
}

export function parsePOsFromCSV(file: File): Promise<ParsedPO[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => resolve(rowsToPOs(res.data as Record<string, any>[])),
      error: reject,
    });
  });
}

export async function parsePOsFromXLSX(file: File): Promise<ParsedPO[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, any>[];
  return rowsToPOs(rows);
}

export async function parsePOFile(file: File): Promise<ParsedPO[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return parsePOsFromPDF(file);
  if (ext === 'csv') return parsePOsFromCSV(file);
  if (ext === 'xlsx' || ext === 'xls') return parsePOsFromXLSX(file);
  throw new Error(`Unsupported file type: .${ext}. Use PDF, CSV, or XLSX.`);
}

// ── Vendor / Hub fuzzy matching ───────────────────────────────

function normName(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/^ms\.?\s*/i, '')
    .replace(/[^a-z0-9]/g, '');
}

export function matchVendor(rawName: string, vendors: Array<{ id: string; name: string }>): { id: string; name: string } | null {
  const norm = normName(rawName);
  if (!norm) return null;
  const exact = vendors.find(v => normName(v.name) === norm);
  if (exact) return exact;
  const partial = vendors.find(v => {
    const vn = normName(v.name);
    return vn.length >= 4 && (norm.includes(vn) || vn.includes(norm));
  });
  return partial ?? null;
}

const normHub = (s: string) =>
  (s ?? '').toLowerCase().replace(/\s*hub\s*/gi, '').replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');

export function matchHub(rawHub: string, hubs: Array<{ id: string; name: string }>): { id: string; name: string } | null {
  const target = normHub(rawHub.replace(/^ff\s*-?\s*/i, ''));
  if (!target || target.length < 3) return null;
  for (const hub of hubs) {
    const hn = normHub(hub.name);
    if (!hn) continue;
    let i = 0;
    while (i < target.length && i < hn.length && target[i] === hn[i]) i++;
    if (i >= Math.min(6, target.length)) return hub;
  }
  return null;
}
