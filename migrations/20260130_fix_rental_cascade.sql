-- Fix constraint between rental_deductions and rental_monthly_records
-- This allows deleting a monthly record to automatically delete its deductions
ALTER TABLE rental_deductions
DROP CONSTRAINT IF EXISTS rental_deductions_record_id_fkey;

ALTER TABLE rental_deductions
ADD CONSTRAINT rental_deductions_record_id_fkey
FOREIGN KEY (record_id)
REFERENCES rental_monthly_records(id)
ON DELETE CASCADE;

-- Fix constraint between rental_monthly_records and rental_properties
-- This allows deleting a property to automatically delete its monthly records
ALTER TABLE rental_monthly_records
DROP CONSTRAINT IF EXISTS rental_monthly_records_property_id_fkey;

ALTER TABLE rental_monthly_records
ADD CONSTRAINT rental_monthly_records_property_id_fkey
FOREIGN KEY (property_id)
REFERENCES rental_properties(id)
ON DELETE CASCADE;

-- Also check rental_documents if it exists and links to property
-- (Assuming standard naming rental_documents_property_id_fkey)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rental_documents') THEN
        ALTER TABLE rental_documents
        DROP CONSTRAINT IF EXISTS rental_documents_property_id_fkey;

        ALTER TABLE rental_documents
        ADD CONSTRAINT rental_documents_property_id_fkey
        FOREIGN KEY (property_id)
        REFERENCES rental_properties(id)
        ON DELETE CASCADE;
    END IF;
END $$;
