-- Create employee_master table for manual HR fields
CREATE TABLE IF NOT EXISTS public.employee_master (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    designation text,
    doj date, -- date of joining
    salary numeric,
    bank text,
    pf text, -- provident fund
    esi text, -- employee state insurance
    status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add unique constraint on profile_id
ALTER TABLE public.employee_master ADD CONSTRAINT employee_master_profile_id_unique UNIQUE (profile_id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employee_master_profile_id ON public.employee_master(profile_id);
CREATE INDEX IF NOT EXISTS idx_employee_master_status ON public.employee_master(status);

-- Add comments
COMMENT ON TABLE public.employee_master IS 'Manual HR fields linked to profiles table';
COMMENT ON COLUMN public.employee_master.profile_id IS 'Foreign key to profiles table';
COMMENT ON COLUMN public.employee_master.designation IS 'Employee designation/title';
COMMENT ON COLUMN public.employee_master.doj IS 'Date of joining';
COMMENT ON COLUMN public.employee_master.salary IS 'Monthly salary';
COMMENT ON COLUMN public.employee_master.bank IS 'Bank details';
COMMENT ON COLUMN public.employee_master.pf IS 'Provident fund details';
COMMENT ON COLUMN public.employee_master.esi IS 'Employee state insurance details';
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
