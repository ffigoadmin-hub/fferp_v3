-- Create RPC function to get employee salary summary with LOP calculations
CREATE OR REPLACE FUNCTION public.get_employee_salary_summary(p_month integer, p_year integer)
RETURNS TABLE (
    id uuid,
    employee_id text,
    full_name text,
    department text,
    status text,
    fixed_monthly_salary numeric,
    increment_amount numeric,
    incentive numeric,
    bonus numeric,
    lop_days numeric,
    days_in_month integer,
    daily_rate numeric,
    lop_amount numeric,
    gross_salary numeric,
    tds_amount numeric,
    net_salary numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_days_in_month integer;
BEGIN
    -- Calculate days in month
    v_days_in_month := EXTRACT(DAY FROM (p_year || '-' || p_month || '-01')::date + INTERVAL '1 month' - INTERVAL '1 day');
    
    RETURN QUERY
    SELECT 
        e.id,
        e.employee_id,
        e.full_name,
        e.department,
        e.status,
        COALESCE(e.fixed_monthly_salary, 0) as fixed_monthly_salary,
        COALESCE(e.increment_amount, 0) as increment_amount,
        COALESCE(e.incentive, 0) as incentive,
        COALESCE(e.bonus, 0) as bonus,
        COALESCE(el.lop_days, 0) as lop_days,
        v_days_in_month as days_in_month,
        CASE 
            WHEN COALESCE(e.fixed_monthly_salary, 0) > 0 
            THEN COALESCE(e.fixed_monthly_salary, 0) / v_days_in_month 
            ELSE 0 
        END as daily_rate,
        CASE 
            WHEN COALESCE(e.fixed_monthly_salary, 0) > 0 
            THEN (COALESCE(e.fixed_monthly_salary, 0) / v_days_in_month) * COALESCE(el.lop_days, 0)
            ELSE 0 
        END as lop_amount,
        COALESCE(e.fixed_monthly_salary, 0) + 
        COALESCE(e.increment_amount, 0) + 
        COALESCE(e.incentive, 0) + 
        COALESCE(e.bonus, 0) - 
        CASE 
            WHEN COALESCE(e.fixed_monthly_salary, 0) > 0 
            THEN (COALESCE(e.fixed_monthly_salary, 0) / v_days_in_month) * COALESCE(el.lop_days, 0)
            ELSE 0 
        END as gross_salary,
        (COALESCE(e.fixed_monthly_salary, 0) + 
         COALESCE(e.increment_amount, 0) + 
         COALESCE(e.incentive, 0) + 
         COALESCE(e.bonus, 0) - 
         CASE 
             WHEN COALESCE(e.fixed_monthly_salary, 0) > 0 
             THEN (COALESCE(e.fixed_monthly_salary, 0) / v_days_in_month) * COALESCE(el.lop_days, 0)
             ELSE 0 
         END) * 0.01 as tds_amount,
        (COALESCE(e.fixed_monthly_salary, 0) + 
         COALESCE(e.increment_amount, 0) + 
         COALESCE(e.incentive, 0) + 
         COALESCE(e.bonus, 0) - 
         CASE 
             WHEN COALESCE(e.fixed_monthly_salary, 0) > 0 
             THEN (COALESCE(e.fixed_monthly_salary, 0) / v_days_in_month) * COALESCE(el.lop_days, 0)
             ELSE 0 
         END) * 0.99 as net_salary
    FROM public.employees e
    LEFT JOIN public.employee_lop el ON e.employee_id = el.employee_id 
        AND el.month = p_month 
        AND el.year = p_year
    WHERE e.status = 'ACTIVE';
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_employee_salary_summary(integer, integer) TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
