-- Add increment_amount column to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS increment_amount numeric NOT NULL DEFAULT 0;

-- Update existing incentive column to be NOT NULL with default
ALTER TABLE public.employees 
ALTER COLUMN incentive SET NOT NULL,
ALTER COLUMN incentive SET DEFAULT 0;

-- Update any existing NULL values to 0
UPDATE public.employees 
SET incentive = COALESCE(incentive, 0),
    increment_amount = COALESCE(increment_amount, 0)
WHERE incentive IS NULL OR increment_amount IS NULL;

-- Add generated total_salary column
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS total_salary numeric GENERATED ALWAYS AS (
  COALESCE(fixed_monthly_salary, 0)
  + COALESCE(bonus, 0)
  + COALESCE(increment_amount, 0)
  + COALESCE(incentive, 0)
) STORED;

-- Create table if it doesn't exist (for fresh installations)
CREATE TABLE IF NOT EXISTS public.employees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id text UNIQUE NOT NULL,
    full_name text NOT NULL,
    joining_date date NOT NULL,
    phone_number text NOT NULL,
    dob date NOT NULL,
    emergency_contact_number text NOT NULL,
    address text NOT NULL,
    department text NOT NULL,
    location_type text NOT NULL CHECK (location_type IN ('HEAD_OFFICE', 'BACK_OFFICE', 'OTHER')),
    location_name text,
    status text NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
    fixed_monthly_salary numeric NOT NULL DEFAULT 0,
    bonus numeric NOT NULL DEFAULT 0,
    increment_amount numeric NOT NULL DEFAULT 0,
    incentive numeric NOT NULL DEFAULT 0,
    total_salary numeric GENERATED ALWAYS AS (
      COALESCE(fixed_monthly_salary, 0)
      + COALESCE(bonus, 0)
      + COALESCE(increment_amount, 0)
      + COALESCE(incentive, 0)
    ) STORED,
    bank_account_name text,
    bank_account_number text,
    bank_ifsc text,
    bank_name text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
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
DROP TRIGGER IF EXISTS update_employees_updated_at ON public.employees;
CREATE TRIGGER update_employees_updated_at 
    BEFORE UPDATE ON public.employees 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON COLUMN public.employees.increment_amount IS 'Increment amount for employee salary adjustment';
COMMENT ON COLUMN public.employees.total_salary IS 'Auto-calculated total salary (fixed + bonus + increment + incentive)';
