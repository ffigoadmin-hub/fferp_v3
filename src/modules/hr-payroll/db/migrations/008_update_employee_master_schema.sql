-- Update existing employee_master table to match new schema
-- First, let's see what columns currently exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'employee_master' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Add new columns if they don't exist
DO $$
BEGIN
    -- Add bank_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employee_master' 
          AND table_schema = 'public' 
          AND column_name = 'bank_name'
    ) THEN
        ALTER TABLE public.employee_master ADD COLUMN bank_name text;
    END IF;

    -- Add ifsc column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employee_master' 
          AND table_schema = 'public' 
          AND column_name = 'ifsc'
    ) THEN
        ALTER TABLE public.employee_master ADD COLUMN ifsc text;
    END IF;

    -- Add account_number column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employee_master' 
          AND table_schema = 'public' 
          AND column_name = 'account_number'
    ) THEN
        ALTER TABLE public.employee_master ADD COLUMN account_number text;
    END IF;

    -- Add increment column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employee_master' 
          AND table_schema = 'public' 
          AND column_name = 'increment'
    ) THEN
        ALTER TABLE public.employee_master ADD COLUMN increment numeric;
    END IF;

    -- Add incentives column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employee_master' 
          AND table_schema = 'public' 
          AND column_name = 'incentives'
    ) THEN
        ALTER TABLE public.employee_master ADD COLUMN incentives numeric;
    END IF;
END $$;

-- Drop old columns that are no longer needed (be careful with this)
-- Uncomment these lines if you want to remove old columns
-- ALTER TABLE public.employee_master DROP COLUMN IF EXISTS designation;
-- ALTER TABLE public.employee_master DROP COLUMN IF EXISTS doj;
-- ALTER TABLE public.employee_master DROP COLUMN IF EXISTS bank;
-- ALTER TABLE public.employee_master DROP COLUMN IF EXISTS pf;
-- ALTER TABLE public.employee_master DROP COLUMN IF EXISTS esi;

-- Update comments
COMMENT ON COLUMN public.employee_master.bank_name IS 'Bank name';
COMMENT ON COLUMN public.employee_master.ifsc IS 'Bank IFSC code';
COMMENT ON COLUMN public.employee_master.account_number IS 'Bank account number';
COMMENT ON COLUMN public.employee_master.basic_salary IS 'Basic monthly salary';
COMMENT ON COLUMN public.employee_master.increment IS 'Salary increment amount';
COMMENT ON COLUMN public.employee_master.incentives IS 'Incentives and bonuses';

-- Ensure unique constraint on profile_id exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'employee_master' 
          AND table_schema = 'public' 
          AND constraint_name = 'employee_master_profile_id_unique'
    ) THEN
        ALTER TABLE public.employee_master ADD CONSTRAINT employee_master_profile_id_unique UNIQUE (profile_id);
    END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_master_profile_id ON public.employee_master(profile_id);
CREATE INDEX IF NOT EXISTS idx_employee_master_status ON public.employee_master(status);

-- Ensure RLS is enabled
ALTER TABLE public.employee_master ENABLE ROW LEVEL SECURITY;

-- Update RLS policies
DROP POLICY IF EXISTS "Allow authenticated users to read employee_master" ON public.employee_master;
DROP POLICY IF EXISTS "Allow HR and Admin to modify employee_master" ON public.employee_master;

-- Recreate RLS policies
CREATE POLICY "Allow authenticated users to read employee_master" ON public.employee_master
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow HR and Admin to modify employee_master" ON public.employee_master
    FOR ALL USING (
        auth.jwt() ->> 'role' IN ('hr', 'admin')
    );

-- Grant permissions
GRANT SELECT ON public.employee_master TO authenticated;
GRANT ALL ON public.employee_master TO hr;
GRANT ALL ON public.employee_master TO admin;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Show final table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'employee_master' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
