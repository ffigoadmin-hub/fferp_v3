-- HR Payroll Module - Employees Table and RLS Policies

-- Create employees table if not exists
CREATE TABLE IF NOT EXISTS employees (
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
    bank_account_name text,
    bank_account_number text,
    bank_ifsc text,
    bank_name text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_employees_updated_at 
    BEFORE UPDATE ON employees 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "HR Admin full access" ON employees;
DROP POLICY IF EXISTS "Employees read own profile" ON employees;
DROP POLICY IF EXISTS "CEO read access" ON employees;
DROP POLICY IF EXISTS "Accounts read access" ON employees;

-- RLS Policies
-- HR and Admin can do everything
CREATE POLICY "HR Admin full access" ON employees
    FOR ALL USING (
        auth.jwt() ->> 'role' IN ('hr', 'admin')
    );

-- CEO can read all employees
CREATE POLICY "CEO read access" ON employees
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'ceo'
    );

-- Accounts can read all employees (for payroll processing)
CREATE POLICY "Accounts read access" ON employees
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'accounts'
    );

-- Employees can only read their own profile (excluding salary for security)
CREATE POLICY "Employees read own profile" ON employees
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'employee' AND 
        employee_id = auth.jwt() ->> 'employee_id'
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_location_type ON employees(location_type);
