-- ADD_WAREHOUSE_INVENTORY_WASTAGE.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Inventory & Wastage module (web ERP) — columns verified live 2026-09-24.
--
-- Problems this fixes:
--   • Recording wastage never reduced stock: no trigger existed on wastage_entries (the
--     trg_inventory_wastage described in older docs was never applied), and wastage_entries had
--     no product link — only free-text item_name — so it could not be matched to inventory.
--   • Stock could only change through box scans; there was no audited way to correct a count.
--
-- What it adds (additive + idempotent; no existing column/row is changed or removed):
--   wastage_entries  + product_id → products, reason_category, rate_per_kg, unit,
--                      inventory_applied_qty (how much stock this entry actually deducted)
--   inventory_log    ref_type CHECK extended with 'wastage', 'manual' (superset of the old list)
--   inv__move()                 internal: change one hub+product stock row and write inventory_log
--   wastage_entries trigger     save → deducts stock; edit → re-applies; delete → gives stock back
--   inv_adjust_stock()          RPC: set a counted quantity (logs the difference as 'adjustment')
--   inv_set_min_threshold()     RPC: low-stock level per hub + product
--
-- Stock never goes below zero: if wastage exceeds recorded stock, only the available quantity is
-- deducted, and inventory_applied_qty / the log note record exactly what happened (so the EOD PO
-- engine never sees negative stock and over-buys).
--
-- Access: admin, ceo, gm, ff_operations_manager → any warehouse;
--         hub_manager, warehouse_manager, qc_manager → their own hub only (profiles.hub_id).
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- ── 1. wastage_entries: product link + reason + valuation ──────────────────────────────────────
ALTER TABLE public.wastage_entries ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id);
ALTER TABLE public.wastage_entries ADD COLUMN IF NOT EXISTS reason_category text;
ALTER TABLE public.wastage_entries ADD COLUMN IF NOT EXISTS rate_per_kg numeric;
ALTER TABLE public.wastage_entries ADD COLUMN IF NOT EXISTS unit text DEFAULT 'kg';
ALTER TABLE public.wastage_entries ADD COLUMN IF NOT EXISTS inventory_applied_qty numeric NOT NULL DEFAULT 0;

ALTER TABLE public.wastage_entries DROP CONSTRAINT IF EXISTS wastage_entries_reason_category_check;
ALTER TABLE public.wastage_entries ADD CONSTRAINT wastage_entries_reason_category_check
  CHECK (reason_category IS NULL OR reason_category IN
    ('damaged','rotten','expired','qc_reject','transit_damage','pest','pilferage','customer_return','other'));

CREATE INDEX IF NOT EXISTS wastage_entries_hub_date_idx ON public.wastage_entries(hub_id, entry_date);
CREATE INDEX IF NOT EXISTS wastage_entries_product_idx  ON public.wastage_entries(product_id);
CREATE INDEX IF NOT EXISTS inventory_log_hub_created_idx ON public.inventory_log(hub_id, created_at DESC);

-- ── 2. inventory_log: allow the new reference types (superset — old values kept) ───────────────
ALTER TABLE public.inventory_log DROP CONSTRAINT IF EXISTS inventory_log_ref_type_check;
ALTER TABLE public.inventory_log ADD CONSTRAINT inventory_log_ref_type_check
  CHECK (ref_type IS NULL OR ref_type IN ('box','pack','order','adjustment','wastage','manual'));

-- ── 3. Core stock movement (internal) ──────────────────────────────────────────────────────────
-- Applies delta to hub+product stock (never below 0), logs it, returns the delta actually applied.
CREATE OR REPLACE FUNCTION public.inv__move(p_hub uuid, p_product uuid, p_delta numeric, p_event text,
  p_ref_type text, p_ref_id uuid, p_notes text, p_user uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.inventory; v_new numeric; v_applied numeric;
BEGIN
  IF p_hub IS NULL OR p_product IS NULL OR coalesce(p_delta, 0) = 0 THEN RETURN 0; END IF;

  INSERT INTO public.inventory (hub_id, product_id, quantity)
  VALUES (p_hub, p_product, 0)
  ON CONFLICT (hub_id, product_id) DO NOTHING;

  SELECT * INTO v_inv FROM public.inventory WHERE hub_id = p_hub AND product_id = p_product FOR UPDATE;
  v_new := greatest(0, coalesce(v_inv.quantity, 0) + p_delta);
  v_applied := round((v_new - coalesce(v_inv.quantity, 0))::numeric, 3);
  IF v_applied = 0 AND p_delta < 0 THEN
    -- nothing on hand to deduct; still record the attempt so the register explains itself
    INSERT INTO public.inventory_log (inventory_id, hub_id, product_id, event_type, qty_delta, ref_id, ref_type, notes, created_by)
    VALUES (v_inv.id, p_hub, p_product, p_event, 0, p_ref_id, p_ref_type,
            coalesce(p_notes || ' · ', '') || 'requested ' || p_delta || ' but stock was 0', p_user);
    RETURN 0;
  END IF;

  UPDATE public.inventory SET quantity = v_new, updated_at = now() WHERE id = v_inv.id;
  INSERT INTO public.inventory_log (inventory_id, hub_id, product_id, event_type, qty_delta, ref_id, ref_type, notes, created_by)
  VALUES (v_inv.id, p_hub, p_product, p_event, v_applied, p_ref_id, p_ref_type,
          CASE WHEN v_applied <> p_delta
               THEN coalesce(p_notes || ' · ', '') || 'requested ' || p_delta || ', limited by stock on hand'
               ELSE p_notes END,
          p_user);
  RETURN v_applied;
END $$;

-- ── 4. Wastage → stock ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inv_wastage_before() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pname text; v_hname text; v_uid uuid := auth.uid();
BEGIN
  IF NEW.product_id IS NOT NULL AND coalesce(NEW.item_name, '') = '' THEN
    SELECT name INTO v_pname FROM public.products WHERE id = NEW.product_id;
    NEW.item_name := coalesce(v_pname, 'Unknown item');
  END IF;
  IF NEW.hub_name IS NULL THEN
    SELECT coalesce(display_name, name) INTO v_hname FROM public.hubs WHERE id = NEW.hub_id;
    NEW.hub_name := v_hname;
  END IF;
  IF NEW.amount IS NULL AND NEW.rate_per_kg IS NOT NULL THEN
    NEW.amount := round(NEW.quantity_kg::numeric * NEW.rate_per_kg, 2);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- only touch stock when something stock-relevant changed
    IF NEW.hub_id IS NOT DISTINCT FROM OLD.hub_id AND NEW.product_id IS NOT DISTINCT FROM OLD.product_id
       AND NEW.quantity_kg = OLD.quantity_kg THEN
      NEW.inventory_applied_qty := OLD.inventory_applied_qty;
      RETURN NEW;
    END IF;
    IF OLD.inventory_applied_qty > 0 AND OLD.product_id IS NOT NULL THEN
      PERFORM public.inv__move(OLD.hub_id, OLD.product_id, OLD.inventory_applied_qty, 'wastage', 'wastage',
                               OLD.id, 'Wastage entry edited — previous deduction returned', v_uid);
    END IF;
  END IF;

  NEW.inventory_applied_qty := 0;
  IF NEW.product_id IS NOT NULL AND NEW.quantity_kg > 0 THEN
    NEW.inventory_applied_qty := -public.inv__move(NEW.hub_id, NEW.product_id, -(NEW.quantity_kg::numeric), 'wastage', 'wastage',
                                   NEW.id, 'Wastage: ' || coalesce(NEW.reason_category, NEW.reason, 'unspecified'), v_uid);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.inv_wastage_after_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.inventory_applied_qty > 0 AND OLD.product_id IS NOT NULL THEN
    PERFORM public.inv__move(OLD.hub_id, OLD.product_id, OLD.inventory_applied_qty, 'wastage', 'wastage',
                             OLD.id, 'Wastage entry deleted — stock returned', auth.uid());
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS inv_wastage_before_trg ON public.wastage_entries;
CREATE TRIGGER inv_wastage_before_trg BEFORE INSERT OR UPDATE ON public.wastage_entries
  FOR EACH ROW EXECUTE FUNCTION public.inv_wastage_before();

DROP TRIGGER IF EXISTS inv_wastage_after_delete_trg ON public.wastage_entries;
CREATE TRIGGER inv_wastage_after_delete_trg AFTER DELETE ON public.wastage_entries
  FOR EACH ROW EXECUTE FUNCTION public.inv_wastage_after_delete();

-- ── 5. RPCs for the Inventory screen ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inv__can_manage(p_hub uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN lower(coalesce(public.get_my_role(), '')) IN ('admin','ceo','gm','ff_operations_manager') THEN true
    WHEN lower(coalesce(public.get_my_role(), '')) IN ('hub_manager','warehouse_manager','qc_manager')
      THEN public.auth_hub_id() = p_hub
    ELSE false END;
$$;

-- Set the counted quantity; the difference is logged as an adjustment with the reason.
CREATE OR REPLACE FUNCTION public.inv_adjust_stock(p_hub uuid, p_product uuid, p_new_qty numeric, p_reason text)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cur numeric;
BEGIN
  IF NOT public.inv__can_manage(p_hub) THEN RAISE EXCEPTION 'You can only adjust stock for your own warehouse'; END IF;
  IF p_new_qty IS NULL OR p_new_qty < 0 THEN RAISE EXCEPTION 'Quantity must be zero or more'; END IF;
  IF coalesce(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required for a stock adjustment'; END IF;
  SELECT quantity INTO v_cur FROM public.inventory WHERE hub_id = p_hub AND product_id = p_product;
  IF v_cur IS NULL THEN
    INSERT INTO public.inventory (hub_id, product_id, quantity) VALUES (p_hub, p_product, 0)
    ON CONFLICT (hub_id, product_id) DO NOTHING;
    v_cur := 0;
  END IF;
  RETURN public.inv__move(p_hub, p_product, p_new_qty - v_cur, 'adjustment', 'manual', NULL,
                          'Stock count: ' || trim(p_reason), auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.inv_set_min_threshold(p_hub uuid, p_product uuid, p_min numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.inv__can_manage(p_hub) THEN RAISE EXCEPTION 'You can only change your own warehouse'; END IF;
  IF p_min IS NOT NULL AND p_min < 0 THEN RAISE EXCEPTION 'Minimum level must be zero or more'; END IF;
  INSERT INTO public.inventory (hub_id, product_id, quantity, min_threshold) VALUES (p_hub, p_product, 0, p_min)
  ON CONFLICT (hub_id, product_id) DO UPDATE SET min_threshold = p_min, updated_at = now();
END $$;

REVOKE EXECUTE ON FUNCTION public.inv__move(uuid, uuid, numeric, text, text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inv_wastage_before()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inv_wastage_after_delete()  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.inv_adjust_stock(uuid, uuid, numeric, text)   TO authenticated;
GRANT  EXECUTE ON FUNCTION public.inv_set_min_threshold(uuid, uuid, numeric)    TO authenticated;
GRANT  EXECUTE ON FUNCTION public.inv__can_manage(uuid)                         TO authenticated;

-- ── 6. Verify (paste this result back) ─────────────────────────────────────────────────────────
SELECT 'wastage_entries new columns' AS what,
       string_agg(column_name, ', ' ORDER BY column_name) AS detail
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'wastage_entries'
  AND column_name IN ('product_id','reason_category','rate_per_kg','unit','inventory_applied_qty')
UNION ALL
SELECT 'triggers on wastage_entries', string_agg(tgname, ', ') FROM pg_trigger
WHERE tgrelid = 'public.wastage_entries'::regclass AND NOT tgisinternal
UNION ALL
SELECT 'functions', string_agg(proname, ', ' ORDER BY proname) FROM pg_proc
WHERE pronamespace = 'public'::regnamespace AND proname IN ('inv__move','inv_adjust_stock','inv_set_min_threshold','inv__can_manage','inv_wastage_before','inv_wastage_after_delete')
UNION ALL
SELECT 'inventory_log ref_type check', pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'inventory_log_ref_type_check';
