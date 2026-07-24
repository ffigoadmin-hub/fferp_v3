-- ============================================================
--  RLS FIX — FINAL BATCH: remaining ~90 tables from the full
--  "qual = true" sweep
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Three groups, each verified via grep against src/ before writing:
--
--  (A) Internal FFERP/IGO-Chain tables — confirmed used by staff-only
--      pages in this repo. RLS was already enabled on most of these
--      in the earlier bulk-enable migration; this replaces their
--      sole dangerous "authenticated_full_X" policy (any logged-in
--      user, any role — which on this shared DB includes customers
--      too) with a real is_staff() scope.
--
--  (B) Tables with a legitimate companion policy already present
--      (app_banners, app_config, web_access_config) — keep the good
--      one, drop only the dangerous one.
--
--  (C) Tables not referenced anywhere in this FFERP repo, with NO
--      legitimate alternative policy, moderate-to-high sensitivity
--      (customer_addresses = PII, subscriptions = billing, sessions/
--      order tracking = ambiguous) — deny-all stopgap, same
--      reasoning as the exposed auth tokens: better to break an
--      unverifiable feature than leave it open to anyone.
-- ============================================================

-- ── (A) Internal FFERP tables → is_staff() ──────────────────
DROP POLICY IF EXISTS authenticated_full_boxes ON public.boxes;
CREATE POLICY boxes_staff_access ON public.boxes FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_bulk_order_uploads ON public.bulk_order_uploads;
CREATE POLICY bulk_order_uploads_staff_access ON public.bulk_order_uploads FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_cafe_ads ON public.cafe_ads;
CREATE POLICY cafe_ads_staff_access ON public.cafe_ads FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_cafe_daily_closings ON public.cafe_daily_closings;
CREATE POLICY cafe_daily_closings_staff_access ON public.cafe_daily_closings FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_cafe_master_menu ON public.cafe_master_menu;
CREATE POLICY cafe_master_menu_staff_access ON public.cafe_master_menu FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_cafe_menu_items ON public.cafe_menu_items;
CREATE POLICY cafe_menu_items_staff_access ON public.cafe_menu_items FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_cafe_order_items ON public.cafe_order_items;
CREATE POLICY cafe_order_items_staff_access ON public.cafe_order_items FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_cafe_orders ON public.cafe_orders;
CREATE POLICY cafe_orders_staff_access ON public.cafe_orders FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_cafe_settings ON public.cafe_settings;
CREATE POLICY cafe_settings_staff_access ON public.cafe_settings FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_chat_activity ON public.chat_activity;
CREATE POLICY chat_activity_staff_access ON public.chat_activity FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_chat_connections ON public.chat_connections;
CREATE POLICY chat_connections_staff_access ON public.chat_connections FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_company_calendar ON public.company_calendar;
CREATE POLICY company_calendar_staff_access ON public.company_calendar FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_credit_notes ON public.credit_notes;
CREATE POLICY credit_notes_staff_access ON public.credit_notes FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_cultivation_cycles ON public.cultivation_cycles;
CREATE POLICY cultivation_cycles_staff_access ON public.cultivation_cycles FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_daily_expense_sheet ON public.daily_expense_sheet;
CREATE POLICY daily_expense_sheet_staff_access ON public.daily_expense_sheet FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_daily_farm_logs ON public.daily_farm_logs;
CREATE POLICY daily_farm_logs_staff_access ON public.daily_farm_logs FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_daily_site_updates ON public.daily_site_updates;
CREATE POLICY daily_site_updates_staff_access ON public.daily_site_updates FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_daily_tasks ON public.daily_tasks;
CREATE POLICY daily_tasks_staff_access ON public.daily_tasks FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_delivery_challans ON public.delivery_challans;
CREATE POLICY delivery_challans_staff_access ON public.delivery_challans FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_delivery_pack_items ON public.delivery_pack_items;
CREATE POLICY delivery_pack_items_staff_access ON public.delivery_pack_items FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_delivery_packs ON public.delivery_packs;
CREATE POLICY delivery_packs_staff_access ON public.delivery_packs FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_delivery_slots ON public.delivery_slots;
CREATE POLICY delivery_slots_staff_access ON public.delivery_slots FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS auth_full_delivery_zones ON public.delivery_zones;
CREATE POLICY delivery_zones_staff_access ON public.delivery_zones FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_departments ON public.departments;
CREATE POLICY departments_staff_access ON public.departments FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_escalation_timeline ON public.escalation_timeline;
CREATE POLICY escalation_timeline_staff_access ON public.escalation_timeline FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_farm_manager_remarks ON public.farm_manager_remarks;
CREATE POLICY farm_manager_remarks_staff_access ON public.farm_manager_remarks FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_fraud_pattern_alerts ON public.fraud_pattern_alerts;
CREATE POLICY fraud_pattern_alerts_staff_access ON public.fraud_pattern_alerts FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_harvest_records ON public.harvest_records;
CREATE POLICY harvest_records_staff_access ON public.harvest_records FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- hub_pincodes: keep public_read_hub_pincodes (untouched), only replace the write blanket
DROP POLICY IF EXISTS authenticated_full_hub_pincodes ON public.hub_pincodes;
CREATE POLICY hub_pincodes_staff_write ON public.hub_pincodes FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_inventory_consumption_summary ON public.inventory_consumption_summary;
CREATE POLICY inventory_consumption_summary_staff_access ON public.inventory_consumption_summary FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_inventory_items ON public.inventory_items;
CREATE POLICY inventory_items_staff_access ON public.inventory_items FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_inventory_log ON public.inventory_log;
CREATE POLICY inventory_log_staff_access ON public.inventory_log FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_inventory_usage_logs ON public.inventory_usage_logs;
CREATE POLICY inventory_usage_logs_staff_access ON public.inventory_usage_logs FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_leave_types ON public.leave_types;
CREATE POLICY leave_types_staff_access ON public.leave_types FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_milestone_deviation_requests ON public.milestone_deviation_requests;
CREATE POLICY milestone_deviation_requests_staff_access ON public.milestone_deviation_requests FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_notification_settings ON public.notification_settings;
CREATE POLICY notification_settings_staff_access ON public.notification_settings FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_order_returns ON public.order_returns;
CREATE POLICY order_returns_staff_access ON public.order_returns FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_payment_audit_logs ON public.payment_audit_logs;
CREATE POLICY payment_audit_logs_staff_access ON public.payment_audit_logs FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_payment_deduplication_registry ON public.payment_deduplication_registry;
CREATE POLICY payment_deduplication_registry_staff_access ON public.payment_deduplication_registry FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_payment_tags ON public.payment_tags;
CREATE POLICY payment_tags_staff_access ON public.payment_tags FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_payments_made ON public.payments_made;
CREATE POLICY payments_made_staff_access ON public.payments_made FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_payments_received ON public.payments_received;
CREATE POLICY payments_received_staff_access ON public.payments_received FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_payroll_summary ON public.payroll_summary;
CREATE POLICY payroll_summary_staff_access ON public.payroll_summary FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_po_assignments ON public.po_assignments;
CREATE POLICY po_assignments_staff_access ON public.po_assignments FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_po_links ON public.po_sales_order_links;
CREATE POLICY po_sales_order_links_staff_access ON public.po_sales_order_links FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS auth_full_product_categories ON public.product_categories;
CREATE POLICY product_categories_staff_write ON public.product_categories FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_project_documents ON public.project_documents;
CREATE POLICY project_documents_staff_access ON public.project_documents FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_project_escalation_stats ON public.project_escalation_stats;
CREATE POLICY project_escalation_stats_staff_access ON public.project_escalation_stats FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_project_execution_proofs ON public.project_execution_proofs;
CREATE POLICY project_execution_proofs_staff_access ON public.project_execution_proofs FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_project_milestones ON public.project_milestones;
CREATE POLICY project_milestones_staff_access ON public.project_milestones FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_project_verticals ON public.project_verticals;
CREATE POLICY project_verticals_staff_access ON public.project_verticals FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_purchase_progress_logs ON public.purchase_progress_logs;
CREATE POLICY purchase_progress_logs_staff_access ON public.purchase_progress_logs FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_recurring_bills ON public.recurring_bills;
CREATE POLICY recurring_bills_staff_access ON public.recurring_bills FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_recurring_invoices ON public.recurring_invoices;
CREATE POLICY recurring_invoices_staff_access ON public.recurring_invoices FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_rental_additions ON public.rental_additions;
CREATE POLICY rental_additions_staff_access ON public.rental_additions FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_rental_deductions ON public.rental_deductions;
CREATE POLICY rental_deductions_staff_access ON public.rental_deductions FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_site_visit_assignments ON public.site_visit_assignments;
CREATE POLICY site_visit_assignments_staff_access ON public.site_visit_assignments FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_site_visit_daily_reports ON public.site_visit_daily_reports;
CREATE POLICY site_visit_daily_reports_staff_access ON public.site_visit_daily_reports FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_site_visit_daily_reports_public ON public.site_visit_daily_reports_public;
CREATE POLICY site_visit_daily_reports_public_staff_access ON public.site_visit_daily_reports_public FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_site_visit_requests ON public.site_visit_requests;
CREATE POLICY site_visit_requests_staff_access ON public.site_visit_requests FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_site_visit_session_reports ON public.site_visit_session_reports;
CREATE POLICY site_visit_session_reports_staff_access ON public.site_visit_session_reports FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_site_visit_sla_tracking ON public.site_visit_sla_tracking;
CREATE POLICY site_visit_sla_tracking_staff_access ON public.site_visit_sla_tracking FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_site_visit_timeline ON public.site_visit_timeline;
CREATE POLICY site_visit_timeline_staff_access ON public.site_visit_timeline FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_site_visit_travel_logs ON public.site_visit_travel_logs;
CREATE POLICY site_visit_travel_logs_staff_access ON public.site_visit_travel_logs FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_sops ON public.sops;
CREATE POLICY sops_staff_access ON public.sops FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_split_payments ON public.split_payments;
CREATE POLICY split_payments_staff_access ON public.split_payments FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_system_settings ON public.system_settings;
CREATE POLICY system_settings_staff_access ON public.system_settings FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_task_achievements ON public.task_achievements;
CREATE POLICY task_achievements_staff_access ON public.task_achievements FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_ticket_views ON public.ticket_views;
CREATE POLICY ticket_views_staff_access ON public.ticket_views FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS ops_transit_all ON public.transit_records;
CREATE POLICY transit_records_staff_access ON public.transit_records FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_trip_orders ON public.trip_orders;
CREATE POLICY trip_orders_staff_access ON public.trip_orders FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_vendor_credits ON public.vendor_credits;
CREATE POLICY vendor_credits_staff_access ON public.vendor_credits FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_vendor_quotes ON public.vendor_quotes;
CREATE POLICY vendor_quotes_staff_access ON public.vendor_quotes FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_vendor_ratings ON public.vendor_ratings;
CREATE POLICY vendor_ratings_staff_access ON public.vendor_ratings FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_vendor_sourcing_logs ON public.vendor_sourcing_logs;
CREATE POLICY vendor_sourcing_logs_staff_access ON public.vendor_sourcing_logs FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_vendor_sourcing_queue ON public.vendor_sourcing_queue;
CREATE POLICY vendor_sourcing_queue_staff_access ON public.vendor_sourcing_queue FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_vendor_work_requests ON public.vendor_work_requests;
CREATE POLICY vendor_work_requests_staff_access ON public.vendor_work_requests FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_wastage_entries ON public.wastage_entries;
CREATE POLICY wastage_entries_staff_access ON public.wastage_entries FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_wastage_log ON public.wastage_log;
CREATE POLICY wastage_log_staff_access ON public.wastage_log FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_work_order_final_audits ON public.work_order_final_audits;
CREATE POLICY work_order_final_audits_staff_access ON public.work_order_final_audits FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS authenticated_full_work_order_payments ON public.work_order_payments;
CREATE POLICY work_order_payments_staff_access ON public.work_order_payments FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── (B) Keep the good, drop the bad ─────────────────────────
DROP POLICY IF EXISTS auth_full_app_banners ON public.app_banners;
-- public_read_app_banners (anon, is_active=true) already covers legitimate read.

DROP POLICY IF EXISTS anon_insert_app_config ON public.app_config;
DROP POLICY IF EXISTS anon_update_app_config ON public.app_config;
-- anon_select_app_config kept — world-readable config (feature flags/version
-- checks) is a common, low-risk pattern; world-WRITABLE config is not.

DROP POLICY IF EXISTS web_access_config_admin ON public.web_access_config;
-- web_access_config_read (authenticated, true) kept as-is.

-- ── (C) No FFERP usage, no legitimate alternative — deny-all ─
DROP POLICY IF EXISTS auth_full_app_sessions ON public.app_sessions;
DROP POLICY IF EXISTS auth_full_carts ON public.carts;
DROP POLICY IF EXISTS auth_full_customer_addresses ON public.customer_addresses;
DROP POLICY IF EXISTS auth_full_order_cancellations ON public.order_cancellations;
DROP POLICY IF EXISTS auth_full_order_tracking ON public.order_tracking;
DROP POLICY IF EXISTS auth_full_subscription_items ON public.subscription_items;
DROP POLICY IF EXISTS auth_full_subscriptions ON public.subscriptions;

-- ── Verify: should return 0 rows (no more unrestricted "true" policies
--    left anywhere, aside from the deliberately-open ones we chose to keep) ──
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true')
ORDER BY tablename, policyname;
