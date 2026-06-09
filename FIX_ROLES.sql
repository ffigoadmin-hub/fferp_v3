-- ============================================================
--  FIX: Drop role CHECK constraint + update all role names
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
-- ============================================================

-- Step 1: Find and drop the role check constraint
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%';

  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(cname);
    RAISE NOTICE 'Dropped constraint: %', cname;
  ELSE
    RAISE NOTICE 'No role constraint found — skipping';
  END IF;
END$$;


-- Step 2: Update roles to match ERP sidebar expectations
UPDATE public.profiles SET role = 'ff_operations_manager' WHERE email = 'ops.manager@ffactory.com';
UPDATE public.profiles SET role = 'l1_manager'            WHERE email = 'l1.manager@ffactory.com';
UPDATE public.profiles SET role = 'accounts'              WHERE email = 'accounts@ffactory.com';
UPDATE public.profiles SET role = 'purchase_manager'      WHERE email = 'purchase.hyd@ffactory.com';
UPDATE public.profiles SET role = 'purchase_manager'      WHERE email = 'purchase.pali@ffactory.com';
UPDATE public.profiles SET role = 'purchase_manager'      WHERE email = 'purchase.vana@ffactory.com';
UPDATE public.profiles SET role = 'collection_executive'  WHERE email = 'collection@farmersfactory.com';
UPDATE public.profiles SET role = 'back_office'           WHERE email = 'backoffice@ffactory.com';


-- Step 3: Verify
SELECT email, name, role, department FROM public.profiles ORDER BY role, email;
