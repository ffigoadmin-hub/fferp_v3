-- ============================================================
-- FFERPv2 — PHASE 4: AUTOMATION TRIGGERS & FUNCTIONS
-- Project: bvbfnguqpuctdvfztuda.supabase.co
-- Run in Supabase SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECTION 1 — PAYMENT STATUS AUDIT TRAIL
-- Log every status change on ff_vendor_payments &
-- ff_transport_payments to a central audit table
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ff_payment_audit_trail (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_type   TEXT NOT NULL CHECK (payment_type IN ('vendor','transport')),
  payment_id     UUID NOT NULL,
  from_status    TEXT,
  to_status      TEXT NOT NULL,
  changed_by     UUID REFERENCES public.profiles(id),
  remarks        TEXT,
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ff_payment_audit_payment ON public.ff_payment_audit_trail(payment_id);
CREATE INDEX IF NOT EXISTS idx_ff_payment_audit_at      ON public.ff_payment_audit_trail(changed_at DESC);

-- Trigger function — vendor payments
CREATE OR REPLACE FUNCTION public.trg_vendor_payment_audit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    INSERT INTO public.ff_payment_audit_trail
      (payment_type, payment_id, from_status, to_status, changed_by, remarks)
    VALUES (
      'vendor',
      NEW.id,
      OLD.payment_status,
      NEW.payment_status,
      COALESCE(
        NEW.ff_ops_approved_by, NEW.gm_approved_by, NEW.l1_approved_by,
        NEW.auditor_approved_by, NEW.ceo_approved_by, NEW.rejected_by, NEW.paid_by
      ),
      CASE NEW.payment_status
        WHEN 'pending_gm'      THEN 'Approved by FF Ops · ' || COALESCE(NEW.ff_ops_remarks,'')
        WHEN 'pending_l1'      THEN 'Approved by GM · '     || COALESCE(NEW.gm_remarks,'')
        WHEN 'pending_auditor' THEN 'Approved by L1 · '     || COALESCE(NEW.l1_remarks,'')
        WHEN 'pending_ceo'     THEN 'Approved by Auditor · '|| COALESCE(NEW.auditor_remarks,'')
        WHEN 'approved'        THEN 'Final approval by CEO · ' || COALESCE(NEW.ceo_remarks,'')
        WHEN 'paid'            THEN 'Payment processed · UTR: ' || COALESCE(NEW.utr_number,'—')
        WHEN 'rejected'        THEN 'Rejected · ' || COALESCE(NEW.rejection_reason,'—')
        ELSE NULL
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_payment_audit ON public.ff_vendor_payments;
CREATE TRIGGER trg_vendor_payment_audit
  AFTER UPDATE ON public.ff_vendor_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_vendor_payment_audit();

-- Trigger function — transport payments
CREATE OR REPLACE FUNCTION public.trg_transport_payment_audit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    INSERT INTO public.ff_payment_audit_trail
      (payment_type, payment_id, from_status, to_status, changed_by, remarks)
    VALUES (
      'transport',
      NEW.id,
      OLD.payment_status,
      NEW.payment_status,
      COALESCE(
        NEW.ff_ops_approved_by, NEW.gm_approved_by, NEW.l1_approved_by,
        NEW.auditor_approved_by, NEW.ceo_approved_by, NEW.rejected_by, NEW.paid_by
      ),
      CASE NEW.payment_status
        WHEN 'rejected' THEN 'Rejected · ' || COALESCE(NEW.rejection_reason,'—')
        WHEN 'approved' THEN 'CEO Approved · ' || COALESCE(NEW.ceo_remarks,'')
        WHEN 'paid'     THEN 'Paid · UTR: ' || COALESCE(NEW.utr_number,'—')
        ELSE NULL
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transport_payment_audit ON public.ff_transport_payments;
CREATE TRIGGER trg_transport_payment_audit
  AFTER UPDATE ON public.ff_transport_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_transport_payment_audit();

-- ────────────────────────────────────────────────────────────
-- SECTION 2 — AUTO-CREATE VENDOR PAYMENT WHEN PO RECEIVED
-- When purchase_orders.status is set to 'received',
-- automatically create a ff_vendor_payments record at
-- pending_ff_ops if one doesn't already exist for that PO.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_po_received_create_payment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_items  JSONB;
  v_gross  NUMERIC;
BEGIN
  -- Only fire when status changes TO 'received'
  IF NEW.status = 'received' AND (OLD.status IS DISTINCT FROM 'received') THEN

    -- Skip if a payment already exists for this PO
    IF EXISTS (
      SELECT 1 FROM public.ff_vendor_payments WHERE purchase_order_id = NEW.id
    ) THEN
      RETURN NEW;
    END IF;

    -- Build items JSONB from purchase_order_items if they exist
    SELECT
      COALESCE(
        jsonb_agg(jsonb_build_object(
          'product_name', COALESCE(p.name, poi.product_name, 'Unknown'),
          'qty',          poi.quantity,
          'unit',         COALESCE(poi.unit, 'kg'),
          'rate',         poi.unit_price,
          'amount',       poi.quantity * poi.unit_price,
          'qc_grade',     NULL,
          'deduction_reason', NULL
        )),
        '[]'::jsonb
      )
    INTO v_items
    FROM public.purchase_order_items poi
    LEFT JOIN public.products p ON p.id = poi.product_id
    WHERE poi.purchase_order_id = NEW.id;

    -- Calculate gross amount
    SELECT COALESCE(SUM(quantity * unit_price), 0)
    INTO v_gross
    FROM public.purchase_order_items
    WHERE purchase_order_id = NEW.id;

    -- If no line items found, use PO total_amount
    IF v_gross = 0 THEN
      v_gross := COALESCE(NEW.total_amount, 0);
    END IF;

    -- Insert the vendor payment record
    INSERT INTO public.ff_vendor_payments (
      purchase_order_id,
      vendor_id,
      hub_id,
      items,
      gross_amount,
      deduction_amount,
      payment_status,
      created_by
    ) VALUES (
      NEW.id,
      NEW.vendor_id,
      NEW.hub_id,
      v_items,
      v_gross,
      0,
      'pending_ff_ops',
      NEW.created_by
    );

    RAISE NOTICE 'Auto-created vendor payment for PO %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Only attach if purchase_orders has status column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
      AND column_name = 'status'
  ) THEN
    DROP TRIGGER IF EXISTS trg_po_received_create_payment ON public.purchase_orders;
    CREATE TRIGGER trg_po_received_create_payment
      AFTER UPDATE OF status ON public.purchase_orders
      FOR EACH ROW EXECUTE FUNCTION public.trg_po_received_create_payment();
    RAISE NOTICE 'Trigger trg_po_received_create_payment attached to purchase_orders';
  ELSE
    RAISE NOTICE 'Skipped trigger — purchase_orders.status column not found';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- SECTION 3 — AUTO-MISS TASKS AT END OF DAY
-- Function called via pg_cron or Supabase scheduled edge fn.
-- Marks in_progress/pending tasks as 'missed' if task_date < today.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_miss_overdue_tasks()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.ff_task_assignments
  SET status = 'missed'
  WHERE task_date < CURRENT_DATE
    AND status IN ('pending', 'in_progress');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Marked % tasks as missed', v_count;
  RETURN v_count;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- SECTION 4 — APPROVED PAYMENT → MARK PO AS PAID
-- When ff_vendor_payments status = 'paid',
-- update purchase_orders.payment_status = 'paid'
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_vendor_payment_paid_sync_po()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND OLD.payment_status <> 'paid'
     AND NEW.purchase_order_id IS NOT NULL THEN
    UPDATE public.purchase_orders
    SET payment_status = 'paid',
        paid_at = now()
    WHERE id = NEW.purchase_order_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_payment_paid_sync_po ON public.ff_vendor_payments;
CREATE TRIGGER trg_vendor_payment_paid_sync_po
  AFTER UPDATE OF payment_status ON public.ff_vendor_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_vendor_payment_paid_sync_po();

-- ────────────────────────────────────────────────────────────
-- SECTION 5 — ADD MISSING COLUMNS TO PURCHASE_ORDERS
-- (needed by the triggers above)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','pending','paid')),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES public.hubs(id),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- ────────────────────────────────────────────────────────────
-- SECTION 6 — HELPER VIEW: PAYMENT PIPELINE SUMMARY
-- Useful for CEO / L1 overview dashboards
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_ff_payment_pipeline AS
SELECT
  'vendor'         AS payment_type,
  payment_status,
  COUNT(*)         AS count,
  SUM(net_amount)  AS total_amount,
  MIN(created_at)  AS oldest_pending
FROM public.ff_vendor_payments
GROUP BY payment_status

UNION ALL

SELECT
  'transport'       AS payment_type,
  payment_status,
  COUNT(*)          AS count,
  SUM(total_amount) AS total_amount,
  MIN(created_at)   AS oldest_pending
FROM public.ff_transport_payments
GROUP BY payment_status;

-- ────────────────────────────────────────────────────────────
-- SECTION 7 — RLS ON AUDIT TRAIL
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.ff_payment_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "management reads audit trail"
  ON public.ff_payment_audit_trail FOR SELECT
  USING (current_user_role() IN ('ff_operations_manager','gm','l1_manager','auditor','ceo','admin'));

-- ────────────────────────────────────────────────────────────
-- SECTION 8 — VERIFY
-- ────────────────────────────────────────────────────────────

SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'trg_%'
ORDER BY event_object_table, trigger_name;
