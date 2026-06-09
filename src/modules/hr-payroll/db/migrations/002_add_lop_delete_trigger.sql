-- Migration: Add trigger to recalculate payroll when LOP entries are deleted
-- This ensures payroll_items are updated when LOP entries are removed

-- Function to recalculate payroll item when LOP changes
CREATE OR REPLACE FUNCTION recalculate_payroll_on_lop_change()
RETURNS TRIGGER AS $$
DECLARE
    v_employee_id UUID;
    v_lop_date DATE;
    v_payroll_month INTEGER;
    v_payroll_year INTEGER;
    v_employee_record RECORD;
    v_total_lop_days DECIMAL(5,2);
    v_daily_rate DECIMAL(12,2);
    v_lop_amount DECIMAL(12,2);
    v_gross_salary DECIMAL(12,2);
    v_earned DECIMAL(12,2);
    v_tds DECIMAL(12,2);
    v_net DECIMAL(12,2);
BEGIN
    -- Determine employee_id and date based on operation
    IF TG_OP = 'DELETE' THEN
        v_employee_id := OLD.employee_id;
        v_lop_date := OLD.lop_date;
    ELSIF TG_OP = 'UPDATE' THEN
        v_employee_id := NEW.employee_id;
        v_lop_date := NEW.lop_date;
    ELSE -- INSERT
        v_employee_id := NEW.employee_id;
        v_lop_date := NEW.lop_date;
    END IF;
    
    -- Get the month and year from the LOP date
    v_payroll_month := EXTRACT(MONTH FROM v_lop_date);
    v_payroll_year := EXTRACT(YEAR FROM v_lop_date);
    
    -- Find the employee record by profile_id (employees table uses user_id to link to profiles)
    SELECT e.id, e.fixed_monthly_salary, e.employee_id as emp_code
    INTO v_employee_record
    FROM employees e
    JOIN profiles p ON p.id = v_employee_id
    WHERE e.user_id = p.id
    LIMIT 1;
    
    -- If employee not found, exit
    IF NOT FOUND THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Calculate total LOP days for this employee in the month
    SELECT COALESCE(SUM(lop_days), 0)
    INTO v_total_lop_days
    FROM lop_entries
    WHERE employee_id = v_employee_id
    AND EXTRACT(MONTH FROM lop_date) = v_payroll_month
    AND EXTRACT(YEAR FROM lop_date) = v_payroll_year
    AND (TG_OP != 'INSERT' OR id != NEW.id); -- Exclude the new record on insert
    
    -- Add the new LOP days if it's an insert
    IF TG_OP = 'INSERT' THEN
        v_total_lop_days := v_total_lop_days + NEW.lop_days;
    END IF;
    
    -- Update payroll_items for this employee in the month
    UPDATE payroll_items
    SET 
        lop_days = v_total_lop_days,
        -- Recalculate earned: (base_salary / days_in_month) * (days_in_month - lop_days)
        earned = ROUND(
            (base_monthly_salary / days_in_month) * (days_in_month - v_total_lop_days), 
            2
        ),
        -- Recalculate gross: earned + incentive + bonus
        gross = ROUND(
            (base_monthly_salary / days_in_month) * (days_in_month - v_total_lop_days) + 
            COALESCE(incentive, 0) + 
            COALESCE(bonus, 0), 
            2
        ),
        -- Recalculate net: gross - tds - pf - esi
        net = ROUND(
            (base_monthly_salary / days_in_month) * (days_in_month - v_total_lop_days) + 
            COALESCE(incentive, 0) + 
            COALESCE(bonus, 0) - 
            COALESCE(tds, 0) - 
            COALESCE(pf, 0) - 
            COALESCE(esi, 0), 
            2
        ),
        updated_at = NOW()
    WHERE employee_id = v_employee_record.id
    AND EXISTS (
        SELECT 1 FROM payroll_runs pr 
        WHERE pr.id = payroll_items.payroll_run_id 
        AND pr.month = v_payroll_month 
        AND pr.year = v_payroll_year
    );
    
    -- Log the change in audit log
    INSERT INTO payroll_audit_log (
        payroll_item_id,
        employee_id,
        action,
        new_values,
        performed_at,
        notes
    )
    SELECT 
        pi.id,
        v_employee_record.id,
        'LOP_' || TG_OP,
        jsonb_build_object(
            'lop_days', v_total_lop_days,
            'lop_date', v_lop_date,
            'operation', TG_OP
        ),
        NOW(),
        'LOP entry ' || TG_OP || ' triggered payroll recalculation'
    FROM payroll_items pi
    JOIN payroll_runs pr ON pr.id = pi.payroll_run_id
    WHERE pi.employee_id = v_employee_record.id
    AND pr.month = v_payroll_month
    AND pr.year = v_payroll_year;
    
    -- Also recalculate totals for the payroll run
    UPDATE payroll_runs
    SET 
        total_net_pay = (
            SELECT COALESCE(SUM(net), 0) 
            FROM payroll_items 
            WHERE payroll_run_id = payroll_runs.id
        ),
        updated_at = NOW()
    WHERE month = v_payroll_month
    AND year = v_payroll_year;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_lop_delete_recalculate_payroll ON lop_entries;
DROP TRIGGER IF EXISTS trg_lop_insert_recalculate_payroll ON lop_entries;
DROP TRIGGER IF EXISTS trg_lop_update_recalculate_payroll ON lop_entries;

-- Create trigger for DELETE operations
CREATE TRIGGER trg_lop_delete_recalculate_payroll
    AFTER DELETE ON lop_entries
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_payroll_on_lop_change();

-- Create trigger for INSERT operations
CREATE TRIGGER trg_lop_insert_recalculate_payroll
    AFTER INSERT ON lop_entries
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_payroll_on_lop_change();

-- Create trigger for UPDATE operations
CREATE TRIGGER trg_lop_update_recalculate_payroll
    AFTER UPDATE OF lop_days, lop_date ON lop_entries
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_payroll_on_lop_change();

-- Add comment explaining the trigger
COMMENT ON FUNCTION recalculate_payroll_on_lop_change() IS 
'Automatically recalculates payroll_items when LOP entries are inserted, updated, or deleted.
This ensures payroll calculations stay in sync with LOP records.';
