SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'purchase_order_items'::regclass AND conname = 'purchase_order_items_status_check';
