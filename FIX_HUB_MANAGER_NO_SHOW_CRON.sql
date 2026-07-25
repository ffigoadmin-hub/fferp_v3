-- ============================================================
--  FIX — Hub Manager no-show auto-LOP (1.0 day, absence)
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Companion to FIX_HUB_MANAGER_LATE_LOGIN_TRIGGER.sql. A trigger can
--  only fire on an INSERT — it can't detect the absence of one. So a
--  hub_manager who never starts a shift at all that day needs a
--  once-daily scheduled check instead, run late enough (9:00 PM IST)
--  that a genuinely-late-but-present manager has had time to start
--  their shift first (same reasoning as the existing but unused
--  src/utils/autoLopLogic.ts precedent: "only run after 8 PM").
--
--  Marks the day as a full 1.0 LOP absence, status: pending_admin
--  (reviewable by HR/admin before it counts, same as every other LOP
--  entry here). Skips week-off days (reuses the existing
--  is_week_off_day RPC) and anyone already marked absent through some
--  other path.
--
--  CORRECTED after checking live schema: lop_entries has NO lop_days
--  column — lop_type ('1_day') is the only field representing the
--  amount, and the real pending status value is 'pending_admin', not
--  the generic 'pending' used in the first draft.
-- ============================================================

-- ── STEP 1: The check function ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_hub_manager_no_shift(p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r              RECORD;
  v_is_week_off  boolean;
  v_count        INT := 0;
BEGIN
  FOR r IN
    SELECT id, name FROM profiles
    WHERE role = 'hub_manager' AND is_active = true
  LOOP
    -- Skip week-offs
    SELECT public.is_week_off_day(r.id, p_date) INTO v_is_week_off;
    IF v_is_week_off IS TRUE THEN
      CONTINUE;
    END IF;

    -- Skip if a shift was actually started that day
    IF EXISTS (SELECT 1 FROM shift_sessions WHERE user_id = r.id AND date = p_date) THEN
      CONTINUE;
    END IF;

    -- Skip if already marked absent (1_day LOP) through some other path
    IF EXISTS (
      SELECT 1 FROM lop_entries
      WHERE employee_id = r.id AND lop_date = p_date AND lop_type = '1_day'
    ) THEN
      CONTINUE;
    END IF;

    -- Skip if this exact auto-check already ran for this person/date
    IF EXISTS (
      SELECT 1 FROM lop_entries
      WHERE employee_id = r.id AND lop_date = p_date AND source = 'SYSTEM_NO_SHIFT_START'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO lop_entries (
      employee_id, lop_date, lop_type, reason, status, source, evidence_url
    ) VALUES (
      r.id, p_date, '1_day',
      'No shift started for the day',
      'pending_admin', 'SYSTEM_NO_SHIFT_START', 'SYSTEM_AUTO_LOP'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN JSONB_BUILD_OBJECT(
    'date', p_date::text,
    'lop_entries_created', v_count,
    'message', CASE WHEN v_count = 0 THEN 'No no-shows found' ELSE v_count::text || ' hub_manager(s) marked absent' END
  );
END;
$function$;

-- ── STEP 2: Schedule it daily at 9:00 PM IST (15:30 UTC) ──────────────
SELECT cron.schedule(
  'hub_manager_no_shift_check',
  '30 15 * * *',
  $$ SELECT public.check_hub_manager_no_shift(CURRENT_DATE); $$
);

-- ── STEP 3: Test manually on a real past date ───────────────────────
-- Pick a real past date where a known hub_manager genuinely had no
-- shift_sessions row and wasn't a week-off, then check the result:
-- SELECT check_hub_manager_no_shift('2026-07-20');
-- SELECT * FROM lop_entries WHERE source = 'SYSTEM_NO_SHIFT_START' ORDER BY created_at DESC LIMIT 5;
-- -- cleanup: DELETE FROM lop_entries WHERE id = '<the test row id>';

-- ── Verify the cron job registered ──────────────────────────────────
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'hub_manager_no_shift_check';
