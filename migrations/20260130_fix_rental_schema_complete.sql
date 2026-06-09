-- 1. Add missing columns for Rental Properties
ALTER TABLE public.rental_properties 
ADD COLUMN IF NOT EXISTS branch_name TEXT;

-- 2. Add missing columns for Rental Monthly Records (Payment features)
ALTER TABLE public.rental_monthly_records 
ADD COLUMN IF NOT EXISTS payment_date DATE,
ADD COLUMN IF NOT EXISTS payment_utr TEXT,
ADD COLUMN IF NOT EXISTS payment_mode TEXT,
ADD COLUMN IF NOT EXISTS payment_proof_link TEXT;

-- 3. FIX: Add Unique Constraint for Auto-Billing Trigger
-- The error "no unique constraint matching ON CONFLICT" happens because 
-- the trigger tries to upsert into rental_monthly_records using (property_id, month_year).
-- We must ensure this constraint exists.

DO $$ 
BEGIN
    -- Check if constraint exists, if not, add it
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'rental_monthly_records_property_id_month_year_key'
    ) THEN
        ALTER TABLE public.rental_monthly_records
        ADD CONSTRAINT rental_monthly_records_property_id_month_year_key 
        UNIQUE (property_id, month_year);
    END IF;
END $$;

-- 4. Clear Schema Cache
NOTIFY pgrst, 'reload config';
