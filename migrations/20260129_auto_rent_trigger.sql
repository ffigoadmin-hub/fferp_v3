-- Auto-generate Draft Rent Record on Property Creation

-- 1. Function to handle the trigger
CREATE OR REPLACE FUNCTION handle_new_property_rent()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO rental_monthly_records (
        property_id, 
        month_year, 
        base_rent, 
        net_payable_amount, 
        status
    ) VALUES (
        NEW.id,
        DATE_TRUNC('month', CURRENT_DATE),
        NEW.monthly_base_rent,
        NEW.monthly_base_rent,
        'DRAFT'
    )
    ON CONFLICT (property_id, month_year) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS tr_new_property_rent ON rental_properties;
CREATE TRIGGER tr_new_property_rent
AFTER INSERT ON rental_properties
FOR EACH ROW
EXECUTE FUNCTION handle_new_property_rent();

-- 3. Manually run the generation function for existing properties that might be missing records
SELECT generate_monthly_rent_drafts();
