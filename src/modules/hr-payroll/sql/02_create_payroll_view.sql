-- =====================================================
-- PAYROLL SUMMARY VIEW
-- =====================================================

-- Drop view if it exists (for easy recreation)
DROP VIEW IF EXISTS payroll_summary;

-- Create the payroll summary view
CREATE VIEW payroll_summary AS
WITH lop_aggregated AS (
    -- Aggregate LOP days per employee
    SELECT 
        employee_id,
        COALESCE(SUM(lop_days), 0) AS total_lop_days
    FROM lop_entries
    GROUP BY employee_id
),
salary_calculations AS (
    -- Perform salary calculations
    SELECT 
        p.id AS employee_uuid,
        p.id, -- Keep for compatibility
        p.name,
        p.department,
        COALESCE(em.basic_salary, 0) AS basic_salary,
        COALESCE(em.increment, 0) AS increment,
        COALESCE(em.incentive, 0) AS incentive,
        COALESCE(em.tds_percent, 1.0) AS tds_percent,
        COALESCE(l.total_lop_days, 0) AS lop_days,
        
        -- Daily salary calculation
        CASE 
            WHEN COALESCE(em.basic_salary, 0) > 0 
            THEN COALESCE(em.basic_salary, 0) / 30.0 
            ELSE 0 
        END AS daily_salary,
        
        -- LOP amount calculation
        CASE 
            WHEN COALESCE(em.basic_salary, 0) > 0 
            THEN (COALESCE(em.basic_salary, 0) / 30.0) * COALESCE(l.total_lop_days, 0)
            ELSE 0 
        END AS lop_amount,
        
        -- Gross salary calculation
        COALESCE(em.basic_salary, 0) + COALESCE(em.increment, 0) + COALESCE(em.incentive, 0) AS gross_salary,
        
        -- Employee master record exists flag
        CASE WHEN em.id IS NOT NULL THEN true ELSE false END AS has_salary_record
        
    FROM profiles p
    LEFT JOIN employee_master em ON p.id = em.employee_id
    LEFT JOIN lop_aggregated l ON p.id = l.employee_id
),
final_calculations AS (
    -- Final salary calculations
    SELECT 
        *,
        
        -- Salary after LOP deduction
        gross_salary - lop_amount AS salary_after_lop,
        
        -- TDS calculation
        (gross_salary - lop_amount) * (tds_percent / 100.0) AS tds_amount,
        
        -- Final salary
        (gross_salary - lop_amount) - ((gross_salary - lop_amount) * (tds_percent / 100.0)) AS final_salary
        
    FROM salary_calculations
)
-- Final selection with formatted columns
SELECT 
    employee_uuid,
    id,
    name,
    department,
    basic_salary,
    increment,
    incentive,
    lop_days,
    daily_salary,
    lop_amount,
    gross_salary,
    salary_after_lop,
    tds_percent,
    tds_amount,
    final_salary,
    has_salary_record
FROM final_calculations;

-- =====================================================
-- CREATE INDEXES FOR VIEW PERFORMANCE
-- =====================================================

-- Note: Views don't have indexes directly, but we can create 
-- materialized views if needed for very large datasets

-- =====================================================
-- GRANT PERMISSIONS ON VIEW
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT ON payroll_summary TO authenticated;
GRANT SELECT ON payroll_summary TO service_role;

-- =====================================================
-- SAMPLE QUERIES FOR TESTING
-- =====================================================

-- Basic query to get all payroll data
-- SELECT * FROM payroll_summary ORDER BY name;

-- Query for specific department
-- SELECT * FROM payroll_summary WHERE department = 'IT' ORDER BY name;

-- Query for employees with LOP deductions
-- SELECT * FROM payroll_summary WHERE lop_days > 0 ORDER BY lop_days DESC;

-- Query for employees without salary records
-- SELECT * FROM payroll_summary WHERE NOT has_salary_record ORDER BY name;

-- Query for salary statistics
-- SELECT 
--     department,
--     COUNT(*) as employee_count,
--     SUM(basic_salary) as total_basic,
--     SUM(final_salary) as total_final,
--     AVG(final_salary) as avg_final_salary
-- FROM payroll_summary 
-- WHERE has_salary_record 
-- GROUP BY department 
-- ORDER BY department;
