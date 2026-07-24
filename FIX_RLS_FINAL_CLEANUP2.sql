-- ============================================================
--  RLS FIX — final cleanup: 5 tables missed from the last batch
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
-- ============================================================

-- categories, coupon_usage: not used in FFERP, no legitimate write
-- alternative found, low sensitivity (taxonomy / usage tracking) —
-- drop the write blanket, no replacement.
DROP POLICY IF EXISTS authenticated_full_categories ON public.categories;
DROP POLICY IF EXISTS auth_full_coupon_usage ON public.coupon_usage;

-- contact_enquiries: anon_insert_contact (contact form submission)
-- already covers the legitimate use — auth_full let any logged-in
-- user read/edit/delete every submitted enquiry (PII: name/email/message).
DROP POLICY IF EXISTS auth_full_contact_enquiries ON public.contact_enquiries;

-- product_images, product_reviews: public read already covers the
-- storefront use case — auth_full let any logged-in user fully
-- modify the product image/review catalog.
DROP POLICY IF EXISTS auth_full_product_images ON public.product_images;
DROP POLICY IF EXISTS auth_full_product_reviews ON public.product_reviews;

-- ── Verify ───────────────────────────────────────────────────
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true')
ORDER BY tablename, policyname;
