-- ADD_ASSET_QR_TAGS.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Asset Management, Phase 6: a stable, human-readable tag code per fixed asset (e.g. FA-000123)
-- plus a QR code that encodes a link to a lookup page — print it, stick it on the crate/vehicle/
-- equipment, and scanning it opens that asset's record instead of someone hunting through the
-- register by name.
--
-- The tag code is assigned once, automatically, on insert (never reassigned), via a sequence —
-- same idea as generate_site_visit_request_number()/generate_cafe_order_number() elsewhere in
-- this codebase. Existing rows without a code get backfilled once.
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.asset_tag_code_seq;

ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS asset_tag_code text UNIQUE;

CREATE OR REPLACE FUNCTION public.assign_asset_tag_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.asset_tag_code IS NULL THEN
    NEW.asset_tag_code := 'FA-' || lpad(nextval('public.asset_tag_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_asset_tag_code ON public.fixed_assets;
CREATE TRIGGER trg_assign_asset_tag_code
  BEFORE INSERT ON public.fixed_assets
  FOR EACH ROW EXECUTE FUNCTION public.assign_asset_tag_code();

-- Backfill any assets created before this migration (order doesn't matter — each just needs a
-- unique code once).
UPDATE public.fixed_assets
SET asset_tag_code = 'FA-' || lpad(nextval('public.asset_tag_code_seq')::text, 6, '0')
WHERE asset_tag_code IS NULL;
