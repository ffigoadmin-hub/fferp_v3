-- REPAIR SCRIPT FOR SPLIT PAYMENTS (V2)
-- This script ensures all required columns exist, tables exist, and RLS policies are restored.
-- Run this in the Supabase SQL Editor.

-- 1. Ensure columns exist in payment_requests
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS is_split_payment BOOLEAN DEFAULT false;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS split_batch_id UUID;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS total_splits INTEGER DEFAULT 0;

-- 2. Ensure split_payments table exists
CREATE TABLE IF NOT EXISTS public.split_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_payment_id UUID NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL,
  split_number INTEGER NOT NULL,
  split_title TEXT NOT NULL,
  payee_name TEXT NOT NULL,
  beneficiary_name TEXT,
  amount NUMERIC(15,2) NOT NULL,
  payment_method TEXT NOT NULL,
  account_number TEXT,
  ifsc_code TEXT,
  upi_id TEXT,
  utr_number TEXT,
  payment_proof_url TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.split_payments ENABLE ROW LEVEL SECURITY;

-- 4. Restore RLS Policies
DROP POLICY IF EXISTS "Users can view relevant split payments" ON public.split_payments;
CREATE POLICY "Users can view relevant split payments" ON public.split_payments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.payment_requests pr
    WHERE pr.id = parent_payment_id
    AND (pr.requester_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('Admin', 'CEO', 'Accounts', 'GM', 'BOI', 'HR', 'Auditor', 'SMO', 'GMO', 'Director'))
  )
);

DROP POLICY IF EXISTS "Users can create split payments" ON public.split_payments;
CREATE POLICY "Users can create split payments" ON public.split_payments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.payment_requests pr
    WHERE pr.id = parent_payment_id
    AND pr.requester_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authorized roles can update split payments" ON public.split_payments;
CREATE POLICY "Authorized roles can update split payments" ON public.split_payments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.payment_requests pr
    WHERE pr.id = parent_payment_id
    AND (pr.requester_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('Admin', 'CEO', 'Accounts'))
  )
);

-- 5. FORCE SCHEMA CACHE REFRESH
COMMENT ON TABLE public.payment_requests IS 'Table for tracking payment requests and batch splits. [Refreshed at ' || NOW() || ']';
NOTIFY pgrst, 'reload schema';
