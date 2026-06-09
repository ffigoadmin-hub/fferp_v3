-- ========================================================================
-- COMPLETE FIX: Project Verticals System
-- ========================================================================
-- This script will:
-- 1. Create a reusable seeder function
-- 2. Populate all 9 project verticals (6 DIRECT + 3 JV)
-- 3. Verify the data was inserted correctly
-- ========================================================================
-- STEP 1: Create reusable seeder function
-- This function can be called anytime to ensure all verticals exist
CREATE OR REPLACE FUNCTION seed_project_verticals() RETURNS TABLE(action TEXT, count BIGINT) AS $$
DECLARE inserted_count INTEGER;
updated_count INTEGER;
BEGIN -- Insert all verticals with conflict handling
WITH upsert_result AS (
    INSERT INTO project_verticals (
            category,
            code,
            name,
            description,
            icon,
            color,
            display_order,
            is_active
        )
    VALUES -- DIRECT (AMC) Verticals
        (
            'DIRECT',
            'polyhouse',
            'Polyhouse',
            'Protected cultivation structures',
            'Warehouse',
            'green',
            1,
            true
        ),
        (
            'DIRECT',
            'microgreens',
            'Microgreens',
            'Indoor microgreen farming',
            'Sprout',
            'emerald',
            2,
            true
        ),
        (
            'DIRECT',
            'mushroom',
            'Mushroom',
            'Mushroom cultivation',
            'Circle',
            'amber',
            3,
            true
        ),
        (
            'DIRECT',
            'open_cultivation',
            'Open Cultivation',
            'Open field farming',
            'Sun',
            'yellow',
            4,
            true
        ),
        (
            'DIRECT',
            'goat_farming',
            'Goat Farming',
            'Livestock - Goats',
            'Milk',
            'orange',
            5,
            true
        ),
        (
            'DIRECT',
            'crab_farming',
            'Crab Farming',
            'Aquaculture - Crabs',
            'Fish',
            'blue',
            6,
            true
        ),
        -- JV (Joint Venture) Verticals
        (
            'JV',
            'new_jv',
            'New JV',
            'New joint venture construction',
            'Building2',
            'indigo',
            1,
            true
        ),
        (
            'JV',
            'revamp_jv',
            'Revamp JV',
            'Renovation of existing JV',
            'RefreshCw',
            'violet',
            2,
            true
        ),
        (
            'JV',
            'repair_services',
            'Repair & Services',
            'Maintenance and repair work',
            'Wrench',
            'slate',
            3,
            true
        ) ON CONFLICT (code) DO
    UPDATE
    SET is_active = EXCLUDED.is_active,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        color = EXCLUDED.color,
        display_order = EXCLUDED.display_order
    RETURNING (xmax = 0) AS inserted
)
SELECT COUNT(*) FILTER (
        WHERE inserted
    ) INTO inserted_count,
    COUNT(*) FILTER (
        WHERE NOT inserted
    ) INTO updated_count
FROM upsert_result;
-- Return results
RETURN QUERY
SELECT 'Inserted'::TEXT,
    inserted_count::BIGINT
UNION ALL
SELECT 'Updated'::TEXT,
    updated_count::BIGINT;
END;
$$ LANGUAGE plpgsql;
-- STEP 2: Execute the seeder function
SELECT *
FROM seed_project_verticals();
-- STEP 3: Verify the results
-- Check total count by category
SELECT category,
    COUNT(*) as total_count,
    COUNT(*) FILTER (
        WHERE is_active = true
    ) as active_count
FROM project_verticals
GROUP BY category
ORDER BY category;
-- STEP 4: Display all verticals for confirmation
SELECT category,
    code,
    name,
    description,
    is_active,
    display_order
FROM project_verticals
ORDER BY category,
    display_order;
-- ========================================================================
-- EXPECTED RESULTS
-- ========================================================================
--
-- After running this script, you should see:
--
-- seed_project_verticals() output:
--   action   | count
--   Inserted | 9      (if table was empty)
--   Updated  | 0
--
-- Category counts:
--   category | total_count | active_count
--   DIRECT   | 6          | 6
--   JV       | 3          | 3
--
-- All verticals list:
--   DIRECT: polyhouse, microgreens, mushroom, open_cultivation, goat_farming, crab_farming
--   JV: new_jv, revamp_jv, repair_services
--
-- ========================================================================
-- NEXT STEPS
-- ========================================================================
-- 1. After running this script in Supabase SQL Editor
-- 2. Go to your app: /projects/new
-- 3. Select "DIRECT (AMC)" category
-- 4. Vertical dropdown should show all 6 DIRECT verticals
-- 5. Select "Joint Venture" category  
-- 6. Vertical dropdown should show all 3 JV verticals
-- ========================================================================
-- BONUS: Function to check vertical status anytime
CREATE OR REPLACE FUNCTION check_verticals_status() RETURNS TABLE(
        category TEXT,
        total INTEGER,
        active INTEGER,
        missing_expected INTEGER
    ) AS $$ BEGIN RETURN QUERY WITH expected AS (
        SELECT 'DIRECT'::TEXT as cat,
            6 as expected_count
        UNION ALL
        SELECT 'JV'::TEXT,
            3
    ),
    actual AS (
        SELECT category,
            COUNT(*)::INTEGER as total,
            COUNT(*) FILTER (
                WHERE is_active = true
            )::INTEGER as active
        FROM project_verticals
        GROUP BY category
    )
SELECT e.cat as category,
    COALESCE(a.total, 0) as total,
    COALESCE(a.active, 0) as active,
    (e.expected_count - COALESCE(a.total, 0)) as missing_expected
FROM expected e
    LEFT JOIN actual a ON e.cat = a.category
ORDER BY e.cat;
END;
$$ LANGUAGE plpgsql;
-- Check status
SELECT *
FROM check_verticals_status();