-- =====================================================
-- PAYROLL MODULE - TABLE CREATION SCRIPTS
-- =====================================================

-- Note: profiles table already exists in Supabase auth schema
-- Columns: id (uuid, primary key), name (text), department (text)

-- =====================================================
-- EMPLOYEE_MASTER TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS employee_master (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    basic_salary DECIMAL(12,2) NOT NULL CHECK (basic_salary >= 0),
    increment DECIMAL(12,2) DEFAULT 0 CHECK (increment >= 0),
    incentive DECIMAL(12,2) DEFAULT 0 CHECK (incentive >= 0),
    tds_percent DECIMAL(5,2) DEFAULT 1.00 CHECK (tds_percent >= 0 AND tds_percent <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one record per employee
    UNIQUE(employee_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_employee_master_employee_id ON employee_master(employee_id);

-- =====================================================
-- LOP_ENTRIES TABLE (Updated schema)
-- =====================================================
CREATE TABLE IF NOT EXISTS lop_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    lop_days DECIMAL(5,2) NOT NULL CHECK (lop_days > 0 AND lop_days <= 31),
    reason TEXT,
    lop_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate entries for same employee on same date
    UNIQUE(employee_id, lop_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lop_entries_employee_id ON lop_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_lop_entries_date ON lop_entries(lop_date);

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_employee_master_updated_at 
    BEFORE UPDATE ON employee_master 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lop_entries_updated_at 
    BEFORE UPDATE ON lop_entries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS (ROW LEVEL SECURITY) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE employee_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE lop_entries ENABLE ROW LEVEL SECURITY;

-- Employee Master RLS Policies
CREATE POLICY "Users can view employee_master for their department" ON employee_master
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND 
        department = (SELECT department FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "HR users can insert employee_master" ON employee_master
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND
        (SELECT department FROM profiles WHERE id = auth.uid()) IN ('HR', 'ADMIN')
    );

CREATE POLICY "HR users can update employee_master" ON employee_master
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND
        (SELECT department FROM profiles WHERE id = auth.uid()) IN ('HR', 'ADMIN')
    );

-- LOP Entries RLS Policies
CREATE POLICY "Users can view their own LOP entries" ON lop_entries
    FOR SELECT USING (auth.uid() = employee_id);

CREATE POLICY "HR users can view all LOP entries" ON lop_entries
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND
        (SELECT department FROM profiles WHERE id = auth.uid()) IN ('HR', 'ADMIN')
    );

CREATE POLICY "HR users can insert LOP entries" ON lop_entries
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND
        (SELECT department FROM profiles WHERE id = auth.uid()) IN ('HR', 'ADMIN')
    );

CREATE POLICY "HR users can update LOP entries" ON lop_entries
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND
        (SELECT department FROM profiles WHERE id = auth.uid()) IN ('HR', 'ADMIN')
    );

CREATE POLICY "HR users can delete LOP entries" ON lop_entries
    FOR DELETE USING (
        auth.uid() IS NOT NULL AND
        (SELECT department FROM profiles WHERE id = auth.uid()) IN ('HR', 'ADMIN')
    );

-- =====================================================
-- SAMPLE DATA INSERTION (Optional)
-- =====================================================

-- Insert sample employee master records (uncomment if needed)
/*
INSERT INTO employee_master (employee_id, basic_salary, increment, incentive) VALUES
    (SELECT id FROM profiles WHERE name = 'John Doe', 50000, 2000, 1000),
    (SELECT id FROM profiles WHERE name = 'Jane Smith', 60000, 3000, 1500);
*/

-- Insert sample LOP entries (uncomment if needed)
/*
INSERT INTO lop_entries (employee_id, lop_days, reason, lop_date) VALUES
    (SELECT id FROM profiles WHERE name = 'John Doe', 1.5, 'Medical Leave', '2024-01-15'),
    (SELECT id FROM profiles WHERE name = 'Jane Smith', 0.5, 'Personal Work', '2024-01-20');
*/
