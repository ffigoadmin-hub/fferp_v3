-- Is RLS actually enabled on purchase_orders right now?
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN ('purchase_orders', 'purchase_order_items');

-- What policies (if any) currently exist on it?
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename IN ('purchase_orders', 'purchase_order_items');
