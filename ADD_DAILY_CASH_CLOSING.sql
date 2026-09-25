-- ADD_DAILY_CASH_CLOSING.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- P1 #1: Daily Branch Cash Closing — internal-control worksheet per hub per day:
--   Opening Cash + Cash Collected − Cash Expenses − Cash Deposited = Expected Cash
--   vs. Actual Cash counted, with the difference flagged as Variance.
--
-- Deliberately kept separate from the existing petty-cash-float system (petty_cash_ledger /
-- usePettyCash) — that's a different, already-functional cash pool (small office expense float,
-- refilled periodically) from the day's field-collected sales cash this worksheet reconciles.
-- Cash Expenses here is a plain manual total entered by the hub manager, not pulled from petty
-- cash, since the two aren't confirmed to be the same physical cash box.
--
-- Cash Collected auto-suggests from cash_collections (payment_mode='cash', that hub+date) —
-- editable in case of known gaps, since it's a suggestion, not a locked source of truth.
--
-- This is a reconciliation report only — it does NOT auto-post any voucher. A material variance
-- found here is a signal for accounts to investigate/post manually, not something to book
-- automatically (this table records what was counted, not an accounting judgement).
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.daily_cash_closings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id          uuid NOT NULL REFERENCES public.hubs(id),
  closing_date    date NOT NULL,
  opening_cash    numeric NOT NULL DEFAULT 0,
  cash_collected  numeric NOT NULL DEFAULT 0,
  upi_collected   numeric NOT NULL DEFAULT 0,
  cash_expenses   numeric NOT NULL DEFAULT 0,
  cash_deposited  numeric NOT NULL DEFAULT 0,
  actual_cash     numeric NOT NULL DEFAULT 0,
  notes           text,
  closed_by       uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hub_id, closing_date)
);

ALTER TABLE public.daily_cash_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_closing_admin_full ON public.daily_cash_closings;
CREATE POLICY cash_closing_admin_full ON public.daily_cash_closings FOR ALL
  USING (get_my_role() = ANY (ARRAY['admin','ceo','gm']))
  WITH CHECK (get_my_role() = ANY (ARRAY['admin','ceo','gm']));

DROP POLICY IF EXISTS cash_closing_ops_all_hubs ON public.daily_cash_closings;
CREATE POLICY cash_closing_ops_all_hubs ON public.daily_cash_closings FOR ALL
  USING (get_my_role() = 'ff_operations_manager')
  WITH CHECK (get_my_role() = 'ff_operations_manager');

DROP POLICY IF EXISTS cash_closing_hub_manager_own_hub ON public.daily_cash_closings;
CREATE POLICY cash_closing_hub_manager_own_hub ON public.daily_cash_closings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'hub_manager' AND p.hub_id = daily_cash_closings.hub_id))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'hub_manager' AND p.hub_id = daily_cash_closings.hub_id));

DROP POLICY IF EXISTS cash_closing_read_all_staff ON public.daily_cash_closings;
CREATE POLICY cash_closing_read_all_staff ON public.daily_cash_closings FOR SELECT
  USING (get_my_role() = ANY (ARRAY['admin','ceo','gm','auditor','accounts','director']));

-- Helper: previous closing's actual_cash for a hub, to suggest the next day's opening cash
CREATE OR REPLACE FUNCTION public.cash_closing_prior_balance(p_hub_id uuid, p_date date) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT actual_cash FROM public.daily_cash_closings
  WHERE hub_id = p_hub_id AND closing_date < p_date
  ORDER BY closing_date DESC LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.cash_closing_prior_balance(uuid, date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cash_closing_prior_balance(uuid, date) TO authenticated;
