-- Rental Management Schema (Aligned with Frontend)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Rental Categories
CREATE TABLE IF NOT EXISTS rental_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE, -- e.g., 'Warehouse', 'Land Lease', 'Office'
    owner_role TEXT NOT NULL DEFAULT 'admin', -- 'hr', 'rsh', 'admin' - used for RLS and ownership
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Rental Properties
CREATE TABLE IF NOT EXISTS rental_properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Basic Info
    title TEXT NOT NULL, -- Matched with frontend 'title'
    location TEXT, -- Matched with frontend 'location'
    category_id UUID REFERENCES rental_categories(id),
    status TEXT DEFAULT 'Active', -- 'Active', 'Hold', 'Closed'
    
    -- Rent Details
    monthly_base_rent NUMERIC(15, 2) NOT NULL DEFAULT 0,
    rent_due_day INTEGER DEFAULT 1, -- 1 to 31
    agreement_expiry_date DATE,
    
    -- Bank Details (Flattened as per frontend)
    holder_name TEXT,
    bank_name TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    
    -- Documents
    google_drive_folder_link TEXT,
    
    -- System
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Rental Monthly Records (Transactions)
CREATE TABLE IF NOT EXISTS rental_monthly_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    property_id UUID REFERENCES rental_properties(id),
    month_year DATE NOT NULL, -- The billing month (e.g., 2024-02-01)
    
    -- Amounts
    base_rent NUMERIC(15, 2) DEFAULT 0,
    electricity_bill_amount NUMERIC(15, 2) DEFAULT 0,
    electricity_bill_proof_url TEXT,
    
    -- Total
    net_payable_amount NUMERIC(15, 2) DEFAULT 0,
    
    -- Workflow Status
    status TEXT DEFAULT 'DRAFT', 
    -- 'DRAFT', 'ELECTRICITY_UPDATED', 'RAISED_FOR_APPROVAL', 'APPROVED_BY_CEO', 'PAYMENT_EXECUTED', 'REJECTED'
    
    -- Approval/Rejection
    rejection_reason TEXT,
    
    -- Payment Execution Details (Snapshot)
    utr_number TEXT,
    payment_method TEXT, -- 'Bank Transfer', 'Cheque', 'UPI'
    payment_proof_url TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    
    paid_to_holder_name TEXT,
    paid_to_bank_name TEXT,
    paid_to_account_number TEXT,
    paid_to_ifsc_code TEXT,

    UNIQUE(property_id, month_year)
);

-- 4. Rental Discussions (Comments)
CREATE TABLE IF NOT EXISTS rental_discussions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id UUID REFERENCES rental_monthly_records(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rental_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_monthly_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_discussions ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- RLS Policies
-- -------------------------------------------------------------------------

-- Drop existing policies to allow re-application
DROP POLICY IF EXISTS "Categories View All" ON rental_categories;
DROP POLICY IF EXISTS "Categories Edit Admin" ON rental_categories;
DROP POLICY IF EXISTS "Properties View Admin/CEO/Accounts" ON rental_properties;
DROP POLICY IF EXISTS "Properties View Scoped" ON rental_properties;
DROP POLICY IF EXISTS "Properties All Admin" ON rental_properties;
DROP POLICY IF EXISTS "Records View Permitted" ON rental_monthly_records;
DROP POLICY IF EXISTS "Records Update Permitted" ON rental_monthly_records;


-- Categories: Readable by all, Editable by Admin
CREATE POLICY "Categories View All" ON rental_categories FOR SELECT USING (true);
CREATE POLICY "Categories Edit Admin" ON rental_categories FOR ALL USING (
    (select role from profiles where id = auth.uid()) = 'admin'
);

-- Properties:
-- View: Admin, CEO, Accounts, Auditor (ALL)
-- View: HR (Only if category owner_role is hr)
-- View: RSH (Only if category owner_role is rsh)
-- Edit: Admin, HR, RSH (Scoped)

CREATE POLICY "Properties View Admin/CEO/Accounts" ON rental_properties FOR SELECT USING (
    (select role from profiles where id = auth.uid()) IN ('admin', 'ceo', 'accounts', 'auditor', 'director')
);

CREATE POLICY "Properties View Scoped" ON rental_properties FOR SELECT USING (
    (
        (select role from profiles where id = auth.uid()) = 'hr' AND 
        EXISTS (SELECT 1 FROM rental_categories c WHERE c.id = category_id AND c.owner_role = 'hr')
    )
    OR
    (
        (
            (select role from profiles where id = auth.uid()) IN ('rsh', 'RSH') 
            OR 
            ((select role from profiles where id = auth.uid()) = 'employee' AND (select department from profiles where id = auth.uid()) = 'Rental Sourcing')
        )
        AND 
        EXISTS (SELECT 1 FROM rental_categories c WHERE c.id = category_id AND c.owner_role IN ('rsh', 'RSH'))
    )
);

CREATE POLICY "Properties All Admin" ON rental_properties FOR ALL USING (
    (select role from profiles where id = auth.uid()) = 'admin'
);

-- Monthly Records:
-- View: Same as properties logic usually, but simplified:
CREATE POLICY "Records View Permitted" ON rental_monthly_records FOR SELECT USING (
    (select role from profiles where id = auth.uid()) IN ('admin', 'ceo', 'accounts', 'auditor', 'director')
    OR
    EXISTS (
        SELECT 1 FROM rental_properties p 
        JOIN rental_categories c ON p.category_id = c.id
        WHERE p.id = rental_monthly_records.property_id
        AND (
            c.owner_role = (select role from profiles where id = auth.uid())::text
            OR 
            (c.owner_role IN ('rsh', 'RSH') AND (select role from profiles where id = auth.uid()) = 'employee' AND (select department from profiles where id = auth.uid()) = 'Rental Sourcing')
        )
    )
);

CREATE POLICY "Records Update Permitted" ON rental_monthly_records FOR UPDATE USING (
    (select role from profiles where id = auth.uid()) IN ('admin', 'ceo', 'accounts')
    OR
    EXISTS (
        SELECT 1 FROM rental_properties p 
        JOIN rental_categories c ON p.category_id = c.id
        WHERE p.id = rental_monthly_records.property_id
        AND (
            c.owner_role = (select role from profiles where id = auth.uid())::text
            OR 
            (c.owner_role IN ('rsh', 'RSH') AND (select role from profiles where id = auth.uid()) = 'employee' AND (select department from profiles where id = auth.uid()) = 'Rental Sourcing')
        )
    )
);

-- -------------------------------------------------------------------------
-- Seed Data (Categories)
-- -------------------------------------------------------------------------
INSERT INTO rental_categories (name, owner_role) VALUES 
('Warehouse', 'hr'),
('Guest House', 'hr'),
('Office', 'hr'),
('Polyhouse Land', 'rsh'),
('Farm Room', 'rsh')
ON CONFLICT (name) DO NOTHING;

-- -------------------------------------------------------------------------
-- Function: Auto Generate Drafts (Run via Cron or Manual Trigger)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_monthly_rent_drafts()
RETURNS INTEGER AS $$
DECLARE
    prop RECORD;
    records_created INTEGER := 0;
    billing_date DATE;
BEGIN
    -- Logic: Raise for 'Next Month' if run on 25th? Or just current month?
    -- Let's stick to Current Month first day for simplicity of unique constraint
    billing_date := DATE_TRUNC('month', CURRENT_DATE);
    
    FOR prop IN 
        SELECT * FROM rental_properties 
        WHERE status = 'Active'
    LOOP
        -- Check if record already exists for this month
        IF NOT EXISTS (
            SELECT 1 FROM rental_monthly_records 
            WHERE property_id = prop.id AND month_year = billing_date
        ) THEN
            INSERT INTO rental_monthly_records (
                property_id, 
                month_year, 
                base_rent, 
                net_payable_amount, 
                status
            ) VALUES (
                prop.id,
                billing_date,
                prop.monthly_base_rent,
                prop.monthly_base_rent, -- Starts equal to base
                'DRAFT'
            );
            records_created := records_created + 1;
        END IF;
    END LOOP;
    
    RETURN records_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
