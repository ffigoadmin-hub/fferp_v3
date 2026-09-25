-- ADD_CRATE_TRACKING.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Asset Management, Phase 2: Crate Tracking — the highest-ROI piece of the plan for a produce-
-- trading business. Crates are lent to customers/vendors and routinely don't come back; right now
-- "Crates & Hub Equipment" is a single lump depreciation line with no count of how many crates
-- exist, which hub has them, or which are outstanding with a party.
--
-- Design: crates are fungible (not individually serialized) — tracked as quantity movements per
-- crate type, mirroring the same "ledger of movements, balance is derived" pattern already used
-- for produce inventory (inv__move()/inventory_log) rather than inventing a new paradigm.
--
--   crate_types:      the kinds of crates FF uses (seeded with one to match the existing
--                      "Crates & Hub Equipment" asset category; add more anytime).
--   crate_movements:  one row per event — issued to a customer/vendor, returned, transferred
--                      between hubs, received new, damaged, lost, or a manual adjustment.
--   crate_hub_balance(): current on-hand quantity per hub per type, computed from movements.
--   crate_party_outstanding(): how many crates each customer/vendor currently holds (issued minus
--                      returned), so leakage is visible per-party, not just as a vague suspicion.
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.crate_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  unit_cost   numeric,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crate_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crate_types_staff_access ON public.crate_types;
CREATE POLICY crate_types_staff_access ON public.crate_types FOR ALL USING (is_staff()) WITH CHECK (is_staff());

INSERT INTO public.crate_types (name, unit_cost)
VALUES ('Standard Crate', NULL)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.crate_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crate_type_id   uuid NOT NULL REFERENCES public.crate_types(id),
  movement_type   text NOT NULL CHECK (movement_type IN (
                    'received_new','issued_to_customer','issued_to_vendor',
                    'returned_from_customer','returned_from_vendor',
                    'transfer','damaged','lost','adjustment')),
  quantity        integer NOT NULL CHECK (quantity > 0),
  hub_id          uuid REFERENCES public.hubs(id),
  other_hub_id    uuid REFERENCES public.hubs(id), -- for movement_type='transfer': the destination hub
  party_type      text CHECK (party_type IN ('customer','vendor')),
  party_id        uuid,
  party_name      text,
  reference_no    text,
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crate_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crate_movements_staff_access ON public.crate_movements;
CREATE POLICY crate_movements_staff_access ON public.crate_movements FOR ALL USING (is_staff()) WITH CHECK (is_staff());

CREATE OR REPLACE FUNCTION public.crate_hub_balance() RETURNS TABLE (
  hub_id uuid, crate_type_id uuid, on_hand bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hub_id, crate_type_id, sum(delta)::bigint AS on_hand FROM (
    SELECT hub_id, crate_type_id, quantity AS delta FROM public.crate_movements
      WHERE movement_type IN ('received_new','returned_from_customer','returned_from_vendor')
    UNION ALL
    SELECT hub_id, crate_type_id, -quantity FROM public.crate_movements
      WHERE movement_type IN ('issued_to_customer','issued_to_vendor','damaged','lost')
    UNION ALL
    SELECT hub_id, crate_type_id, -quantity FROM public.crate_movements WHERE movement_type = 'transfer'
    UNION ALL
    SELECT other_hub_id AS hub_id, crate_type_id, quantity FROM public.crate_movements
      WHERE movement_type = 'transfer' AND other_hub_id IS NOT NULL
    UNION ALL
    SELECT hub_id, crate_type_id, quantity FROM public.crate_movements WHERE movement_type = 'adjustment'
  ) x
  WHERE hub_id IS NOT NULL
  GROUP BY hub_id, crate_type_id;
$$;
REVOKE EXECUTE ON FUNCTION public.crate_hub_balance() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.crate_hub_balance() TO authenticated;

CREATE OR REPLACE FUNCTION public.crate_party_outstanding() RETURNS TABLE (
  party_type text, party_id uuid, party_name text, crate_type_id uuid, outstanding bigint, last_movement timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT party_type, party_id, party_name, crate_type_id,
    sum(CASE WHEN movement_type IN ('issued_to_customer','issued_to_vendor') THEN quantity
             WHEN movement_type IN ('returned_from_customer','returned_from_vendor') THEN -quantity
             ELSE 0 END)::bigint AS outstanding,
    max(created_at) AS last_movement
  FROM public.crate_movements
  WHERE party_type IS NOT NULL
  GROUP BY party_type, party_id, party_name, crate_type_id
  HAVING sum(CASE WHEN movement_type IN ('issued_to_customer','issued_to_vendor') THEN quantity
                  WHEN movement_type IN ('returned_from_customer','returned_from_vendor') THEN -quantity
                  ELSE 0 END) <> 0;
$$;
REVOKE EXECUTE ON FUNCTION public.crate_party_outstanding() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.crate_party_outstanding() TO authenticated;
