// @ts-nocheck
// ─────────────────────────────────────────────────────────────
//  Admin QC Overview — read-only, cross-hub quality snapshot.
//  No edit/inspect actions here; that workflow lives at
//  /warehouse/qc (QCInspection.tsx) for QC staff. This page only
//  ever reads qc_inspections — never writes to it.
// ─────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ClipboardCheck, CheckCircle2, XCircle, AlertTriangle, Scale } from 'lucide-react';

function KPICard({ label, value, sub, icon: Icon, iconBg, iconColor, notAvailable }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${notAvailable ? 'text-gray-300' : 'text-gray-900'}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: iconBg }}>
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
        </div>
      </div>
    </div>
  );
}

export default function AdminQCOverviewPage() {
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const { data: hubs = [] } = useQuery({
    queryKey: ['admin-qc-hubs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hubs').select('id, name').eq('is_active', true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: inspections = [], isLoading } = useQuery({
    queryKey: ['admin-qc-inspections', monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qc_inspections')
        .select('hub_id, overall_grade, status, grade_a_kg, grade_b_kg, grade_c_kg, grade_d_kg, product_id, created_at')
        .gte('created_at', `${monthStart}T00:00:00`)
        .lte('created_at', monthEnd + 'T23:59:59');
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = inspections.length;
  const accepted = inspections.filter((i: any) => i.status === 'accepted').length;
  const partial = inspections.filter((i: any) => i.status === 'partial').length;
  const rejected = inspections.filter((i: any) => i.status === 'rejected').length;
  const passRate = total > 0 ? Math.round((accepted / total) * 100) : null;

  const gradeKg = inspections.reduce(
    (acc: any, i: any) => ({
      A: acc.A + Number(i.grade_a_kg || 0),
      B: acc.B + Number(i.grade_b_kg || 0),
      C: acc.C + Number(i.grade_c_kg || 0),
      D: acc.D + Number(i.grade_d_kg || 0),
    }),
    { A: 0, B: 0, C: 0, D: 0 }
  );
  const totalGradedKg = gradeKg.A + gradeKg.B + gradeKg.C + gradeKg.D;

  const hubBreakdown = hubs
    .map((h: any) => {
      const rows = inspections.filter((i: any) => i.hub_id === h.id);
      const hubAccepted = rows.filter((i: any) => i.status === 'accepted').length;
      return {
        name: h.name,
        total: rows.length,
        passRate: rows.length > 0 ? Math.round((hubAccepted / rows.length) * 100) : null,
        rejected: rows.filter((i: any) => i.status === 'rejected').length,
      };
    })
    .filter((h: any) => h.total > 0)
    .sort((a: any, b: any) => b.total - a.total);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 pt-2">
      <div>
        <h1 className="text-xl font-bold text-gray-900">QC Overview</h1>
        <p className="text-xs text-gray-500 mt-0.5">Read-only quality snapshot across all hubs · {format(new Date(), 'MMMM yyyy')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Inspections This Month" value={isLoading ? '…' : total} sub="all hubs"
          icon={ClipboardCheck} iconBg="#EFF6FF" iconColor="#2563EB"
        />
        <KPICard
          label="Pass Rate" value={passRate !== null ? `${passRate}%` : '—'}
          sub={total > 0 ? `${accepted}/${total} accepted` : 'no inspections this month'}
          icon={CheckCircle2} iconBg="#DCFCE7" iconColor="#16A34A" notAvailable={passRate === null}
        />
        <KPICard
          label="Rejected" value={isLoading ? '…' : rejected} sub={total > 0 ? `${Math.round((rejected / total) * 100)}% of inspections` : ''}
          icon={XCircle} iconBg="#FEF2F2" iconColor="#DC2626"
        />
        <KPICard
          label="Partial Accept" value={isLoading ? '…' : partial} sub="mixed-grade lots"
          icon={AlertTriangle} iconBg="#FEF3C7" iconColor="#D97706"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Scale className="w-4 h-4 text-gray-500" /> Grade Distribution (kg)
        </h2>
        {totalGradedKg === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No graded weight recorded this month.</p>
        ) : (
          <div className="space-y-2.5">
            {(['A', 'B', 'C', 'D'] as const).map(grade => {
              const kg = gradeKg[grade];
              const pct = totalGradedKg > 0 ? (kg / totalGradedKg) * 100 : 0;
              const colors: Record<string, string> = { A: 'bg-green-500', B: 'bg-blue-500', C: 'bg-amber-500', D: 'bg-red-500' };
              return (
                <div key={grade} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-600 w-16 shrink-0">Grade {grade}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${colors[grade]}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-28 text-right shrink-0">{kg.toLocaleString('en-IN')} kg ({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Per-Hub Breakdown</h2>
        </div>
        {hubBreakdown.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No inspections recorded this month.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Hub</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500">Inspections</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500">Pass Rate</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500">Rejected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {hubBreakdown.map((h: any) => (
                <tr key={h.name}>
                  <td className="px-5 py-2.5 font-medium text-gray-800">{h.name}</td>
                  <td className="px-5 py-2.5 text-right text-gray-600">{h.total}</td>
                  <td className="px-5 py-2.5 text-right font-semibold text-gray-800">{h.passRate}%</td>
                  <td className="px-5 py-2.5 text-right text-red-600">{h.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
