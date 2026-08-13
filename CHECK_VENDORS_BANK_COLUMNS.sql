-- Confirm the real column set on public.vendors — the app has two
-- conflicting conventions in play: bank_account/bank_ifsc (used by
-- VendorManagement.tsx, vendorStore.ts, FFVendorPaymentForm.tsx) vs
-- account_number/ifsc_code/upi_id (used by BuyPage.tsx's dynamic-vendor
-- insert, which was live-tested and worked). Need to know if both sets
-- of columns actually exist, or just one.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'vendors'
ORDER BY ordinal_position;
