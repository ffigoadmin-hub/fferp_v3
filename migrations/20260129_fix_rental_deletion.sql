-- Fix RLS Case Sensitivity and Enable Cascade Delete for Rental Module

-- 1. Fix rental_properties RLS to be case-insensitive
DROP POLICY IF EXISTS "Admin full access" ON rental_properties;
DROP POLICY IF EXISTS "Properties All Admin" ON rental_properties;
DROP POLICY IF EXISTS "Properties View Admin/CEO/Accounts" ON rental_properties;
DROP POLICY IF EXISTS "Properties View Scoped" ON rental_properties;
DROP POLICY IF EXISTS "Role Based Insert Properties" ON rental_properties;
DROP POLICY IF EXISTS "Role Based Update Properties" ON rental_properties;

CREATE POLICY "Admin full access" ON rental_properties FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND lower(profiles.role) = 'admin')
);

CREATE POLICY "Properties View Admin/CEO/Accounts" ON rental_properties FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND lower(profiles.role) IN ('admin', 'ceo', 'accounts', 'auditor', 'director'))
);

CREATE POLICY "Properties View Scoped" ON rental_properties FOR SELECT USING (
    (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'hr') AND 
        EXISTS (SELECT 1 FROM rental_categories c WHERE c.id = category_id AND lower(c.owner_role) = 'hr')
    )
    OR
    (
        (
            EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'rsh') 
            OR 
            EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'employee' AND p.department = 'Rental Sourcing')
        )
        AND 
        EXISTS (SELECT 1 FROM rental_categories c WHERE c.id = category_id AND lower(c.owner_role) IN ('rsh', 'RSH'))
    )
);

-- 2. Enable Cascade Delete for Records
-- First, find the constraint name if it differs (usually it matches what I saw in list_tables)
ALTER TABLE rental_monthly_records 
DROP CONSTRAINT IF EXISTS rental_monthly_records_property_id_fkey,
ADD CONSTRAINT rental_monthly_records_property_id_fkey 
    FOREIGN KEY (property_id) 
    REFERENCES rental_properties(id) 
    ON DELETE CASCADE;

-- 3. Fix Categories RLS likewise
DROP POLICY IF EXISTS "Categories Edit Admin" ON rental_categories;
CREATE POLICY "Categories Edit Admin" ON rental_categories FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND lower(profiles.role) = 'admin')
);
