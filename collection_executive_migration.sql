-- ============================================================
-- FFERPv2 — COLLECTION EXECUTIVE FEATURE
-- Project: bvbfnguqpuctdvfztuda
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. CASH COLLECTIONS TABLE ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_collections (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID        REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  customer_id       UUID        REFERENCES public.customers(id) ON DELETE SET NULL,
  -- Denormalized for fast display (in case order/customer deleted)
  customer_name     TEXT,
  shop_name         TEXT,
  area              TEXT,
  phone             TEXT,
  order_number      TEXT,
  order_amount      NUMERIC     NOT NULL DEFAULT 0,
  collected_amount  NUMERIC     NOT NULL DEFAULT 0,
  difference        NUMERIC     GENERATED ALWAYS AS (order_amount - collected_amount) STORED,
  payment_mode      TEXT        NOT NULL DEFAULT 'cash'
    CHECK (payment_mode IN ('cash','upi','cheque','neft')),
  upi_reference     TEXT,
  cheque_number     TEXT,
  collection_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  hub_id            UUID        REFERENCES public.hubs(id),
  collected_by      UUID        REFERENCES public.profiles(id),
  notes             TEXT,
  status            TEXT        NOT NULL DEFAULT 'collected'
    CHECK (status IN ('collected','verified','shortfall','excess')),
  verified_by       UUID        REFERENCES public.profiles(id),
  verified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_collections_date      ON public.cash_collections(collection_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_collections_by        ON public.cash_collections(collected_by);
CREATE INDEX IF NOT EXISTS idx_cash_collections_hub       ON public.cash_collections(hub_id);
CREATE INDEX IF NOT EXISTS idx_cash_collections_order     ON public.cash_collections(order_id);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER set_cash_collections_updated_at
  BEFORE UPDATE ON public.cash_collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. RLS ────────────────────────────────────────────────────
ALTER TABLE public.cash_collections ENABLE ROW LEVEL SECURITY;

-- Collection executives: read/insert their own records
CREATE POLICY "collection_exec_insert"
  ON public.cash_collections FOR INSERT
  WITH CHECK (collected_by = auth.uid());

CREATE POLICY "collection_exec_select_own"
  ON public.cash_collections FOR SELECT
  USING (
    collected_by = auth.uid()
    OR current_user_role() IN (
      'admin','ceo','gm','ff_operations_manager',
      'accounts','auditor','l1_manager',
      'field_executive','bde','tele_caller','back_office'
    )
  );

CREATE POLICY "collection_exec_update_own"
  ON public.cash_collections FOR UPDATE
  USING (
    collected_by = auth.uid()
    OR current_user_role() IN ('admin','ff_operations_manager')
  );

-- ── 3. SEED DEFAULT CREDENTIAL ───────────────────────────────
DO $$
DECLARE
  v_uid  UUID;
  v_now  TIMESTAMPTZ := now();
BEGIN
  -- Check if user already exists
  SELECT id INTO v_uid FROM auth.users
  WHERE email = 'collection@farmersfactory.com' LIMIT 1;

  IF v_uid IS NULL THEN
    -- Create new auth user
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at
    ) VALUES (
      v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'collection@farmersfactory.com',
      crypt('Collection@FF2024', gen_salt('bf', 10)),
      v_now,
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('sub', v_uid::text, 'email', 'collection@farmersfactory.com'),
      v_now, v_now, v_now
    );
    RAISE NOTICE 'Created auth user for collection@farmersfactory.com';
  ELSE
    RAISE NOTICE 'Auth user already exists: %', v_uid;
  END IF;

  -- Upsert profile
  INSERT INTO public.profiles (id, email, name, role, department, created_at)
  VALUES (v_uid, 'collection@farmersfactory.com', 'Collection Executive', 'collection_executive', 'Sales', v_now)
  ON CONFLICT (id) DO UPDATE SET
    role       = 'collection_executive',
    name       = 'Collection Executive',
    department = 'Sales';

  RAISE NOTICE 'Profile upserted for collection_executive';
END $$;

-- ── 4. VERIFY ─────────────────────────────────────────────────
SELECT id, email, name, role FROM public.profiles
WHERE role = 'collection_executive';
