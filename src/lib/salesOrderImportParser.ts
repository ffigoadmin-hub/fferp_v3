// ─────────────────────────────────────────────────────────────
//  Sales Order PDF import — same Zoho-style export template as
//  the Purchase Order import (poImportParsers.ts), just with
//  customer/order fields instead of vendor/PO fields. Reuses the
//  same line-extraction and item-row parsing (computed rate from
//  qty+amount) since that part of the template is identical.
// ─────────────────────────────────────────────────────────────

import * as pdfjsLib from 'pdfjs-dist';
import {
  extractPageLines, parseItemRows, toISODate, parseAmount,
  type ParsedPOItem,
} from './poImportParsers';

export interface ParsedSalesOrder {
  sourceRef: string;
  hubRaw: string;
  customerRaw: string;
  date: string;
  items: ParsedPOItem[];
  parsedTotal: number;
  declaredTotal: number | null;
}

export async function parseSalesOrdersFromPDF(file: File): Promise<ParsedSalesOrder[]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
  const results: ParsedSalesOrder[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const lines = await extractPageLines(page);
    const fullText = lines.map(l => l.text).join('\n');

    const refMatch     = fullText.match(/#\s*([A-Z]{2,4}-?\S+)/i);
    const dateMatch     = fullText.match(/Date\s*:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    const hubMatch      = fullText.match(/(FF\s*-\s*[A-Z][A-Za-z]+)/);
    // Same template family as the PO — customer block may be labeled any of
    // these depending on which Zoho doc type it is (Sales Order / Invoice).
    const custLabelLine = lines.find(l => /(bill to|customer address|ship to|vendor address)/i.test(l.text));
    const custIdx       = custLabelLine ? lines.indexOf(custLabelLine) : -1;
    const customerMatch = custIdx >= 0 ? lines[custIdx + 1]?.text : undefined;
    const subTotalMatch = fullText.match(/Sub\s*Total\s*([\d,]+\.\d{2})/i);
    const totalMatch    = fullText.match(/(?<!Sub )Total\s*₹?\s*([\d,]+\.\d{2})/i);

    const items = parseItemRows(lines);
    if (!items.length) continue;

    results.push({
      sourceRef:     refMatch?.[1] ?? `page-${p}`,
      hubRaw:        hubMatch?.[1]?.replace(/\s+/g, ' ').trim() ?? '',
      customerRaw:   customerMatch ?? '',
      date:          dateMatch ? toISODate(dateMatch[1]) : new Date().toISOString().slice(0, 10),
      items,
      parsedTotal:   items.reduce((s, i) => s + i.amount, 0),
      declaredTotal: totalMatch ? parseAmount(totalMatch[1]) : (subTotalMatch ? parseAmount(subTotalMatch[1]) : null),
    });
  }
  return results;
}
