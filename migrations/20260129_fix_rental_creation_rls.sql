-- Fix Rental Property Creation and Management Scoped Policies

-- 1. Add INSERT policy for HR and RSH
CREATE POLICY "HR/RSH Insert Properties" ON rental_properties FOR INSERT WITH CHECK (
    (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'hr') AND 
        EXISTS (SELECT 1 FROM rental_categories c WHERE c.id = category_id AND lower(c.owner_role) = 'hr')
    )
    OR
    (
        (
            EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'rsh') 
            OR 
            ((SELECT role FROM profiles WHERE id = auth.uid()) = 'Employee' AND (SELECT department FROM profiles WHERE id = auth.uid()) = 'Rental Sourcing')
        )
        AND 
        EXISTS (SELECT 1 FROM rental_categories c WHERE c.id = category_id AND lower(c.owner_role) IN ('rsh', 'RSH'))
    )
);

-- 2. Add UPDATE policy for HR and RSH
CREATE POLICY "HR/RSH Update Properties" ON rental_properties FOR UPDATE USING (
    (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'hr') AND 
        EXISTS (SELECT 1 FROM rental_categories c WHERE c.id = category_id AND lower(c.owner_role) = 'hr')
    )
    OR
    (
        (
            EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'rsh') 
            OR 
            ((SELECT role FROM profiles WHERE id = auth.uid()) = 'Employee' AND (SELECT department FROM profiles WHERE id = auth.uid()) = 'Rental Sourcing')
        )
        AND 
        EXISTS (SELECT 1 FROM rental_categories c WHERE c.id = category_id AND lower(c.owner_role) IN ('rsh', 'RSH'))
    )
);

-- 3. Add DELETE policy for HR and RSH
CREATE POLICY "HR/RSH Delete Properties" ON rental_properties FOR DELETE USING (
    (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'hr') AND 
        EXISTS (SELECT 1 FROM rental_categories c WHERE c.id = category_id AND lower(c.owner_role) = 'hr')
    )
    OR
    (
        (
            EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'rsh') 
            OR 
            ((SELECT role FROM profiles WHERE id = auth.uid()) = 'Employee' AND (SELECT department FROM profiles WHERE id = auth.uid()) = 'Rental Sourcing')
        )
        AND 
        EXISTS (SELECT 1 FROM rental_categories c WHERE c.id = category_id AND lower(c.owner_role) IN ('rsh', 'RSH'))
    )
);
