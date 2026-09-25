-- ADD_ASSET_VERIFICATION_AUDIT.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Asset Management, Phase 5: periodic physical verification (a spot-check that assets on paper
-- still exist, at the hub/with the person the register says they're at).
--
-- asset_verification_cycles: one row per audit round (e.g. "Q3 2026 Physical Verification").
-- asset_verification_items:  a snapshot row per active asset, taken the moment the cycle starts
--                            (expected_hub_id/expected_assigned_to freeze what the register said
--                            at that instant, so later custody changes don't retroactively change
--                            what the audit was checking against). Whoever does the physical walk
--                            marks each item verified / missing / damaged, with an optional note
--                            of where it was actually found.
--
-- Starting and closing a cycle is restricted to admin/ceo/gm/ff_operations_manager (a cycle is a
-- controlled event, not something anyone kicks off). Marking individual items is left to normal
-- staff access (is_staff()), same as the rest of this module, since the person doing the physical
-- walk is often not an admin-tier role.
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.asset_verification_cycles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  due_date    date,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  started_by  uuid REFERENCES auth.users(id),
  started_at  timestamptz NOT NULL DEFAULT now(),
  closed_by   uuid REFERENCES auth.users(id),
  closed_at   timestamptz
);
ALTER TABLE public.asset_verification_cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asset_verification_cycles_staff_access ON public.asset_verification_cycles;
CREATE POLICY asset_verification_cycles_staff_access ON public.asset_verification_cycles FOR ALL USING (is_staff()) WITH CHECK (is_staff());

CREATE TABLE IF NOT EXISTS public.asset_verification_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id              uuid NOT NULL REFERENCES public.asset_verification_cycles(id),
  asset_id              uuid NOT NULL REFERENCES public.fixed_assets(id),
  expected_hub_id       uuid REFERENCES public.hubs(id),
  expected_assigned_to  uuid REFERENCES auth.users(id),
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'missing', 'damaged')),
  found_hub_id          uuid REFERENCES public.hubs(id),
  notes                 text,
  verified_by           uuid REFERENCES auth.users(id),
  verified_at           timestamptz,
  UNIQUE (cycle_id, asset_id)
);
ALTER TABLE public.asset_verification_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asset_verification_items_staff_access ON public.asset_verification_items;
CREATE POLICY asset_verification_items_staff_access ON public.asset_verification_items FOR ALL USING (is_staff()) WITH CHECK (is_staff());

CREATE OR REPLACE FUNCTION public.asset_verification_start_cycle(p_name text, p_due_date date DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'gm', 'ff_operations_manager')
  ) THEN
    RAISE EXCEPTION 'Not authorized to start a verification cycle';
  END IF;

  INSERT INTO public.asset_verification_cycles (name, due_date, started_by)
  VALUES (p_name, p_due_date, auth.uid())
  RETURNING id INTO v_cycle_id;

  INSERT INTO public.asset_verification_items (cycle_id, asset_id, expected_hub_id, expected_assigned_to)
  SELECT v_cycle_id, id, hub_id, assigned_to
  FROM public.fixed_assets
  WHERE status = 'active';

  RETURN v_cycle_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.asset_verification_start_cycle(text, date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.asset_verification_start_cycle(text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.asset_verification_close_cycle(p_cycle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'gm', 'ff_operations_manager')
  ) THEN
    RAISE EXCEPTION 'Not authorized to close a verification cycle';
  END IF;

  SELECT count(*) INTO v_pending FROM public.asset_verification_items WHERE cycle_id = p_cycle_id AND status = 'pending';

  UPDATE public.asset_verification_cycles
  SET status = 'closed', closed_by = auth.uid(), closed_at = now()
  WHERE id = p_cycle_id;

  RETURN jsonb_build_object('cycle_id', p_cycle_id, 'closed_with_pending', v_pending);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.asset_verification_close_cycle(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.asset_verification_close_cycle(uuid) TO authenticated;
