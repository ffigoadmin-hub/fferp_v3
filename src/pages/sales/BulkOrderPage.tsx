import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createInvoiceForOrder } from '@/lib/invoiceHelper';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parseSalesOrdersFromPDF, type ParsedSalesOrder } from '@/lib/salesOrderImportParser';
import { matchHub } from '@/lib/poImportParsers';
import {
  Plus, Trash2, RefreshCw, CheckCircle2, ShoppingBag,
  Phone, MapPin, User, Store, Package, CalendarDays,
  FileText, AlertCircle, IndianRupee, ChevronDown,
  Upload, Download, X,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface BulkRow {
  key: string;
  // customer
  customer_id: string;
  customer_name: string;
  customer_search: string;
  customer_phone: string;
  customer_area: string;
  customer_address: string;
  customer_type: string;
  showCustomerDrop: boolean;
  // product / item
  product_id: string;
  product_name: string;
  product_search: string;
  showProductDrop: boolean;
  qty: number;
  unit: string;
  unit_price: number;
  grade: 'A' | 'B' | 'C';
  // order meta
  payment_mode: 'cod' | 'credit' | 'upi';
  delivery_date: string;
  notes: string;
  // ui state
  error: string;
}

function newRow(): BulkRow {
  const today = new Date().toISOString().split('T')[0];
  return {
    key: Math.random().toString(36).slice(2),
    customer_id: '', customer_name: '', customer_search: '',
    customer_phone: '', customer_area: '', customer_address: '', customer_type: 'shop',
    showCustomerDrop: false,
    product_id: '', product_name: '', product_search: '',
    showProductDrop: false,
    qty: 1, unit: 'KG', unit_price: 0, grade: 'A',
    payment_mode: 'cod', delivery_date: today, notes: '',
    error: '',
  };
}

const UNITS = ['KG', 'G', 'L', 'ML', 'PCS', 'BOX', 'BAG', 'DOZEN'];

function normCustName(s: string): string {
  return (s ?? '').toLowerCase().replace(/^ms\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
}
function matchCustomer(rawName: string, customers: Array<{ id: string; name: string }>) {
  const norm = normCustName(rawName);
  if (!norm) return null;
  const exact = customers.find(c => normCustName(c.name) === norm);
  if (exact) return exact;
  return customers.find(c => {
    const cn = normCustName(c.name);
    return cn.length >= 4 && (norm.includes(cn) || cn.includes(norm));
  }) ?? null;
}

/* ─── Import Sales Orders from PDF — same Zoho-doc template as the PO import,
       kept as its own dialog (not the flat CSV pipeline) because a PDF page
       can hold multiple items for ONE order, and the CSV path here assumes
       exactly one item per row/order. ─────────────────────────────────────── */
interface SORow {
  key: string;
  parsed: ParsedSalesOrder;
  hubId: string;
  customerId: string;       // '' → create new customer from customerNameOverride
  customerNameOverride: string;
  include: boolean;
  status: 'pending' | 'importing' | 'done' | 'error';
  errorMsg?: string;
}

function ImportSalesOrderDialog({
  open, file, onClose, onImported,
}: {
  open: boolean;
  file: File | null;
  onClose: () => void;
  onImported: () => void;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<SORow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-so-import'],
    queryFn: async () => { const { data } = await supabase.from('hubs').select('id, name').eq('is_active', true); return data ?? []; },
    enabled: open,
  });
  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers-so-import'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('id, shop_name, name, first_name, last_name').eq('is_active', true);
      return (data ?? []).map((c: any) => ({ id: c.id, name: c.shop_name || c.name || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() }));
    },
    enabled: open,
  });

  const parsedOnceRef = useRef<string | null>(null);
  if (open && file && parsedOnceRef.current !== file.name + file.size) {
    parsedOnceRef.current = file.name + file.size;
    setParsing(true);
    parseSalesOrdersFromPDF(file).then(parsed => {
      const rr: SORow[] = parsed.map((p, i) => {
        const hub = matchHub(p.hubRaw, hubs.length ? hubs : []);
        const cust = matchCustomer(p.customerRaw, allCustomers.length ? allCustomers : []);
        return {
          key: `${i}-${p.sourceRef}`,
          parsed: p,
          hubId: hub?.id ?? '',
          customerId: cust?.id ?? '',
          customerNameOverride: cust?.name ?? p.customerRaw,
          include: true,
          status: 'pending',
        };
      });
      setRows(rr);
      if (!rr.length) toast.error('No orders could be read from this PDF.');
    }).catch(e => toast.error(e.message || 'Failed to parse PDF'))
      .finally(() => setParsing(false));
  }

  const close = () => { onClose(); setRows([]); parsedOnceRef.current = null; };
  const updateRow = (key: string, patch: Partial<SORow>) => setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));
  const readyCount = rows.filter(r => r.include && r.hubId).length;

  const handleImport = async () => {
    setImporting(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const isRealUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user?.id ?? '');
    let created = 0, failed = 0;

    for (const row of rows) {
      if (!row.include) continue;
      if (!row.hubId) { updateRow(row.key, { status: 'error', errorMsg: 'No hub selected' }); failed++; continue; }
      updateRow(row.key, { status: 'importing' });
      try {
        let customerId = row.customerId;
        const custName = row.customerNameOverride.trim();
        if (!customerId) {
          if (!custName) throw new Error('No customer name');
          const { data: newCust, error: cErr } = await supabase
            .from('customers')
            .insert({ customer_type: 'shop', shop_name: custName, name: custName, is_active: true })
            .select('id').single();
          if (cErr) throw cErr;
          customerId = newCust.id;
        }

        const hub = hubs.find(h => h.id === row.hubId);
        const total = row.parsed.parsedTotal;
        const { data: order, error: oErr } = await supabase
          .from('sales_orders')
          .insert({
            customer_id: customerId, customer_name: custName,
            order_date: today, delivery_date: row.parsed.date || today,
            status: 'confirmed', payment_mode: 'cod',
            subtotal: total, total_amount: total,
            notes: `Imported from ${row.parsed.sourceRef}`,
            hub_id: row.hubId, hub_name: hub?.name ?? null,
            ...(isRealUuid ? { created_by: user!.id } : {}),
          })
          .select('id').single();
        if (oErr) throw oErr;

        const itemRows = row.parsed.items.map(it => ({
          order_id: order.id, product_name: it.name,
          quantity: it.qty, qty_kg: it.qty, quantity_kg: it.qty,
          unit: (it.unit || 'KG').toUpperCase(),
          unit_price: it.rate, total_price: it.amount, subtotal: it.amount,
          qc_grade: 'A', grade: 'A',
        }));
        if (itemRows.length) {
          const { error: itemsErr } = await supabase.from('sales_order_items').insert(itemRows);
          if (itemsErr) throw itemsErr;
        }

        const suffix = order.id.replace(/-/g, '').slice(0, 6).toUpperCase();
        await supabase.from('invoices').insert({
          invoice_number: `INV-${format(new Date(), 'yyyyMMdd')}-${suffix}`,
          order_id: order.id, customer_id: customerId, customer_name: custName,
          invoice_date: today, due_date: today,
          subtotal: total, discount_amount: 0, tax_amount: 0, total_amount: total,
          payment_mode: 'cod', status: 'unpaid',
          notes: `Imported from ${row.parsed.sourceRef}`,
        });

        updateRow(row.key, { status: 'done' });
        created++;
      } catch (e: any) {
        updateRow(row.key, { status: 'error', errorMsg: e.message || 'Failed' });
        failed++;
      }
    }

    setImporting(false);
    if (created) onImported();
    toast[failed ? 'error' : 'success'](failed ? `Imported ${created}, ${failed} failed` : `Imported ${created} order${created > 1 ? 's' : ''}`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && close()}>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Import Sales Orders from PDF</h3>
          <button onClick={close} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-4 w-4 text-gray-400" /></button>
        </div>

        {parsing ? (
          <div className="flex flex-col items-center justify-center gap-2 h-32 text-purple-600">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="text-sm">Reading {file?.name}…</span>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">{rows.length} order{rows.length === 1 ? '' : 's'} parsed, {readyCount} ready</p>
            {rows.map(row => (
              <div key={row.key} className={`border rounded-lg overflow-hidden ${row.status === 'error' ? 'border-red-300 bg-red-50' : row.status === 'done' ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <input type="checkbox" checked={row.include} disabled={importing} onChange={e => updateRow(row.key, { include: e.target.checked })} />
                  <button onClick={() => setExpanded(v => v === row.key ? null : row.key)} className="p-0.5 text-gray-400">
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded === row.key ? '' : '-rotate-90'}`} />
                  </button>
                  <span className="text-xs font-mono text-gray-400 w-16 shrink-0">{row.parsed.sourceRef}</span>
                  <select value={row.hubId} disabled={importing} onChange={e => updateRow(row.key, { hubId: e.target.value })}
                    className={`h-8 text-xs rounded-lg border px-2 flex-1 ${!row.hubId ? 'border-amber-400 text-amber-700' : 'border-gray-200'}`}>
                    <option value="">Select hub…</option>
                    {hubs.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                  <input value={row.customerNameOverride} disabled={importing}
                    onChange={e => updateRow(row.key, { customerNameOverride: e.target.value, customerId: '' })}
                    className={`h-8 text-xs rounded-lg border px-2 flex-1 ${!row.customerId ? 'border-amber-300' : 'border-gray-200'}`}
                    placeholder="Customer name" />
                  <span className="text-xs font-semibold text-gray-700 w-20 text-right shrink-0">₹{row.parsed.parsedTotal.toLocaleString('en-IN')}</span>
                  {row.status === 'importing' && <RefreshCw className="h-4 w-4 animate-spin text-purple-500 shrink-0" />}
                  {row.status === 'done' && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                  {row.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
                </div>
                {!row.customerId && <p className="px-3 pb-1.5 -mt-1 text-[10px] text-amber-600">New customer — will be created on import</p>}
                {row.parsed.declaredTotal != null && Math.abs(row.parsed.declaredTotal - row.parsed.parsedTotal) > 1 && (
                  <p className="px-3 pb-1.5 -mt-1 text-[10px] text-red-500">File shows ₹{row.parsed.declaredTotal.toLocaleString('en-IN')}, parsed items sum to ₹{row.parsed.parsedTotal.toLocaleString('en-IN')} — check before importing</p>
                )}
                {row.status === 'error' && row.errorMsg && <p className="px-3 pb-1.5 -mt-1 text-[10px] text-red-600">{row.errorMsg}</p>}
                {expanded === row.key && (
                  <div className="border-t border-gray-100 px-3 py-2 bg-gray-50/60">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-400"><th className="text-left font-medium py-1">Item</th><th className="text-right font-medium py-1">Qty</th><th className="text-right font-medium py-1">Rate</th><th className="text-right font-medium py-1">Amount</th></tr></thead>
                      <tbody>
                        {row.parsed.items.map((it, idx) => (
                          <tr key={idx} className="border-t border-gray-100">
                            <td className="py-1 text-gray-700">{it.name}</td>
                            <td className="py-1 text-right text-gray-600">{it.qty} {it.unit}</td>
                            <td className="py-1 text-right text-gray-600">₹{it.rate.toFixed(2)}</td>
                            <td className="py-1 text-right font-medium text-gray-800">₹{it.amount.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={close} disabled={importing} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">Close</button>
            <button onClick={handleImport} disabled={importing || readyCount === 0}
              className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5">
              {importing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
              Import {readyCount} Order{readyCount === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function BulkOrderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows]         = useState<BulkRow[]>([newRow(), newRow(), newRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState<{ count: number } | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [productQuery, setProductQuery]   = useState('');
  const [csvImporting, setCsvImporting]   = useState(false);
  const [csvPreview, setCsvPreview]       = useState<any[]>([]);
  const [showCsvPanel, setShowCsvPanel]   = useState(false);
  const [pdfImportFile, setPdfImportFile] = useState<File | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  /* Customer search */
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-bulk-search', customerQuery],
    queryFn: async () => {
      if (customerQuery.length < 2) return [];
      const { data } = await supabase.from('customers')
        .select('id, shop_name, first_name, last_name, phone, mobile, area, address, customer_type')
        .or(`shop_name.ilike.%${customerQuery}%,first_name.ilike.%${customerQuery}%,phone.ilike.%${customerQuery}%,mobile.ilike.%${customerQuery}%`)
        .eq('is_active', true).limit(10);
      return data ?? [];
    },
    enabled: customerQuery.length >= 2,
  });

  /* Products */
  const { data: products = [] } = useQuery({
    queryKey: ['products-bulk'],
    queryFn: async () => {
      const { data } = await supabase.from('products')
        .select('id, name, unit, grade_a_price, grade_b_price, grade_c_price, category')
        .order('name');
      return data ?? [];
    },
  });

  const updateRow = useCallback((key: string, patch: Partial<BulkRow>) =>
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r)), []);

  const removeRow = (key: string) => setRows(prev => prev.filter(r => r.key !== key));
  const addRow    = () => setRows(prev => [...prev, newRow()]);

  const lineTotal = (r: BulkRow) => r.qty * r.unit_price;

  const validRows   = rows.filter(r => r.customer_id && (r.product_id || r.product_name) && r.qty > 0 && r.unit_price > 0);
  const invalidRows = rows.filter(r => !r.customer_id || (!r.product_id && !r.product_name) || !r.qty || !r.unit_price);
  const grandTotal  = validRows.reduce((s, r) => s + lineTotal(r), 0);

  /* Pick grade price on product select */
  const gradePrice = (prod: any, grade: 'A' | 'B' | 'C') => {
    if (grade === 'A') return prod.grade_a_price ?? prod.price ?? 0;
    if (grade === 'B') return prod.grade_b_price ?? prod.price ?? 0;
    return prod.grade_c_price ?? prod.price ?? 0;
  };

  /* Submit */
  const handleSubmit = async () => {
    if (!validRows.length) { toast.error('Add at least one complete order row'); return; }
    setSubmitting(true);
    let createdCount = 0;
    const today = format(new Date(), 'yyyy-MM-dd');

    try {
      for (const row of validRows) {
        const total = lineTotal(row);
        const isRealUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user?.id ?? '');
        const { data: order, error: oErr } = await supabase.from('sales_orders').insert({
          customer_id:   row.customer_id,
          customer_name: row.customer_name,
          order_date:    row.delivery_date || today,
          status:        'confirmed',
          payment_mode:  row.payment_mode,
          subtotal:      total,
          total_amount:  total,
          notes:         row.notes || null,
          hub_id:        (user as any)?.hub_id ?? null,
          ...(isRealUuid ? { created_by: user!.id } : {}),
        }).select().single();
        if (oErr) throw oErr;

        const { error: itemErr } = await supabase.from('sales_order_items').insert({
          order_id:     order.id,
          product_id:   row.product_id || null,
          product_name: row.product_name,
          quantity:     row.qty,
          qty_kg:       row.qty,
          quantity_kg:  row.qty,
          unit:         row.unit,
          unit_price:   row.unit_price,
          total_price:  total,
          subtotal:     total,
          qc_grade:     row.grade,
          grade:        row.grade,
        });
        if (itemErr) throw itemErr;

        // Auto-create invoice
        await createInvoiceForOrder({
          orderId:       order.id,
          customerId:    row.customer_id,
          customerName:  row.customer_name,
          customerPhone: row.customer_phone || null,
          customerAddress: row.customer_address || null,
          subtotal:      total,
          totalAmount:   total,
          paymentMode:   row.payment_mode,
          notes:         row.notes || null,
        });

        createdCount++;
      }

      setDone({ count: createdCount });
      toast.success(`${createdCount} orders created!`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── CSV / XLSX Import ─────────────────────────────────────────────────── */
  const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/\s+/g, '_');

  const handleCsvFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      setCsvImporting(true);
      file.arrayBuffer().then(buf => {
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        // header:1 to get raw rows first, so header text can be normalized the
        // same way Papa's transformHeader does for CSV — keeps every
        // downstream r.phone / r.hub_name lookup working unchanged.
        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
        const [headerRow, ...dataRows] = raw;
        const headers = (headerRow ?? []).map((h: any) => normalizeHeader(String(h ?? '')));
        const rows = dataRows
          .filter(r => r.some(c => String(c ?? '').trim() !== ''))
          .map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
        setCsvPreview(rows);
        setShowCsvPanel(true);
        setCsvImporting(false);
      }).catch(err => {
        toast.error(err.message || 'Failed to read file');
        setCsvImporting(false);
      });
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      complete: (result: any) => {
        setCsvPreview(result.data);
        setShowCsvPanel(true);
      },
    });
  };

  const handleCsvImport = async () => {
    if (!csvPreview.length) return;
    setCsvImporting(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const isRealUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user?.id ?? '');

    try {
      // ── STEP 1: Fetch all hubs in one call ──────────────────────────────
      const { data: allHubs } = await supabase.from('hubs').select('id, name');
      const hubMap: Record<string, string> = {};
      for (const h of (allHubs ?? [])) hubMap[h.name.toLowerCase()] = h.id;

      // ── STEP 2: Get unique phones from CSV ──────────────────────────────
      const uniquePhones = [...new Set(csvPreview.map((r: any) =>
        String(r.phone ?? r.mobile ?? '').trim()).filter(Boolean))];

      // Fetch existing customers in ONE call
      const { data: existingCustomers } = await supabase
        .from('customers').select('id, phone').in('phone', uniquePhones);
      const phoneToId: Record<string, string> = {};
      for (const c of (existingCustomers ?? [])) if (c.phone) phoneToId[c.phone] = c.id;

      // ── STEP 3: Batch-insert only NEW customers ─────────────────────────
      const newCustomerRows = csvPreview
        .filter((r: any) => {
          const p = String(r.phone ?? '').trim();
          return p && !phoneToId[p];
        })
        // dedupe by phone within CSV itself
        .filter((r: any, idx: number, arr: any[]) =>
          arr.findIndex((x: any) => String(x.phone ?? '') === String(r.phone ?? '')) === idx)
        .map((r: any) => {
          const cName = String(r.customer_name ?? '').trim();
          return {
            customer_type: String(r.customer_type ?? 'shop').toLowerCase(),
            shop_name: cName, name: cName,
            phone: String(r.phone ?? '').trim(),
            area:  String(r.area ?? '').trim() || null,
            city:  String(r.city ?? '').trim() || null,
            address: String(r.address ?? '').trim() || null,
            is_active: true,
          };
        });

      if (newCustomerRows.length > 0) {
        const { data: inserted, error: custErr } = await supabase
          .from('customers').insert(newCustomerRows).select('id, phone');
        if (custErr) console.warn('[BulkOrder] customer insert failed (RLS?):', custErr.message);
        for (const c of (inserted ?? [])) if (c.phone) phoneToId[c.phone] = c.id;
      }

      // ── STEP 4: Batch-insert ALL orders in one call ─────────────────────
      // customer_id is nullable — we still import even if customer creation was blocked by RLS
      const orderRows = csvPreview.map((r: any) => {
        const phone    = String(r.phone ?? '').trim();
        const hubName  = String(r.hub_name ?? '').trim();
        const qty      = Number(r.qty ?? 1);
        const price    = Number(r.unit_price ?? 0);
        const total    = qty * price;
        return {
          customer_id:   phoneToId[phone] ?? null,
          customer_name: String(r.customer_name ?? '').trim(),
          order_date:    today,
          delivery_date: String(r.delivery_date ?? today).trim() || today,
          status:        'confirmed',
          payment_mode:  (() => { const m = String(r.payment_mode ?? 'cod').toLowerCase().trim(); const map: Record<string,string> = { 'credit':'credit','cod':'cod','cash':'cash','upi':'upi','online':'upi','card':'cod','cheque':'cash','partial':'cod' }; return map[m] ?? 'cod'; })(),
          subtotal:      total,
          total_amount:  total,
          notes:         [String(r.salesperson ?? '').trim() ? `By: ${String(r.salesperson).trim()}` : '', String(r.notes ?? '').trim()].filter(Boolean).join(' | ') || null,
          hub_id:        hubMap[hubName.toLowerCase()] ?? null,
          hub_name:      hubName || null,
          ...(isRealUuid ? { created_by: user!.id } : {}),
        };
      }).filter(o => o.customer_name); // only require customer_name, not customer_id

      const { data: createdOrders, error: oErr } = await supabase
        .from('sales_orders').insert(orderRows).select('id, customer_id, customer_name, total_amount, payment_mode, notes');
      if (oErr) throw oErr;

      // ── STEP 5: Batch-insert ALL order items in one call ────────────────
      const itemRows = (createdOrders ?? []).map((order, i) => {
        const r = csvPreview[i] as any;
        const qty   = Number(r.qty ?? 1);
        const price = Number(r.unit_price ?? 0);
        return {
          order_id:     order.id,
          product_name: String(r.product_name ?? '').trim(),
          quantity:     qty, qty_kg: qty, quantity_kg: qty,
          unit:         String(r.unit ?? 'KG').toUpperCase(),
          unit_price:   price,
          total_price:  qty * price,
          subtotal:     qty * price,
          qc_grade:     'A', grade: 'A',
        };
      });
      if (itemRows.length) {
        const { error: itemsErr } = await supabase.from('sales_order_items').insert(itemRows);
        if (itemsErr) {
          console.warn('[BulkOrder] item insert failed:', itemsErr.message);
          toast.error(`Orders created, but product line items failed to save: ${itemsErr.message}`);
        }
      }

      // ── STEP 6: Batch-insert ALL invoices in one call ───────────────────
      const invoiceRows = (createdOrders ?? []).map((order, i) => {
        const r      = csvPreview[i] as any;
        const phone  = String(r.phone ?? '').trim();
        const suffix = order.id.replace(/-/g, '').slice(0, 6).toUpperCase();
        return {
          invoice_number:   `INV-${format(new Date(), 'yyyyMMdd')}-${suffix}`,
          order_id:         order.id,
          customer_id:      order.customer_id,
          customer_name:    order.customer_name,
          customer_phone:   phone || null,
          invoice_date:     today,
          due_date:         today,
          subtotal:         Number(order.total_amount),
          discount_amount:  0,
          tax_amount:       0,
          total_amount:     Number(order.total_amount),
          payment_mode:     order.payment_mode ?? 'cod',
          status:           'unpaid',
          notes:            order.notes ?? null,
        };
      });
      if (invoiceRows.length) {
        await supabase.from('invoices').insert(invoiceRows);
      }

      const count = createdOrders?.length ?? 0;
      setCsvImporting(false);
      setShowCsvPanel(false);
      setCsvPreview([]);
      toast.success(`✅ ${count} orders imported!`);
      setDone({ count });
    } catch (err: any) {
      setCsvImporting(false);
      toast.error(`Import failed: ${err?.message ?? 'Unknown error'}`);
      console.error('CSV import error:', err);
    }
  };

  /* Success screen */
  if (done) {
    return (
      <div className="max-w-lg mx-auto pt-16 pb-12 text-center space-y-5">
        <div className="h-20 w-20 bg-green-50 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">{done.count} Orders Created!</h2>
        <p className="text-slate-400 text-sm">All orders are confirmed and visible in the order list.</p>
        <div className="flex justify-center gap-3">
          <button onClick={() => { setDone(null); setRows([newRow(), newRow(), newRow()]); }}
            className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-gray-50">
            Create More
          </button>
          <button onClick={() => navigate('/sales/orders')}
            className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">
            View All Orders →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12 pt-2">

      {/* Import file input (hidden) */}
      <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls,.pdf" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) {
            if (f.name.toLowerCase().endsWith('.pdf')) setPdfImportFile(f);
            else handleCsvFile(f);
          }
          e.target.value = '';
        }} />

      <ImportSalesOrderDialog
        open={!!pdfImportFile}
        file={pdfImportFile}
        onClose={() => setPdfImportFile(null)}
        onImported={() => navigate('/sales/orders')}
      />

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Bulk Order Entry</h2>
          <p className="text-xs text-slate-400">One card per order — or import from CSV/XLSX/PDF</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg font-medium">
            {validRows.length} ready · {invalidRows.length} incomplete
          </span>
          <button onClick={() => csvRef.current?.click()} disabled={csvImporting}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 disabled:opacity-50">
            {csvImporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Import File
          </button>
          <button onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" /> Add Order
          </button>
        </div>
      </div>

      {/* CSV Preview Panel */}
      {showCsvPanel && csvPreview.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-purple-50 border-b border-purple-100">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600" />
              <p className="font-bold text-purple-800 text-sm">{csvPreview.length} orders ready to import</p>
            </div>
            <button onClick={() => { setShowCsvPanel(false); setCsvPreview([]); }}
              className="p-1 rounded-lg hover:bg-purple-100">
              <X className="h-4 w-4 text-purple-500" />
            </button>
          </div>
          <div className="overflow-x-auto max-h-56">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 sticky top-0">
                <tr>
                  {['customer_name','phone','address','product_name','qty','unit','unit_price','payment_mode'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {csvPreview.slice(0, 10).map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">{r.customer_name}</td>
                    <td className="px-3 py-2 text-gray-500">{r.phone}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-[140px] truncate">{r.address ?? r.area ?? '—'}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800">{r.product_name}</td>
                    <td className="px-3 py-2 text-center">{r.qty}</td>
                    <td className="px-3 py-2">{r.unit}</td>
                    <td className="px-3 py-2 font-semibold">₹{r.unit_price}</td>
                    <td className="px-3 py-2 uppercase text-[10px] font-bold text-gray-500">{r.payment_mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {csvPreview.length > 10 && (
            <p className="text-center text-xs text-gray-400 py-2 border-t">…and {csvPreview.length - 10} more rows</p>
          )}
          <div className="flex items-center gap-3 px-5 py-4 border-t bg-gray-50">
            <button onClick={handleCsvImport} disabled={csvImporting}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 disabled:opacity-50">
              {csvImporting
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Importing…</>
                : <><CheckCircle2 className="h-4 w-4" /> Import {csvPreview.length} Orders</>}
            </button>
            <p className="text-xs text-gray-500">
              New customers will be auto-created. Existing customers matched by phone number.
            </p>
          </div>
        </div>
      )}

      {/* Order cards */}
      <div className="space-y-3">
        {rows.map((row, i) => {
          const isValid = row.customer_id && (row.product_id || row.product_name) && row.qty > 0 && row.unit_price > 0;
          const filteredProducts = products.filter((p: any) =>
            !row.product_search || p.name.toLowerCase().includes(row.product_search.toLowerCase())
          ).slice(0, 8);

          return (
            <div key={row.key} className={`bg-white rounded-2xl border-2 shadow-sm transition-colors ${
              row.error ? 'border-red-300' : isValid ? 'border-green-200' : 'border-gray-200'
            }`}>
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-black ${
                    isValid ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}>{i + 1}</span>
                  <span className="text-xs font-semibold text-slate-500">
                    {isValid
                      ? <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Ready to submit</span>
                      : 'Fill in the details below'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isValid && (
                    <span className="text-sm font-black text-slate-800">
                      ₹{lineTotal(row).toLocaleString()}
                    </span>
                  )}
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(row.key)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* ── Column 1: Customer Details ── */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="h-3 w-3" /> Customer Details
                  </p>

                  {/* Customer search */}
                  <div className="relative">
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Customer *</label>
                    <div className="relative">
                      <input
                        value={row.customer_name || row.customer_search}
                        onChange={e => {
                          updateRow(row.key, {
                            customer_search: e.target.value, customer_name: '',
                            customer_id: '', customer_phone: '', customer_area: '',
                            customer_address: '', showCustomerDrop: true,
                          });
                          setCustomerQuery(e.target.value);
                        }}
                        onFocus={() => updateRow(row.key, { showCustomerDrop: true })}
                        onBlur={() => setTimeout(() => updateRow(row.key, { showCustomerDrop: false }), 200)}
                        placeholder="Search by name or phone…"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-8"
                      />
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                    </div>
                    {row.showCustomerDrop && (customers as any[]).length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl z-30 mt-1 overflow-hidden max-h-48 overflow-y-auto">
                        {(customers as any[]).map((c: any) => {
                          const displayName = c.customer_type === 'individual'
                            ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
                            : c.shop_name ?? c.first_name ?? '—';
                          return (
                            <button key={c.id} onMouseDown={() => updateRow(row.key, {
                              customer_id: c.id,
                              customer_name: displayName,
                              customer_search: '',
                              customer_phone: c.mobile || c.phone || '',
                              customer_area: c.area || '',
                              customer_address: c.address || '',
                              customer_type: c.customer_type || 'shop',
                              showCustomerDrop: false,
                            })}
                              className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0">
                              <div className="flex items-center gap-2">
                                {c.customer_type === 'individual'
                                  ? <User className="h-3 w-3 text-blue-400 flex-shrink-0" />
                                  : <Store className="h-3 w-3 text-green-500 flex-shrink-0" />}
                                <span className="text-sm font-semibold text-slate-700">{displayName}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 ml-5 text-[10px] text-slate-400">
                                {(c.mobile || c.phone) && <span>{c.mobile || c.phone}</span>}
                                {c.area && <span>{c.area}</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Customer info card (shown after selection) */}
                  {row.customer_id ? (
                    <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 border border-slate-100">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        {row.customer_type === 'individual'
                          ? <User className="h-3.5 w-3.5 text-blue-500" />
                          : <Store className="h-3.5 w-3.5 text-green-500" />}
                        {row.customer_name}
                      </div>
                      {row.customer_phone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <a href={`tel:${row.customer_phone}`} className="text-blue-600 hover:underline">{row.customer_phone}</a>
                        </div>
                      )}
                      {row.customer_area && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {row.customer_area}
                        </div>
                      )}
                      {row.customer_address && (
                        <p className="text-[10px] text-slate-400 leading-snug mt-1 pl-4">{row.customer_address}</p>
                      )}
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center text-[11px] text-slate-300">
                      Select a customer to see their details
                    </div>
                  )}
                </div>

                {/* ── Column 2: Item / Product ── */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="h-3 w-3" /> Item Details
                  </p>

                  {/* Product search */}
                  <div className="relative">
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Product *</label>
                    <div className="relative">
                      <input
                        value={row.product_name || row.product_search}
                        onChange={e => {
                          updateRow(row.key, { product_search: e.target.value, product_name: '', product_id: '', unit_price: 0, showProductDrop: true });
                          setProductQuery(e.target.value);
                        }}
                        onFocus={() => updateRow(row.key, { showProductDrop: true })}
                        onBlur={() => setTimeout(() => {
                          setRows(prev => prev.map(r => r.key === row.key ? {
                            ...r,
                            showProductDrop: false,
                            product_name: r.product_name || r.product_search || '',
                            product_search: '',
                          } : r));
                        }, 200)}
                        placeholder="Search product…"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-8"
                      />
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                    </div>
                    {row.showProductDrop && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl z-30 mt-1 overflow-hidden max-h-48 overflow-y-auto">
                        {filteredProducts.map((p: any) => (
                          <button key={p.id} onMouseDown={() => updateRow(row.key, {
                            product_id: p.id,
                            product_name: p.name,
                            product_search: '',
                            unit: p.unit || 'KG',
                            unit_price: gradePrice(p, row.grade),
                            showProductDrop: false,
                          })}
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-slate-700">{p.name}</span>
                              <span className="text-[10px] font-bold text-slate-400">{p.unit}</span>
                            </div>
                            <div className="flex gap-3 mt-0.5 text-[10px] text-slate-400">
                              {p.grade_a_price && <span className="text-emerald-600">A: ₹{p.grade_a_price}</span>}
                              {p.grade_b_price && <span className="text-amber-600">B: ₹{p.grade_b_price}</span>}
                              {p.grade_c_price && <span className="text-orange-600">C: ₹{p.grade_c_price}</span>}
                            </div>
                          </button>
                        ))}
                        {/* Manual entry option */}
                        {(row.product_search || row.product_name) && (
                          <button onMouseDown={() => updateRow(row.key, {
                            product_id: '',
                            product_name: row.product_search || row.product_name,
                            product_search: '',
                            showProductDrop: false,
                          })}
                            className="w-full text-left px-4 py-2.5 hover:bg-amber-50 border-t border-gray-100 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-amber-600 uppercase">Use manually:</span>
                            <span className="text-sm font-semibold text-slate-700">"{row.product_search || row.product_name}"</span>
                          </button>
                        )}
                        {filteredProducts.length === 0 && !row.product_search && (
                          <div className="px-4 py-3 text-xs text-slate-400 text-center">Type a product name to search or enter manually</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Qty + Unit */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">Quantity *</label>
                      <input type="number" min="0.1" step="0.5" value={row.qty}
                        onChange={e => updateRow(row.key, { qty: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">Unit</label>
                      <select value={row.unit} onChange={e => updateRow(row.key, { unit: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Price + Grade */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">Price / Unit (₹) *</label>
                      <input type="number" min="0" step="0.5" value={row.unit_price}
                        onChange={e => updateRow(row.key, { unit_price: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">Grade</label>
                      <div className="flex gap-1 pt-1">
                        {(['A', 'B', 'C'] as const).map(g => (
                          <button key={g} type="button"
                            onClick={() => {
                              const prod = products.find((p: any) => p.id === row.product_id);
                              updateRow(row.key, {
                                grade: g,
                                ...(prod ? { unit_price: gradePrice(prod, g) } : {}),
                              });
                            }}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                              row.grade === g
                                ? g === 'A' ? 'bg-emerald-500 text-white border-emerald-500'
                                  : g === 'B' ? 'bg-amber-500 text-white border-amber-500'
                                  : 'bg-orange-500 text-white border-orange-500'
                                : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                            }`}>{g}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Line total */}
                  {row.qty > 0 && row.unit_price > 0 && (
                    <div className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-2.5">
                      <span className="text-xs text-blue-500 font-semibold">Line Total</span>
                      <span className="text-lg font-black text-blue-700 flex items-center gap-0.5">
                        <IndianRupee className="h-4 w-4" />{lineTotal(row).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* ── Column 3: Order Info ── */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-3 w-3" /> Order Info
                  </p>

                  {/* Payment mode */}
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Payment Mode</label>
                    <div className="flex gap-1.5">
                      {(['cod', 'credit', 'upi'] as const).map(m => (
                        <button key={m} type="button"
                          onClick={() => updateRow(row.key, { payment_mode: m })}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-colors border ${
                            row.payment_mode === m
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-400 border-gray-200 hover:border-gray-300'
                          }`}>{m}</button>
                      ))}
                    </div>
                  </div>

                  {/* Delivery date */}
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> Delivery Date
                    </label>
                    <input
                      type="date"
                      value={row.delivery_date}
                      onChange={e => updateRow(row.key, { delivery_date: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Notes / Remarks
                    </label>
                    <textarea
                      value={row.notes}
                      onChange={e => updateRow(row.key, { notes: e.target.value })}
                      placeholder="Special instructions, delivery notes…"
                      rows={3}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                    />
                  </div>

                  {/* Error */}
                  {row.error && (
                    <div className="flex items-start gap-1.5 bg-red-50 rounded-lg px-3 py-2">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                      <span className="text-[11px] text-red-600 font-medium">{row.error}</span>
                    </div>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* Add row button */}
      <button onClick={addRow}
        className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-4 text-sm font-semibold text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors flex items-center justify-center gap-2">
        <Plus className="h-4 w-4" /> Add Another Order
      </button>

      {/* Summary / submit bar */}
      <div className="sticky bottom-4 bg-slate-900 text-white rounded-2xl px-6 py-4 flex items-center justify-between gap-4 shadow-2xl border border-white/10">
        <div className="flex items-center gap-8">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total Orders</p>
            <p className="text-2xl font-black">{validRows.length}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total Value</p>
            <p className="text-2xl font-black text-green-400">₹{grandTotal.toLocaleString()}</p>
          </div>
          {invalidRows.length > 0 && (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
              <AlertCircle className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-400 font-medium">
                {invalidRows.length} incomplete {invalidRows.length === 1 ? 'row' : 'rows'}
              </span>
              <button
                onClick={() => setRows(prev => prev.filter(r =>
                  r.customer_id && (r.product_id || r.product_name) && r.qty > 0 && r.unit_price > 0
                ).length > 0
                  ? prev.filter(r => r.customer_id && (r.product_id || r.product_name) && r.qty > 0 && r.unit_price > 0)
                  : [newRow()]
                )}
                className="text-xs font-bold text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors ml-1"
              >
                Remove them
              </button>
            </div>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || validRows.length === 0}
          className="flex items-center gap-2 px-8 py-3 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 disabled:opacity-40 transition-colors"
        >
          {submitting
            ? <><RefreshCw className="h-4 w-4 animate-spin" /> Creating…</>
            : <><ShoppingBag className="h-4 w-4" /> Create {validRows.length} {validRows.length === 1 ? 'Order' : 'Orders'}</>}
        </button>
      </div>
    </div>
  );
}
