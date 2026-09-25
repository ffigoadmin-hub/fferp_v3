-- ADD_ASSET_CUSTODY_AND_VEHICLE_COMPLIANCE.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Asset Management, Phase 1: Custody & Assignments + Vehicle Compliance.
--
-- 1. fixed_assets gets an assigned_to (current custodian, on top of the existing hub_id
--    location) plus asset_custody_log, auto-populated by a trigger whenever hub_id or
--    assigned_to changes — no manual logging step, matching this codebase's convention of
--    letting DB triggers be the single source of truth for movement history (same pattern as
--    inv__move() for inventory).
--
-- 2. transport_vehicles already existed (vehicle_number, type, make, model, ownership_type) but
--    had zero rows and no management page anywhere — a master-data table nobody could populate.
--    Extended with compliance fields (insurance/PUC/permit/fitness expiry, service due, odometer)
--    and linked to fixed_assets (fixed_asset_id) so an OWNED vehicle has one depreciation record
--    and one operational record instead of two disconnected ones. assigned_driver_id references
--    the existing transport_drivers master table (drivers aren't necessarily system users).
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.asset_custody_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id          uuid NOT NULL REFERENCES public.fixed_assets(id),
  from_hub_id       uuid REFERENCES public.hubs(id),
  to_hub_id         uuid REFERENCES public.hubs(id),
  from_assigned_to  uuid REFERENCES auth.users(id),
  to_assigned_to    uuid REFERENCES auth.users(id),
  changed_by        uuid REFERENCES auth.users(id),
  changed_at        timestamptz NOT NULL DEFAULT now(),
  notes             text
);
ALTER TABLE public.asset_custody_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asset_custody_log_read_all_staff ON public.asset_custody_log;
CREATE POLICY asset_custody_log_read_all_staff ON public.asset_custody_log FOR SELECT
  USING (get_my_role() = ANY (ARRAY['admin','ceo','gm','accounts','director','auditor','ff_operations_manager']));
DROP POLICY IF EXISTS asset_custody_log_admin_write ON public.asset_custody_log;
CREATE POLICY asset_custody_log_admin_write ON public.asset_custody_log FOR INSERT
  WITH CHECK (get_my_role() = ANY (ARRAY['admin','ceo','accounts']));

CREATE OR REPLACE FUNCTION public.trg_asset_custody_log() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.asset_custody_log (asset_id, from_hub_id, to_hub_id, from_assigned_to, to_assigned_to, changed_by, notes)
    VALUES (NEW.id, NULL, NEW.hub_id, NULL, NEW.assigned_to, auth.uid(), 'Asset registered');
  ELSIF TG_OP = 'UPDATE' AND (NEW.hub_id IS DISTINCT FROM OLD.hub_id OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    INSERT INTO public.asset_custody_log (asset_id, from_hub_id, to_hub_id, from_assigned_to, to_assigned_to, changed_by, notes)
    VALUES (NEW.id, OLD.hub_id, NEW.hub_id, OLD.assigned_to, NEW.assigned_to, auth.uid(), 'Custody changed');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS asset_custody_log_trg ON public.fixed_assets;
CREATE TRIGGER asset_custody_log_trg AFTER INSERT OR UPDATE ON public.fixed_assets
  FOR EACH ROW EXECUTE FUNCTION public.trg_asset_custody_log();

ALTER TABLE public.transport_vehicles
  ADD COLUMN IF NOT EXISTS fixed_asset_id     uuid REFERENCES public.fixed_assets(id),
  ADD COLUMN IF NOT EXISTS hub_id             uuid REFERENCES public.hubs(id),
  ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES public.transport_drivers(id),
  ADD COLUMN IF NOT EXISTS insurance_expiry   date,
  ADD COLUMN IF NOT EXISTS puc_expiry         date,
  ADD COLUMN IF NOT EXISTS permit_expiry      date,
  ADD COLUMN IF NOT EXISTS fitness_expiry     date,
  ADD COLUMN IF NOT EXISTS last_service_date  date,
  ADD COLUMN IF NOT EXISTS next_service_due   date,
  ADD COLUMN IF NOT EXISTS odometer_km        numeric,
  ADD COLUMN IF NOT EXISTS notes              text,
  ADD COLUMN IF NOT EXISTS created_by         uuid REFERENCES auth.users(id);
