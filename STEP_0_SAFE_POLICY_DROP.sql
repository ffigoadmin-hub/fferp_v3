-- ============================================================
--  STEP 0 — SAFE RLS POLICY DROP (run BEFORE Part 1)
--  Project: FFERPv2 | DB: qwiumswrbddwmlraktvy
--  Generated: 2026-06-02
--
--  WHY: SCHEMA_PART1_FROM_MASTER.sql contains 201 CREATE POLICY
--  statements with no DROP POLICY IF EXISTS guards. Since
--  FIX_RLS_ALL_ROLES.sql and COMPLETE_SCHEMA_MIGRATION.sql were
--  already applied, every policy already exists and Part1 will
--  throw "policy already exists" on line 1 of the RLS section.
--
--  THIS SCRIPT: Drops ALL existing RLS policies on all public
--  tables using a single dynamic DO block. It is 100% safe —
--  no data is deleted, tables are untouched, only policy rules
--  are removed. Part1 then recreates them cleanly.
--
--  RUN ORDER:
--    1. This file (STEP_0_SAFE_POLICY_DROP.sql)   ← you are here
--    2. SCHEMA_PART1_FROM_MASTER.sql
--    3. SCHEMA_PART2_REMAINING.sql
--    4. EOD_PO_ENGINE.sql
--    5. Deploy edge function eod-po-engine
-- ============================================================

DO $$
DECLARE
  r RECORD;
  drop_sql TEXT;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  LOOP
    drop_sql := format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      r.policyname,
      r.tablename
    );
    EXECUTE drop_sql;
    RAISE NOTICE 'Dropped policy: % on %', r.policyname, r.tablename;
  END LOOP;

  RAISE NOTICE '✅ All RLS policies dropped. Safe to run SCHEMA_PART1_FROM_MASTER.sql now.';
END;
$$;

-- Quick verify — should return 0 rows after this runs:
SELECT COUNT(*) AS remaining_policies
FROM pg_policies
WHERE schemaname = 'public';
