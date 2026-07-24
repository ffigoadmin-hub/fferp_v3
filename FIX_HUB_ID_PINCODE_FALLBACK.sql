-- ============================================================
--  FIX — hub_id auto-assignment reliability
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Root cause investigation: only 1/17 recent sales_orders had
--  hub_id populated. Traced through the whole chain:
--
--  1. auto_assign_hub() trigger (fires on sales_orders insert) is
--     NOT buggy — it correctly does hub_pincodes lookup on
--     NEW.pincode, falling back to the linked customer's pincode.
--
--  2. sync_order_to_sales_orders() (fires on the OTHER app's orders
--     table insert, syncs into sales_orders) DOES correctly map
--     NEW.delivery_pincode → sales_orders.pincode. It never sets
--     customer_id at all (only denormalized customer_name/phone),
--     so the customer-lookup fallback in auto_assign_hub() can never
--     fire for synced orders — not fixable without also linking
--     real customers, out of scope here.
--
--  3. The ACTUAL root cause: the checkout form in the other
--     (customer-facing) app isn't consistently capturing pincode as
--     its own structured field — delivery_pincode is null on most
--     orders. But the pincode IS present, embedded in the free-text
--     delivery_address (e.g. "...Chennai - 600119"). Confirmed
--     against all 4 real orders in production: every one has a
--     valid 6-digit pincode extractable from the address tail via
--     regex, matching the one order that already had it structured.
--
--  Fix: add a regex-extraction fallback in sync_order_to_sales_orders
--  — when NEW.delivery_pincode is null/empty, pull the trailing
--  6-digit number from NEW.delivery_address instead. This is a
--  fallback only; a properly-populated delivery_pincode always wins.
--  The underlying form issue in the other app isn't fixed by this
--  (that's out of scope — separate codebase) but this closes the
--  actual data gap it causes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_order_to_sales_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_erp_status TEXT;
  v_pincode TEXT;
BEGIN
  v_erp_status := CASE UPPER(COALESCE(NEW.status, 'PLACED'))
    WHEN 'PLACED'     THEN 'pending'
    WHEN 'PENDING'    THEN 'pending'
    WHEN 'CONFIRMED'  THEN 'confirmed'
    WHEN 'PROCESSING' THEN 'processing'
    WHEN 'PACKED'     THEN 'processing'
    WHEN 'SHIPPED'    THEN 'dispatched'
    WHEN 'DELIVERED'  THEN 'delivered'
    WHEN 'CANCELLED'  THEN 'cancelled'
    WHEN 'REJECTED'   THEN 'cancelled'
    ELSE 'pending'
  END;

  -- Fallback: extract trailing 6-digit pincode from the free-text
  -- address when the structured delivery_pincode field is empty.
  v_pincode := COALESCE(
    NULLIF(TRIM(NEW.delivery_pincode), ''),
    substring(NEW.delivery_address FROM '(\d{6})\D*$')
  );

  INSERT INTO public.sales_orders (
    id,
    order_number,
    customer_name,
    customer_phone,
    order_date,
    status,
    payment_mode,
    payment_status,
    subtotal,
    delivery_fee,
    total_amount,
    delivery_address,
    pincode,
    source,
    channel,
    source_order_id,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.order_number,
    COALESCE(NEW.customer_name, 'Website Customer'),
    NEW.customer_phone,
    CURRENT_DATE,
    v_erp_status,
    LOWER(COALESCE(NEW.payment_method, 'cod')),
    COALESCE(NEW.payment_status, 'unpaid'),
    COALESCE(NEW.subtotal, 0),
    COALESCE(NEW.delivery_fee, 0),
    COALESCE(NEW.total_amount, 0),
    NEW.delivery_address,
    v_pincode,
    COALESCE(NEW.source, 'website'),
    COALESCE(NEW.source, 'website'),
    NEW.id::text,
    NEW.created_at,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    source     = EXCLUDED.source,
    channel    = EXCLUDED.channel,
    status     = EXCLUDED.status,
    pincode    = COALESCE(public.sales_orders.pincode, EXCLUDED.pincode),
    updated_at = now();

  RETURN NEW;
END;
$function$;

-- ── Backfill: apply the same fallback to existing rows that are
--    missing hub_id but have a recoverable pincode ──
UPDATE public.sales_orders so
SET pincode = COALESCE(
  so.pincode,
  substring(o.delivery_address FROM '(\d{6})\D*$')
)
FROM public.orders o
WHERE so.source_order_id = o.id::text
  AND so.pincode IS NULL
  AND o.delivery_address IS NOT NULL;

-- Re-run the hub assignment logic on the backfilled rows (the
-- auto_assign_hub trigger only fires on INSERT, not UPDATE, so this
-- has to be done manually for existing rows). Matches the trigger's
-- own priority exactly: exact pincode match first, 4-digit-prefix
-- fallback second, single result only (LIMIT 1 per row via subquery,
-- not a join — avoids double-matching against multiple hub_pincodes rows).
UPDATE public.sales_orders so
SET hub_id = COALESCE(
  (SELECT hp.hub_id FROM public.hub_pincodes hp WHERE hp.pincode = so.pincode LIMIT 1),
  (SELECT hp.hub_id FROM public.hub_pincodes hp WHERE LEFT(hp.pincode, 4) = LEFT(so.pincode, 4) LIMIT 1)
)
WHERE so.hub_id IS NULL
  AND so.pincode IS NOT NULL;

-- ── Verify ───────────────────────────────────────────────────
SELECT order_number, pincode, hub_id, source
FROM public.sales_orders
ORDER BY created_at DESC
LIMIT 20;
