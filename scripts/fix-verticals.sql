-- Quick fix script to ensure all project verticals exist
-- Run this in your Supabase SQL Editor
-- First, check if verticals table exists and show current count
SELECT category,
    COUNT(*) as count,
    COUNT(*) FILTER (
        WHERE is_active = true
    ) as active_count
FROM project_verticals
GROUP BY category;
-- Insert DIRECT verticals if they don't exist (using ON CONFLICT to avoid duplicates)
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
VALUES (
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
    ) ON CONFLICT (code) DO
UPDATE
SET is_active = true,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    display_order = EXCLUDED.display_order;
-- Insert JV verticals if they don't exist
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
VALUES (
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
SET is_active = true,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    display_order = EXCLUDED.display_order;
-- Verify the insert
SELECT category,
    code,
    name,
    is_active
FROM project_verticals
ORDER BY category,
    display_order;