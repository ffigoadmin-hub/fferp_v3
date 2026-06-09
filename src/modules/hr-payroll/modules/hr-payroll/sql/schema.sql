-- ============================================================
-- HR & Payroll Module — Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Role enum & user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'employee');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS for user_roles: users can read their own; admin can read all
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-assign employee role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  joining_date DATE NOT NULL,
  phone_number TEXT NOT NULL,
  dob DATE,
  emergency_contact_number TEXT,
  address TEXT,
  department TEXT,
  location_type TEXT,
  location_name TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  fixed_monthly_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- HR/Admin can do everything
CREATE POLICY "HR/Admin full access to employees"
  ON public.employees FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
  );

-- Employees can read their own record only
CREATE POLICY "Employees can read own record"
  ON public.employees FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- View that excludes salary for employee self-service
CREATE VIEW public.employee_profiles AS
  SELECT id, employee_id, full_name, joining_date, phone_number, dob,
         emergency_contact_number, address, department, location_type,
         location_name, status, bank_name, bank_account_number, bank_ifsc,
         user_id, created_at, updated_at
  FROM public.employees;

-- 3. Payroll runs
CREATE TABLE public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year >= 2000),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINALIZED')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (month, year)
);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR/Admin full access to payroll_runs"
  ON public.payroll_runs FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
  );

-- 4. Payroll items
CREATE TABLE public.payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES public.employees(id) NOT NULL,
  employee_business_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  salary_override NUMERIC(12,2),
  bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  incentive NUMERIC(12,2) NOT NULL DEFAULT 0,
  lop_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  days_in_month INTEGER NOT NULL,
  payable_days NUMERIC(5,2) NOT NULL,
  daily_salary NUMERIC(12,2) NOT NULL,
  base_pay NUMERIC(12,2) NOT NULL,
  earned NUMERIC(12,2) NOT NULL,
  gross NUMERIC(12,2) NOT NULL,
  tds NUMERIC(12,2) NOT NULL DEFAULT 0,
  pf NUMERIC(12,2) NOT NULL DEFAULT 0,
  esi NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (payroll_run_id, employee_id)
);

ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR/Admin full access to payroll_items"
  ON public.payroll_items FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
  );

-- Employees can read their own payroll items
CREATE POLICY "Employees can read own payroll_items"
  ON public.payroll_items FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- Employees can see payroll_runs linked to their items
CREATE POLICY "Employees can read linked payroll_runs"
  ON public.payroll_runs FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT payroll_run_id FROM public.payroll_items
      WHERE employee_id IN (
        SELECT id FROM public.employees WHERE user_id = auth.uid()
      )
    )
  );

-- 5. Payslip documents
CREATE TABLE public.payslip_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_item_id UUID REFERENCES public.payroll_items(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payslip_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR/Admin full access to payslip_documents"
  ON public.payslip_documents FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
  );

CREATE POLICY "Employees can read own payslip_documents"
  ON public.payslip_documents FOR SELECT
  TO authenticated
  USING (
    payroll_item_id IN (
      SELECT id FROM public.payroll_items
      WHERE employee_id IN (
        SELECT id FROM public.employees WHERE user_id = auth.uid()
      )
    )
  );
