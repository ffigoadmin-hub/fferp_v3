// @ts-nocheck
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ComingSoonOverlay } from '@/components/ComingSoonOverlay';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import {
  Package, AlertTriangle, TrendingDown, TrendingUp,
  RefreshCw, Building2, Activity, ArrowDown, ArrowUp,
  RotateCcw, Trash2, ShieldCheck, ShieldX, Truck,
  CheckCircle2, Clock, Layers, ChevronDown, ChevronUp,
  Search, Filter, Zap,
} from 'lucide-react';

// ─── Event type config ────────────────────────────────────────────────────────
const EVENT_CONFIG = {
  receive:     { label: 'Received',    icon: ArrowDown,    color: '#16a34a', bg: '#f0fdf4' },
  dispatch:    { label: 'Dispatched',  icon: Truck,        color: '#2563eb', bg: '#eff6ff' },
  wastage:     { label: 'Wastage',     icon: Trash2,       color: '#dc2626', bg: '#fef2f2' },
  qc_reject:   { label: 'QC Rejected', icon: ShieldX,      color: '#f59e0b', bg: '#fffbeb' },
  return:      { label: 'Returned',    icon: RotateCcw,    color: '#7c3aed', bg: '#f5f3ff' },
  adjustment:  { label: 'Adjusted',   icon: Activity,     color: '#6b7280', bg: '#f9fafb' },
};

const BOX_STATUS_CONFIG = {
  created:     { label: 'Created',     color: '#6b7280', bg: '#f9fafb' },
  received:    { label: 'Received',    color: '#2563eb', bg: '#eff6ff' },
  qc_passed:   { label: 'QC Passed',  color: '#16a34a', bg: '#f0fdf4' },
  qc_failed:   { label: 'QC Failed',  color: '#dc2626', bg: '#fef2f2' },
  packed:      { label: 'Packed',     color: '#7c3aed', bg: '#f5f3ff' },
  dispatched:  { label: 'Dispatched', color: '#2563eb', bg: '#dbeafe' },
  delivered:   { label: 'Delivered',  color: '#16a34a', bg: '#dcfce7' },
  wasted:      { label: 'Wasted',     color: '#dc2626', bg: '#fee2e2' },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SmartInventoryPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedHub, setSelectedHub] = useState((user as any)?.hub_id ?? '');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'boxes'>('stock');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // ── Fetch hubs ──
  const { data: hubs = [] } = useQuery({
    queryKey: ['smart-inv-hubs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('hubs')
        .select('id, name, is_active')
        .order('name');
      return data ?? [];
    },
  });

  // ── Fetch inventory (quantity per hub+product) ──
  const { data: inventory = [], isLoading: invLoading, refetch: refetchInv } = useQuery({
    queryKey: ['smart-inv-stock', selectedHub],
    queryFn: async () => {
      let q = supabase
        .from('inventory')
        .select(`
          id, hub_id, product_id, quantity, min_threshold, updated_at,
          product:products(id, name, sku, unit),
          hub:hubs(id, name)
        `)
        .order('updated_at', { ascending: false });

      if (selectedHub) q = q.eq('hub_id', selectedHub);

      const { data } = await q;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  // ── Fetch inventory_log (recent movements) ──
  const { data: movements = [], isLoading: movLoading, refetch: refetchMov } = useQuery({
    queryKey: ['smart-inv-log', selectedHub],
    queryFn: async () => {
      let q = supabase
        .from('inventory_log')
        .select(`
          id, event_type, qty_delta, ref_type, notes, created_at,
          product:products(id, name, unit),
          hub:hubs(id, name),
          creator:profiles(id, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (selectedHub) q = q.eq('hub_id', selectedHub);

      const { data } = await q;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  // ── Fetch box status counts ──
  const { data: boxStats = [], isLoading: boxLoading, refetch: refetchBoxes } = useQuery({
    queryKey: ['smart-inv-boxes', selectedHub],
    queryFn: async () => {
      let q = supabase
        .from('boxes')
        .select('status, hub_id, product_id, weight_kg, product:products(name)')
        .order('created_at', { ascending: false });

      if (selectedHub) q = q.eq('hub_id', selectedHub);

      const { data } = await q;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  // ── Realtime subscription to inventory_log ──
  useEffect(() => {
    const channel = supabase
      .channel('smart-inventory-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'inventory_log',
      }, () => {
        qc.invalidateQueries({ queryKey: ['smart-inv-stock'] });
        qc.invalidateQueries({ queryKey: ['smart-inv-log'] });
        setLastUpdate(new Date());
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'boxes',
      }, () => {
        qc.invalidateQueries({ queryKey: ['smart-inv-boxes'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const handleRefresh = () => {
    refetchInv(); refetchMov(); refetchBoxes();
    setLastUpdate(new Date());
  };

  // ── Derived stats ──
  const filtered = inventory.filter((i: any) =>
    !search || i.product?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalProducts = filtered.length;
  const lowStock = filtered.filter((i: any) =>
    (i.min_threshold ?? 0) > 0 && i.quantity <= i.min_threshold
  ).length;
  const outOfStock = filtered.filter((i: any) => i.quantity <= 0).length;
  const totalKg = filtered.reduce((s: number, i: any) => s + (i.quantity ?? 0), 0);

  // Box status counts
  const boxStatusCounts = Object.keys(BOX_STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = (boxStats as any[]).filter(b => b.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  // Today's movements
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayIn = (movements as any[])
    .filter(m => m.created_at?.startsWith(today) && m.qty_delta > 0)
    .reduce((s, m) => s + Math.abs(m.qty_delta), 0);
  const todayOut = (movements as any[])
    .filter(m => m.created_at?.startsWith(today) && m.qty_delta < 0)
    .reduce((s, m) => s + Math.abs(m.qty_delta), 0);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <ComingSoonOverlay>
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 20px 48px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: '#f0fdf4',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Layers size={18} color="#16a34a" />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>
                Smart Inventory
              </h1>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>M08 · Live stock tracker</p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, color: '#6b7280', background: '#f9fafb',
            padding: '5px 10px', borderRadius: 8, border: '1px solid #e5e7eb',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
            Live · {format(lastUpdate, 'HH:mm:ss')}
          </div>
          <button
            onClick={handleRefresh}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
              padding: '7px 12px', fontSize: 13, fontWeight: 600, color: '#374151',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Hub selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedHub('')}
          style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: '1px solid',
            background: selectedHub === '' ? '#16a34a' : '#fff',
            color: selectedHub === '' ? '#fff' : '#374151',
            borderColor: selectedHub === '' ? '#16a34a' : '#d1d5db',
          }}
        >
          All Hubs
        </button>
        {(hubs as any[]).map(h => (
          <button
            key={h.id}
            onClick={() => setSelectedHub(h.id)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: '1px solid',
              background: selectedHub === h.id ? '#16a34a' : '#fff',
              color: selectedHub === h.id ? '#fff' : '#374151',
              borderColor: selectedHub === h.id ? '#16a34a' : '#d1d5db',
            }}
          >
            {h.name}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Products', value: totalProducts, icon: Package, color: '#2563eb', bg: '#eff6ff' },
          { label: 'Total Stock', value: `${totalKg.toFixed(0)} kg`, icon: Layers, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Low Stock', value: lowStock, icon: AlertTriangle, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Out of Stock', value: outOfStock, icon: TrendingDown, color: '#dc2626', bg: '#fef2f2' },
          { label: 'In Today', value: `+${todayIn.toFixed(0)} kg`, icon: ArrowDown, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Out Today', value: `-${todayOut.toFixed(0)} kg`, icon: ArrowUp, color: '#dc2626', bg: '#fef2f2' },
        ].map(card => (
          <div key={card.label} style={{
            background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
            padding: '12px 14px',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: card.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
            }}>
              <card.icon size={16} color={card.color} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 2, background: '#f3f4f6', borderRadius: 10,
        padding: 3, marginBottom: 16, width: 'fit-content',
      }}>
        {[
          { id: 'stock', label: 'Stock Levels', icon: Package },
          { id: 'movements', label: 'Movements', icon: Activity },
          { id: 'boxes', label: 'Box Tracker', icon: CheckCircle2 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: 'none',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#111827' : '#6b7280',
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: STOCK LEVELS ── */}
      {activeTab === 'stock' && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {/* Search bar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                style={{
                  width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                  border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#111827', outline: 'none',
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
              {filtered.length} items
            </div>
          </div>

          {invLoading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
              <RefreshCw size={24} style={{ margin: '0 auto 8px', display: 'block', animation: 'spin 1s linear infinite' }} />
              Loading stock data...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
              <Package size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
              <p style={{ fontWeight: 600 }}>No inventory records yet</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Records appear after hub managers scan and receive boxes</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Product', 'Hub', 'Stock (kg)', 'Min Threshold', 'Health', 'Last Updated'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left',
                      borderBottom: '1px solid #f3f4f6',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item: any) => {
                  const qty = item.quantity ?? 0;
                  const threshold = item.min_threshold ?? 0;
                  const isOut = qty <= 0;
                  const isLow = threshold > 0 && qty <= threshold;
                  const pct = threshold > 0 ? Math.min(100, (qty / (threshold * 3)) * 100) : 60;

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>{item.product?.name ?? '—'}</div>
                        {item.product?.sku && (
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>SKU: {item.product.sku}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#374151' }}>
                          <Building2 size={12} color="#9ca3af" />
                          {item.hub?.name ?? '—'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: 18, fontWeight: 800,
                          color: isOut ? '#dc2626' : isLow ? '#f59e0b' : '#16a34a',
                        }}>
                          {qty.toFixed(1)}
                        </span>
                        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>kg</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#6b7280' }}>
                        {threshold > 0 ? `${threshold} kg` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', minWidth: 120 }}>
                        <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{pct.toFixed(0)}%</span>
                        </div>
                        <div style={{ height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            width: `${pct}%`,
                            background: isOut ? '#dc2626' : isLow ? '#f59e0b' : '#16a34a',
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                        <div style={{ marginTop: 5 }}>
                          {isOut ? (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '2px 6px', borderRadius: 4 }}>
                              OUT OF STOCK
                            </span>
                          ) : isLow ? (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: '#fffbeb', padding: '2px 6px', borderRadius: 4 }}>
                              ⚠ LOW STOCK
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '2px 6px', borderRadius: 4 }}>
                              HEALTHY
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: '#9ca3af' }}>
                        {item.updated_at ? format(new Date(item.updated_at), 'dd MMM HH:mm') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── TAB: MOVEMENTS ── */}
      {activeTab === 'movements' && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Inventory Movements</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Last 50 events</span>
          </div>

          {movLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
          ) : (movements as any[]).length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
              <Activity size={36} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.3 }} />
              <p>No movements recorded yet</p>
            </div>
          ) : (
            (movements as any[]).map((m: any) => {
              const cfg = EVENT_CONFIG[m.event_type as keyof typeof EVENT_CONFIG] ?? EVENT_CONFIG.adjustment;
              const EventIcon = cfg.icon;
              const isPositive = m.qty_delta > 0;
              return (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderBottom: '1px solid #f9fafb',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 17, background: cfg.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <EventIcon size={15} color={cfg.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                        {m.product?.name ?? '—'}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                        background: cfg.bg, color: cfg.color,
                      }}>
                        {cfg.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                      {m.hub?.name ?? ''}
                      {m.creator?.full_name ? ` · ${m.creator.full_name}` : ''}
                      {m.notes ? ` · ${m.notes.slice(0, 50)}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: 16, fontWeight: 800,
                      color: isPositive ? '#16a34a' : '#dc2626',
                    }}>
                      {isPositive ? '+' : ''}{m.qty_delta} kg
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      {m.created_at ? format(new Date(m.created_at), 'dd MMM HH:mm') : ''}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB: BOX TRACKER ── */}
      {activeTab === 'boxes' && (
        <div>
          {/* Status grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {Object.entries(BOX_STATUS_CONFIG).map(([status, cfg]) => (
              <div key={status} style={{
                background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '12px 14px',
                borderLeft: `3px solid ${cfg.color}`,
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color }}>
                  {boxStatusCounts[status] ?? 0}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{cfg.label}</div>
              </div>
            ))}
          </div>

          {/* Boxes table */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>All Boxes</span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{(boxStats as any[]).length} boxes</span>
            </div>
            {boxLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
            ) : (boxStats as any[]).length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
                <Package size={36} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.3 }} />
                <p>No boxes created yet. Use Box Label Generator to get started.</p>
              </div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {Object.entries(BOX_STATUS_CONFIG)
                  .filter(([s]) => (boxStatusCounts[s] ?? 0) > 0)
                  .map(([status, cfg]) => {
                    const statusBoxes = (boxStats as any[]).filter(b => b.status === status);
                    const isExpanded = expandedProduct === status;
                    return (
                      <div key={status}>
                        <div
                          onClick={() => setExpandedProduct(isExpanded ? null : status)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 16px', cursor: 'pointer', background: '#fafafa',
                            borderBottom: '1px solid #f3f4f6',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                              background: cfg.bg, color: cfg.color,
                            }}>
                              {cfg.label}
                            </span>
                            <span style={{ fontSize: 13, color: '#6b7280' }}>{statusBoxes.length} boxes</span>
                          </div>
                          {isExpanded ? <ChevronUp size={14} color="#9ca3af" /> : <ChevronDown size={14} color="#9ca3af" />}
                        </div>
                        {isExpanded && statusBoxes.slice(0, 20).map((b: any) => (
                          <div key={b.id ?? b.box_code} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 16px 8px 32px', borderBottom: '1px solid #f9fafb',
                            fontSize: 12,
                          }}>
                            <span style={{ color: '#374151', fontFamily: 'monospace' }}>{b.box_code}</span>
                            <span style={{ color: '#9ca3af' }}>{b.product?.name} · {b.weight_kg} kg</span>
                          </div>
                        ))}
                        {isExpanded && statusBoxes.length > 20 && (
                          <div style={{ padding: '8px 16px 8px 32px', fontSize: 12, color: '#9ca3af' }}>
                            +{statusBoxes.length - 20} more boxes
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </ComingSoonOverlay>
  );
}
