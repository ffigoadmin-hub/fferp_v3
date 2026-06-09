-- ============================================================
--  FF ERP — EOD PO ENGINE (PostgreSQL Stored Function)
--  Runs at 11:50 PM daily via Supabase Edge Function cron.
--  Logic:
--    1. Collect all orders placed today (before 11:30 PM cutoff)
--    2. Group by product + hub
--    3. Required qty  = SUM of order item quantities per group
--    4. Available qty = current inventory per hub + product
--    5. Net purchase  = required - available  (min 0)
--    6. Create/update purchase_orders + purchase_order_items per hub
--    7. Box labels auto-created via trigger on purchase_order_items
--    8. Assign POs to purchase executives per hub
--    9. Send notifications to PEs
-- ============================================================

CREATE OR REPLACE FUNCTION public.run_eod_po_engine(
  p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result        jsonb := '{"pos_created": 0, "items_created": 0, "skipped_stock": 0, "errors": []}'::jsonb;
  v_po_count      integer := 0;
  v_item_count    integer := 0;
  v_stock_skip    integer := 0;
  v_errors        text[] := '{}';

  -- Cursor over product+hub groups
  rec RECORD;

  v_po_id         uuid;
  v_po_number     text;
  v_current_inv   numeric;
  v_net_qty       numeric;
  v_pe_id         uuid;
  v_hub_name      text;
BEGIN

  RAISE NOTICE '[EOD PO Engine] Starting for date: %', p_date;

  -- ── Step 1: Aggregate orders by product + hub ──────────────
  FOR rec IN
    SELECT
      soi.product_id,
      p.name                              AS product_name,
      p.unit                              AS unit,
      so.hub_id,
      h.name                              AS hub_name,
      SUM(soi.quantity)                   AS required_qty,
      COALESCE(
        (SELECT quantity FROM public.inventory inv
         WHERE inv.product_id = soi.product_id
           AND inv.hub_id     = so.hub_id
         LIMIT 1), 0
      )                                   AS current_inventory
    FROM public.sales_orders so
    JOIN public.sales_order_items soi ON soi.order_id = so.id
    JOIN public.products p            ON p.id = soi.product_id
    JOIN public.hubs h                ON h.id = so.hub_id
    WHERE so.order_date   = p_date
      AND so.status NOT IN ('cancelled')
      AND so.hub_id IS NOT NULL
      AND soi.product_id IS NOT NULL
    GROUP BY soi.product_id, p.name, p.unit, so.hub_id, h.name
  LOOP

    v_hub_name := rec.hub_name;

    -- ── Step 2: Calculate net purchase qty ────────────────────
    v_net_qty := GREATEST(0, rec.required_qty - rec.current_inventory);

    -- ── Step 3: Skip if stock is sufficient ───────────────────
    IF v_net_qty <= 0 THEN
      v_stock_skip := v_stock_skip + 1;
      RAISE NOTICE '[EOD] % at % — fully covered by stock (%.2f kg available)',
        rec.product_name, rec.hub_name, rec.current_inventory;
      CONTINUE;
    END IF;

    -- ── Step 4: Get or create today's PO for this hub ─────────
    SELECT id INTO v_po_id
    FROM public.purchase_orders
    WHERE hub_id   = rec.hub_id
      AND eod_date = p_date
      AND status NOT IN ('cancelled')
    LIMIT 1;

    IF v_po_id IS NULL THEN
      -- Create new PO for this hub
      INSERT INTO public.purchase_orders (hub_id, hub_name, eod_date, status)
      VALUES (rec.hub_id, rec.hub_name, p_date, 'pending')
      RETURNING id INTO v_po_id;

      v_po_count := v_po_count + 1;
      RAISE NOTICE '[EOD] Created PO for hub: %', rec.hub_name;
    END IF;

    -- ── Step 5: Add/update item in PO ─────────────────────────
    -- Check if this product already has a line in this PO
    IF EXISTS (
      SELECT 1 FROM public.purchase_order_items
      WHERE po_id = v_po_id AND product_id = rec.product_id
    ) THEN
      -- Update existing line
      UPDATE public.purchase_order_items
      SET required_qty = rec.required_qty,
          ordered_qty  = v_net_qty
      WHERE po_id = v_po_id AND product_id = rec.product_id;
    ELSE
      -- Insert new line (trigger will auto-create box)
      INSERT INTO public.purchase_order_items (
        po_id, product_id, product_name, hub_id,
        required_qty, ordered_qty, unit, status
      ) VALUES (
        v_po_id,
        rec.product_id,
        rec.product_name,
        rec.hub_id,
        rec.required_qty,
        v_net_qty,
        COALESCE(rec.unit, 'kg'),
        'pending'
      );
      v_item_count := v_item_count + 1;
    END IF;

  END LOOP;

  -- ── Step 6: Assign POs to purchase executives per hub ────────
  FOR rec IN
    SELECT DISTINCT po.id AS po_id, po.hub_id
    FROM public.purchase_orders po
    WHERE po.eod_date = p_date
      AND po.status   = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM public.po_assignments pa WHERE pa.po_id = po.id
      )
  LOOP
    -- Find PE for this hub
    SELECT id INTO v_pe_id
    FROM public.profiles
    WHERE hub_id   = rec.hub_id
      AND role     = 'purchase_manager'
      AND is_active = true
    LIMIT 1;

    IF v_pe_id IS NOT NULL THEN
      INSERT INTO public.po_assignments (po_id, hub_id, purchase_executive_id, status)
      VALUES (rec.po_id, rec.hub_id, v_pe_id, 'assigned');
      -- Notification sent automatically by trg_notify_pe trigger
    ELSE
      -- No PE found — notify ff_operations_manager
      INSERT INTO public.notifications (user_id, title, body, type, ref_id, ref_type)
      SELECT id,
        '⚠️ No Purchase Executive for hub',
        'PO created for ' || rec.hub_id || ' but no purchase_manager assigned to this hub.',
        'po_unassigned',
        rec.po_id,
        'purchase_order'
      FROM public.profiles
      WHERE role = 'ff_operations_manager' AND is_active = true
      LIMIT 1;

      v_errors := v_errors || ('No PE found for hub_id: ' || rec.hub_id);
    END IF;
  END LOOP;

  -- ── Step 7: Update PO totals ──────────────────────────────────
  UPDATE public.purchase_orders po
  SET total_estimated = (
    SELECT COALESCE(SUM(poi.ordered_qty * COALESCE(
      (SELECT grade_a_price FROM public.products WHERE id = poi.product_id LIMIT 1), 0
    )), 0)
    FROM public.purchase_order_items poi
    WHERE poi.po_id = po.id
  )
  WHERE po.eod_date = p_date;

  -- ── Step 8: Build result ──────────────────────────────────────
  v_result := jsonb_build_object(
    'date',          p_date,
    'pos_created',   v_po_count,
    'items_created', v_item_count,
    'skipped_stock', v_stock_skip,
    'errors',        to_jsonb(v_errors),
    'status',        'success'
  );

  RAISE NOTICE '[EOD PO Engine] Done: % POs, % items, % skipped',
    v_po_count, v_item_count, v_stock_skip;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'status', 'error',
    'message', SQLERRM,
    'date', p_date
  );
END;
$$;


-- ── Manual test (run this to verify the function works) ───────
-- SELECT public.run_eod_po_engine(CURRENT_DATE);


-- ════════════════════════════════════════════════════════════
--  MANUAL TRIGGER FUNCTION
--  Allows ops manager to trigger PO generation mid-day
--  (same logic, just callable from ERP dashboard)
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trigger_eod_po_now()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN public.run_eod_po_engine(CURRENT_DATE);
END;
$$;
