-- ============================================================
-- FFERPv2 — COLLECTION TABLE COMPLETE FIX
-- Drops and recreates cash_collections without broken elements
-- Run in Supabase SQL Editor
-- ============================================================

-- Step 1: Drop everything related to cash_collections
DROP TABLE IF EXISTS public.cash_collections CASCADE;

-- Step 2: Recreate cleanly — no GENERATED columns, no current_user_role()
CREATE TABLE public.cash_collections (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID,
  customer_id       UUID,
  customer_name     TEXT,
  shop_name         TEXT,
  area              TEXT,
  phone             TEXT,
  order_number      TEXT,
  order_amount      NUMERIC     NOT NULL DEFAULT 0,
  collected_amount  NUMERIC     NOT NULL DEFAULT 0,
  payment_mode      TEXT        NOT NULL DEFAULT 'cash'
    CHECK (payment_mode IN ('cash','upi','cheque','neft')),
  upi_reference     TEXT,
  cheque_number     TEXT,
  collection_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  hub_id            UUID,
  collected_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes             TEXT,
  status            TEXT        NOT NULL DEFAULT 'collected'
    CHECK (status IN ('collected','verified','shortfall','excess')),
  verified_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_collections_date  ON public.cash_collections(collection_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_collections_by    ON public.cash_collections(collected_by);
CREATE INDEX IF NOT EXISTS idx_cash_collections_hub   ON public.cash_collections(hub_id);

-- Step 3: RLS using auth.uid() only — no custom functions needed
ALTER TABLE public.cash_collections ENABLE ROW LEVEL SECURITY;

-- Collection exec: insert their own
CREATE POLICY "cc_insert_own"
  ON public.cash_collections FOR INSERT
  WITH CHECK (collected_by = auth.uid());

-- Everyone authenticated can read (filter in app by role)
CREATE POLICY "cc_select_auth"
  ON public.cash_collections FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only inserter or service role can update
CREATE POLICY "cc_update_own"
  ON public.cash_collections FOR UPDATE
  USING (collected_by = auth.uid());

-- Step 4: Force PostgREST to reload
NOTIFY pgrst, 'reload schema';

SELECT 'cash_collections table recreated successfully' AS result;
