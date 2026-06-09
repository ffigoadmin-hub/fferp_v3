-- =====================================================
-- EXAMPLE QUERIES FOR PAYROLL SYSTEM
-- =====================================================

-- =====================================================
-- BASIC QUERIES
-- =====================================================

-- 1. Get complete payroll summary
SELECT * FROM payroll_summary ORDER BY name;

-- 2. Get payroll summary for specific department
SELECT * FROM payroll_summary WHERE department = 'IT' ORDER BY name;

-- 3. Get employees with LOP deductions
SELECT 
    name, 
    department, 
    lop_days, 
    lop_amount, 
    final_salary 
FROM payroll_summary 
WHERE lop_days > 0 
ORDER BY lop_days DESC;

-- 4. Get employees without salary records
SELECT 
    id, 
    name, 
    department 
FROM payroll_summary 
WHERE NOT has_salary_record 
ORDER BY name;

-- 5. Get salary statistics by department
SELECT 
    department,
    COUNT(*) as employee_count,
    COUNT(CASE WHEN has_salary_record THEN 1 END) as employees_with_salary,
    SUM(basic_salary) as total_basic_salary,
    SUM(final_salary) as total_final_salary,
    AVG(CASE WHEN has_salary_record THEN final_salary END) as avg_final_salary,
    SUM(lop_amount) as total_lop_deductions,
    SUM(tds_amount) as total_tds
FROM payroll_summary 
GROUP BY department 
ORDER BY department;

-- =====================================================
-- DETAILED QUERIES WITH JOINS
-- =====================================================

-- 6. Complete payroll details with manual calculations
SELECT 
    p.name,
    p.department,
    COALESCE(em.basic_salary, 0) as basic_salary,
    COALESCE(em.increment, 0) as increment,
    COALESCE(em.incentive, 0) as incentive,
    COALESCE(SUM(le.lop_days), 0) as total_lop_days,
    CASE 
        WHEN COALESCE(em.basic_salary, 0) > 0 
        THEN (COALESCE(em.basic_salary, 0) / 30.0) * COALESCE(SUM(le.lop_days), 0)
        ELSE 0 
    END as lop_amount,
    COALESCE(em.basic_salary, 0) + COALESCE(em.increment, 0) + COALESCE(em.incentive, 0) as gross_salary,
    (COALESCE(em.basic_salary, 0) + COALESCE(em.increment, 0) + COALESCE(em.incentive, 0)) - 
    CASE 
        WHEN COALESCE(em.basic_salary, 0) > 0 
        THEN (COALESCE(em.basic_salary, 0) / 30.0) * COALESCE(SUM(le.lop_days), 0)
        ELSE 0 
    END as salary_after_lop,
    ((COALESCE(em.basic_salary, 0) + COALESCE(em.increment, 0) + COALESCE(em.incentive, 0)) - 
    CASE 
        WHEN COALESCE(em.basic_salary, 0) > 0 
        THEN (COALESCE(em.basic_salary, 0) / 30.0) * COALESCE(SUM(le.lop_days), 0)
        ELSE 0 
    END) * COALESCE(em.tds_percent, 1.0) / 100.0 as tds_amount,
    ((COALESCE(em.basic_salary, 0) + COALESCE(em.increment, 0) + COALESCE(em.incentive, 0)) - 
    CASE 
        WHEN COALESCE(em.basic_salary, 0) > 0 
        THEN (COALESCE(em.basic_salary, 0) / 30.0) * COALESCE(SUM(le.lop_days), 0)
        ELSE 0 
    END) - (((COALESCE(em.basic_salary, 0) + COALESCE(em.increment, 0) + COALESCE(em.incentive, 0)) - 
    CASE 
        WHEN COALESCE(em.basic_salary, 0) > 0 
        THEN (COALESCE(em.basic_salary, 0) / 30.0) * COALESCE(SUM(le.lop_days), 0)
        ELSE 0 
    END) * COALESCE(em.tds_percent, 1.0) / 100.0) as final_salary
FROM profiles p
LEFT JOIN employee_master em ON p.id = em.employee_id
LEFT JOIN lop_entries le ON p.id = le.employee_id
GROUP BY p.id, p.name, p.department, em.basic_salary, em.increment, em.incentive, em.tds_percent
ORDER BY p.name;

-- =====================================================
-- LOP MANAGEMENT QUERIES
-- =====================================================

-- 7. Get all LOP entries for current month
SELECT 
    p.name,
    p.department,
    le.lop_days,
    le.reason,
    le.lop_date,
    le.created_at
FROM lop_entries le
JOIN profiles p ON le.employee_id = p.id
WHERE DATE_TRUNC('month', le.lop_date) = DATE_TRUNC('month', CURRENT_DATE)
ORDER BY le.lop_date DESC;

-- 8. Get LOP summary by employee
SELECT 
    p.name,
    p.department,
    COUNT(le.id) as lop_entries_count,
    SUM(le.lop_days) as total_lop_days,
    MIN(le.lop_date) as first_lop_date,
    MAX(le.lop_date) as last_lop_date
FROM profiles p
LEFT JOIN lop_entries le ON p.id = le.employee_id
GROUP BY p.id, p.name, p.department
HAVING SUM(le.lop_days) > 0
ORDER BY total_lop_days DESC;

-- 9. Get monthly LOP trends
SELECT 
    DATE_TRUNC('month', lop_date) as month,
    COUNT(DISTINCT employee_id) as employees_with_lop,
    SUM(lop_days) as total_lop_days,
    AVG(lop_days) as avg_lop_per_employee
FROM lop_entries
GROUP BY DATE_TRUNC('month', lop_date)
ORDER BY month DESC
LIMIT 12;

-- =====================================================
-- SALARY ANALYSIS QUERIES
-- =====================================================

-- 10. Salary range analysis
SELECT 
    CASE 
        WHEN basic_salary < 30000 THEN 'Below 30K'
        WHEN basic_salary < 50000 THEN '30K - 50K'
        WHEN basic_salary < 70000 THEN '50K - 70K'
        WHEN basic_salary < 100000 THEN '70K - 100K'
        ELSE 'Above 100K'
    END as salary_range,
    COUNT(*) as employee_count,
    AVG(basic_salary) as avg_basic_salary,
    AVG(final_salary) as avg_final_salary
FROM payroll_summary
WHERE has_salary_record
GROUP BY salary_range
ORDER BY min(basic_salary);

-- 11. Department-wise salary comparison
SELECT 
    department,
    COUNT(*) as total_employees,
    COUNT(CASE WHEN has_salary_record THEN 1 END) as employees_with_salary,
    MIN(basic_salary) as min_basic_salary,
    MAX(basic_salary) as max_basic_salary,
    AVG(basic_salary) as avg_basic_salary,
    MIN(final_salary) as min_final_salary,
    MAX(final_salary) as max_final_salary,
    AVG(final_salary) as avg_final_salary,
    SUM(lop_amount) as total_lop_deductions
FROM payroll_summary
GROUP BY department
ORDER BY avg_final_salary DESC;

-- 12. Top earners by department
SELECT 
    department,
    name,
    basic_salary,
    increment,
    incentive,
    final_salary
FROM (
    SELECT 
        department,
        name,
        basic_salary,
        increment,
        incentive,
        final_salary,
        ROW_NUMBER() OVER (PARTITION BY department ORDER BY final_salary DESC) as rank
    FROM payroll_summary
    WHERE has_salary_record
) ranked
WHERE rank <= 3
ORDER BY department, rank;

-- =====================================================
-- EDGE CASE HANDLING QUERIES
-- =====================================================

-- 13. Employees with zero basic salary but records exist
SELECT 
    id,
    name,
    department,
    basic_salary,
    has_salary_record
FROM payroll_summary
WHERE has_salary_record AND basic_salary = 0;

-- 14. Employees with negative calculations (data integrity check)
SELECT 
    name,
    department,
    basic_salary,
    lop_days,
    lop_amount,
    final_salary
FROM payroll_summary
WHERE final_salary < 0 OR lop_amount < 0 OR basic_salary < 0;

-- 15. Duplicate salary records check
SELECT 
    employee_id,
    COUNT(*) as duplicate_count
FROM employee_master
GROUP BY employee_id
HAVING COUNT(*) > 1;

-- =====================================================
-- PERFORMANCE QUERIES
-- =====================================================

-- 16. Optimized payroll query with indexes
EXPLAIN ANALYZE
SELECT ps.* 
FROM payroll_summary ps
WHERE ps.department = 'IT' 
  AND ps.has_salary_record = true
ORDER BY ps.final_salary DESC
LIMIT 10;

-- 17. Check query performance for large datasets
EXPLAIN ANALYZE
SELECT 
    p.name,
    p.department,
    em.basic_salary,
    SUM(le.lop_days) as total_lop_days
FROM profiles p
LEFT JOIN employee_master em ON p.id = em.employee_id
LEFT JOIN lop_entries le ON p.id = le.employee_id
WHERE p.department = 'IT'
GROUP BY p.id, p.name, p.department, em.basic_salary
ORDER BY p.name;

-- =====================================================
-- DATA VALIDATION QUERIES
-- =====================================================

-- 18. Validate payroll calculations
SELECT 
    'Calculation Validation' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN gross_salary = basic_salary + increment + incentive THEN 1 END) as correct_gross,
    COUNT(CASE WHEN lop_amount = daily_salary * lop_days THEN 1 END) as correct_lop,
    COUNT(CASE WHEN tds_amount = salary_after_lop * (tds_percent / 100) THEN 1 END) as correct_tds,
    COUNT(CASE WHEN final_salary = salary_after_lop - tds_amount THEN 1 END) as correct_final
FROM payroll_summary
WHERE has_salary_record;

-- 19. Check for missing foreign key relationships
SELECT 
    'Missing Relationships' as check_type,
    COUNT(CASE WHEN employee_id NOT IN (SELECT id FROM profiles) THEN 1 END) as orphaned_employee_master,
    COUNT(CASE WHEN employee_id NOT IN (SELECT id FROM profiles) THEN 1 END) as orphaned_lop_entries
FROM employee_master
UNION ALL
SELECT 
    'Missing Relationships' as check_type,
    0,
    COUNT(CASE WHEN employee_id NOT IN (SELECT id FROM profiles) THEN 1 END)
FROM lop_entries;

-- =====================================================
-- SAMPLE DATA INSERTION (for testing)
-- =====================================================

-- 20. Insert sample employee master records
INSERT INTO employee_master (employee_id, basic_salary, increment, incentive, tds_percent) VALUES
    ((SELECT id FROM profiles WHERE name = 'John Doe' LIMIT 1), 50000, 2000, 1000, 1.0),
    ((SELECT id FROM profiles WHERE name = 'Jane Smith' LIMIT 1), 60000, 3000, 1500, 1.0),
    ((SELECT id FROM profiles WHERE name = 'Mike Johnson' LIMIT 1), 45000, 1500, 500, 1.0);

-- 21. Insert sample LOP entries
INSERT INTO lop_entries (employee_id, lop_days, reason, lop_date) VALUES
    ((SELECT id FROM profiles WHERE name = 'John Doe' LIMIT 1), 1.5, 'Medical Leave', '2024-01-15'),
    ((SELECT id FROM profiles WHERE name = 'Jane Smith' LIMIT 1), 0.5, 'Personal Work', '2024-01-20'),
    ((SELECT id FROM profiles WHERE name = 'Mike Johnson' LIMIT 1), 2.0, 'Family Emergency', '2024-01-25');

-- =====================================================
-- CLEANUP QUERIES (use with caution)
-- =====================================================

-- 22. Remove duplicate employee master records (keep latest)
DELETE FROM employee_master 
WHERE id NOT IN (
    SELECT DISTINCT ON (employee_id) id 
    FROM employee_master 
    ORDER BY employee_id, updated_at DESC
);

-- 23. Remove orphaned LOP entries
DELETE FROM lop_entries 
WHERE employee_id NOT IN (SELECT id FROM profiles);

-- =====================================================
-- USAGE EXAMPLES
-- =====================================================

/*
-- Basic Usage:
-- 1. Run table creation scripts first (01_create_payroll_tables.sql)
-- 2. Create the payroll view (02_create_payroll_view.sql)
-- 3. Insert sample data (queries 20-21)
-- 4. Query payroll summary: SELECT * FROM payroll_summary;

-- Advanced Usage:
-- 1. Use query 6 for detailed manual calculations
-- 2. Use query 5 for department-wise statistics
-- 3. Use queries 7-9 for LOP management
-- 4. Use queries 10-12 for salary analysis

-- Performance Optimization:
-- 1. Ensure indexes are created (see table creation script)
-- 2. Use EXPLAIN ANALYZE with queries 16-17 for optimization
-- 3. Consider materialized views for very large datasets

-- Data Validation:
-- 1. Run query 18 to validate calculations
-- 2. Run query 19 to check data integrity
-- 3. Use queries 13-14 for edge case detection
*/
