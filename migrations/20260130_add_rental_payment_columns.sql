-- Add branch_name to rental_properties
ALTER TABLE public.rental_properties 
ADD COLUMN IF NOT EXISTS branch_name TEXT;

-- Add payment details to rental_monthly_records
ALTER TABLE public.rental_monthly_records 
ADD COLUMN IF NOT EXISTS payment_date DATE,
ADD COLUMN IF NOT EXISTS payment_utr TEXT,
ADD COLUMN IF NOT EXISTS payment_mode TEXT,
ADD COLUMN IF NOT EXISTS payment_proof_link TEXT;

-- Update RLS policies to allow Accounts role to update these payment columns
-- (Assuming "Records Update Permitted" policy exists, checks if role is 'accounts')
-- We might need to ensure the policy covers these new columns if it was restrictive, 
-- but usually UPDATE policies cover the whole row unless specified otherwise.
-- Just in case, grant update directly if using column-level security (unlikely here but good practice).
