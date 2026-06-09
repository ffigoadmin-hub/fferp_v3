-- Complete employee_master table fix
-- This script ensures all required columns exist with correct names

-- First, let's see what we have
SELECT 'Current columns in employee_master:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'employee_master' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Drop and recreate table to ensure clean schema
DROP TABLE IF EXISTS public.employee_master CASCADE;

-- Create employee_master with exact schema needed by frontend
CREATE TABLE public.employee_master (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    bank_name text,
    ifsc text,
    account_number text,
    basic_salary numeric,
    increment numeric,
    incentives numeric,
    status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add unique constraint on profile_id
ALTER TABLE public.employee_master ADD CONSTRAINT employee_master_profile_id_unique UNIQUE (profile_id);

-- Add indexes for performance
CREATE INDEX idx_employee_master_profile_id ON public.employee_master(profile_id);
CREATE INDEX idx_employee_master_status ON public.employee_master(status);

-- Add comments
COMMENT ON TABLE public.employee_master IS 'Manual HR fields linked to profiles table';
COMMENT ON COLUMN public.employee_master.profile_id IS 'Foreign key to profiles table';
COMMENT ON COLUMN public.employee_master.bank_name IS 'Bank name';
COMMENT ON COLUMN public.employee_master.ifsc IS 'Bank IFSC code';
COMMENT ON COLUMN public.employee_master.account_number IS 'Bank account number';
COMMENT ON COLUMN public.employee_master.basic_salary IS 'Basic monthly salary';
COMMENT ON COLUMN public.employee_master.increment IS 'Salary increment amount';
COMMENT ON COLUMN public.employee_master.incentives IS 'Incentives and bonuses';
COMMENT ON COLUMN public.employee_master.status IS 'Employee status (ACTIVE/INACTIVE)';

-- RLS Policies
ALTER TABLE public.employee_master ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read employee_master
CREATE POLICY "Allow authenticated users to read employee_master" ON public.employee_master
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow HR and Admin roles to modify employee_master
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

-- Verify final schema
SELECT 'Final employee_master schema:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'employee_master' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
