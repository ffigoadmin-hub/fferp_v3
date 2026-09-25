-- ADD_FIXED_ASSET_REGISTER.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- P1 #2: Fixed Asset Register with depreciation.
--
-- Before this, "Vehicles" / "Crates & Hub Equipment" / "Furniture & Computers" existed only as
-- three bare chart-of-accounts balances (codes 1210/1220/1230) — no register of individual
-- assets, no depreciation. This adds:
--   - fixed_assets: one row per physical asset (cost, salvage value, useful life, which of the
--     three category accounts it belongs to, running accumulated depreciation).
--   - fixed_asset_depreciation_runs: one row per calendar month a depreciation run was executed —
--     acts as the "source document" for its posted voucher, same pattern as every other
--     acct_auto_post source in this system (dedup by source_table+source_id).
--   - Straight-line depreciation only (monthly = (cost − salvage) / (useful_life_years × 12)),
--     capped so an asset never depreciates past (cost − salvage). Kept to one method
--     deliberately — this is a small business, not a statutory multi-method WDV/SLM shop.
--   - acct_run_depreciation(month): computes each active asset's depreciation for that month,
--     posts ONE combined voucher (Dr Depreciation Expense / Cr Accumulated Depreciation), and
--     updates each asset's running accumulated_depreciation. Idempotent per month (the run table
--     has a unique constraint on run_month; acct_auto_post's own dedup also guards the voucher).
--
-- New accounts: 1240 Accumulated Depreciation (contra fixed-asset), 5380 Depreciation (indirect
-- expense).
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

INSERT INTO public.acct_accounts (code, name, parent_id, is_group, root_type, account_type, system_key)
SELECT '1240', 'Accumulated Depreciation', id, false, 'asset', 'fixed_asset', 'accumulated_depreciation'
FROM public.acct_accounts WHERE code = '1200'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.acct_accounts (code, name, parent_id, is_group, root_type, account_type, system_key)
SELECT '5380', 'Depreciation', id, false, 'expense', 'indirect_expense', 'depreciation_expense'
FROM public.acct_accounts WHERE code = '5300'
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name              text NOT NULL,
  asset_code              text,
  account_id              uuid NOT NULL REFERENCES public.acct_accounts(id),
  hub_id                  uuid REFERENCES public.hubs(id),
  purchase_date           date NOT NULL,
  purchase_cost           numeric NOT NULL CHECK (purchase_cost > 0),
  salvage_value           numeric NOT NULL DEFAULT 0,
  useful_life_years       numeric NOT NULL CHECK (useful_life_years > 0),
  accumulated_depreciation numeric NOT NULL DEFAULT 0,
  status                  text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disposed')),
  disposal_date           date,
  disposal_value          numeric,
  notes                   text,
  created_by              uuid REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fixed_assets_admin_full ON public.fixed_assets;
CREATE POLICY fixed_assets_admin_full ON public.fixed_assets FOR ALL
  USING (get_my_role() = ANY (ARRAY['admin','ceo','accounts']))
  WITH CHECK (get_my_role() = ANY (ARRAY['admin','ceo','accounts']));

DROP POLICY IF EXISTS fixed_assets_read_all_staff ON public.fixed_assets;
CREATE POLICY fixed_assets_read_all_staff ON public.fixed_assets FOR SELECT
  USING (get_my_role() = ANY (ARRAY['admin','ceo','gm','accounts','director','auditor','ff_operations_manager']));

CREATE TABLE IF NOT EXISTS public.fixed_asset_depreciation_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_month          date NOT NULL UNIQUE,
  total_depreciation numeric NOT NULL DEFAULT 0,
  assets_processed   integer NOT NULL DEFAULT 0,
  run_by             uuid REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fixed_asset_depreciation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS depreciation_runs_admin_full ON public.fixed_asset_depreciation_runs;
CREATE POLICY depreciation_runs_admin_full ON public.fixed_asset_depreciation_runs FOR ALL
  USING (get_my_role() = ANY (ARRAY['admin','ceo','accounts']))
  WITH CHECK (get_my_role() = ANY (ARRAY['admin','ceo','accounts']));

DROP POLICY IF EXISTS depreciation_runs_read_all_staff ON public.fixed_asset_depreciation_runs;
CREATE POLICY depreciation_runs_read_all_staff ON public.fixed_asset_depreciation_runs FOR SELECT
  USING (get_my_role() = ANY (ARRAY['admin','ceo','gm','accounts','director','auditor','ff_operations_manager']));

CREATE OR REPLACE FUNCTION public.acct_run_depreciation(p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_next_month date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_run_id uuid; v_total numeric := 0; v_count int := 0;
  r public.fixed_assets; v_monthly numeric; v_remaining numeric; v_this_month numeric;
  v_voucher_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.acct_can_write() OR public.acct_can_approve()) THEN
    RAISE EXCEPTION 'Only Accounts, Admin or CEO can run depreciation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.fixed_asset_depreciation_runs WHERE run_month = v_month) THEN
    RAISE EXCEPTION 'Depreciation for % has already been run', to_char(v_month, 'Mon YYYY');
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _dep_applied (asset_id uuid, amt numeric) ON COMMIT DROP;
  TRUNCATE _dep_applied;

  FOR r IN
    SELECT * FROM public.fixed_assets
    WHERE status = 'active' AND purchase_date < v_next_month
    ORDER BY purchase_date
  LOOP
    v_remaining := round(r.purchase_cost - r.salvage_value - r.accumulated_depreciation, 2);
    IF v_remaining <= 0 THEN CONTINUE; END IF;
    v_monthly := round((r.purchase_cost - r.salvage_value) / (r.useful_life_years * 12), 2);
    v_this_month := LEAST(v_monthly, v_remaining);
    IF v_this_month <= 0 THEN CONTINUE; END IF;

    UPDATE public.fixed_assets SET accumulated_depreciation = accumulated_depreciation + v_this_month,
      updated_at = now() WHERE id = r.id;
    INSERT INTO _dep_applied (asset_id, amt) VALUES (r.id, v_this_month);
    v_total := v_total + v_this_month;
    v_count := v_count + 1;
  END LOOP;

  IF v_total <= 0 THEN
    RETURN jsonb_build_object('run', false, 'reason', 'No depreciable assets for this month', 'assets_processed', 0, 'total_depreciation', 0);
  END IF;

  INSERT INTO public.fixed_asset_depreciation_runs (run_month, total_depreciation, assets_processed, run_by)
  VALUES (v_month, v_total, v_count, auth.uid())
  RETURNING id INTO v_run_id;

  v_voucher_id := public.acct_auto_post(jsonb_build_object(
    'source_table', 'fixed_asset_depreciation_runs', 'source_id', v_run_id, 'voucher_type', 'period_closing',
    'posting_date', (v_next_month - interval '1 day')::date,
    'narration', 'Depreciation for ' || to_char(v_month, 'Mon YYYY') || ' — ' || v_count || ' asset(s)',
    'lines', jsonb_build_array(
      jsonb_build_object('system_key','depreciation_expense', 'debit', v_total),
      jsonb_build_object('system_key','accumulated_depreciation', 'credit', v_total))));

  IF v_voucher_id IS NULL THEN
    -- Posting failed (see acct_posting_errors) — undo the per-asset accumulation and the run
    -- record exactly, using what was actually applied, so this month can be retried.
    UPDATE public.fixed_assets fa SET accumulated_depreciation = accumulated_depreciation - d.amt
    FROM _dep_applied d WHERE fa.id = d.asset_id;
    DELETE FROM public.fixed_asset_depreciation_runs WHERE id = v_run_id;
    RETURN jsonb_build_object('run', false, 'reason', 'Voucher posting failed — see acct_posting_errors', 'assets_processed', 0, 'total_depreciation', 0);
  END IF;

  RETURN jsonb_build_object('run', true, 'run_id', v_run_id, 'voucher_id', v_voucher_id,
    'assets_processed', v_count, 'total_depreciation', v_total);
END $$;

REVOKE EXECUTE ON FUNCTION public.acct_run_depreciation(date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.acct_run_depreciation(date) TO authenticated;
