-- HR & Payroll Module Database Schema
-- Migration: Create comprehensive HR and payroll tables

-- Employee Master Table
CREATE TABLE IF NOT EXISTS employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id VARCHAR(20) UNIQUE NOT NULL, -- EMP001, EMP002, etc.
    full_name VARCHAR(255) NOT NULL,
    joining_date DATE NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    dob DATE NOT NULL,
    emergency_contact_number VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    department VARCHAR(100) NOT NULL,
    location_type VARCHAR(20) NOT NULL CHECK (location_type IN ('HEAD_OFFICE', 'BACK_OFFICE', 'OTHER')),
    location_name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    fixed_monthly_salary DECIMAL(12,2) NOT NULL CHECK (fixed_monthly_salary >= 0),
    bank_account_number VARCHAR(50),
    bank_name VARCHAR(255),
    bank_ifsc VARCHAR(20),
    user_id UUID REFERENCES auth.users(id), -- Link to user account for employee self-service
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Payroll Runs Table
CREATE TABLE IF NOT EXISTS payroll_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL')),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    finalized_at TIMESTAMPTZ,
    finalized_by UUID REFERENCES auth.users(id),
    total_employees INTEGER DEFAULT 0,
    total_net_pay DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    UNIQUE(month, year) -- One payroll run per month
);

-- Payroll Items Table (individual employee payroll records)
CREATE TABLE IF NOT EXISTS payroll_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    base_monthly_salary DECIMAL(12,2) NOT NULL CHECK (base_monthly_salary >= 0),
    salary_override DECIMAL(12,2) CHECK (salary_override >= 0), -- HR can override base salary for this run
    days_in_month INTEGER NOT NULL CHECK (days_in_month BETWEEN 28 AND 31),
    payable_days INTEGER NOT NULL, -- Calculated based on joining date
    lop_days DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (lop_days >= 0),
    bonus DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (bonus >= 0),
    incentive DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (incentive >= 0),
    earned DECIMAL(12,2) NOT NULL CHECK (earned >= 0),
    gross DECIMAL(12,2) NOT NULL CHECK (gross >= 0),
    tds DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (tds >= 0),
    pf DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (pf >= 0),
    esi DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (esi >= 0),
    net DECIMAL(12,2) NOT NULL CHECK (net >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    UNIQUE(payroll_run_id, employee_id)
);

-- Payslip Documents Table
CREATE TABLE IF NOT EXISTS payslip_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payroll_item_id UUID NOT NULL REFERENCES payroll_items(id) ON DELETE CASCADE,
    pdf_path TEXT NOT NULL,
    pdf_url TEXT,
    file_size BIGINT,
    checksum VARCHAR(64), -- SHA-256 checksum for integrity
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(payroll_item_id)
);

-- Payroll Audit Log Table
CREATE TABLE IF NOT EXISTS payroll_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payroll_run_id UUID REFERENCES payroll_runs(id),
    payroll_item_id UUID REFERENCES payroll_items(id),
    employee_id UUID REFERENCES employees(id),
    action VARCHAR(50) NOT NULL, -- GENERATED, UPDATED, FINALIZED, LOP_OVERRIDE, etc.
    old_values JSONB,
    new_values JSONB,
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_month_year ON payroll_runs(month, year);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);
CREATE INDEX IF NOT EXISTS idx_payroll_items_payroll_run_id ON payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee_id ON payroll_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslip_documents_payroll_item_id ON payslip_documents(payroll_item_id);
CREATE INDEX IF NOT EXISTS idx_payroll_audit_run ON payroll_audit_log(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_audit_employee ON payroll_audit_log(employee_id);

-- Row Level Security (RLS) Policies
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslip_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_audit_log ENABLE ROW LEVEL SECURITY;

-- Employees table policies
-- HR and Admin can do everything
CREATE POLICY "HR Admin full access employees" ON employees
    FOR ALL USING (
        auth.jwt() ->> 'role' IN ('hr', 'admin')
    );

-- Employees can only view their own record
CREATE POLICY "Employees view own data" ON employees
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'employee' AND 
        user_id = auth.uid()
    );

-- Payroll runs policies
-- HR and Admin can do everything
CREATE POLICY "HR Admin full access payroll_runs" ON payroll_runs
    FOR ALL USING (
        auth.jwt() ->> 'role' IN ('hr', 'admin')
    );

-- Employees can view payroll runs they're part of
CREATE POLICY "Employees view own payroll runs" ON payroll_runs
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'employee' AND 
        EXISTS (
            SELECT 1 FROM payroll_items pi
            WHERE pi.payroll_run_id = payroll_runs.id
            AND pi.employee_id = (
                SELECT id FROM employees WHERE user_id = auth.uid()
            )
        )
    );

-- Payroll items policies
-- HR and Admin can do everything
CREATE POLICY "HR Admin full access payroll_items" ON payroll_items
    FOR ALL USING (
        auth.jwt() ->> 'role' IN ('hr', 'admin')
    );

-- Employees can view their own payroll items
CREATE POLICY "Employees view own payroll items" ON payroll_items
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'employee' AND 
        employee_id = (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
    );

-- Payslip documents policies
-- HR and Admin can do everything
CREATE POLICY "HR Admin full access payslip_documents" ON payslip_documents
    FOR ALL USING (
        auth.jwt() ->> 'role' IN ('hr', 'admin')
    );

-- Employees can view their own payslip documents
CREATE POLICY "Employees view own payslip_documents" ON payslip_documents
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'employee' AND 
        payroll_item_id IN (
            SELECT id FROM payroll_items WHERE employee_id = (
                SELECT id FROM employees WHERE user_id = auth.uid()
            )
        )
    );

-- Audit log policies
-- HR and Admin can view audit logs
CREATE POLICY "HR Admin view audit logs" ON payroll_audit_log
    FOR SELECT USING (
        auth.jwt() ->> 'role' IN ('hr', 'admin')
    );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payroll_runs_updated_at BEFORE UPDATE ON payroll_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payroll_items_updated_at BEFORE UPDATE ON payroll_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
