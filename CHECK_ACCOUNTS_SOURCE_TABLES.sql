-- CHECK_ACCOUNTS_SOURCE_TABLES.sql
-- Purpose: before building the FFERP Accounts (double-entry ledger) module, confirm the live
--          columns of every table the ledger will auto-post from, and make sure the new table
--          names we plan to use are not already taken.
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor. READ-ONLY — changes nothing.
-- Paste back: the result grid of each of the 4 queries (run them one at a time, or all together
--             and copy each result tab).

-- 1) Columns of the source documents, one row per table (compact to paste)
SELECT table_name,
       string_agg(column_name || ':' || data_type
                  || CASE WHEN is_generated = 'ALWAYS' THEN '(GEN)' ELSE '' END
                  || CASE WHEN is_nullable = 'NO' THEN '!' ELSE '' END,
                  ', ' ORDER BY ordinal_position) AS columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('invoices','payments_received','payments_made','credit_notes',
                     'vendor_credits','purchase_entries','purchase_bills','purchase_expenses',
                     'wastage_entries','customers','ff_transport_payments','ff_vendor_payments',
                     'sales_orders','recurring_bills','delivery_challans')
GROUP BY table_name
ORDER BY table_name;

-- 2) CHECK constraints (status lists) and FKs on those tables
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype IN ('c','f')
  AND conrelid::regclass::text IN ('invoices','payments_received','payments_made','credit_notes',
                                   'vendor_credits','purchase_entries','wastage_entries')
ORDER BY 1, 2;

-- 3) Name clashes: any existing table/view whose name the Accounts module might use
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name ~ '^(acc_|account|chart_of|gl_|general_ledger|journal|ledger|cost_cent|fiscal|accounting_period|bank_|gst|tax_|tds|period_closing|opening_bal)'
       OR table_name IN ('accounts','bank_accounts','bank_transactions','journal_entries'))
ORDER BY 1;

-- 4) Row counts + date range of the documents (tells us how much history to back-post)
SELECT 'invoices' AS t, count(*) AS rows, min(invoice_date)::text AS first, max(invoice_date)::text AS last FROM public.invoices
UNION ALL SELECT 'ff_vendor_payments (paid)', count(*), min(paid_at)::date::text, max(paid_at)::date::text FROM public.ff_vendor_payments WHERE payment_status = 'paid'
UNION ALL SELECT 'ff_transport_payments (paid)', count(*), min(paid_at)::date::text, max(paid_at)::date::text FROM public.ff_transport_payments WHERE payment_status = 'paid'
UNION ALL SELECT 'purchase_entries', count(*), min(created_at)::date::text, max(created_at)::date::text FROM public.purchase_entries;
