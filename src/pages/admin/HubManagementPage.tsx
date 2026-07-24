import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  MapPin, Warehouse, Users, Truck, Package,
  ArrowRight, BarChart3, RefreshCw, PackageCheck, ChevronRight, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

// ── Live hub row (from public.hubs) ─────────────────────────────────────────────
interface HubRow {
  id: string;
  name: string;
  display_name: string | null;
  code: string | null;
  city: string | null;
  is_active: boolean | null;
}

interface HubRoute { channel: string; count: number; volume: string; }

interface Hub {
  id: string;
  slug: string;
  name: string;
  location: string;
  code: string;
  color: string;
  manager: string;
  qcTeam: string[];
  routes: HubRoute[];
  channels: string[];
  status: string;
}

// ── Cosmetic enrichment (no DB column exists for these yet) ─────────────────────
// Keyed by hub code. Any live hub without a matching entry falls back to defaults
// below rather than being dropped, so newly added hubs still render.
const HUB_ENRICHMENT: Record<string, { color: string; manager: string; qcTeam: string[]; routes: HubRoute[]; channels: string[] }> = {
  'HUB-01': {
    color: '#38BDF8',
    manager: 'Arun Karthick',
    qcTeam: ['Shantha Kumar', 'Siva'],
    routes: [
      { channel: 'FF', count: 2, volume: '70,000 units' },
      { channel: 'DMART', count: 1, volume: '50,000 units' },
    ],
    channels: ['FF', 'DMART'],
  },
  'HUB-02': {
    color: '#2563EB',
    manager: 'Prakash',
    qcTeam: ['Danush', 'Prakash'],
    routes: [
      { channel: 'FF', count: 1, volume: '10,000 units' },
      { channel: 'DMART', count: 2, volume: '70,000 units' },
      { channel: 'BLINKIT', count: 1, volume: 'TBD' },
      { channel: 'ZEPTO', count: 2, volume: 'TBD' },
    ],
    channels: ['FF', 'DMART', 'BLINKIT', 'ZEPTO'],
  },
  'HUB-03': {
    color: '#A78BFA',
    manager: 'Hari',
    qcTeam: ['Guna'],
    routes: [
      { channel: 'FF', count: 1, volume: '35,000 units' },
      { channel: 'DMART', count: 2, volume: '40,000 units' },
      { channel: 'ZEPTO', count: 1, volume: 'TBD' },
    ],
    channels: ['FF', 'DMART', 'ZEPTO'],
  },
};
const DEFAULT_ENRICHMENT = { color: '#94A3B8', manager: 'Unassigned', qcTeam: [] as string[], routes: [] as HubRoute[], channels: [] as string[] };

// Derive a URL slug from the hub name — strips the word "hub", matches the
// static sidebar links (/admin/hubs/palikarani etc.) so those keep working
// without hardcoding hub identity here.
function slugFromName(name: string): string {
  return (name ?? '').toLowerCase().replace(/\s*hub\s*/gi, '').trim().replace(/\s+/g, '-');
}

// Hub names have spelling variants in the DB (e.g. "Pallikaranai" vs the
// "Palikarani" spelling hardcoded in Sidebar.tsx's nav links) — same fuzzy
// match already used in PurchaseOrdersPage.tsx to resolve this.
const normHub = (s: string) =>
  (s ?? '').toLowerCase().replace(/\s*hub\s*/gi, '').replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
const hubNormMatch = (a: string, b: string) => {
  if (!a || !b || a.length < 5 || b.length < 5) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= 8;
};

function toHub(row: HubRow): Hub {
  const enrichment = (row.code && HUB_ENRICHMENT[row.code]) || DEFAULT_ENRICHMENT;
  return {
    id: row.id,
    slug: slugFromName(row.display_name || row.name),
    name: row.display_name || row.name,
    location: row.city || '—',
    code: row.code || '—',
    status: row.is_active === false ? 'inactive' : 'active',
    ...enrichment,
  };
}

function useHubs() {
  return useQuery({
    queryKey: ['admin-hubs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hubs')
        .select('id, name, display_name, code, city, is_active')
        .order('name');
      if (error) throw error;
      return ((data ?? []) as HubRow[]).map(toHub);
    },
  });
}

const CHANNEL_COLORS: Record<string, string> = {
  FF:      '#38BDF8',
  DMART:   '#FBBF24',
  BLINKIT: '#FB923C',
  ZEPTO:   '#A78BFA',
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden"
      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.5 }} />
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: color + '15', border: `1px solid ${color}20` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: color + '80' }}>{label}</p>
        <p className="text-[20px] font-black leading-tight mt-0.5 tabular-nums" style={{ color: '#111827' }}>{value}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Hub Card ─────────────────────────────────────────────────────────────────
function HubCard({ hub, onClick }: { hub: Hub; onClick: () => void }) {
  const totalRoutes = hub.routes.reduce((s, r) => s + r.count, 0);
  const isActive = hub.status === 'active';

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: `0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px ${hub.color}30` }}
      transition={{ duration: 0.18 }}
      className="rounded-2xl cursor-pointer overflow-hidden"
      style={{ background: '#FFFFFF', border: `1px solid #E5E7EB`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      onClick={onClick}
    >
      {/* Hub color accent bar */}
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${hub.color}80, ${hub.color}, ${hub.color}80)` }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: hub.color + '15', border: `1px solid ${hub.color}25` }}>
              <Warehouse className="w-5 h-5" style={{ color: hub.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-bold" style={{ color: '#111827' }}>{hub.name}</h3>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: hub.color + '15', color: hub.color }}>
                  {hub.code}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" style={{ color: '#9CA3AF' }} />
                <span className="text-[11px]" style={{ color: '#9CA3AF' }}>{hub.location}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: isActive ? 'rgba(74,222,128,0.1)' : 'rgba(156,163,175,0.12)',
              border: `1px solid ${isActive ? 'rgba(74,222,128,0.25)' : 'rgba(156,163,175,0.3)'}`,
            }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: isActive ? '#4ADE80' : '#9CA3AF' }} />
            <span className="text-[10px] font-semibold" style={{ color: isActive ? '#4ADE80' : '#9CA3AF' }}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Manager + QC Team */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl p-3" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#9CA3AF' }}>Hub Manager</p>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: hub.color + '20', border: `1px solid ${hub.color}30` }}>
                <span className="text-[9px] font-black" style={{ color: hub.color }}>{hub.manager[0]}</span>
              </div>
              <span className="text-[12px] font-semibold" style={{ color: '#111827' }}>{hub.manager}</span>
            </div>
          </div>
          <div className="rounded-xl p-3" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#9CA3AF' }}>QC Team</p>
            {hub.qcTeam.length === 0 ? (
              <span className="text-[11px]" style={{ color: '#D1D5DB' }}>Unassigned</span>
            ) : (
              <div className="flex items-center gap-1">
                {hub.qcTeam.map((m, i) => (
                  <div key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                    style={{ background: hub.color + '20', color: hub.color, border: `1px solid ${hub.color}30`, marginLeft: i > 0 ? '-4px' : 0 }}>
                    {m[0]}
                  </div>
                ))}
                <span className="text-[10px] ml-1.5 truncate" style={{ color: '#6B7280' }}>
                  {hub.qcTeam.slice(0, 2).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Routes */}
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>
            Routes ({totalRoutes} total)
          </p>
          {hub.routes.length === 0 ? (
            <p className="text-[11px]" style={{ color: '#D1D5DB' }}>No routes configured</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {hub.routes.map((r, i) => {
                const chColor = CHANNEL_COLORS[r.channel] || '#38BDF8';
                return (
                  <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold"
                    style={{ background: chColor + '12', color: chColor, border: `1px solid ${chColor}25` }}>
                    <Truck className="w-3 h-3" />
                    {r.channel} ×{r.count}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3"
          style={{ borderTop: '1px solid #F3F4F6' }}>
          <div className="flex gap-1.5">
            {hub.channels.map(ch => {
              const c = CHANNEL_COLORS[ch] || '#38BDF8';
              return (
                <span key={ch} className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: c + '12', color: c }}>
                  {ch}
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold" style={{ color: hub.color }}>
            View Details <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Hub Detail View ───────────────────────────────────────────────────────────
function HubDetail({ hubId, hubs, isLoading }: { hubId: string; hubs: Hub[]; isLoading: boolean }) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#9CA3AF' }} />
      </div>
    );
  }

  const hub = hubs.find(h => h.slug === hubId || h.id === hubId)
    ?? hubs.find(h => hubNormMatch(normHub(h.slug), normHub(hubId)));

  if (!hub) {
    return (
      <div className="text-center py-20" style={{ color: '#9CA3AF' }}>
        <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Hub not found</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/admin/hubs')}>
          Back to All Hubs
        </Button>
      </div>
    );
  }

  const totalRoutes = hub.routes.reduce((s, r) => s + r.count, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px]" style={{ color: '#9CA3AF' }}>
        <button onClick={() => navigate('/admin/hubs')}
          className="hover:underline font-bold" style={{ color: hub.color }}>
          All Hubs
        </button>
        <ChevronRight className="w-3 h-3" />
        <span style={{ color: '#374151' }}>{hub.name}</span>
      </div>

      {/* Hub Header */}
      <div className="rounded-2xl overflow-hidden relative"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${hub.color}80, ${hub.color}, ${hub.color}80)` }} />
        <div className="p-6 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: hub.color + '15', border: `1px solid ${hub.color}25` }}>
              <Warehouse className="w-7 h-7" style={{ color: hub.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[20px] font-black" style={{ color: '#111827' }}>{hub.name}</h1>
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: hub.color + '15', color: hub.color }}>{hub.code}</span>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#4ADE80' }} />
                  <span className="text-[10px] font-semibold" style={{ color: '#4ADE80' }}>
                    {hub.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                <span className="text-[12px]" style={{ color: '#9CA3AF' }}>{hub.location}</span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/hubs')} className="gap-1.5">
            ← All Hubs
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Routes" value={totalRoutes} icon={Truck} color={hub.color} sub="daily" />
        <StatCard label="Sales Channels" value={hub.channels.length} icon={BarChart3} color="#0E8A6B" sub="active" />
        <StatCard label="QC Team" value={hub.qcTeam.length} icon={PackageCheck} color="#D97706" sub="members" />
        <StatCard label="Hub Manager" value={hub.manager} icon={Users} color="#7C3AED" />
      </div>

      {/* Routes & Operations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Route breakdown */}
        <div className="rounded-2xl p-5"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h3 className="text-[13px] font-bold mb-4 flex items-center gap-2" style={{ color: '#111827' }}>
            <Truck className="w-4 h-4" style={{ color: hub.color }} />
            Route Breakdown
          </h3>
          {hub.routes.length === 0 ? (
            <p className="text-[12px] py-4 text-center" style={{ color: '#9CA3AF' }}>No routes configured for this hub.</p>
          ) : (
            <div className="space-y-3">
              {hub.routes.map((r, i) => {
                const chColor = CHANNEL_COLORS[r.channel] || '#38BDF8';
                return (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: chColor + '08', border: `1px solid ${chColor}20` }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-[11px]"
                        style={{ background: chColor + '15', color: chColor, border: `1px solid ${chColor}25` }}>
                        {r.channel[0]}
                      </div>
                      <div>
                        <p className="text-[12px] font-bold" style={{ color: chColor }}>{r.channel}</p>
                        <p className="text-[10px]" style={{ color: '#9CA3AF' }}>
                          {r.count} route{r.count > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] font-bold" style={{ color: '#374151' }}>{r.volume}</p>
                      <p className="text-[10px]" style={{ color: '#9CA3AF' }}>daily volume</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Team */}
        <div className="rounded-2xl p-5"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h3 className="text-[13px] font-bold mb-4 flex items-center gap-2" style={{ color: '#111827' }}>
            <Users className="w-4 h-4" style={{ color: hub.color }} />
            Operations Team
          </h3>
          <div className="space-y-3">
            {/* Manager */}
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-[13px]"
                style={{ background: hub.color + '20', color: hub.color, border: `1px solid ${hub.color}30` }}>
                {hub.manager[0]}
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-bold" style={{ color: '#111827' }}>{hub.manager}</p>
                <p className="text-[10px]" style={{ color: '#9CA3AF' }}>Hub Manager</p>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: hub.color + '15', color: hub.color }}>Manager</span>
            </div>
            {/* QC Team */}
            {hub.qcTeam.length === 0 ? (
              <p className="text-[11px] text-center py-2" style={{ color: '#9CA3AF' }}>No QC team assigned yet.</p>
            ) : hub.qcTeam.map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-[13px]"
                  style={{ background: 'rgba(14,138,107,0.15)', color: '#0E8A6B', border: '1px solid rgba(14,138,107,0.2)' }}>
                  {m[0]}
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-bold" style={{ color: '#111827' }}>{m}</p>
                  <p className="text-[10px]" style={{ color: '#9CA3AF' }}>QC & Operations</p>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(14,138,107,0.12)', color: '#0E8A6B', border: '1px solid rgba(14,138,107,0.2)' }}>QC</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl p-5"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h3 className="text-[13px] font-bold mb-4" style={{ color: '#111827' }}>Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'QC Inspection', icon: PackageCheck, path: '/warehouse/qc', color: '#0E8A6B' },
            { label: 'Inventory', icon: Package, path: '/warehouse/inventory', color: '#38BDF8' },
            { label: 'Dispatch', icon: Truck, path: '/logistics', color: '#D97706' },
            { label: 'Reports', icon: BarChart3, path: '/reports', color: '#A78BFA' },
          ].map((a, i) => (
            <button key={i} onClick={() => navigate(a.path)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-all duration-150"
              style={{ background: a.color + '0D', border: `1px solid ${a.color}20` }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = a.color + '18'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = a.color + '0D'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: a.color + '20' }}>
                <a.icon className="w-4 h-4" style={{ color: a.color }} />
              </div>
              <span className="text-[11px] font-bold" style={{ color: a.color }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── All Hubs Overview ─────────────────────────────────────────────────────────
function AllHubsOverview({ hubs, isLoading, refetch }: { hubs: Hub[]; isLoading: boolean; refetch: () => void }) {
  const navigate = useNavigate();

  const totalRoutes = hubs.reduce((s, h) => s + h.routes.reduce((rs, r) => rs + r.count, 0), 0);
  const totalChannels = new Set(hubs.flatMap(h => h.channels)).size;
  const activeChannelList = Array.from(new Set(hubs.flatMap(h => h.channels))).join(', ') || 'none configured';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#9CA3AF' }} />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-black tracking-tight" style={{ color: '#111827' }}>
            Hub Management
          </h1>
          <p className="text-[12px] mt-0.5 font-medium" style={{ color: '#6B7280' }}>
            Manage all {hubs.length} warehouse hub{hubs.length === 1 ? '' : 's'} — operations, teams, routes, and performance
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Hubs" value={hubs.length} icon={Warehouse} color="#38BDF8" sub="in system" />
        <StatCard label="Total Routes" value={totalRoutes} icon={Truck} color="#2563EB" sub="daily" />
        <StatCard label="Sales Channels" value={totalChannels} icon={BarChart3} color="#FBBF24" sub={activeChannelList} />
        <StatCard label="Active Hubs" value={hubs.filter(h => h.status === 'active').length} icon={Package} color="#A78BFA" sub="operational" />
      </div>

      {/* Hub Cards */}
      <div>
        <h2 className="text-[13px] font-bold mb-3 flex items-center gap-2" style={{ color: '#374151' }}>
          <MapPin className="w-4 h-4" style={{ color: '#2563EB' }} />
          All Hubs
        </h2>
        {hubs.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ border: '1px dashed #E5E7EB', color: '#9CA3AF' }}>
            <Warehouse className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No hubs found in the database.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {hubs.map(hub => (
              <HubCard
                key={hub.id}
                hub={hub}
                onClick={() => navigate(`/admin/hubs/${hub.slug}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Channel × Hub Matrix */}
      {hubs.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <span className="text-[13px] font-black" style={{ color: '#111827' }}>Channel × Hub Matrix</span>
          </div>
          <div className="p-5 overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <th className="text-left pb-3 pr-4 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: '#9CA3AF' }}>Channel</th>
                  {hubs.map(h => (
                    <th key={h.id} className="text-center pb-3 px-3 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: '#9CA3AF' }}>{h.code}</th>
                  ))}
                  <th className="text-center pb-3 pl-3 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: '#9CA3AF' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {['FF', 'DMART', 'BLINKIT', 'ZEPTO'].map(channel => {
                  const chColor = CHANNEL_COLORS[channel] || '#38BDF8';
                  let rowTotal = 0;
                  return (
                    <tr key={channel} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td className="py-3 pr-4">
                        <span className="font-black px-2 py-0.5 rounded-full text-[10px]"
                          style={{ background: chColor + '12', color: chColor, border: `1px solid ${chColor}25` }}>{channel}</span>
                      </td>
                      {hubs.map(hub => {
                        const route = hub.routes.find(r => r.channel === channel);
                        const count = route?.count || 0;
                        rowTotal += count;
                        return (
                          <td key={hub.id} className="text-center py-3 px-3">
                            {count > 0 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black"
                                style={{ background: chColor + '15', color: chColor }}>
                                {count}
                              </span>
                            ) : (
                              <span className="text-[12px]" style={{ color: '#D1D5DB' }}>—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center py-3 pl-3">
                        <span className="font-black text-[13px]" style={{ color: '#111827' }}>{rowTotal}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function HubManagementPage() {
  const { hubId } = useParams<{ hubId?: string }>();
  const { data: hubs = [], isLoading, refetch } = useHubs();
  return hubId
    ? <HubDetail hubId={hubId} hubs={hubs} isLoading={isLoading} />
    : <AllHubsOverview hubs={hubs} isLoading={isLoading} refetch={() => refetch()} />;
}
