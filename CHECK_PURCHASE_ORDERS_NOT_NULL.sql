SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'purchase_orders'
ORDER BY ordinal_position;
