-- =====================================================
-- MAIN QUERY FOR EMPLOYEE SALARY WITH AUTO LOP CALCULATION
-- =====================================================

SELECT 
    p.id,
    p.name,
    p.department,
    e.basic_salary,
    COALESCE(l.total_lop, 0) AS lop_days,
    e.increment,
    e.incentive,

    -- LOP Deduction (Assume 30 working days)
    ROUND((e.basic_salary / 30) * COALESCE(l.total_lop,0),2) AS lop_amount,

    -- Gross Salary
    ROUND(
        e.basic_salary + 
        COALESCE(e.increment,0) + 
        COALESCE(e.incentive,0)
        - ((e.basic_salary / 30) * COALESCE(l.total_lop,0))
    ,2) AS gross_salary,

    -- TDS 1%
    ROUND(
        (
            e.basic_salary + 
            COALESCE(e.increment,0) + 
            COALESCE(e.incentive,0)
            - ((e.basic_salary / 30) * COALESCE(l.total_lop,0))
        ) * 0.01
    ,2) AS tds,

    -- Final Salary After 1% TDS
    ROUND(
        (
            e.basic_salary + 
            COALESCE(e.increment,0) + 
            COALESCE(e.incentive,0)
            - ((e.basic_salary / 30) * COALESCE(l.total_lop,0))
        )
        -
        (
            (
                e.basic_salary + 
                COALESCE(e.increment,0) + 
                COALESCE(e.incentive,0)
                - ((e.basic_salary / 30) * COALESCE(l.total_lop,0))
            ) * 0.01
        )
    ,2) AS final_salary

FROM profiles p

LEFT JOIN employee_master e 
ON p.id = e.employee_id

LEFT JOIN (
    SELECT 
        employee_id,
        SUM(lop_entries.lop_days) AS total_lop
    FROM lop_entries
    GROUP BY employee_id
) l 
ON p.id = l.employee_id

ORDER BY p.name;
