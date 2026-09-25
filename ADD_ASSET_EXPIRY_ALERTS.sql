-- ADD_ASSET_EXPIRY_ALERTS.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Asset Management, Phase 3: proactive expiry alerts for vehicle compliance documents.
-- VehicleManagementPage already shows red/amber expiry badges, but only to whoever opens that
-- page. This makes the same insurance/PUC/permit/fitness expiries push into the existing
-- notification bell (public.notifications) for admin/ops roles, so nobody has to remember to
-- go check the page.
--
-- Design mirrors FIX_HUB_MANAGER_NO_SHOW_CRON.sql: a dedup marker table (one row per
-- vehicle+field+expiry_date, UNIQUE constraint) so re-running the daily check never double-alerts
-- for the same expiry event, then a pg_cron job that runs it once a day.
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.asset_expiry_alerts_sent (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   uuid NOT NULL REFERENCES public.transport_vehicles(id),
  field        text NOT NULL CHECK (field IN ('insurance', 'puc', 'permit', 'fitness')),
  expiry_date  date NOT NULL,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, field, expiry_date)
);
ALTER TABLE public.asset_expiry_alerts_sent ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asset_expiry_alerts_sent_staff_access ON public.asset_expiry_alerts_sent;
CREATE POLICY asset_expiry_alerts_sent_staff_access ON public.asset_expiry_alerts_sent FOR ALL USING (is_staff()) WITH CHECK (is_staff());

CREATE OR REPLACE FUNCTION public.check_asset_expiries(p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r            record;
  v_recipient  record;
  v_days       int;
  v_title      text;
  v_message    text;
  v_alerted    int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'gm', 'ff_operations_manager', 'logistics')
  ) THEN
    RAISE EXCEPTION 'Not authorized to run asset expiry check';
  END IF;

  FOR r IN
    SELECT v.id AS vehicle_id, v.vehicle_number, f.field, f.expiry_date
    FROM public.transport_vehicles v
    CROSS JOIN LATERAL (VALUES
      ('insurance', v.insurance_expiry),
      ('puc',       v.puc_expiry),
      ('permit',    v.permit_expiry),
      ('fitness',   v.fitness_expiry)
    ) AS f(field, expiry_date)
    WHERE v.is_active
      AND f.expiry_date IS NOT NULL
      AND f.expiry_date <= p_date + INTERVAL '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.asset_expiry_alerts_sent a
        WHERE a.vehicle_id = v.id AND a.field = f.field AND a.expiry_date = f.expiry_date
      )
  LOOP
    v_days := (r.expiry_date::date - p_date);
    v_title := CASE WHEN v_days < 0 THEN '🚨 Vehicle Document Expired' ELSE '⚠️ Vehicle Document Expiring Soon' END;
    v_message := initcap(r.field) || ' for ' || r.vehicle_number || ' '
      || CASE WHEN v_days < 0 THEN 'expired' ELSE 'expires in ' || v_days || ' day(s)' END
      || ' (' || to_char(r.expiry_date, 'DD Mon YYYY') || ')';

    FOR v_recipient IN
      SELECT id FROM public.profiles
      WHERE role IN ('admin', 'ceo', 'gm', 'ff_operations_manager', 'logistics') AND is_active
    LOOP
      INSERT INTO public.notifications (user_id, role, type, title, message, related_record_id, link)
      VALUES (v_recipient.id, 'admin', 'asset_expiry', v_title, v_message, r.vehicle_id, '/admin/vehicles');
    END LOOP;

    INSERT INTO public.asset_expiry_alerts_sent (vehicle_id, field, expiry_date)
    VALUES (r.vehicle_id, r.field, r.expiry_date)
    ON CONFLICT (vehicle_id, field, expiry_date) DO NOTHING;

    v_alerted := v_alerted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'date', p_date::text,
    'expiry_events_alerted', v_alerted,
    'message', CASE WHEN v_alerted = 0 THEN 'No new expiries in the 30-day window' ELSE v_alerted::text || ' expiry event(s) alerted' END
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_asset_expiries(date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.check_asset_expiries(date) TO authenticated;

-- Daily at 8:00 AM IST (2:30 UTC)
SELECT cron.schedule(
  'asset_expiry_daily_check',
  '30 2 * * *',
  $$ SELECT public.check_asset_expiries(CURRENT_DATE); $$
);
