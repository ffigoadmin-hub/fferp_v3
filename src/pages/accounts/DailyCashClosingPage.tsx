// @ts-nocheck   -- daily_cash_closings is missing from types.ts (see fferp-database)
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { Building2, Loader2, RefreshCw, Save, ClipboardList, History, AlertTriangle, CheckCircle2 } from 'lucide-react';

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function DailyCashClosingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isHubLocked = !!(user as any)?.hub_id;
  const [hubId, setHubId] = useState((user as any)?.hub_id ?? '');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [view, setView] = useState<'entry' | 'history'>('entry');
  const [historyFrom, setHistoryFrom] = useState(format(subDays(new Date(), 13), 'yyyy-MM-dd'));
  const [historyTo, setHistoryTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [openingCash, setOpeningCash] = useState('0');
  const [cashCollected, setCashCollected] = useState('0');
  const [upiCollected, setUpiCollected] = useState('0');
  const [cashExpenses, setCashExpenses] = useState('0');
  const [cashDeposited, setCashDeposited] = useState('0');
  const [actualCash, setActualCash] = useState('0');
  const [notes, setNotes] = useState('');
  const [loadedKey, setLoadedKey] = useState('');

  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-active'],
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('id, name').eq('is_active', true);
      return data ?? [];
    },
  });

  const { isLoading, refetch, isFetching } = useQuery({
    queryKey: ['daily-cash-closing', hubId, date],
    enabled: !!hubId,
    queryFn: async () => {
      const { data: existing, error } = await supabase
        .from('daily_cash_closings')
        .select('*')
        .eq('hub_id', hubId)
        .eq('closing_date', date)
        .maybeSingle();
      if (error) throw error;

      const { data: collections, error: cErr } = await supabase
        .from('cash_collections')
        .select('collected_amount, payment_mode')
        .eq('hub_id', hubId)
        .eq('collection_date', date);
      if (cErr) throw cErr;
      const cashSum = (collections ?? []).filter((c: any) => c.payment_mode === 'cash').reduce((s: number, c: any) => s + Number(c.collected_amount || 0), 0);
      const upiSum = (collections ?? []).filter((c: any) => c.payment_mode !== 'cash').reduce((s: number, c: any) => s + Number(c.collected_amount || 0), 0);

      let opening = 0;
      if (existing) {
        opening = Number(existing.opening_cash);
      } else {
        const { data: prior } = await supabase.rpc('cash_closing_prior_balance', { p_hub_id: hubId, p_date: date });
        opening = Number(prior || 0);
      }

      setOpeningCash(String(opening));
      setCashCollected(String(existing ? existing.cash_collected : cashSum));
      setUpiCollected(String(existing ? existing.upi_collected : upiSum));
      setCashExpenses(String(existing?.cash_expenses ?? 0));
      setCashDeposited(String(existing?.cash_deposited ?? 0));
      setActualCash(String(existing?.actual_cash ?? 0));
      setNotes(existing?.notes ?? '');
      setLoadedKey(`${hubId}|${date}`);
      return { existing, cashSum, upiSum };
    },
  });

  const { data: history = [], isLoading: historyLoading, refetch: refetchHistory, isFetching: historyFetching } = useQuery({
    queryKey: ['daily-cash-closing-history', hubId, historyFrom, historyTo],
    enabled: !!hubId && view === 'history',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_cash_closings')
        .select('*')
        .eq('hub_id', hubId)
        .gte('closing_date', historyFrom)
        .lte('closing_date', historyTo)
        .order('closing_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const expected = Number(openingCash || 0) + Number(cashCollected || 0) - Number(cashExpenses || 0) - Number(cashDeposited || 0);
  const variance = Number(actualCash || 0) - expected;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('daily_cash_closings').upsert({
        hub_id: hubId,
        closing_date: date,
        opening_cash: Number(openingCash) || 0,
        cash_collected: Number(cashCollected) || 0,
        upi_collected: Number(upiCollected) || 0,
        cash_expenses: Number(cashExpenses) || 0,
        cash_deposited: Number(cashDeposited) || 0,
        actual_cash: Number(actualCash) || 0,
        notes: notes || null,
        closed_by: (user as any)?.id ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'hub_id,closing_date' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cash closing saved');
      qc.invalidateQueries({ queryKey: ['daily-cash-closing'] });
      qc.invalidateQueries({ queryKey: ['daily-cash-closing-history'] });
      refetch();
    },
    onError: (e: any) => toast.error(`Failed to save: ${e.message}`),
  });

  const hubName = (hubs as any[]).find(h => h.id === hubId)?.name ?? '';

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12 pt-2">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Daily Cash Closing</h1>
          <p className="text-[13px] text-slate-500">Opening cash + collections − expenses − deposits = expected, vs. actual counted</p>
        </div>
        {view === 'entry' && (
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!hubId || saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Closing
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setView('entry')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'entry' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ClipboardList className="h-3.5 w-3.5" /> Today's Closing
        </button>
        <button
          onClick={() => setView('history')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <History className="h-3.5 w-3.5" /> History
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-400" />
          {isHubLocked ? (
            <span className="text-sm font-medium text-slate-700">{hubName || 'My Hub'}</span>
          ) : (
            <select value={hubId} onChange={e => setHubId(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-md text-sm">
              <option value="">Select hub…</option>
              {(hubs as any[]).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
        </div>
        {view === 'entry' ? (
          <>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-md text-sm" />
            <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </>
        ) : (
          <>
            <span className="text-xs text-gray-500">From</span>
            <input type="date" value={historyFrom} onChange={e => setHistoryFrom(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-md text-sm" />
            <span className="text-xs text-gray-500">To</span>
            <input type="date" value={historyTo} onChange={e => setHistoryTo(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-md text-sm" />
            <button onClick={() => refetchHistory()} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
              <RefreshCw className={`h-3.5 w-3.5 ${historyFetching ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </>
        )}
      </div>

      {view === 'history' ? (
        !hubId ? (
          <div className="p-10 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">Select a hub to view history.</div>
        ) : historyLoading ? (
          <div className="p-10 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…</div>
        ) : (history as any[]).length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
            <History className="h-10 w-10 mx-auto mb-3 text-gray-200" />
            No closings recorded in this date range.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-[100px_100px_100px_100px_100px_100px_100px] gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
              <span>Date</span><span className="text-right">Opening</span><span className="text-right">Collected</span>
              <span className="text-right">Expenses</span><span className="text-right">Deposited</span>
              <span className="text-right">Expected</span><span className="text-right">Variance</span>
            </div>
            <div className="divide-y divide-gray-50">
              {(history as any[]).map((r: any) => {
                const exp = Number(r.opening_cash) + Number(r.cash_collected) - Number(r.cash_expenses) - Number(r.cash_deposited);
                const varc = Number(r.actual_cash) - exp;
                return (
                  <div key={r.id} className="grid grid-cols-[100px_100px_100px_100px_100px_100px_100px] gap-2 px-5 py-2.5 items-center hover:bg-gray-50">
                    <span className="text-sm text-gray-600">{format(new Date(r.closing_date), 'd MMM yyyy')}</span>
                    <span className="text-right text-sm text-gray-700">{inr(r.opening_cash)}</span>
                    <span className="text-right text-sm text-gray-700">{inr(r.cash_collected)}</span>
                    <span className="text-right text-sm text-gray-700">{inr(r.cash_expenses)}</span>
                    <span className="text-right text-sm text-gray-700">{inr(r.cash_deposited)}</span>
                    <span className="text-right text-sm text-gray-700">{inr(exp)}</span>
                    <span className={`text-right text-sm font-semibold ${varc === 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {varc === 0 ? '✓ 0' : (varc > 0 ? '+' : '') + inr(varc)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : !hubId ? (
        <div className="p-10 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">Select a hub to record today's closing.</div>
      ) : isLoading && loadedKey !== `${hubId}|${date}` ? (
        <div className="p-10 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Opening Cash (₹)</label>
              <input type="number" value={openingCash} onChange={e => setOpeningCash(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              <p className="text-[11px] text-gray-400 mt-1">Suggested from yesterday's actual cash — edit if wrong</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Cash Collected (₹)</label>
              <input type="number" value={cashCollected} onChange={e => setCashCollected(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              <p className="text-[11px] text-gray-400 mt-1">Suggested from field collections logged today — edit if incomplete</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">UPI / Other Collected (₹)</label>
              <input type="number" value={upiCollected} onChange={e => setUpiCollected(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50" />
              <p className="text-[11px] text-gray-400 mt-1">Informational only — not part of the physical cash count</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Cash Expenses (₹)</label>
              <input type="number" value={cashExpenses} onChange={e => setCashExpenses(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Cash Deposited to Bank (₹)</label>
              <input type="number" value={cashDeposited} onChange={e => setCashDeposited(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Actual Cash Counted (₹) *</label>
              <input type="number" value={actualCash} onChange={e => setActualCash(e.target.value)} className="w-full px-3 py-2 border-2 border-blue-200 rounded-md text-sm font-semibold" />
            </div>
          </div>

          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes (optional)…"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm resize-none" />

          <div className={`rounded-lg p-4 flex items-center justify-between ${variance === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Expected Cash</p>
              <p className="text-lg font-bold text-gray-800">{inr(expected)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-500 uppercase flex items-center justify-end gap-1">
                {variance === 0 ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
                Variance
              </p>
              <p className={`text-lg font-bold ${variance === 0 ? 'text-green-700' : 'text-red-700'}`}>
                {variance === 0 ? 'Matched' : `${variance > 0 ? '+' : ''}${inr(variance)} ${variance > 0 ? '(surplus)' : '(shortage)'}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
