-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
--  PHASE 2 â€” RLS POLICIES (all tables exist now)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€ profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile"     ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Managers view all profiles" ON public.profiles FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','hr','director'));
CREATE POLICY "Users update own profile"   ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins insert profiles"     ON public.profiles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete profiles"     ON public.profiles FOR DELETE USING (get_my_role() IN ('admin','ceo'));

-- â”€â”€ hubs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all_hubs" ON public.hubs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- â”€â”€ products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view products"       ON public.products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Purchase managers manage products" ON public.products FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));

-- â”€â”€ vendors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view vendors"   ON public.vendors FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Purchase manage vendors" ON public.vendors FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));

-- â”€â”€ announcements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All view announcements"    ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL USING (get_my_role() IN ('admin','ceo','gm'));

-- â”€â”€ rental_categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.rental_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view rental_categories"  ON public.rental_categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage rental_categories"    ON public.rental_categories FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director'));

-- â”€â”€ transport_categories/vehicles/drivers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.transport_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view transport_categories" ON public.transport_categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage transport_categories"   ON public.transport_categories FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts'));
ALTER TABLE public.transport_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view transport_vehicles" ON public.transport_vehicles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage transport_vehicles"   ON public.transport_vehicles FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts','logistics'));
ALTER TABLE public.transport_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view transport_drivers" ON public.transport_drivers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage transport_drivers"   ON public.transport_drivers FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts','logistics'));

-- â”€â”€ customers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view customers"   ON public.customers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Sales manage customers" ON public.customers FOR ALL USING (get_my_role() IN ('admin','ceo','gm','field_executive','tele_caller','back_office','warehouse_manager','bde','nsm','smo'));

-- â”€â”€ market_rates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.market_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view market rates"      ON public.market_rates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Purchase manage rates"        ON public.market_rates FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));

-- â”€â”€ inventory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view inventory"        ON public.inventory FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Warehouse manage inventory"  ON public.inventory FOR ALL USING (get_my_role() IN ('admin','ceo','gm','warehouse_manager','qc_manager','back_office'));

-- â”€â”€ salary_batches â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.salary_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR view salary batches"     ON public.salary_batches FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','hr','accounts','director'));
CREATE POLICY "HR manage salary batches"   ON public.salary_batches FOR ALL USING (get_my_role() IN ('admin','ceo','hr','accounts'));

-- â”€â”€ purchase_orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view POs"          ON public.purchase_orders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Purchase manage POs"     ON public.purchase_orders FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office','smo','gmo'));

-- â”€â”€ audit_logs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit logs"  ON public.audit_logs FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','hr'));
CREATE POLICY "System inserts logs"     ON public.audit_logs FOR INSERT WITH CHECK (true);

-- â”€â”€ notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL USING (user_id = auth.uid());
CREATE POLICY "System inserts notifications"   ON public.notifications FOR INSERT WITH CHECK (true);

-- â”€â”€ geofences â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view geofences" ON public.geofences FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage geofences"   ON public.geofences FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr'));

-- â”€â”€ core_heads â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.core_heads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view core_heads" ON public.core_heads FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage core_heads"   ON public.core_heads FOR ALL USING (get_my_role() IN ('admin','ceo'));

-- â”€â”€ sales_orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view orders"       ON public.sales_orders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Sales manage orders"     ON public.sales_orders FOR ALL USING (get_my_role() IN ('admin','ceo','gm','field_executive','tele_caller','back_office','warehouse_manager','bde','nsm','smo','gmo'));

ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view order items"  ON public.sales_order_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Sales manage order items" ON public.sales_order_items FOR ALL USING (get_my_role() IN ('admin','ceo','gm','field_executive','tele_caller','back_office','warehouse_manager','bde','nsm','smo'));

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view PO items"     ON public.purchase_order_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Purchase manage PO items" ON public.purchase_order_items FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));

ALTER TABLE public.po_sales_order_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_po_links"  ON public.po_sales_order_links FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.invoices TO anon, authenticated;

ALTER TABLE public.qc_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view QC"          ON public.qc_inspections FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "QC manage inspections"  ON public.qc_inspections FOR ALL USING (get_my_role() IN ('admin','ceo','gm','warehouse_manager','qc_manager','back_office'));

ALTER TABLE public.transit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops_transit_all" ON public.transit_records FOR ALL USING (true);

ALTER TABLE public.logistics_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view trips"        ON public.logistics_trips FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Logistics manage trips"  ON public.logistics_trips FOR ALL USING (get_my_role() IN ('admin','ceo','gm','driver','warehouse_manager','back_office'));

ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance manage vendor payments" ON public.vendor_payments FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts','purchase_manager','purchase_head','back_office','director'));

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own requests"  ON public.payment_requests FOR SELECT USING (requester_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','accounts','smo','gmo','director'));
CREATE POLICY "Users create requests"    ON public.payment_requests FOR INSERT WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Admins update requests"   ON public.payment_requests FOR UPDATE USING (get_my_role() IN ('admin','ceo','accounts','gm','smo','gmo','director'));

ALTER TABLE public.deduction_memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops_deductions_all" ON public.deduction_memos FOR ALL USING (true);

ALTER TABLE public.payment_deduction_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops_deduction_lines_all" ON public.payment_deduction_lines FOR ALL USING (true);

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tele callers manage leads" ON public.crm_leads FOR ALL USING (get_my_role() IN ('admin','ceo','gm','tele_caller','field_executive','back_office','bde') OR assigned_to = auth.uid());

-- â”€â”€ daily workflow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.day_starts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own day starts" ON public.day_starts FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','datateam','boi'));
ALTER TABLE public.day_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own day plans"  ON public.day_plans FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','datateam','boi'));
ALTER TABLE public.hourly_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own hourly_plans" ON public.hourly_plans FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','datateam','boi'));
ALTER TABLE public.hourly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own hourly reports" ON public.hourly_reports FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','datateam','boi'));
ALTER TABLE public.eod_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own EOD reports" ON public.eod_reports FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','datateam','boi'));
ALTER TABLE public.selfie_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all_selfie" ON public.selfie_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.user_location_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users log own location" ON public.user_location_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin view location_logs" ON public.user_location_logs FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

-- â”€â”€ leave & HR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own leaves" ON public.leave_requests FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));
ALTER TABLE public.week_off_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage week_off" ON public.week_off_assignments FOR ALL USING (get_my_role() IN ('admin','ceo','hr','gm'));
CREATE POLICY "Users view own week_off" ON public.week_off_assignments FOR SELECT USING (employee_id = auth.uid());
ALTER TABLE public.attendance_lock_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage overrides" ON public.attendance_lock_overrides FOR ALL USING (get_my_role() IN ('admin','ceo','hr'));
CREATE POLICY "Users view own overrides" ON public.attendance_lock_overrides FOR SELECT USING (user_id = auth.uid());
ALTER TABLE public.hr_attestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage attestations" ON public.hr_attestations FOR ALL USING (get_my_role() IN ('admin','ceo','hr'));
CREATE POLICY "HR view attestations"   ON public.hr_attestations FOR SELECT USING (get_my_role() IN ('admin','ceo','hr','gm') OR employee_id = auth.uid());
ALTER TABLE public.onboarding_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage onboarding_requests" ON public.onboarding_requests FOR ALL USING (get_my_role() IN ('admin','ceo','hr'));

-- â”€â”€ LOP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.lop_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR Admin view all lop entries"  ON public.lop_entries FOR SELECT USING (get_my_role() IN ('admin','ceo','hr','gm','boi','director','accounts'));
CREATE POLICY "Employees view own lop entries" ON public.lop_entries FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "HR manage lop entries"          ON public.lop_entries FOR ALL USING (get_my_role() IN ('admin','ceo','hr','gm','boi'));
ALTER TABLE public.lop_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage lop audit logs" ON public.lop_audit_logs FOR ALL USING (get_my_role() IN ('admin','ceo','hr','gm'));
ALTER TABLE public.employee_lop ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage employee_lop"  ON public.employee_lop FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director'));
CREATE POLICY "Users view own lop"      ON public.employee_lop FOR SELECT USING (user_id = auth.uid());

-- â”€â”€ payroll â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.employee_payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees view own payslips" ON public.employee_payslips FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "HR Admin manage payslips"    ON public.employee_payslips FOR ALL USING (get_my_role() IN ('admin','ceo','hr','accounts','director'));
ALTER TABLE public.salary_batch_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR view salary_batch_employees" ON public.salary_batch_employees FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','hr','accounts','director') OR employee_id = auth.uid() OR profile_id = auth.uid());
CREATE POLICY "HR manage salary_batch_employees" ON public.salary_batch_employees FOR ALL USING (get_my_role() IN ('admin','ceo','hr','accounts'));

-- â”€â”€ employee extras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.employee_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own achievements" ON public.employee_achievements FOR SELECT USING (user_id = auth.uid() OR is_public = true OR get_my_role() IN ('admin','ceo','gm','hr','director'));
CREATE POLICY "Managers manage achievements" ON public.employee_achievements FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director'));
ALTER TABLE public.employee_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own history" ON public.employee_history FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','director'));
CREATE POLICY "Managers create history" ON public.employee_history FOR INSERT WITH CHECK (get_my_role() IN ('admin','ceo','gm','hr','director'));
ALTER TABLE public.employee_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage issues" ON public.employee_issues FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director'));
ALTER TABLE public.payees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized view payees" ON public.payees FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','accounts','finance','director'));
CREATE POLICY "Accounts manage payees" ON public.payees FOR ALL USING (get_my_role() IN ('admin','ceo','accounts','finance'));

-- â”€â”€ shift system â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.shift_user_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage shift assignments" ON public.shift_user_assignments FOR ALL USING (get_my_role() IN ('admin','ceo','hr','gm'));
CREATE POLICY "Users view own shift assignment" ON public.shift_user_assignments FOR SELECT USING (user_id = auth.uid());
ALTER TABLE public.shift_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own shift sessions" ON public.shift_sessions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admins view all shift sessions"  ON public.shift_sessions FOR SELECT USING (get_my_role() IN ('admin','ceo','hr','gm'));
ALTER TABLE public.shift_hourly_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own hourly slots"  ON public.shift_hourly_slots FOR ALL USING (EXISTS (SELECT 1 FROM public.shift_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));
CREATE POLICY "Admins view all hourly slots"   ON public.shift_hourly_slots FOR SELECT USING (get_my_role() IN ('admin','ceo','hr','gm'));
ALTER TABLE public.shift_eod_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own eod reports"   ON public.shift_eod_reports FOR ALL USING (EXISTS (SELECT 1 FROM public.shift_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));
CREATE POLICY "Admins view all eod reports"    ON public.shift_eod_reports FOR SELECT USING (get_my_role() IN ('admin','ceo','hr','gm'));
ALTER TABLE public.shift_assignment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage shift history" ON public.shift_assignment_history FOR ALL USING (get_my_role() IN ('admin','ceo','hr','gm'));
ALTER TABLE public.shift_breaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own shift_breaks" ON public.shift_breaks FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

-- â”€â”€ tasks & SOPs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tasks"    ON public.task_assignments FOR SELECT USING (assigned_to = auth.uid() OR assigned_by = auth.uid());
CREATE POLICY "Admins view all tasks"   ON public.task_assignments FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','hr','boi','director'));
CREATE POLICY "Users update own tasks"  ON public.task_assignments FOR UPDATE USING (assigned_to = auth.uid());
CREATE POLICY "Admins manage all tasks" ON public.task_assignments FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','boi','director'));
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Task members view comments" ON public.task_comments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Task members add comments"  ON public.task_comments FOR INSERT WITH CHECK (user_id = auth.uid());
ALTER TABLE public.sop_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own sop assignments"   ON public.sop_assignments FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','boi','director'));
CREATE POLICY "Users update own sop assignments" ON public.sop_assignments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins manage sop assignments"    ON public.sop_assignments FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','boi','director'));

-- â”€â”€ escalations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own escalations"    ON public.escalations FOR SELECT USING (raised_by = auth.uid() OR assigned_to = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','boi','smo','gmo','nsm','director'));
CREATE POLICY "Users create escalations"      ON public.escalations FOR INSERT WITH CHECK (raised_by = auth.uid());
CREATE POLICY "Admins manage all escalations" ON public.escalations FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','boi','smo','gmo','nsm','director'));

-- â”€â”€ projects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view projects"     ON public.projects FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Engineers update projects"   ON public.projects FOR UPDATE USING (assigned_engineer_id = auth.uid() OR assigned_site_manager_id = auth.uid() OR assigned_manager_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','gmo','smo','director'));
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view phases"    ON public.project_phases FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Engineers manage phases"  ON public.project_phases FOR ALL USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','engineer','site_manager','director'));
ALTER TABLE public.project_boq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view boq"    ON public.project_boq FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Engineers manage boq"  ON public.project_boq FOR ALL USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','engineer','site_manager','director','purchase_head','purchase_manager'));
ALTER TABLE public.project_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view timeline" ON public.project_timeline FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Staff create timeline"   ON public.project_timeline FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
ALTER TABLE public.project_variations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view variations"  ON public.project_variations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage variations"    ON public.project_variations FOR ALL USING (get_my_role() IN ('admin','ceo','gm','gmo','director'));
ALTER TABLE public.project_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view project_inventory" ON public.project_inventory FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Engineers manage project_inventory" ON public.project_inventory FOR ALL USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','engineer','site_manager','director'));
ALTER TABLE public.procurement_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view procurement timeline" ON public.procurement_timeline FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated add procurement event" ON public.procurement_timeline FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view work_orders" ON public.work_orders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated create work_orders" ON public.work_orders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage work_orders" ON public.work_orders FOR UPDATE USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','director') OR requester_id = auth.uid());

-- â”€â”€ collections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.client_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view client_collections"       ON public.client_collections FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated manage client_collections" ON public.client_collections FOR ALL USING (auth.uid() IS NOT NULL);
ALTER TABLE public.client_escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view client_escalations"       ON public.client_escalations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated create client_escalations" ON public.client_escalations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage client_escalations"         ON public.client_escalations FOR UPDATE USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','director') OR created_by = auth.uid());
ALTER TABLE public.client_escalation_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view escalation_timeline"  ON public.client_escalation_timeline FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated add timeline entry"    ON public.client_escalation_timeline FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
ALTER TABLE public.hourly_criticals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view hourly_criticals" ON public.hourly_criticals FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated create hourly_criticals" ON public.hourly_criticals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Managers update hourly_criticals" ON public.hourly_criticals FOR UPDATE USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','datateam'));
ALTER TABLE public.hourly_critical_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view critical_timeline" ON public.hourly_critical_timeline FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated add critical_timeline" ON public.hourly_critical_timeline FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- â”€â”€ transport â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.transport_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transport_expenses" ON public.transport_expenses FOR SELECT USING (created_by = auth.uid() OR get_my_role() IN ('admin','ceo','gm','accounts','logistics','director'));
CREATE POLICY "Users create transport_expenses"   ON public.transport_expenses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Approvers manage transport_expenses" ON public.transport_expenses FOR UPDATE USING (created_by = auth.uid() OR get_my_role() IN ('admin','ceo','gm','accounts','logistics','director'));
ALTER TABLE public.transport_batch_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view transport_batch_entries"      ON public.transport_batch_entries FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated manage transport_batch_entries" ON public.transport_batch_entries FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts','logistics'));
ALTER TABLE public.transport_split_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view transport_split"  ON public.transport_split_payments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Accounts manage transport_split" ON public.transport_split_payments FOR ALL USING (get_my_role() IN ('admin','ceo','accounts'));

-- â”€â”€ rental â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.rental_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view rental_properties"    ON public.rental_properties FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authorized manage rental_properties" ON public.rental_properties FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director','rsh','accounts'));
ALTER TABLE public.rental_monthly_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view rental_monthly"    ON public.rental_monthly_records FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authorized manage rental_monthly" ON public.rental_monthly_records FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director','rsh','accounts'));
ALTER TABLE public.rental_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view rental_expenses"    ON public.rental_expenses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authorized manage rental_expenses" ON public.rental_expenses FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director','rsh','accounts'));
ALTER TABLE public.rental_discussions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view rental_discussions"     ON public.rental_discussions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated post rental_discussions" ON public.rental_discussions FOR INSERT WITH CHECK (author_id = auth.uid());
ALTER TABLE public.rental_property_remarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view rental_remarks"     ON public.rental_property_remarks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated post rental_remarks" ON public.rental_property_remarks FOR INSERT WITH CHECK (author_id = auth.uid());

-- â”€â”€ cash collections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.cash_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own cash_collections"       ON public.cash_collections FOR SELECT USING (collector_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','accounts','director'));
CREATE POLICY "Authenticated create cash_collections" ON public.cash_collections FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Approvers update cash_collections"     ON public.cash_collections FOR UPDATE USING (get_my_role() IN ('admin','ceo','gm','accounts'));

-- â”€â”€ sales tools â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view sales_targets"    ON public.sales_targets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers manage sales_targets"   ON public.sales_targets FOR ALL USING (get_my_role() IN ('admin','ceo','gm','nsm','smo','director'));
ALTER TABLE public.weekly_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view weekly_targets"   ON public.weekly_targets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers manage weekly_targets"  ON public.weekly_targets FOR ALL USING (get_my_role() IN ('admin','ceo','gm','nsm','smo','director'));
ALTER TABLE public.weekly_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view weekly_achievements" ON public.weekly_achievements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers manage weekly_achievements" ON public.weekly_achievements FOR ALL USING (get_my_role() IN ('admin','ceo','gm','nsm','smo','director'));
ALTER TABLE public.demand_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view demand_forecasts"   ON public.demand_forecasts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers manage demand_forecasts"  ON public.demand_forecasts FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_head','nsm','director'));
ALTER TABLE public.followup_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reminders"  ON public.followup_reminders FOR ALL USING (assigned_to = auth.uid() OR get_my_role() IN ('admin','ceo','gm','nsm'));
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own call_logs"       ON public.call_logs FOR SELECT USING (caller_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','nsm','smo'));
CREATE POLICY "Authenticated create call_logs" ON public.call_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- â”€â”€ AI & system â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.ai_employee_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ai_scores" ON public.ai_employee_scores FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','datateam'));
CREATE POLICY "AI system manage scores"  ON public.ai_employee_scores FOR ALL USING (get_my_role() IN ('admin','ceo','datateam'));
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view system_events" ON public.system_events FOR SELECT USING (get_my_role() IN ('admin','ceo','datateam'));
CREATE POLICY "System insert events"     ON public.system_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
ALTER TABLE public.bulk_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized view bulk_batches"   ON public.bulk_batches FOR SELECT USING (get_my_role() IN ('admin','ceo','accounts','hr'));
CREATE POLICY "Authorized manage bulk_batches" ON public.bulk_batches FOR ALL USING (get_my_role() IN ('admin','ceo','accounts','hr'));
ALTER TABLE public.qc_rejections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view qc_rejections" ON public.qc_rejections FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "QC manage rejections" ON public.qc_rejections FOR ALL USING (get_my_role() IN ('admin','ceo','gm','warehouse','logistics','datateam'));
ALTER TABLE public.deduction_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_achievements ENABLE ROW LEVEL SECURITY;

-- â”€â”€ chat (all tables exist, safe to add cross-table policies) â”€
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view conversations"     ON public.chat_conversations FOR SELECT USING (id IN (SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()));
CREATE POLICY "Authenticated create conversations"  ON public.chat_conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Creator update conversation"         ON public.chat_conversations FOR UPDATE USING (created_by = auth.uid() OR get_my_role() IN ('admin','ceo'));
CREATE POLICY "Admin delete conversations"          ON public.chat_conversations FOR DELETE USING (created_by = auth.uid() OR get_my_role() IN ('admin','ceo'));

ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own participations"      ON public.chat_participants FOR SELECT USING (user_id = auth.uid() OR conversation_id IN (SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()));
CREATE POLICY "Authenticated join conversations"   ON public.chat_participants FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users update own participation"     ON public.chat_participants FOR UPDATE USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo'));
CREATE POLICY "Users leave conversations"          ON public.chat_participants FOR DELETE USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo'));

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view messages"   ON public.chat_messages FOR SELECT USING (conversation_id IN (SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()));
CREATE POLICY "Participants send messages"   ON public.chat_messages FOR INSERT WITH CHECK (sender_id = auth.uid() AND conversation_id IN (SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()));
CREATE POLICY "Sender edit own message"      ON public.chat_messages FOR UPDATE USING (sender_id = auth.uid() OR get_my_role() IN ('admin','ceo'));
CREATE POLICY "Sender or admin delete msg"   ON public.chat_messages FOR DELETE USING (sender_id = auth.uid() OR get_my_role() IN ('admin','ceo'));

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view reactions" ON public.chat_message_reactions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users react"                  ON public.chat_message_reactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users remove own reaction"    ON public.chat_message_reactions FOR DELETE USING (user_id = auth.uid());

ALTER TABLE public.chat_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view calls"   ON public.chat_calls FOR SELECT USING (caller_id = auth.uid() OR receiver_id = auth.uid() OR get_my_role() IN ('admin','ceo'));
CREATE POLICY "Authenticated create calls" ON public.chat_calls FOR INSERT WITH CHECK (caller_id = auth.uid());
CREATE POLICY "Call participants update"  ON public.chat_calls FOR UPDATE USING (caller_id = auth.uid() OR receiver_id = auth.uid() OR get_my_role() IN ('admin','ceo'));

ALTER TABLE public.chat_call_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signal participants view"  ON public.chat_call_signals FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "Authenticated send signals" ON public.chat_call_signals FOR INSERT WITH CHECK (sender_id = auth.uid());


-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
--  PHASE 3 â€” TRIGGERS, FUNCTIONS & HELPERS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Shift time helper
CREATE OR REPLACE FUNCTION public.get_shift_for_time(t time)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN t >= '10:00' AND t < '19:30' THEN 1
    WHEN t >= '19:30' AND t <= '23:00' THEN 2
    ELSE NULL
  END;
$$;

-- Chat: keep last_message_at in sync
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.chat_conversations
  SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER trg_update_conversation_last_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- Notify PostgREST of schema changes
NOTIFY pgrst, 'reload schema';

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
