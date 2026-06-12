// @ts-nocheck
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Zap, Calendar, RefreshCw, Package, ShoppingCart,
  AlertTriangle, CheckCircle2, Clock, TrendingUp,
  ChevronDown, ChevronUp, Download, Play, FileText,
  Boxes, BarChart3, ArrowRight, Plus, Loader2,
  Building2, Info,
} from 'lucide-react';
import {
  fetchAllPOs, savePOToStore, fetchMaxPOSerial,
  type StoredPO,
} from '@/lib/purchaseStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SalesOrderItem {
  product_id: string | null;
  product_name: string;
  qty_kg: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

interface SalesOrder {
  id: string;
  order_number: string;
  status: string;
  hub_id: string | null;
  hub_name: string | null;
  order_date: string;
  net_amount: number;
  customer: { shop_name: string; name: string } | null;
  items: SalesOrderItem[];
}

interface InventoryRow {
  product_id: string;
  product_name: string;
  hub_id: string;
  hub_name: string;
  quantity: number;
  min_threshold: number;
}

interface ProductDemand {
  product_id: string | null;
  product_name: string;
  unit: string;
  totalRequired: number;       // sum of all order quantities
  currentStock: number;        // sum across selected hubs
  shortfall: number;           // max(0, required - stock)
  surplus: number;             // max(0, stock - required)
  orderCount: number;
  avgUnitPrice: number;
  suggestedVendor: string;
  poCreated: boolean;
  hubBreakdown: { hub: string; stock: number }[];
}

interface GeneratedPO {
  poNumber: string;
  vendor: string;
  items: { product: string; qty: number; unit: string; rate: number }[];
  total: number;
}

// ─── Vendor hints (same as AutoPOPage) ───────────────────────────────────────

const VENDOR_MAP: Record<string, string> = {
  Onion: 'Ravi Farms', Tomato: 'Fresh Vendors Co.', Potato: 'AK Traders',
  Carrot: 'Green Valley Agro', Cabbage: 'Tamil Nadu Produce',
  Beetroot: 'Sri Murugan Traders', Brinjal: 'Tamil Nadu Produce',
  Capsicum: 'Green Valley Agro', Coriander: 'Ravi Farms',
  Spinach: 'Green Valley Agro',
};

function vendorFor(name: string) {
  return VENDOR_MAP[name] ?? 'TBD';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString('en-IN'); }
function kg(n: number) { return `${n.toFixed(1)} kg`; }

function Countdown() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const eod = new Date(now);
  eod.setHours(23, 59, 0, 0);
  const diff = Math.max(0, Math.floor((eod.getTime() - now.getTime()) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  const pct = 1 - diff / 86400;
  const isUrgent = diff < 3600;

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-semibold',
      isUrgent ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
    )}>
      <Clock className="w-3.5 h-3.5" />
      <span>EOD in {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</span>
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   'bg-amber-100 text-amber-700',
    confirmed: 'bg-blue-100 text-blue-700',
    draft:     'bg-gray-100 text-gray-600',
  };
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide', map[status] ?? 'bg-gray-100 text-gray-600')}>
      {status}
    </span>
  );
}

// ─── Product Row ──────────────────────────────────────────────────────────────

function ProductRow({ row, onTogglePO }: { row: ProductDemand; onTogglePO: (name: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className={cn(
        'border-b border-gray-50 hover:bg-gray-50/60 transition-colors',
        row.shortfall > 0 ? 'bg-red-50/30' : ''
      )}>
        <td className="py-3 pl-4 pr-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-2 h-2 rounded-full shrink-0',
              row.shortfall > 0 ? 'bg-red-400' : 'bg-green-400'
            )} />
            <span className="text-[13px] font-semibold text-gray-800">{row.product_name}</span>
          </div>
          <p className="text-[10px] text-gray-400 ml-4">{row.orderCount} order{row.orderCount !== 1 ? 's' : ''}</p>
        </td>
        <td className="py-3 px-2 text-[13px] font-semibold text-gray-700 text-right">{kg(row.totalRequired)}</td>
        <td className="py-3 px-2 text-right">
          <span className={cn(
            'text-[13px] font-semibold',
            row.currentStock === 0 ? 'text-red-600' :
            row.currentStock < row.totalRequired ? 'text-amber-600' : 'text-green-600'
          )}>
            {kg(row.currentStock)}
          </span>
          {row.hubBreakdown.length > 0 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="ml-1.5 text-gray-400 hover:text-gray-600"
            >
              {expanded ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
            </button>
          )}
        </td>
        <td className="py-3 px-2 text-right">
          {row.shortfall > 0 ? (
            <span className="text-[13px] font-bold text-red-600">{kg(row.shortfall)}</span>
          ) : (
            <span className="text-[13px] text-green-600 font-semibold">— OK</span>
          )}
        </td>
        <td className="py-3 px-2 text-[11px] text-gray-500 text-center">{row.suggestedVendor}</td>
        <td className="py-3 px-4 text-right">
          {row.shortfall > 0 ? (
            <button
              onClick={() => onTogglePO(row.product_name)}
              className={cn(
                'text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors',
                row.poCreated
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              )}
            >
              {row.poCreated ? <><CheckCircle2 className="w-3 h-3 inline mr-1" />PO Added</> : <>+ Add to PO</>}
            </button>
          ) : (
            <span className="text-[11px] text-gray-400">No PO needed</span>
          )}
        </td>
      </tr>

      {/* Hub breakdown */}
      {expanded && row.hubBreakdown.map(hb => (
        <tr key={hb.hub} className="bg-blue-50/40 border-b border-blue-50">
          <td colSpan={2} className="py-1.5 pl-10 text-[11px] text-gray-500 italic">{hb.hub}</td>
          <td className="py-1.5 px-2 text-right text-[11px] text-gray-600">{kg(hb.stock)}</td>
          <td colSpan={3} />
        </tr>
      ))}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EODPOEngine() {
  const qc = useQueryClient();
  const [targetDate, setTargetDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [poCreatedSet, setPoCreatedSet] = useState<Set<string>>(new Set());
  const [generatedPOs, setGeneratedPOs] = useState<GeneratedPO[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showPOPreview, setShowPOPreview] = useState(false);

  // ── Orders for target date ────────────────────────────────────────────────
  const { data: salesOrders = [], isLoading: loadingOrders, refetch } = useQuery<SalesOrder[]>({
    queryKey: ['eod-po-orders', targetDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          id, order_number, status, hub_id, hub_name, order_date, net_amount,
          customer:customers(shop_name, name),
          items:sales_order_items(product_id, product_name, qty_kg, unit, unit_price, total_price)
        `)
        .eq('order_date', targetDate)
        .in('status', ['pending', 'confirmed', 'draft'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as SalesOrder[];
    },
  });

  // ── Current inventory ──────────────────────────────────────────────────────
  const { data: inventoryRows = [], isLoading: loadingInventory } = useQuery<InventoryRow[]>({
    queryKey: ['eod-po-inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          product_id, quantity, min_threshold,
          products(id, name),
          hubs(id, name)
        `);

      if (error) throw error;

      return (data ?? []).map((r: any) => ({
        product_id:    r.product_id ?? r.products?.id ?? '',
        product_name:  r.products?.name ?? 'Unknown',
        hub_id:        r.hub_id ?? r.hubs?.id ?? '',
        hub_name:      r.hubs?.name ?? 'Unknown Hub',
        quantity:      Number(r.quantity ?? 0),
        min_threshold: Number(r.min_threshold ?? 0),
      }));
    },
  });

  // ── Aggregated demand ──────────────────────────────────────────────────────
  const productDemand = useMemo<ProductDemand[]>(() => {
    // Aggregate all order items
    const demandMap = new Map<string, {
      product_id: string | null;
      product_name: string;
      unit: string;
      totalRequired: number;
      orderIds: Set<string>;
      prices: number[];
    }>();

    salesOrders.forEach(order => {
      (order.items ?? []).forEach(item => {
        const key = item.product_name.toLowerCase().trim();
        const qty = Number(item.qty_kg ?? 0);
        if (qty <= 0) return;

        if (demandMap.has(key)) {
          const e = demandMap.get(key)!;
          e.totalRequired += qty;
          e.orderIds.add(order.id);
          e.prices.push(Number(item.unit_price ?? 0));
        } else {
          demandMap.set(key, {
            product_id:    item.product_id ?? null,
            product_name:  item.product_name,
            unit:          item.unit ?? 'kg',
            totalRequired: qty,
            orderIds:      new Set([order.id]),
            prices:        [Number(item.unit_price ?? 0)],
          });
        }
      });
    });

    // Build stock map: product_name → { totalStock, hubBreakdown }
    const stockMap = new Map<string, { total: number; hubs: { hub: string; stock: number }[] }>();
    inventoryRows.forEach(row => {
      const key = row.product_name.toLowerCase().trim();
      if (!stockMap.has(key)) stockMap.set(key, { total: 0, hubs: [] });
      const entry = stockMap.get(key)!;
      entry.total += row.quantity;
      entry.hubs.push({ hub: row.hub_name, stock: row.quantity });
    });

    return Array.from(demandMap.values()).map(d => {
      const stock = stockMap.get(d.product_name.toLowerCase().trim()) ?? { total: 0, hubs: [] };
      const shortfall = Math.max(0, d.totalRequired - stock.total);
      const surplus = Math.max(0, stock.total - d.totalRequired);
      const avgUnitPrice = d.prices.length > 0
        ? d.prices.reduce((a, b) => a + b, 0) / d.prices.length
        : 0;

      return {
        product_id:    d.product_id,
        product_name:  d.product_name,
        unit:          d.unit,
        totalRequired: d.totalRequired,
        currentStock:  stock.total,
        shortfall,
        surplus,
        orderCount:    d.orderIds.size,
        avgUnitPrice,
        suggestedVendor: vendorFor(d.product_name),
        poCreated:     poCreatedSet.has(d.product_name),
        hubBreakdown:  stock.hubs,
      } as ProductDemand;
    }).sort((a, b) => b.shortfall - a.shortfall);
  }, [salesOrders, inventoryRows, poCreatedSet]);

  // ── Summary numbers ────────────────────────────────────────────────────────
  const summary = useMemo(() => ({
    totalOrders:    salesOrders.length,
    totalItems:     productDemand.length,
    productsShort:  productDemand.filter(p => p.shortfall > 0).length,
    totalShortfall: productDemand.reduce((a, b) => a + b.shortfall, 0),
    totalRevenue:   salesOrders.reduce((a, o) => a + Number(o.net_amount ?? 0), 0),
  }), [salesOrders, productDemand]);

  // ── Toggle PO for a product ───────────────────────────────────────────────
  const togglePO = useCallback((name: string) => {
    setPoCreatedSet(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // ── Generate POs ─────────────────────────────────────────────────────────
  const generatePOs = useCallback(async () => {
    const shortfallProducts = productDemand.filter(p => p.shortfall > 0);
    if (shortfallProducts.length === 0) {
      toast.info('No shortfall — stock is sufficient for all orders!');
      return;
    }

    setGenerating(true);

    try {
      // ── Step 1: Group orders by hub → product ──────────────────────────
      const hubDemand = new Map<string, {
        hubId: string; hubName: string;
        items: Map<string, { qty: number; price: number; unit: string }>;
      }>();

      salesOrders.forEach(order => {
        const hubId   = order.hub_id   ?? 'unassigned';
        const hubName = order.hub_name ?? 'Unassigned Hub';
        if (!hubDemand.has(hubId)) hubDemand.set(hubId, { hubId, hubName, items: new Map() });
        const hub = hubDemand.get(hubId)!;
        (order.items ?? []).forEach((item: any) => {
          const qty = Number(item.qty_kg ?? 0);
          if (qty <= 0) return;
          const key = item.product_name.toLowerCase().trim();
          if (hub.items.has(key)) {
            hub.items.get(key)!.qty += qty;
          } else {
            hub.items.set(key, { qty, price: Number(item.unit_price ?? 0), unit: item.unit ?? 'kg' });
          }
        });
      });

      // ── Step 2: Build per-hub inventory stock map ──────────────────────
      const hubStock = new Map<string, Map<string, number>>();
      inventoryRows.forEach((row: any) => {
        const hId = row.hub_id ?? '';
        const key = row.product_name.toLowerCase().trim();
        if (!hubStock.has(hId)) hubStock.set(hId, new Map());
        const cur = hubStock.get(hId)!.get(key) ?? 0;
        hubStock.get(hId)!.set(key, cur + Number(row.quantity ?? 0));
      });

      const newPOs: GeneratedPO[] = [];
      let serial = (await fetchMaxPOSerial()) + 1;

      // ── Step 3: One PO per hub — all shortfall items, no vendor grouping ──
      // Vendor is selected later by the purchase executive in the Buy page
      for (const [, hubData] of hubDemand) {
        const stock = hubStock.get(hubData.hubId) ?? new Map();

        // Shortfall items for this hub
        const shortfallItems: { product: string; qty: number; unit: string; rate: number }[] = [];
        for (const [key, item] of hubData.items) {
          const s = stock.get(key) ?? 0;
          const shortfall = Math.max(0, item.qty - s);
          if (shortfall > 0) shortfallItems.push({
            product: key,
            qty:  Math.ceil(shortfall),
            unit: item.unit,
            rate: Math.round(item.price || 0),
          });
        }
        if (shortfallItems.length === 0) continue;

        // One PO per hub — all items together
        const poNumber = `PO-${String(serial).padStart(5, '0')}`;
        const poItems = shortfallItems.map((item, idx) => ({
          id:              idx + 1,
          itemName:        item.product,
          account:         'Cost of Goods Sold',
          quantity:        item.qty,
          rate:            item.rate,
          tax:             'GST 5%',
          discount:        0,
          customerDetails: `${hubData.hubName} — ${targetDate}`,
        }));

        const subTotal = poItems.reduce((a, i) => a + i.quantity * i.rate, 0);
        const total    = Math.round(subTotal * 1.05);

        const po: StoredPO = {
          id:           '',
          poNumber,
          vendorName:   '',   // vendor assigned later during Buy
          date:         format(new Date(), 'yyyy-MM-dd'),
          deliveryDate: targetDate,
          paymentTerms: 'Due on Receipt',
          status:       'pending_approval',
          items:        poItems,
          subTotal,
          total,
          notes:        `Auto-generated for ${hubData.hubName} | ${targetDate}. Items: ${shortfallItems.map(i => i.product).join(', ')}.`,
          hub_id:       hubData.hubId,
          hub_name:     hubData.hubName,
        };

        const savedId = await savePOToStore(po);
        if (!savedId) console.warn('[EOD PO] Supabase save failed for', poNumber);

        newPOs.push({ poNumber, vendor: hubData.hubName, items: shortfallItems, total });
        serial++;
      }

      // Mark all shortfall products as PO created
      setPoCreatedSet(new Set(shortfallProducts.map(p => p.product_name)));
      setGeneratedPOs(newPOs);
      setShowPOPreview(true);

      toast.success(`✅ ${newPOs.length} PO${newPOs.length > 1 ? 's' : ''} generated & saved to database!`, {
        description: `${newPOs.length} hub${newPOs.length > 1 ? 's' : ''} · Visible to purchase executives`,
      });
    } catch (err: any) {
      toast.error('PO generation failed', { description: err?.message });
    } finally {
      setGenerating(false);
    }
  }, [productDemand, targetDate]);

  // ── Render ────────────────────────────────────────────────────────────────

  const isLoading = loadingOrders || loadingInventory;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold text-gray-900">EOD PO Engine</h1>
              <p className="text-[11px] text-gray-400">Auto-generate Purchase Orders from tomorrow's demand</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Countdown />

            {/* Date picker */}
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="text-[12px] font-medium text-gray-700 bg-transparent outline-none"
              />
            </div>

            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-xl transition-colors"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 max-w-[1400px] mx-auto space-y-5">

        {/* ── KPI Strip ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Orders for Target Date', value: summary.totalOrders, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Products Required',      value: summary.totalItems,  icon: Package,      color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Products Short',         value: summary.productsShort, icon: AlertTriangle, color: summary.productsShort > 0 ? 'text-red-600' : 'text-green-600', bg: summary.productsShort > 0 ? 'bg-red-50' : 'bg-green-50' },
            { label: 'Total Shortfall',        value: kg(summary.totalShortfall), icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Order Revenue',          value: `₹${fmt(Math.round(summary.totalRevenue))}`, icon: BarChart3, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', s.bg)}>
                <s.icon className={cn('w-4 h-4', s.color)} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none">{s.label}</p>
                <p className="text-[18px] font-bold text-gray-900 mt-0.5">{isLoading ? '—' : s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Content ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Product Demand Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-500" />
                <h2 className="text-[13px] font-semibold text-gray-700 uppercase tracking-wide">Product Demand vs Stock</h2>
              </div>
              {summary.productsShort > 0 && (
                <span className="text-[11px] font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                  {summary.productsShort} short
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                <span className="ml-2 text-[13px] text-gray-400">Loading demand data…</span>
              </div>
            ) : productDemand.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-[14px] font-medium">No orders found for {format(new Date(targetDate), 'dd MMM yyyy')}</p>
                <p className="text-[12px] mt-1">Try selecting a different date or checking order status</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-2.5 pl-4 pr-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-left">Product</th>
                      <th className="py-2.5 px-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Required</th>
                      <th className="py-2.5 px-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">In Stock</th>
                      <th className="py-2.5 px-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Shortfall</th>
                      <th className="py-2.5 px-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center">Vendor</th>
                      <th className="py-2.5 px-4 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productDemand.map(row => (
                      <ProductRow key={row.product_name} row={row} onTogglePO={togglePO} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Generate POs button */}
            {productDemand.length > 0 && (
              <div className="px-5 py-4 border-t border-gray-50 flex items-center justify-between bg-gray-50/50">
                <p className="text-[12px] text-gray-500">
                  {summary.productsShort > 0
                    ? `${summary.productsShort} product${summary.productsShort > 1 ? 's' : ''} need purchasing · ${kg(summary.totalShortfall)} total`
                    : '✓ Stock is sufficient for all orders'}
                </p>
                <button
                  onClick={generatePOs}
                  disabled={generating || summary.productsShort === 0}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all',
                    summary.productsShort > 0 && !generating
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-lg hover:scale-[1.02] active:scale-100'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  )}
                >
                  {generating
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                    : <><Zap className="w-4 h-4" /> Generate All POs</>
                  }
                </button>
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="space-y-4">

            {/* Orders List Toggle */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowOrders(s => !s)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-[13px] font-semibold text-gray-700">Orders ({summary.totalOrders})</span>
                </div>
                {showOrders ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {showOrders && (
                <div className="border-t border-gray-50 max-h-72 overflow-y-auto divide-y divide-gray-50">
                  {salesOrders.length === 0 ? (
                    <p className="text-center py-6 text-[12px] text-gray-400">No orders</p>
                  ) : salesOrders.map(order => (
                    <div key={order.id} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-semibold text-gray-800">
                          {order.order_number ?? order.id.slice(0, 8)}
                        </span>
                        <StatusPill status={order.status} />
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">
                        {order.customer?.shop_name ?? order.customer?.name ?? 'Unknown'}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(order.items ?? []).slice(0, 3).map((item, i) => (
                          <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {item.product_name} {kg(Number(item.qty_kg ?? 0))}
                          </span>
                        ))}
                        {(order.items ?? []).length > 3 && (
                          <span className="text-[10px] text-gray-400">+{order.items.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Engine Info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-blue-500" />
                <h3 className="text-[13px] font-semibold text-gray-700">How It Works</h3>
              </div>
              <ol className="space-y-2.5">
                {[
                  ['Pull orders', `Fetches all pending/confirmed orders for ${format(new Date(targetDate), 'dd MMM')}`],
                  ['Aggregate demand', 'Sums up all product quantities across orders'],
                  ['Check stock', 'Compares demand vs current inventory across all hubs'],
                  ['Calculate shortfall', 'Flags products where stock < requirement'],
                  ['Generate POs', 'Creates one PO per hub with all items — vendor selected later during Buy'],
                ].map(([step, desc], i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold text-gray-700">{step}</p>
                      <p className="text-[11px] text-gray-400">{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Runs automatically at 23:59 every day
                </p>
                <p className="text-[10px] text-amber-600 mt-0.5">
                  POs are saved with status "Pending Approval" and appear in Purchase Orders for review.
                </p>
              </div>
            </div>

            {/* Generated POs Preview */}
            {showPOPreview && generatedPOs.length > 0 && (
              <div className="bg-white rounded-2xl border border-green-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <h3 className="text-[13px] font-semibold text-green-700">Generated POs</h3>
                </div>
                <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {generatedPOs.map(po => (
                    <div key={po.poNumber} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-bold text-gray-800">{po.poNumber}</span>
                        <span className="text-[12px] font-semibold text-green-600">₹{fmt(po.total)}</span>
                      </div>
                      <p className="text-[11px] text-blue-600 font-semibold mb-1">{po.vendor}</p>
                      <div className="space-y-0.5">
                        {po.items.map((item, i) => (
                          <p key={i} className="text-[10px] text-gray-500">
                            {item.product} — {item.qty} {item.unit} @ ₹{item.rate}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50">
                  <a
                    href="/purchase/auto-po"
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    View in Purchase Orders <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Stock Coverage Alert ─────────────────────────────────────────── */}
        {!isLoading && summary.productsShort === 0 && summary.totalOrders > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-green-700">All stock covered!</p>
              <p className="text-[12px] text-green-600">
                Current inventory is sufficient for all {summary.totalOrders} orders on {format(new Date(targetDate), 'dd MMM yyyy')}. No POs required.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
