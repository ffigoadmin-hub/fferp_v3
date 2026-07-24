-- ============================================================
--  RLS FIX — BULK ENABLE: tables that already have policies defined
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Source: Supabase Security Advisor (splinter linter), category
--  "policy_exists_rls_disabled" — 164 tables where RLS policies
--  already exist (many look genuinely well-designed: "Users view
--  own history", "HR manage lop entries", "Managers manage issues",
--  etc.) but RLS itself was never switched on, so none of those
--  policies are enforced.
--
--  This migration does ONLY `ALTER TABLE ... ENABLE ROW LEVEL
--  SECURITY` — it does not add, remove, or change any policy. Safe
--  by construction: it can only make a table MORE restrictive
--  (activating whatever policy already exists), never less.
--
--  Caveat: a handful of these tables (confirmed via the Advisor
--  export) have ONLY a blanket "authenticated_full_X"/"auth_full_X"
--  policy and nothing else — e.g. app_banners, app_sessions,
--  categories, cafe_*, chat_*, delivery_*, payment_audit_logs,
--  payments_made, payments_received, vendor_credits, vendor_quotes,
--  and others. Enabling RLS on those does NOT meaningfully restrict
--  them — they'll still be fully open to any authenticated user,
--  just now "technically RLS-enabled". Those need real scoped
--  policies as a separate follow-up; this migration only satisfies
--  the linter for them, it doesn't fix their actual exposure.
-- ============================================================

ALTER TABLE public.ai_employee_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_lock_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_order_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_master_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_call_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_escalation_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cultivation_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_expense_sheet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_farm_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_site_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deduction_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_pack_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_manager_remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_pattern_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harvest_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourly_critical_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourly_criticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_consumption_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lop_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lop_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_deviation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_deduction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_deduplication_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments_made ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_sales_order_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_boq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_escalation_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_execution_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_additions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_monthly_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_property_remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_eod_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_user_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_daily_reports_public ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_session_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_sla_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_travel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_batch_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_split_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_sourcing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_sourcing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_work_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.week_off_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_final_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

-- ── Verify: count should now be 0 (all 164 should show rowsecurity = true) ──
SELECT count(*) AS still_disabled
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = FALSE
  AND tablename IN (
    'ai_employee_scores','announcements','app_banners','app_sessions','attendance_lock_overrides',
    'bulk_batches','bulk_order_uploads','cafe_ads','cafe_daily_closings','cafe_master_menu',
    'cafe_menu_items','cafe_order_items','cafe_orders','cafe_settings','call_logs','cart',
    'cart_items','carts','cash_collections','categories','chat_activity','chat_call_signals',
    'chat_calls','chat_connections','chat_conversations','chat_message_reactions','chat_messages',
    'chat_participants','client_collections','client_escalation_timeline','client_escalations',
    'company_calendar','contact_enquiries','core_heads','coupon_usage','credit_notes','crm_leads',
    'cultivation_cycles','customer_addresses','daily_expense_sheet','daily_farm_logs',
    'daily_site_updates','daily_tasks','deduction_memos','delivery_challans','delivery_pack_items',
    'delivery_packs','delivery_slots','delivery_zones','demand_forecasts','departments',
    'employee_achievements','escalation_timeline','escalations','farm_manager_remarks',
    'followup_reminders','fraud_pattern_alerts','geofences','harvest_records',
    'hourly_critical_timeline','hourly_criticals','inventory_consumption_summary','inventory_items',
    'inventory_log','inventory_usage_logs','leads','leave_requests','leave_types','logistics_trips',
    'lop_audit_logs','lop_entries','market_rates','milestone_deviation_requests',
    'notification_settings','onboarding_requests','order_cancellations','order_returns',
    'order_tracking','payees','payment_audit_logs','payment_deduction_lines',
    'payment_deduplication_registry','payment_requests','payment_tags','payments_made',
    'payments_received','payroll_summary','po_assignments','po_sales_order_links',
    'procurement_timeline','product_categories','product_images','product_reviews','project_boq',
    'project_documents','project_escalation_stats','project_execution_proofs','project_inventory',
    'project_milestones','project_phases','project_timeline','project_variations',
    'project_verticals','projects','purchase_order_items','purchase_progress_logs','qc_inspections',
    'qc_rejections','recurring_bills','recurring_invoices','rental_additions','rental_categories',
    'rental_deductions','rental_discussions','rental_expenses','rental_monthly_records',
    'rental_properties','rental_property_remarks','reviews','sales_targets',
    'shift_assignment_history','shift_eod_reports','shift_user_assignments',
    'site_visit_assignments','site_visit_daily_reports','site_visit_daily_reports_public',
    'site_visit_requests','site_visit_session_reports','site_visit_sla_tracking',
    'site_visit_timeline','site_visit_travel_logs','sop_assignments','sops','split_payments',
    'subscription_items','subscriptions','system_events','system_settings','task_achievements',
    'task_assignments','task_comments','ticket_views','transit_records','transport_batch_entries',
    'transport_categories','transport_drivers','transport_expenses','transport_split_payments',
    'transport_vehicles','trip_orders','user_addresses','vendor_credits','vendor_quotes',
    'vendor_ratings','vendor_sourcing_logs','vendor_sourcing_queue','vendor_work_requests',
    'week_off_assignments','weekly_achievements','weekly_targets','wishlist_items',
    'work_order_final_audits','work_order_payments','work_orders'
  );
