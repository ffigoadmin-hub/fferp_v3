-- Rental Module V2 Schema Update
-- Adding fields to support 9-Form Specification

-- 1. Update rental_categories
-- [NEW] code, status, owner_department
ALTER TABLE rental_categories ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE rental_categories ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('Active', 'Inactive')) DEFAULT 'Active';
ALTER TABLE rental_categories ADD COLUMN IF NOT EXISTS owner_department TEXT; -- 'HR' or 'Rental Sourcing Head'

-- Add unique constraint to code if not exists (handled safely)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rental_categories_code_key') THEN
        ALTER TABLE rental_categories ADD CONSTRAINT rental_categories_code_key UNIQUE (code);
    END IF;
END $$;

-- 2. Update rental_properties (The "Master" Table)
-- [NEW] Common Fields
ALTER TABLE rental_properties ADD COLUMN IF NOT EXISTS agreement_start_date DATE;
ALTER TABLE rental_properties ADD COLUMN IF NOT EXISTS account_type TEXT CHECK (account_type IN ('Savings', 'Current'));
ALTER TABLE rental_properties ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- [NEW] RSH Specific Fields
ALTER TABLE rental_properties ADD COLUMN IF NOT EXISTS area TEXT; -- e.g., "2000 sq.ft"
ALTER TABLE rental_properties ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE rental_properties ADD COLUMN IF NOT EXISTS farm_name TEXT;
ALTER TABLE rental_properties ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE rental_properties ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE rental_properties ADD COLUMN IF NOT EXISTS advance_paid_on DATE;
ALTER TABLE rental_properties ADD COLUMN IF NOT EXISTS moratorium_period INTEGER DEFAULT 0; -- Months
ALTER TABLE rental_properties ADD COLUMN IF NOT EXISTS quotation_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE rental_properties ADD COLUMN IF NOT EXISTS rent_starts_from DATE;
ALTER TABLE rental_properties ADD COLUMN IF NOT EXISTS rent_after_deduction NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE rental_properties ADD COLUMN IF NOT EXISTS rent_hike_percentage NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE rental_properties ADD COLUMN IF NOT EXISTS agreement_copy_link TEXT;

-- 3. New Table: rental_deductions (For Form 6)
CREATE TABLE IF NOT EXISTS rental_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    record_id UUID NOT NULL REFERENCES rental_monthly_records(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('Electricity', 'Repair', 'Water', 'Other')),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    proof_url TEXT,
    remarks TEXT,
    
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on new table
ALTER TABLE rental_deductions ENABLE ROW LEVEL SECURITY;

-- 4. Update rental_monthly_records
ALTER TABLE rental_monthly_records ADD COLUMN IF NOT EXISTS deduction_total NUMERIC(15, 2) DEFAULT 0;

-- 5. RLS Policies for rental_deductions

-- Drop if exists to be safe
DROP POLICY IF EXISTS "Deductions View Permitted" ON rental_deductions;
DROP POLICY IF EXISTS "Deductions Manage Scoped" ON rental_deductions;

-- View: Admin, CEO, Accounts, Auditor, HR, RSH (Basically same visibility as the parent record)
CREATE POLICY "Deductions View Permitted" ON rental_deductions FOR SELECT USING (
    (select role from profiles where id = auth.uid()) IN ('admin', 'ceo', 'accounts', 'auditor', 'director')
    OR
    EXISTS (
        SELECT 1 FROM rental_monthly_records r
        JOIN rental_properties p ON r.property_id = p.id
        JOIN rental_categories c ON p.category_id = c.id
        WHERE r.id = rental_deductions.record_id
        AND (
            c.owner_role = (select role from profiles where id = auth.uid())::text
            OR 
            (c.owner_role IN ('rsh', 'RSH') AND (select role from profiles where id = auth.uid()) = 'employee' AND (select department from profiles where id = auth.uid()) = 'Rental Sourcing')
        )
    )
);

-- Insert/Update/Delete: Admin, HR (own), RSH (own)
CREATE POLICY "Deductions Manage Scoped" ON rental_deductions FOR ALL USING (
    (select role from profiles where id = auth.uid()) = 'admin'
    OR
    EXISTS (
        SELECT 1 FROM rental_monthly_records r
        JOIN rental_properties p ON r.property_id = p.id
        JOIN rental_categories c ON p.category_id = c.id
        WHERE r.id = rental_deductions.record_id
        AND (
            (c.owner_role = 'hr' AND (select role from profiles where id = auth.uid()) = 'hr')
            OR 
            (c.owner_role IN ('rsh', 'RSH') AND ((select role from profiles where id = auth.uid()) IN ('rsh', 'RSH') OR ((select role from profiles where id = auth.uid()) = 'employee' AND (select department from profiles where id = auth.uid()) = 'Rental Sourcing')))
        )
    )
);

-- 6. Trigger to Auto-Calculate Net Payable
-- net_payable_amount = base_rent + electricity_bill_amount - deduction_total
CREATE OR REPLACE FUNCTION calculate_rental_net_payable()
RETURNS TRIGGER AS $$
BEGIN
    NEW.net_payable_amount := COALESCE(NEW.base_rent, 0) + COALESCE(NEW.electricity_bill_amount, 0) - COALESCE(NEW.deduction_total, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_net_payable ON rental_monthly_records;

CREATE TRIGGER trigger_calculate_net_payable
BEFORE INSERT OR UPDATE OF base_rent, electricity_bill_amount, deduction_total ON rental_monthly_records
FOR EACH ROW
EXECUTE FUNCTION calculate_rental_net_payable();
