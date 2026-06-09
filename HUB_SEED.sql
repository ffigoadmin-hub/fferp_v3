-- ============================================================
--  FF ERP — Hub & Pincode Seed Data
--  Run on: qwiumswrbddwmlraktvy (new core DB)
--  Run AFTER MASTER_INTEGRATION_MIGRATION.sql
--  Generated: 2026-06-01
-- ============================================================

-- ════════════════════════════════════════════════════════════
--  STEP 1 — INSERT HUBS
--  (Uses ON CONFLICT so safe to re-run)
-- ════════════════════════════════════════════════════════════

INSERT INTO public.hubs (id, name, code, address, city, state, pincode, is_active)
VALUES
  (
    gen_random_uuid(),
    'Pallikaranai Hub',
    'HUB-01',
    'Pallikaranai, Chennai',
    'Chennai',
    'Tamil Nadu',
    '600100',
    true
  ),
  (
    gen_random_uuid(),
    'Vanagaram Hub',
    'HUB-02',
    'Vanagaram, Chennai',
    'Chennai',
    'Tamil Nadu',
    '600095',
    true
  ),
  (
    gen_random_uuid(),
    'Hyderabad Hub',
    'HUB-03',
    'Hyderabad',
    'Hyderabad',
    'Telangana',
    '500001',
    true
  )
ON CONFLICT (code) DO UPDATE SET
  name      = EXCLUDED.name,
  address   = EXCLUDED.address,
  city      = EXCLUDED.city,
  state     = EXCLUDED.state,
  pincode   = EXCLUDED.pincode,
  is_active = EXCLUDED.is_active;


-- ════════════════════════════════════════════════════════════
--  STEP 2 — CREATE hub_pincodes TABLE (if not yet created)
--  This may already exist from MASTER_INTEGRATION_MIGRATION.sql
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.hub_pincodes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id     uuid NOT NULL REFERENCES public.hubs(id) ON DELETE CASCADE,
  pincode    text NOT NULL,
  area_name  text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT hub_pincodes_pincode_unique UNIQUE (pincode)
);

CREATE INDEX IF NOT EXISTS idx_hub_pincodes_pincode ON public.hub_pincodes(pincode);
CREATE INDEX IF NOT EXISTS idx_hub_pincodes_hub     ON public.hub_pincodes(hub_id);


-- ════════════════════════════════════════════════════════════
--  STEP 3 — INSERT PINCODES
-- ════════════════════════════════════════════════════════════

-- Hub 1: Pallikaranai — pincode 600100
INSERT INTO public.hub_pincodes (hub_id, pincode, area_name)
SELECT h.id, '600100', 'Pallikaranai'
FROM public.hubs h WHERE h.code = 'HUB-01'
ON CONFLICT (pincode) DO UPDATE SET hub_id = EXCLUDED.hub_id;

-- Hub 2: Vanagaram — pincode 600095
INSERT INTO public.hub_pincodes (hub_id, pincode, area_name)
SELECT h.id, '600095', 'Vanagaram'
FROM public.hubs h WHERE h.code = 'HUB-02'
ON CONFLICT (pincode) DO UPDATE SET hub_id = EXCLUDED.hub_id;

-- Hub 3: Hyderabad — range 500001 to 500095 (95 pincodes)
INSERT INTO public.hub_pincodes (hub_id, pincode, area_name)
SELECT
  h.id,
  LPAD(n::text, 6, '0'),
  'Hyderabad'
FROM public.hubs h
CROSS JOIN generate_series(500001, 500095) AS n
WHERE h.code = 'HUB-03'
ON CONFLICT (pincode) DO UPDATE SET hub_id = EXCLUDED.hub_id;

-- Hub 3: Hyderabad — specific pincode 502325 (Hyd Bath area)
INSERT INTO public.hub_pincodes (hub_id, pincode, area_name)
SELECT h.id, '502325', 'Hyderabad Bath'
FROM public.hubs h WHERE h.code = 'HUB-03'
ON CONFLICT (pincode) DO UPDATE SET hub_id = EXCLUDED.hub_id;


-- ════════════════════════════════════════════════════════════
--  STEP 4 — AUTO-ASSIGN HUB TRIGGER
--  When a new sales_order is inserted, look up the customer's
--  pincode and assign the closest hub automatically.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_assign_hub()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_pincode text;
  v_hub_id  uuid;
BEGIN
  -- Get pincode from order itself, or fall back to customer record
  v_pincode := COALESCE(
    NEW.pincode,
    (SELECT pincode FROM public.customers WHERE id = NEW.customer_id LIMIT 1)
  );

  IF v_pincode IS NOT NULL THEN
    -- Direct pincode match
    SELECT hp.hub_id INTO v_hub_id
    FROM public.hub_pincodes hp
    WHERE hp.pincode = v_pincode
    LIMIT 1;

    -- If no exact match, try first 4 digits (area prefix fallback)
    IF v_hub_id IS NULL THEN
      SELECT hp.hub_id INTO v_hub_id
      FROM public.hub_pincodes hp
      WHERE LEFT(hp.pincode, 4) = LEFT(v_pincode, 4)
      LIMIT 1;
    END IF;

    IF v_hub_id IS NOT NULL THEN
      NEW.hub_id := v_hub_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_hub ON public.sales_orders;
CREATE TRIGGER trg_auto_assign_hub
  BEFORE INSERT ON public.sales_orders
  FOR EACH ROW
  WHEN (NEW.hub_id IS NULL)
  EXECUTE FUNCTION public.auto_assign_hub();


-- ════════════════════════════════════════════════════════════
--  VERIFICATION — Check what was inserted
-- ════════════════════════════════════════════════════════════

SELECT
  h.code,
  h.name,
  h.city,
  COUNT(hp.id) AS pincode_count,
  MIN(hp.pincode) AS from_pin,
  MAX(hp.pincode) AS to_pin
FROM public.hubs h
LEFT JOIN public.hub_pincodes hp ON hp.hub_id = h.id
GROUP BY h.code, h.name, h.city
ORDER BY h.code;

-- ════════════════════════════════════════════════════════════
--  EXPECTED OUTPUT:
--  HUB-01 | Pallikaranai Hub | Chennai   | 1  pincodes | 600100 → 600100
--  HUB-02 | Vanagaram Hub    | Chennai   | 1  pincodes | 600095 → 600095
--  HUB-03 | Hyderabad Hub    | Hyderabad | 96 pincodes | 500001 → 500095 + 502325
-- ════════════════════════════════════════════════════════════
