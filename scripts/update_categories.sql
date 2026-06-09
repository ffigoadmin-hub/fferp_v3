-- Run this SQL in the Supabase SQL Editor to update all existing rental categories
-- to be owned by both HR and RSH.
UPDATE rental_categories
SET owner_department = 'Both HR & RSH',
    owner_role = 'both'
WHERE id IS NOT NULL;