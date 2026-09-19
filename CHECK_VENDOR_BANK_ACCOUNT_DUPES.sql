-- ─────────────────────────────────────────────────────────────
--  Diagnostic: how many vendor rows actually share a bank account
--  under different names, and how many vendors' bank details are
--  only visible under the account_number/ifsc_code column pair
--  (not bank_account/bank_ifsc, which vendorStore.ts currently
--  reads exclusively).
--
--  Run before changing VendorBulkPaymentPage.tsx's grouping key,
--  to see the real-world size of the problem.
-- ─────────────────────────────────────────────────────────────

-- 1. Vendor rows sharing the same normalized bank account + IFSC
--    (falling back across both column pairs) but with different names.
--    This is exactly the "different name, same money destination" set
--    the new bank-account-based grouping is meant to merge.
with normalized as (
  select
    id, name, is_active,
    upper(regexp_replace(coalesce(nullif(bank_account, ''), account_number, ''), '\s', '', 'g')) as acct,
    upper(regexp_replace(coalesce(nullif(bank_ifsc, ''), ifsc_code, ''), '\s', '', 'g')) as ifsc
  from vendors
)
select acct, ifsc, count(*) as vendor_row_count,
  array_agg(name order by name) as names,
  array_agg(is_active order by name) as is_active_flags
from normalized
where length(regexp_replace(acct, '\D', '', 'g')) >= 6
group by acct, ifsc
having count(*) > 1
order by vendor_row_count desc;

-- 2. How many vendors have bank details ONLY under account_number/ifsc_code
--    (bank_account/bank_ifsc empty) — sizes the vendorStore.ts read-gap fix.
select count(*) as vendors_missing_from_bank_account_pair
from vendors
where (bank_account is null or bank_account = '')
  and account_number is not null and account_number <> '';

-- 3. Targeted look at the specific names from the reported screenshot —
--    confirms whether any of these concretely share a bank account today.
select id, name, is_active,
  coalesce(nullif(bank_account, ''), account_number) as acct,
  coalesce(nullif(bank_ifsc, ''), ifsc_code) as ifsc
from vendors
where name ilike '%cocount%' or name ilike '%coconut%'
   or name ilike '%kabur%' or name ilike '%furit%'
   or name ilike '%alagarsamy%' or name ilike '%tomato%'
   or name ilike '%murugan%'
   or name ilike '%ravi%banana%'
order by name;
