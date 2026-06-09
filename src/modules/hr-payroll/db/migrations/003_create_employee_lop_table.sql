-- Create employee_lop table for tracking Loss of Pay days
CREATE TABLE IF NOT EXISTS public.employee_lop (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id text NOT NULL REFERENCES public.employees(employee_id) ON DELETE CASCADE,
    month integer NOT NULL CHECK (month >= 1 AND month <= 12),
    year integer NOT NULL CHECK (year >= 2000 AND year <= 2100),
    lop_days numeric NOT NULL DEFAULT 0 CHECK (lop_days >= 0),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(employee_id, month, year)
);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger if not exists
DROP TRIGGER IF EXISTS update_employee_lop_updated_at ON public.employee_lop;
CREATE TRIGGER update_employee_lop_updated_at 
    BEFORE UPDATE ON public.employee_lop 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.employee_lop IS 'Employee Loss of Pay (LOP) tracking table';
COMMENT ON COLUMN public.employee_lop.employee_id IS 'Foreign key reference to employees table';
COMMENT ON COLUMN public.employee_lop.month IS 'Month of the year (1-12)';
COMMENT ON COLUMN public.employee_lop.year IS 'Year';
COMMENT ON COLUMN public.employee_lop.lop_days IS 'Number of LOP days for the month';

-- Grant permissions
GRANT ALL ON public.employee_lop TO authenticated;
GRANT SELECT ON public.employee_lop TO anon;
