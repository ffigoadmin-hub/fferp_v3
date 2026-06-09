-- Fix Rental Monthly Records RLS for CEO and Accounts (Case Insensitivity)

-- 1. Drop existing policies to be safe
DROP POLICY IF EXISTS "Records Update Permitted" ON rental_monthly_records;
DROP POLICY IF EXISTS "Records View Permitted" ON rental_monthly_records;
DROP POLICY IF EXISTS "Role Based Update Monthly Records" ON rental_monthly_records;

-- 2. Scoped View Policy (Read All for Admin/CEO/Accounts)
CREATE POLICY "Records View Admin/CEO/Accounts" ON rental_monthly_records FOR SELECT USING (
    lower((SELECT role FROM profiles WHERE id = auth.uid())) IN ('admin', 'ceo', 'accounts', 'auditor', 'director')
    OR
    EXISTS (
        SELECT 1 FROM rental_properties p
        JOIN rental_categories c ON p.category_id = c.id
        WHERE p.id = rental_monthly_records.property_id
        AND (
            lower(c.owner_role) = lower((SELECT role FROM profiles WHERE id = auth.uid()))
            OR (
                lower(c.owner_role) = 'rsh' AND 
                lower((SELECT role FROM profiles WHERE id = auth.uid())) = 'employee' AND 
                lower((SELECT department FROM profiles WHERE id = auth.uid())) = 'rental sourcing'
            )
        )
    )
);

-- 3. Scoped Update Policy (CEO/Admin can update status)
CREATE POLICY "Records Update Scoped" ON rental_monthly_records FOR UPDATE USING (
    lower((SELECT role FROM profiles WHERE id = auth.uid())) IN ('admin', 'ceo', 'accounts')
    OR
    EXISTS (
        SELECT 1 FROM rental_properties p
        JOIN rental_categories c ON p.category_id = c.id
        WHERE p.id = rental_monthly_records.property_id
        AND (
            lower(c.owner_role) = lower((SELECT role FROM profiles WHERE id = auth.uid()))
            OR (
                lower(c.owner_role) = 'rsh' AND 
                lower((SELECT role FROM profiles WHERE id = auth.uid())) = 'employee' AND 
                lower((SELECT department FROM profiles WHERE id = auth.uid())) = 'rental sourcing'
            )
        )
    )
);

-- Note: DELETE is usually not allowed for records once generated, handled by Admin only if needed.
