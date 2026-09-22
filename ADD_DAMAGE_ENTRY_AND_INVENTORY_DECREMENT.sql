-- ADD_DAMAGE_ENTRY_AND_INVENTORY_DECREMENT.sql
-- Run on: qwiumswrbddwmlraktvy -> Supabase SQL Editor. Additive, idempotent.
--
-- New Damage/Wastage Entry page (hub manager records damaged/spoiled stock,
-- same style as QC Inspection). Reuses the wastage_entries table already
-- defined in create_wastage_table.sql -- CREATE TABLE IF NOT EXISTS makes this
-- safe to run whether or not that file was ever actually applied live.
-- Also adds decrement_inventory, the symmetric counterpart to
-- increment_inventory (added for QC receiving) -- damage entries reduce
-- inventory instead of adding to it.

CREATE TABLE IF NOT EXISTS public.wastage_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id          uuid NOT NULL REFERENCES public.hubs(id),
  hub_name        text,
  product_id      uuid REFERENCES public.products(id),
  item_name       text NOT NULL,
  quantity_kg     numeric(10,2) NOT NULL,
  amount          numeric(10,2),
  reason          text,
  photo_1_url     text,
  photo_2_url     text,
  entry_date      date NOT NULL DEFAULT CURRENT_DATE,
  submitted_by    uuid REFERENCES auth.users(id),
  submitted_at    timestamptz DEFAULT now(),
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wastage_hub_date ON public.wastage_entries(hub_id, entry_date);

ALTER TABLE public.wastage_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hub_manager_own_hub" ON public.wastage_entries;
DROP POLICY IF EXISTS "wastage_hub_manager_own_hub" ON public.wastage_entries;
CREATE POLICY "wastage_hub_manager_own_hub" ON public.wastage_entries FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
                 AND p.role = 'hub_manager' AND p.hub_id = wastage_entries.hub_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
                 AND p.role = 'hub_manager' AND p.hub_id = wastage_entries.hub_id));

DROP POLICY IF EXISTS "admin_all_wastage" ON public.wastage_entries;
DROP POLICY IF EXISTS "wastage_ops_and_admin_all" ON public.wastage_entries;
CREATE POLICY "wastage_ops_and_admin_all" ON public.wastage_entries FOR ALL
  USING (public.get_my_role() IN ('admin','gm','ceo','ff_operations_manager'))
  WITH CHECK (public.get_my_role() IN ('admin','gm','ceo','ff_operations_manager'));

DROP POLICY IF EXISTS "wastage_read_all_staff" ON public.wastage_entries;
CREATE POLICY "wastage_read_all_staff" ON public.wastage_entries FOR SELECT
  USING (public.get_my_role() IN ('admin','ceo','gm','auditor','purchase_manager','purchase_head'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('wastage-photos', 'wastage-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "wastage_photo_upload" ON storage.objects;
CREATE POLICY "wastage_photo_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wastage-photos');

DROP POLICY IF EXISTS "wastage_photo_read" ON storage.objects;
CREATE POLICY "wastage_photo_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'wastage-photos');

-- Symmetric counterpart to increment_inventory (ADD_INCREMENT_INVENTORY_FUNCTION.sql).
-- Never lets quantity go negative -- a damage entry can't remove more than exists.
CREATE OR REPLACE FUNCTION public.decrement_inventory(
  p_hub_id     uuid,
  p_product_id uuid,
  p_qty        numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.inventory
  SET quantity   = GREATEST(quantity - COALESCE(p_qty, 0), 0),
      updated_at = now()
  WHERE hub_id = p_hub_id AND product_id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_inventory(uuid, uuid, numeric) TO authenticated;

-- verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'wastage_entries' ORDER BY ordinal_position;

SELECT policyname, cmd FROM pg_policies WHERE tablename = 'wastage_entries' ORDER BY cmd, policyname;

SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc WHERE proname IN ('increment_inventory', 'decrement_inventory');
