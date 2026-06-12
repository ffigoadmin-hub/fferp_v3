// @ts-nocheck
import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  QrCode, Barcode, Printer, Download, Package,
  Plus, Loader2, CheckCircle2, AlertCircle,
  Tag, Weight, Building2, Hash, FileText,
  ChevronRight, RotateCcw, Eye, Boxes,
} from 'lucide-react';
import POBatchLabels from './POBatchLabels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GeneratedBox {
  id: string;
  box_code: string;
  qr_data: string;
  product_name: string;
  weight_kg: number;
  hub_name: string;
  hub_prefix: string;
  date: string;
}

interface FormState {
  product_id: string;
  hub_id: string;
  weight_kg: string;
  num_boxes: string;
  po_ref: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getHubPrefix(hub: any): string {
  if (hub?.code) return hub.code.toUpperCase().slice(0, 4);
  if (hub?.name) return hub.name.replace(/\s+/g, '').toUpperCase().slice(0, 3);
  return 'HUB';
}

function formatBoxCode(hubPrefix: string, date: Date, seq: number): string {
  const d = date.toISOString().split('T')[0].replace(/-/g, '');
  return `FF-${hubPrefix}-${d}-${String(seq).padStart(3, '0')}`;
}

async function generateQRDataURL(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 200,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

function generateBarcodeDataURL(text: string): string {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, text, {
    format: 'CODE128',
    width: 2,
    height: 50,
    displayValue: true,
    fontSize: 11,
    margin: 4,
    background: '#FFFFFF',
    lineColor: '#000000',
  });
  return canvas.toDataURL('image/png');
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function BoxLabelGenerator() {
  const { user } = useAuth();
  const isPurchaseExec = ['shift_employee', 'purchase_manager'].includes((user as any)?.role);
  const userHubId = (user as any)?.hub_id ?? '';

  const [mode, setMode] = useState<'single' | 'po_batch'>('single');
  const [form, setForm] = useState<FormState>({
    product_id: '',
    hub_id: isPurchaseExec ? userHubId : '',
    weight_kg: '',
    num_boxes: '10',
    po_ref: '',
  });
  const [generating, setGenerating] = useState(false);
  const [generatedBoxes, setGeneratedBoxes] = useState<GeneratedBox[]>([]);
  const [pdfReady, setPdfReady] = useState(false);
  const [step, setStep] = useState<'form' | 'preview' | 'done'>('form');

  // Lock hub to user's hub for purchase execs (purchase_manager or shift_employee)
  useEffect(() => {
    if (isPurchaseExec && userHubId) {
      setForm(f => ({ ...f, hub_id: userHubId }));
    }
  }, [isPurchaseExec, userHubId]);

  // ── Fetch products ──
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-labels'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, sku, unit')
        .order('name');
      return data ?? [];
    },
  });

  // ── Fetch hubs ──
  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-for-labels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hubs')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');
      const rows = error
        ? ((await supabase.from('hubs').select('id, name').order('name')).data ?? [])
        : (data ?? []);
      // Deduplicate by name — DB may have duplicate seed rows
      const seen = new Set<string>();
      return rows.filter((h: any) => {
        if (seen.has(h.name)) return false;
        seen.add(h.name);
        return true;
      });
    },
  });

  const selectedProduct = products.find(p => p.id === form.product_id);
  const selectedHub = hubs.find(h => h.id === form.hub_id);

  const isFormValid =
    form.product_id &&
    form.hub_id &&
    parseFloat(form.weight_kg) > 0 &&
    parseInt(form.num_boxes) >= 1 &&
    parseInt(form.num_boxes) <= 200;

  // ── Generate boxes & labels ──
  const handleGenerate = async () => {
    if (!isFormValid) return;
    setGenerating(true);

    const numBoxes = parseInt(form.num_boxes);
    const weightKg = parseFloat(form.weight_kg);
    const today = new Date();
    const hubPrefix = getHubPrefix(selectedHub);
    const productName = selectedProduct?.name ?? 'Product';
    const hubName = selectedHub?.name ?? 'Hub';

    try {
      // 1. Get current max sequence for this hub+date to avoid duplicates
      const dateStr = today.toISOString().split('T')[0];
      const codePrefix = `FF-${hubPrefix}-${dateStr.replace(/-/g, '')}-`;

      const { data: existing } = await supabase
        .from('boxes')
        .select('box_code')
        .like('box_code', `${codePrefix}%`)
        .order('box_code', { ascending: false })
        .limit(1);

      let startSeq = 1;
      if (existing && existing.length > 0) {
        const lastCode = existing[0].box_code;
        const lastSeq = parseInt(lastCode.split('-').pop() ?? '0');
        startSeq = lastSeq + 1;
      }

      // 2. Build box records to insert
      const boxRecords = Array.from({ length: numBoxes }, (_, i) => ({
        box_code: formatBoxCode(hubPrefix, today, startSeq + i),
        product_id: form.product_id,
        hub_id: form.hub_id,
        weight_kg: weightKg,
        status: 'created',
        po_item_id: null,
      }));

      // 3. Insert into Supabase
      const { data: inserted, error } = await supabase
        .from('boxes')
        .insert(boxRecords)
        .select('id, box_code, weight_kg');

      if (error) throw error;

      // 4. Build GeneratedBox list with QR payloads
      const boxes: GeneratedBox[] = (inserted ?? []).map(b => ({
        id: b.id,
        box_code: b.box_code,
        qr_data: JSON.stringify({
          box_id: b.id,
          box_code: b.box_code,
          product: productName,
          weight_kg: weightKg,
          hub: hubName,
          po_ref: form.po_ref || null,
          date: dateStr,
        }),
        product_name: productName,
        weight_kg: weightKg,
        hub_name: hubName,
        hub_prefix: hubPrefix,
        date: dateStr,
      }));

      setGeneratedBoxes(boxes);
      setStep('preview');
      toast.success(`${numBoxes} box records created in database`);
    } catch (err: any) {
      toast.error(`Failed to create boxes: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // ── Generate PDF ──
  const handleDownloadPDF = async () => {
    setPdfReady(false);
    toast.info('Generating PDF labels...');

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Label grid: 2 cols × 4 rows per page = 8 labels per page
    const COLS = 2;
    const LABEL_W = 95;   // mm
    const LABEL_H = 65;   // mm
    const MARGIN_X = 5;   // left margin
    const MARGIN_Y = 8;   // top margin
    const GAP_X = 5;
    const GAP_Y = 5;

    for (let i = 0; i < generatedBoxes.length; i++) {
      const box = generatedBoxes[i];
      const col = i % COLS;
      const row = Math.floor(i / COLS) % 4;
      const pageIndex = Math.floor(i / (COLS * 4));

      // New page every 8 labels
      if (i > 0 && i % (COLS * 4) === 0) {
        pdf.addPage();
      }

      const x = MARGIN_X + col * (LABEL_W + GAP_X);
      const y = MARGIN_Y + row * (LABEL_H + GAP_Y);

      // Label border
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(x, y, LABEL_W, LABEL_H, 2, 2, 'S');

      // Header bar
      pdf.setFillColor(22, 163, 74); // green
      pdf.roundedRect(x, y, LABEL_W, 8, 2, 2, 'F');
      pdf.rect(x, y + 4, LABEL_W, 4, 'F'); // fill bottom corners of header

      // Header text
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);
      pdf.text('FARMERS FACTORY', x + 3, y + 5.5);
      pdf.text(`#${i + 1} / ${generatedBoxes.length}`, x + LABEL_W - 3, y + 5.5, { align: 'right' });

      // QR code (left side)
      try {
        const qrDataUrl = await generateQRDataURL(box.qr_data);
        pdf.addImage(qrDataUrl, 'PNG', x + 3, y + 10, 28, 28);
      } catch (e) {
        // fallback — draw placeholder
        pdf.setFillColor(240, 240, 240);
        pdf.rect(x + 3, y + 10, 28, 28, 'F');
        pdf.setTextColor(120, 120, 120);
        pdf.setFontSize(6);
        pdf.text('QR', x + 14, y + 26, { align: 'center' });
      }

      // Product info (right of QR)
      const infoX = x + 34;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(17, 24, 39);
      // Truncate long product names
      const shortName = box.product_name.length > 18
        ? box.product_name.slice(0, 17) + '…'
        : box.product_name;
      pdf.text(shortName, infoX, y + 15);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(55, 65, 81);
      pdf.text(`Weight: ${box.weight_kg} kg`, infoX, y + 21);
      pdf.text(`Hub: ${box.hub_name}`, infoX, y + 27);
      pdf.text(`Date: ${box.date}`, infoX, y + 33);

      // Box code (below QR + info)
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(17, 24, 39);
      pdf.text(box.box_code, x + LABEL_W / 2, y + 42, { align: 'center' });

      // Barcode (bottom area)
      try {
        const barcodeDataUrl = generateBarcodeDataURL(box.box_code);
        pdf.addImage(barcodeDataUrl, 'PNG', x + 8, y + 44, LABEL_W - 16, 16);
      } catch (e) {
        pdf.setFontSize(6);
        pdf.setTextColor(120, 120, 120);
        pdf.text(box.box_code, x + LABEL_W / 2, y + 54, { align: 'center' });
      }
    }

    pdf.save(`FF-Box-Labels-${new Date().toISOString().split('T')[0]}-${generatedBoxes.length}pcs.pdf`);
    setPdfReady(true);
    setStep('done');
    toast.success('PDF downloaded! Print and stick on boxes.');
  };

  const handleReset = () => {
    setForm({ product_id: '', hub_id: '', weight_kg: '', num_boxes: '10', po_ref: '' });
    setGeneratedBoxes([]);
    setPdfReady(false);
    setStep('form');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 48px' }}>

      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Tag size={20} color="#16a34a" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>
              Box Label Generator
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              M06 · Create box records + print QR & barcode labels
            </p>
          </div>
        </div>

        {/* ── Mode Tabs ── */}
        <div style={{ display: 'flex', gap: 6, marginTop: 16, marginBottom: 4 }}>
          {[
            { key: 'single',   label: '🏷️ Single Batch',  desc: 'One product, one hub' },
            { key: 'po_batch', label: '📦 PO Batch',       desc: 'All PO items, one sheet' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setMode(tab.key as any)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: mode === tab.key ? (tab.key === 'po_batch' ? '#fff7ed' : '#f0fdf4') : '#f9fafb',
                borderBottom: `3px solid ${mode === tab.key ? (tab.key === 'po_batch' ? '#f97316' : '#16a34a') : 'transparent'}`,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: mode === tab.key ? '#111827' : '#6b7280' }}>
                {tab.label}
              </span>
              <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{tab.desc}</span>
            </button>
          ))}
        </div>

        {/* Step indicator — only for single batch */}
        <div style={{ display: mode === 'single' ? 'flex' : 'none', alignItems: 'center', gap: 6, marginTop: 14 }}>
          {(['form', 'preview', 'done'] as const).map((s, idx) => {
            const labels = ['1. Fill Details', '2. Review', '3. Download'];
            const active = step === s;
            const done = (['form', 'preview', 'done'].indexOf(step) > idx);
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: active ? '#16a34a' : done ? '#dcfce7' : '#f3f4f6',
                  color: active ? '#fff' : done ? '#15803d' : '#9ca3af',
                }}>
                  {done && !active ? <CheckCircle2 size={12} /> : null}
                  {labels[idx]}
                </div>
                {idx < 2 && <ChevronRight size={14} color="#d1d5db" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── PO Batch Mode ── */}
      {mode === 'po_batch' && (
        <POBatchLabels hubs={hubs} />
      )}

      {/* ── STEP 1: Form ── */}
      {mode === 'single' && step === 'form' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

          {/* Main form */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 20 }}>
              Box Details
            </h2>

            {/* Product */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Product *
              </label>
              <select
                value={form.product_id}
                onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid #d1d5db', fontSize: 14, color: '#111827',
                  background: '#fff', outline: 'none',
                }}
              >
                <option value="">— Select product —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `(${p.sku})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Hub */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Destination Hub *
              </label>
              {isPurchaseExec ? (
                <div style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid #d1d5db', fontSize: 14, color: '#374151',
                  background: '#f9fafb', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Building2 size={14} style={{ color: '#6b7280' }} />
                  {hubs.find(h => h.id === userHubId)?.name ?? 'Your Hub'}
                  <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>(locked to your hub)</span>
                </div>
              ) : (
                <select
                  value={form.hub_id}
                  onChange={e => setForm(f => ({ ...f, hub_id: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #d1d5db', fontSize: 14, color: '#111827',
                    background: '#fff', outline: 'none',
                  }}
                >
                  <option value="">— Select hub —</option>
                  {hubs.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Weight + Boxes row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Weight per Box (kg) *
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 10"
                  value={form.weight_kg}
                  onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))}
                  min="0.1"
                  step="0.5"
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Number of Boxes *
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 50"
                  value={form.num_boxes}
                  onChange={e => setForm(f => ({ ...f, num_boxes: e.target.value }))}
                  min="1"
                  max="200"
                />
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Max 200 per batch</p>
              </div>
            </div>

            {/* PO Reference */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                PO Reference (optional)
              </label>
              <Input
                placeholder="e.g. PO-2026-0042"
                value={form.po_ref}
                onChange={e => setForm(f => ({ ...f, po_ref: e.target.value }))}
              />
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                Embedded in QR code for traceability
              </p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!isFormValid || generating}
              style={{
                width: '100%', height: 44, fontSize: 15, fontWeight: 700,
                background: isFormValid ? '#16a34a' : '#d1d5db',
                color: '#fff', border: 'none', borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: isFormValid ? 'pointer' : 'not-allowed',
              }}
            >
              {generating ? (
                <><Loader2 size={18} className="animate-spin" /> Creating boxes in DB...</>
              ) : (
                <><Plus size={18} /> Generate {form.num_boxes || '?'} Box Labels</>
              )}
            </Button>
          </div>

          {/* Preview card */}
          <div>
            <div style={{
              background: '#f9fafb', borderRadius: 14, border: '1px solid #e5e7eb',
              padding: 20, marginBottom: 14,
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14 }}>
                Label Preview
              </h3>

              {/* Mini label mockup */}
              <div style={{
                background: '#fff', borderRadius: 8, border: '1px solid #d1d5db',
                overflow: 'hidden', fontSize: 10,
              }}>
                <div style={{ background: '#16a34a', padding: '5px 8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 9 }}>FARMERS FACTORY</span>
                  <span style={{ color: '#fff', fontSize: 9 }}>#1 / {form.num_boxes || '?'}</span>
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 36, height: 36, background: '#f3f4f6', borderRadius: 4,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <QrCode size={20} color="#9ca3af" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#111827', fontSize: 10, marginBottom: 2 }}>
                        {selectedProduct?.name || '—'}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: 9 }}>
                        Weight: {form.weight_kg || '?'} kg
                      </div>
                      <div style={{ color: '#6b7280', fontSize: 9 }}>
                        Hub: {selectedHub?.name || '—'}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 6, textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 8, color: '#374151', marginBottom: 3 }}>
                      FF-{getHubPrefix(selectedHub)}-{new Date().toISOString().split('T')[0].replace(/-/g, '')}-001
                    </div>
                    <div style={{
                      height: 20, background: '#f3f4f6', borderRadius: 3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Barcode size={14} color="#9ca3af" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Summary</h3>
              {[
                { label: 'Boxes', value: form.num_boxes || '—' },
                { label: 'Total weight', value: form.weight_kg && form.num_boxes ? `${(parseFloat(form.weight_kg) * parseInt(form.num_boxes)).toFixed(1)} kg` : '—' },
                { label: 'Labels/page', value: '8 (A4)' },
                { label: 'PDF pages', value: form.num_boxes ? `${Math.ceil(parseInt(form.num_boxes) / 8)}` : '—' },
              ].map(r => (
                <div key={r.label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid #f3f4f6',
                }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{r.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Preview ── */}
      {mode === 'single' && step === 'preview' && (
        <div>
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12,
            padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <CheckCircle2 size={22} color="#16a34a" />
            <div>
              <div style={{ fontWeight: 700, color: '#15803d', fontSize: 15 }}>
                {generatedBoxes.length} boxes created in database
              </div>
              <div style={{ fontSize: 13, color: '#16a34a' }}>
                Codes: {generatedBoxes[0]?.box_code} → {generatedBoxes[generatedBoxes.length - 1]?.box_code}
              </div>
            </div>
          </div>

          {/* Box code list */}
          <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
            padding: 20, marginBottom: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                Generated Box Codes ({generatedBoxes.length})
              </h2>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                {generatedBoxes[0]?.product_name} · {generatedBoxes[0]?.hub_name}
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 8, maxHeight: 320, overflowY: 'auto',
            }}>
              {generatedBoxes.map((box, i) => (
                <div key={box.id} style={{
                  background: '#f9fafb', borderRadius: 8, padding: '8px 10px',
                  border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{
                    width: 22, height: 22, background: '#dcfce7', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#15803d', flexShrink: 0,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', fontFamily: 'monospace' }}>
                    {box.box_code}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Button
              onClick={handleDownloadPDF}
              style={{
                flex: 1, height: 48, fontSize: 15, fontWeight: 700,
                background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Download size={18} /> Download PDF Labels
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              style={{
                height: 48, paddingInline: 20, borderRadius: 10, fontSize: 14, fontWeight: 600,
              }}
            >
              <RotateCcw size={16} style={{ marginRight: 6 }} /> New Batch
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Done ── */}
      {mode === 'single' && step === 'done' && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: '#f0fdf4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <Printer size={36} color="#16a34a" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#16a34a', marginBottom: 8 }}>
            PDF Downloaded!
          </h2>
          <p style={{ fontSize: 15, color: '#374151', marginBottom: 4 }}>
            {generatedBoxes.length} labels ready to print
          </p>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 32 }}>
            Print on A4 paper · Cut and stick on physical boxes · Scan with FF Scanner App
          </p>

          <div style={{
            background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb',
            padding: 20, maxWidth: 480, margin: '0 auto 28px', textAlign: 'left',
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
              Next Steps
            </h3>
            {[
              '🖨️ Print the PDF on A4 paper',
              '✂️ Cut each label and stick on the box',
              '📦 Send boxes to hub',
 