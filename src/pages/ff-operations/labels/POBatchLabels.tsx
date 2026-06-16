// @ts-nocheck
/**
 * POBatchLabels — PO Batch Label Sheet Generator
 *
 * Selects hub + delivery date → fetches that hub's sales orders from Supabase
 * → aggregates products → user sets box count → one PDF with ALL labels.
 * Boxes are NOT pre-created in Supabase; they are created when the hub
 * manager scans the label with the FF Scanner App.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import {
  Calendar, Package, Printer, Loader2, CheckCircle2,
  RotateCcw, Tag, Info, Building2, Plus, Minus,
  ShoppingCart, FileText,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductRow {
  product_name: string;
  total_qty_kg: number;
  order_count: number;
  unit: string;
  boxCount: number;
  weightPerBox: number;
}

interface PrintLabel {
  box_code: string;
  qr_data: string;
  product_name: string;
  weight_kg: number;
  hub_name: string;
  hub_code: string;
  delivery_date: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHubPrefix(hub: any): string {
  if (hub?.code) return hub.code.toUpperCase().slice(0, 4);
  if (hub?.name) return hub.name.replace(/\s+/g, '').toUpperCase().slice(0, 3);
  return 'HUB';
}

function suggestBoxCount(qty: number): number {
  if (qty <= 10) return 1;
  if (qty <= 25) return 2;
  if (qty <= 50) return 3;
  return Math.ceil(qty / 20);
}

function formatBoxCode(hubPrefix: string, dateStr: string, seq: number): string {
  return `FF-${hubPrefix}-${dateStr.replace(/-/g, '')}-${String(seq).padStart(3, '0')}`;
}

async function generateQRDataURL(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 200, margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

function generateBarcodeDataURL(text: string): string {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, text, {
    format: 'CODE128', width: 2, height: 50,
    displayValue: true, fontSize: 11, margin: 4,
    background: '#FFFFFF', lineColor: '#000000',
  });
  return canvas.toDataURL('image/png');
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function POBatchLabels({ hubs }: { hubs: any[] }) {
  const { user } = useAuth();
  const userHubId = (user as any)?.hub_id ?? null;
  const [selectedHubId, setSelectedHubId] = useState(userHubId ?? '');
  const [targetDate, setTargetDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (userHubId && !selectedHubId) setSelectedHubId(userHubId);
  }, [userHubId]);
  const [boxCounts, setBoxCounts] = useState<Record<string, number>>({});
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [totalPrinted, setTotalPrinted] = useState(0);

  const hub = hubs.find(h => h.id === selectedHubId);
  const hubPrefix = hub ? getHubPrefix(hub) : 'HUB';
  const hubName = hub?.name ?? '';

  // ── Fetch this hub's sales orders for the target date ─────────────────────
  const { data: orderItems = [], isLoading } = useQuery({
    queryKey: ['po-batch-orders', selectedHubId, targetDate],
    enabled: !!selectedHubId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          id, order_number, status,
          items:sales_order_items(product_name, qty_kg, unit)
        `)
        .eq('hub_id', selectedHubId)
        .eq('order_date', targetDate)
        .in('status', ['pending', 'confirmed', 'draft']);

      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Aggregate products across all orders ──────────────────────────────────
  const productRows = useMemo<ProductRow[]>(() => {
    const map = new Map<string, { total: number; orders: Set<string>; unit: string }>();

    orderItems.forEach((order: any) => {
      (order.items ?? []).forEach((item: any) => {
        const name = (item.product_name ?? '').trim();
        const qty = Number(item.qty_kg ?? 0);
        if (!name || qty <= 0) return;

        if (!map.has(name)) map.set(name, { total: 0, orders: new Set(), unit: item.unit ?? 'kg' });
        const e = map.get(name)!;
        e.total += qty;
        e.orders.add(order.id);
      });
    });

    return Array.from(map.entries()).map(([name, d]) => {
      const suggested = suggestBoxCount(d.total);
      const count = boxCounts[name] ?? suggested;
      return {
        product_name:  name,
        total_qty_kg:  d.total,
        order_count:   d.orders.size,
        unit:          d.unit,
        boxCount:      Math.max(1, count),
        weightPerBox:  d.total / Math.max(1, count),
      };
    }).sort((a, b) => b.total_qty_kg - a.total_qty_kg);
  }, [orderItems, boxCounts]);

  const totalLabels = productRows.reduce((a, r) => a + r.boxCount, 0);

  // ── Box count stepper ──────────────────────────────────────────────────────
  const changeCount = useCallback((name: string, delta: number) => {
    setBoxCounts(prev => {
      const current = prev[name] ?? suggestBoxCount(
        productRows.find(r => r.product_name === name)?.total_qty_kg ?? 1
      );
      return { ...prev, [name]: Math.max(1, current + delta) };
    });
  }, [productRows]);

  // ── Reset when hub or date changes ────────────────────────────────────────
  const handleHubChange = (id: string) => {
    setSelectedHubId(id);
    setBoxCounts({});
    setDone(false);
  };

  const handleDateChange = (d: string) => {
    setTargetDate(d);
    setBoxCounts({});
    setDone(false);
  };

  // ── Generate PDF ──────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedHubId) { toast.error('Select a hub first'); return; }
    if (productRows.length === 0) { toast.error('No products to print'); return; }

    setGenerating(true);
    try {
      // Check existing box codes for today to avoid sequence clash
      const today = format(new Date(), 'yyyy-MM-dd');
      const codePrefix = `FF-${hubPrefix}-${today.replace(/-/g, '')}-`;
      const { data: existing } = await supabase
        .from('boxes').select('box_code')
        .like('box_code', `${codePrefix}%`)
        .order('box_code', { ascending: false }).limit(1);

      let seq = 1;
      if (existing?.length) {
        seq = parseInt(existing[0].box_code.split('-').pop() ?? '0') + 1;
      }

      // Build labels
      const labels: PrintLabel[] = [];
      productRows.forEach(row => {
        const perBox = row.total_qty_kg / row.boxCount;
        for (let b = 0; b < row.boxCount; b++) {
          const box_code = formatBoxCode(hubPrefix, today, seq++);
          labels.push({
            box_code,
            qr_data: JSON.stringify({
              box_code,
              product:       row.product_name,
              weight_kg:     parseFloat(perBox.toFixed(2)),
              hub:           hubName,
              delivery_date: targetDate,
              date:          today,
              mode:          'pre_printed',
            }),
            product_name:  row.product_name,
            weight_kg:     parseFloat(perBox.toFixed(2)),
            hub_name:      hubName,
            hub_code:      hubPrefix,
            delivery_date: targetDate,
          });
        }
      });

      // Build PDF
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const COLS = 2, LABEL_W = 95, LABEL_H = 65;
      const MARGIN_X = 5, MARGIN_Y = 8, GAP_X = 5, GAP_Y = 5;

      for (let i = 0; i < labels.length; i++) {
        const lbl = labels[i];
        const col = i % COLS;
        const row = Math.floor(i / COLS) % 4;
        if (i > 0 && i % (COLS * 4) === 0) pdf.addPage();

        const x = MARGIN_X + col * (LABEL_W + GAP_X);
        const y = MARGIN_Y + row * (LABEL_H + GAP_Y);

        // Border
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, y, LABEL_W, LABEL_H, 2, 2, 'S');

        // Orange header bar
        pdf.setFillColor(234, 88, 12);
        pdf.roundedRect(x, y, LABEL_W, 8, 2, 2, 'F');
        pdf.rect(x, y + 4, LABEL_W, 4, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.5);
        pdf.setTextColor(255, 255, 255);
        pdf.text(`FARMERS FACTORY · ${lbl.hub_code}`, x + 3, y + 5.5);
        pdf.text(`${i + 1}/${labels.length}`, x + LABEL_W - 3, y + 5.5, { align: 'right' });

        // QR code
        try {
          const qr = await generateQRDataURL(lbl.qr_data);
          pdf.addImage(qr, 'PNG', x + 3, y + 10, 28, 28);
        } catch {
          pdf.setFillColor(240, 240, 240); pdf.rect(x + 3, y + 10, 28, 28, 'F');
          pdf.setFontSize(6); pdf.setTextColor(120, 120, 120);
          pdf.text('QR', x + 14, y + 26, { align: 'center' });
        }

        // Product info
        const infoX = x + 34;
        const shortName = lbl.product_name.length > 16 ? lbl.product_name.slice(0, 15) + '…' : lbl.product_name;
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(17, 24, 39);
        pdf.text(shortName, infoX, y + 15);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(55, 65, 81);
        pdf.text(`Weight: ${lbl.weight_kg} kg`, infoX, y + 21);
        pdf.text(`Hub: ${lbl.hub_name}`, infoX, y + 27);
        pdf.text(`Deliver: ${lbl.delivery_date}`, infoX, y + 33);

        // Box code
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(17, 24, 39);
        pdf.text(lbl.box_code, x + LABEL_W / 2, y + 42, { align: 'center' });

        // Barcode
        try {
          const bc = generateBarcodeDataURL(lbl.box_code);
          pdf.addImage(bc, 'PNG', x + 8, y + 44, LABEL_W - 16, 16);
        } catch {
          pdf.setFontSize(6); pdf.setTextColor(120, 120, 120);
          pdf.text(lbl.box_code, x + LABEL_W / 2, y + 54, { align: 'center' });
        }
      }

      // ── Insert boxes into Supabase so scanner can find them by box_code ──
      try {
        const uniqueNames = [...new Set(labels.map(l => l.product_name))];
        const { data: productData } = await supabase
          .from('products')
          .select('id, name')
          .in('name', uniqueNames);
        const productIdMap = Object.fromEntries(
          (productData ?? []).map((p: any) => [p.name, p.id])
        );
        const boxRecords = labels.map(lbl => ({
          box_code: lbl.box_code,
          product_id: productIdMap[lbl.product_name] ?? null,
          hub_id: selectedHubId,
          weight_kg: lbl.weight_kg,
          status: 'created',
        }));
        await supabase.from('boxes').insert(boxRecords);
      } catch (dbErr) {
        console.warn('[POBatchLabels] box insert skipped:', dbErr);
      }

      pdf.save(`FF-${hubPrefix}-Labels-${targetDate}-${labels.length}pcs.pdf`);
      setTotalPrinted(labels.length);
      setDone(true);
      toast.success(`✅ ${labels.length} labels ready!`, {
        description: `Print → cut → stick on boxes as they arrive at ${hubName}`,
      });
    } catch (err: any) {
      toast.error('PDF failed', { description: err?.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setBoxCounts({});
    setDone(false);
    setTotalPrinted(0);
  };

  // ── Done screen ────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-9 h-9 text-orange-500" />
        </div>
        <h2 className="text-[20px] font-bold text-gray-800 mb-1">{totalPrinted} Labels Ready!</h2>
        <p className="text-[13px] text-gray-500 mb-6 max-w-sm">
          PDF downloaded for <strong>{hubName}</strong> · delivery {targetDate}.
          Print on A4, cut along borders, stick on boxes as goods arrive.
        </p>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-left max-w-sm mb-6">
          {['🖨️ Print the PDF on A4 (portrait)', '✂️ Cut each label along the borders',
            '📦 Keep ready before purchase arrives', '🏷️ Stick on each box after filling',
            '📱 Hub Manager scans → Box created in system', '✅ Inventory updates on QC pass'].map((s, i) => (
            <p key={i} className="text-[12px] text-orange-700 py-1.5 border-b border-orange-100 last:border-0">{s}</p>
          ))}
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white rounded-xl text-[13px] font-semibold hover:bg-orange-600 transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Print Another Batch
        </button>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

      {/* ── Left: Hub + Date + Products ─────────────────────────────── */}
      <div className="lg:col-span-2 space-y-4">

        {/* Hub + Date selectors */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            {/* Hub */}
            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-600 mb-2">
                <Building2 className="w-3.5 h-3.5" /> Hub
              </label>
              <select
                value={selectedHubId}
                onChange={e => handleHubChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] text-gray-700 bg-white outline-none focus:border-orange-400 transition-colors"
              >
                <option value="">— Select hub —</option>
                {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-600 mb-2">
                <Calendar className="w-3.5 h-3.5" /> Order Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={e => handleDateChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] text-gray-700 bg-white outline-none focus:border-orange-400 transition-colors"
              />
            </div>
          </div>

          {selectedHubId && (
            <p className="text-[11px] text-gray-400 mt-3">
              Box codes will be:{' '}
              <span className="font-mono font-semibold text-gray-600">
                FF-{hubPrefix}-{format(new Date(), 'yyyyMMdd')}-001, 002…
              </span>
            </p>
          )}
        </div>

        {/* Products from this hub's orders */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-500" />
              <h3 className="text-[13px] font-semibold text-gray-700">
                {selectedHubId
                  ? `Products needed · ${hubName} · ${targetDate}`
                  : 'Select a hub to see products'}
              </h3>
            </div>
            {productRows.length > 0 && (
              <span className="text-[11px] bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">
                {productRows.length} products
              </span>
            )}
          </div>

          {/* Loading */}
          {isLoading && selectedHubId && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300 mr-2" />
              <span className="text-[13px] text-gray-400">Loading orders…</span>
            </div>
          )}

          {/* No hub selected */}
          {!selectedHubId && (
            <div className="text-center py-12 text-gray-400">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-[13px]">Choose a hub above to see its orders</p>
            </div>
          )}

          {/* Hub selected but no orders */}
          {selectedHubId && !isLoading && productRows.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-[13px] font-medium">No orders found</p>
              <p className="text-[11px] mt-1">
                No pending/confirmed orders for {hubName} on {targetDate}
              </p>
            </div>
          )}

          {/* Product rows */}
          {productRows.length > 0 && (
            <div className="divide-y divide-gray-50">
              {productRows.map(row => (
                <div key={row.product_name} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-orange-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-800">{row.product_name}</p>
                    <p className="text-[11px] text-gray-400">
                      {row.total_qty_kg} kg ordered · {row.order_count} order{row.order_count !== 1 ? 's' : ''} · {row.weightPerBox.toFixed(1)} kg/box
                    </p>
                  </div>

                  {/* Box count stepper */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => changeCount(row.product_name, -1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-10 text-center text-[14px] font-bold text-gray-800">
                      {row.boxCount}
                    </span>
                    <button
                      onClick={() => changeCount(row.product_name, +1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="text-[11px] text-gray-400 ml-1">boxes</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Summary + Generate ───────────────────────────────── */}
      <div className="space-y-4">

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-4 h-4 text-orange-500" />
            <h3 className="text-[13px] font-semibold text-gray-700">Print Summary</h3>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Hub',            value: hubName || '—' },
              { label: 'Date',           value: targetDate },
              { label: 'Products',       value: productRows.length },
              { label: 'Orders covered', value: orderItems.length },
              { label: 'Total labels',   value: totalLabels, highlight: true },
              { label: 'A4 pages',       value: Math.ceil(totalLabels / 8) },
            ].map(s => (
              <div key={s.label} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-[12px] text-gray-500">{s.label}</span>
                <span className={cn('font-bold', s.highlight ? 'text-[18px] text-orange-600' : 'text-[13px] text-gray-800')}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          {/* Per-product label count */}
          {productRows.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {productRows.map(row => (
                <div key={row.product_name} className="flex items-center justify-between text-[11px] bg-gray-50 rounded-lg px-3 py-1.5">
                  <span className="text-gray-700 truncate flex-1">{row.product_name}</span>
                  <span className="text-orange-600 font-semibold ml-2 shrink-0">
                    {row.boxCount} box{row.boxCount !== 1 ? 'es' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating || !selectedHubId || productRows.length === 0}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-bold transition-all',
            !generating && selectedHubId && productRows.length > 0
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-lg hover:scale-[1.01] active:scale-100'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
        >
          {generating
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF…</>
            : <><Printer className="w-4 h-4" /> Print {totalLabels || ''} Label{totalLabels !== 1 ? 's' : ''}</>
          }
        </button>

        {/* How it works */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-semibold text-blue-700 mb-1">Hub-scoped labels</p>
              <p className="text-[11px] text-blue-600 leading-relaxed">
                Shows only <strong>{hubName || 'this hub'}</strong>'s orders for the selected date.
                Labels are not saved to DB — boxes are created automatically when scanned on arrival.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
