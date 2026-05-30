-- ============================================================
-- FFERPv2 — PROFILE ROLE FIX  (v2 — email + name fallback)
-- Run this in Supabase SQL Editor (project: bvbfnguqpuctdvfztuda)
-- ============================================================

-- ── STEP 1: Update by email (primary key for seeded accounts) ──
UPDATE public.profiles SET role = 'admin',                 name = 'Admin User',              department = 'Administration'  WHERE email = 'admin@farmersfactory.com';
UPDATE public.profiles SET role = 'ceo',                   name = 'CEO User',                department = 'Executive'        WHERE email = 'ceo@farmersfactory.com';
UPDATE public.profiles SET role = 'gm',                    name = 'General Manager',         department = 'Operations'       WHERE email = 'gm@farmersfactory.com';
UPDATE public.profiles SET role = 'l1_manager',            name = 'L1 Manager',              department = 'Finance'          WHERE email = 'l1manager@farmersfactory.com';
UPDATE public.profiles SET role = 'auditor',               name = 'Auditor',                 department = 'Audit'            WHERE email = 'auditor@farmersfactory.com';
UPDATE public.profiles SET role = 'accounts',              name = 'Accounts Executive',      department = 'Accounts'         WHERE email = 'accounts@farmersfactory.com';
UPDATE public.profiles SET role = 'ff_operations_manager', name = 'FF Operations Manager',   department = 'FF Operations'    WHERE email = 'ffops@farmersfactory.com';
UPDATE public.profiles SET role = 'hub_manager',           name = 'Hub Manager',             department = 'Warehouse'        WHERE email = 'hubmanager@farmersfactory.com';
UPDATE public.profiles SET role = 'warehouse_manager',     name = 'Warehouse Manager',       department = 'Warehouse'        WHERE email = 'warehouse@farmersfactory.com';
UPDATE public.profiles SET role = 'qc_manager',            name = 'QC Manager',              department = 'Quality Control'  WHERE email = 'qcmanager@farmersfactory.com';
UPDATE public.profiles SET role = 'purchase_manager',      name = 'Purchase Manager',        department = 'Purchase'         WHERE email = 'purchase@farmersfactory.com';
UPDATE public.profiles SET role = 'purchase_head',         name = 'Purchase Head',           department = 'Purchase'         WHERE email = 'purchasehead@farmersfactory.com';
UPDATE public.profiles SET role = 'field_executive',       name = 'Field Executive',         department = 'Sales'            WHERE email = 'fieldexec@farmersfactory.com';
UPDATE public.profiles SET role = 'bde',                   name = 'Business Dev Executive',  department = 'Sales'            WHERE email = 'bde@farmersfactory.com';
UPDATE public.profiles SET role = 'tele_caller',           name = 'Tele Caller',             department = 'Sales'            WHERE email = 'telecaller@farmersfactory.com';
UPDATE public.profiles SET role = 'driver',                name = 'Driver',                  department = 'Logistics'        WHERE email = 'driver@farmersfactory.com';
UPDATE public.profiles SET role = 'back_office',           name = 'Back Office',             department = 'Operations'       WHERE email = 'backoffice@farmersfactory.com';
UPDATE public.profiles SET role = 'shift_employee',        name = 'Shift Employee',          department = 'Operations'       WHERE email = 'shiftemployee@farmersfactory.com';

-- ── STEP 2: Fallback — fix by display name (catches mismatched emails) ──
-- These only update rows that STILL have wrong roles after the email pass above.
UPDATE public.profiles SET role = 'admin'                 WHERE name ILIKE '%Admin User%'              AND role <> 'admin';
UPDATE public.profiles SET role = 'ceo'                   WHERE name ILIKE '%CEO User%'                AND role <> 'ceo';
UPDATE public.profiles SET role = 'gm'                    WHERE name ILIKE '%General Manager%'         AND role <> 'gm';
UPDATE public.profiles SET role = 'l1_manager'            WHERE name ILIKE '%L1 Manager%'              AND role <> 'l1_manager';
UPDATE public.profiles SET role = 'auditor'               WHERE name ILIKE '%Auditor%'                 AND role <> 'auditor';
UPDATE public.profiles SET role = 'accounts'              WHERE name ILIKE '%Accounts Executive%'      AND role <> 'accounts';
UPDATE public.profiles SET role = 'ff_operations_manager' WHERE name ILIKE '%FF Operations Manager%'   AND role <> 'ff_operations_manager';
UPDATE public.profiles SET role = 'hub_manager'           WHERE name ILIKE '%Hub Manager%'             AND role <> 'hub_manager';
UPDATE public.profiles SET role = 'warehouse_manager'     WHERE name ILIKE '%Warehouse Manager%'       AND role <> 'warehouse_manager';
UPDATE public.profiles SET role = 'qc_manager'            WHERE name ILIKE '%QC Manager%'              AND role <> 'qc_manager';
UPDATE public.profiles SET role = 'purchase_manager'      WHERE name ILIKE '%Purchase Manager%'        AND role <> 'purchase_manager';
UPDATE public.profiles SET role = 'purchase_head'         WHERE name ILIKE '%Purchase Head%'           AND role <> 'purchase_head';
UPDATE public.profiles SET role = 'field_executive'       WHERE name ILIKE '%Field Executive%'         AND role <> 'field_executive';
UPDATE public.profiles SET role = 'bde'                   WHERE name ILIKE '%Business Dev Executive%'  AND role <> 'bde';
UPDATE public.profiles SET role = 'tele_caller'           WHERE name ILIKE '%Tele Caller%'             AND role <> 'tele_caller';
UPDATE public.profiles SET role = 'driver'                WHERE name ILIKE '%Driver%'                  AND role <> 'driver';
UPDATE public.profiles SET role = 'back_office'           WHERE name ILIKE '%Back Office%'             AND role <> 'back_office';
UPDATE public.profiles SET role = 'shift_employee'        WHERE name ILIKE '%Shift Employee%'          AND role <> 'shift_employee';

-- ── STEP 3: See ALL current profiles (check no wrong roles remain) ──
SELECT id, email, name, role, department
FROM public.profiles
ORDER BY
  CASE role
    WHEN 'admin'                 THEN 1
    WHEN 'ceo'                   THEN 2
    WHEN 'gm'                    THEN 3
    WHEN 'l1_manager'            THEN 4
    WHEN 'auditor'               THEN 5
    WHEN 'accounts'              THEN 6
    WHEN 'ff_operations_manager' THEN 7
    WHEN 'hub_manager'           THEN 8
    WHEN 'warehouse_manager'     THEN 9
    WHEN 'qc_manager'            THEN 10
    WHEN 'purchase_manager'      THEN 11
    WHEN 'purchase_head'         THEN 12
    WHEN 'field_executive'       THEN 13
    WHEN 'bde'                   THEN 14
    WHEN 'tele_caller'           THEN 15
    WHEN 'driver'                THEN 16
    WHEN 'back_office'           THEN 17
    WHEN 'shift_employee'        THEN 18
    ELSE 99
  END, name;
