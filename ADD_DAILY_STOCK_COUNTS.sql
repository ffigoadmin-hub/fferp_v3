-- ADD_DAILY_STOCK_COUNTS.sql
-- Run on: qwiumswrbddwmlraktvy -> Supabase SQL Editor. Additive, idempotent.
--
-- New feature: daily per-hub, per-product opening/closing stock counts, entered
-- manually by the hub manager / FF operations manager (a physical stock register,
-- not derived from the currently-empty `inventory` table). One row per
-- hub+product+day.

CREATE TABLE IF NOT EXISTS public.daily_stock_counts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id        uuid NOT NULL REFERENCES public.hubs(id) ON DELETE CASCADE,
  product_id    uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name  text NOT NULL,
  unit          text NOT NULL DEFAULT 'kg',
  stock_date    date NOT NULL DEFAULT CURRENT_DATE,
  opening_qty   numeric(12,2) NOT NULL DEFAULT 0,
  closing_qty   numeric(12,2),
  notes         text,
  recorded_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT daily_stock_counts_unique_row UNIQUE (hub_id, product_id, stock_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_stock_hub_date ON public.daily_stock_counts(hub_id, stock_date);

DROP TRIGGER IF EXISTS daily_stock_counts_updated_at ON public.daily_stock_counts;
CREATE TRIGGER daily_stock_counts_updated_at
  BEFORE UPDATE ON public.daily_stock_counts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.daily_stock_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_stock_admin_full" ON public.daily_stock_counts;
CREATE POLICY "daily_stock_admin_full" ON public.daily_stock_counts FOR ALL
  USING (public.get_my_role() IN ('admin','ceo','gm'))
  WITH CHECK (public.get_my_role() IN ('admin','ceo','gm'));

DROP POLICY IF EXISTS "daily_stock_ops_all_hubs" ON public.daily_stock_counts;
CREATE POLICY "daily_stock_ops_all_hubs" ON public.daily_stock_counts FOR ALL
  USING (public.get_my_role() = 'ff_operations_manager')
  WITH CHECK (public.get_my_role() = 'ff_operations_manager');

DROP POLICY IF EXISTS "daily_stock_hub_manager_own_hub" ON public.daily_stock_counts;
CREATE POLICY "daily_stock_hub_manager_own_hub" ON public.daily_stock_counts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
                 AND p.role = 'hub_manager' AND p.hub_id = daily_stock_counts.hub_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
                 AND p.role = 'hub_manager' AND p.hub_id = daily_stock_counts.hub_id));

-- Read-only for other elevated/reporting roles
DROP POLICY IF EXISTS "daily_stock_read_all_staff" ON public.daily_stock_counts;
CREATE POLICY "daily_stock_read_all_staff" ON public.daily_stock_counts FOR SELECT
  USING (public.get_my_role() IN ('admin','ceo','gm','auditor','purchase_manager','purchase_head'));

-- verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'daily_stock_counts'
ORDER BY ordinal_position;

SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'daily_stock_counts' ORDER BY cmd, policyname;
