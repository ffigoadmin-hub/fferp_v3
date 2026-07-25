-- ============================================================
--  FIX — Hub Manager late-login auto-LOP (0.10, grace till 7:30 AM IST)
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Management rule: Hub Manager workday starts 7:00 AM, grace period
--  until 7:30 AM. Starting a shift after 7:30 AM IST auto-raises a
--  0.10 LOP entry (status: pending — reviewable by HR/admin before it
--  counts, same as a manually-raised LOP, before it ever reaches payroll).
--
--  This is a DB trigger on shift_sessions, so it fires automatically
--  the instant any hub_manager clicks "Start Shift" in the app
--  (src/hooks/useShiftSession.ts) — no dependency on any script running.
--  Every other role is untouched — the trigger no-ops for them.
--
--  CORRECTED after checking live schema (shift_sessions): this table
--  has no shift_start/shift_end columns — the real columns are
--  login_time/logout_time. But login_time has NO database default
--  and the app's startShift() insert never sets it explicitly, so it
--  is NULL on every real row today. created_at DOES default to
--  now() and IS reliably populated on every insert, so the trigger
--  uses created_at as the actual "when did they start their shift"
--  signal instead of login_time.
--
--  CORRECTED again after checking live schema (lop_entries): this
--  table has NO lop_days or lop_value column — lop_type (text) is the
--  ONLY field that represents the amount, and status defaults to
--  'pending_admin' (not the generic 'pending' used in the first draft).
--  The amount is now encoded purely via lop_type = '0.1_day' — there
--  is no numeric fallback field, so whatever downstream payroll
--  rollup reads lop_type must recognize this new value (flagged as an
--  open verification item — see the plan file / final summary).
-- ============================================================

-- ── STEP 1: Trigger function ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_hub_manager_late_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role      text;
  v_ist_time  time;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = NEW.user_id;

  IF v_role IS DISTINCT FROM 'hub_manager' THEN
    RETURN NEW;
  END IF;

  v_ist_time := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Kolkata')::time;

  IF v_ist_time > TIME '07:30:00' THEN
    IF NOT EXISTS (
      SELECT 1 FROM lop_entries
      WHERE employee_id = NEW.user_id
        AND lop_date = NEW.date
        AND source = 'SYSTEM_LATE_SHIFT_START'
    ) THEN
      INSERT INTO lop_entries (
        employee_id, lop_date, lop_type, reason, status, source, evidence_url
      ) VALUES (
        NEW.user_id, NEW.date, '0.1_day',
        'Late shift start after 7:30 AM grace period',
        'pending_admin', 'SYSTEM_LATE_SHIFT_START', 'SYSTEM_AUTO_LOP'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ── STEP 2: Trigger ───────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_check_hub_manager_late_login ON shift_sessions;

CREATE TRIGGER trg_check_hub_manager_late_login
AFTER INSERT ON shift_sessions
FOR EACH ROW
EXECUTE FUNCTION public.check_hub_manager_late_login();

-- ── STEP 3: Test (use a REAL hub_manager id from profiles) ─────────────
-- Replace the user_id below with a real hub_manager's id, then check
-- lop_entries for a new row with source = 'SYSTEM_LATE_SHIFT_START'.
-- DELETE both test rows afterwards.
--
-- This inserts a row exactly as the app would (no login_time/created_at
-- override) — created_at will default to NOW(), so only run this test
-- itself after 7:30 AM IST for the row to actually trigger the LOP.
--
-- INSERT INTO shift_sessions (user_id, date, login_selfie_url, status, target_hours, max_hours)
-- VALUES ('<hub_manager_id>', CURRENT_DATE, 'TEST', 'active', 9, 12);
--
-- SELECT * FROM lop_entries WHERE source = 'SYSTEM_LATE_SHIFT_START' ORDER BY created_at DESC LIMIT 5;
--
-- -- cleanup:
-- DELETE FROM lop_entries WHERE source = 'SYSTEM_LATE_SHIFT_START' AND evidence_url = 'SYSTEM_AUTO_LOP' AND reason LIKE 'Late shift start%' AND created_at > now() - interval '10 minutes';
-- DELETE FROM shift_sessions WHERE login_selfie_url = 'TEST';

-- ── Verify trigger is attached ───────────────────────────────────────
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = 'trg_check_hub_manager_late_login';
