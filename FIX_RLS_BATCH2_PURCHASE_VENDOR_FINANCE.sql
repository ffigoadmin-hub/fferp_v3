-- ============================================================
--  RLS FIX — BATCH 2: purchase_entries, purchase_entry_items,
--  po_bills, porter_transit_payments, petty_cash_ledger,
--  petty_cash_refill_requests, petty_cash_reports,
--  vendor_master, vendors, invoices, refunds
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Two policy shapes used here, chosen per table based on actual
--  code usage (checked via grep across src/ before writing this):
--
--  (A) NARROW — table is only ever touched from one page/flow with
--      a clear, small role list. Policy mirrors that exact list.
--  (B) BROAD ("is_staff") — table is touched from multiple pages
--      with different, overlapping role sets (e.g. vendor_master is
--      read from a vendor-sourcing dashboard open to 'employee', AND
--      from FF/IGO purchase flows open to a totally different role
--      list). Rather than risk a narrow list that's wrong and breaks
--      a flow I haven't traced, these get "any logged-in active
--      staff member" via the existing is_staff() function — this
--      still closes the real danger (anonymous/public internet
--      access with the anon key) without a false-precision risk.
-- ============================================================

-- ── (A) purchase_entries / purchase_entry_items ─────────────
-- Only ever touched by BuyPage.tsx (/purchase/buy)
ALTER TABLE public.purchase_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_entry_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_buy_page_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.get_my_role() IN (
    'admin','back_office','purchase_manager','purchase_head','shift_employee','ff_operations_manager'
  );
$$;

DROP POLICY IF EXISTS purchase_entries_access ON public.purchase_entries;
CREATE POLICY purchase_entries_access ON public.purchase_entries
  FOR ALL USING (public.is_buy_page_staff()) WITH CHECK (public.is_buy_page_staff());

DROP POLICY IF EXISTS purchase_entry_items_access ON public.purchase_entry_items;
CREATE POLICY purchase_entry_items_access ON public.purchase_entry_items
  FOR ALL USING (public.is_buy_page_staff()) WITH CHECK (public.is_buy_page_staff());

-- ── (A) po_bills ─────────────────────────────────────────────
-- Only ever touched by buyStore.ts, used from AutoPOPage.tsx (/purchase/auto-po)
ALTER TABLE public.po_bills ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_auto_po_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.get_my_role() IN (
    'admin','back_office','purchase_manager','purchase_head','ff_operations_manager',
    'field_executive','bde','tele_caller','hub_manager','gm','ceo'
  );
$$;

DROP POLICY IF EXISTS po_bills_access ON public.po_bills;
CREATE POLICY po_bills_access ON public.po_bills
  FOR ALL USING (public.is_auto_po_staff()) WITH CHECK (public.is_auto_po_staff());

-- ── (A) porter_transit_payments ─────────────────────────────
-- Confirmed unused anywhere in src/ — dead table today. Staff-only
-- default applied since it clearly belongs to the same
-- purchase/transit domain as the tables above, even though nothing
-- reads/writes it yet (so this cannot break any current feature).
ALTER TABLE public.porter_transit_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS porter_transit_payments_access ON public.porter_transit_payments;
CREATE POLICY porter_transit_payments_access ON public.porter_transit_payments
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── (A) petty_cash_ledger / petty_cash_refill_requests / petty_cash_reports ──
-- Union of allowedRoles across /accounts-execution, /accounts/petty-cash/audit,
-- /accounts/petty-cash/refill, /dashboard/director, /director/jv-approvals
ALTER TABLE public.petty_cash_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_refill_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_finance_governance_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.get_my_role() IN (
    'accounts','admin','gm','director','Director','ceo','auditor'
  );
$$;

DROP POLICY IF EXISTS petty_cash_ledger_access ON public.petty_cash_ledger;
CREATE POLICY petty_cash_ledger_access ON public.petty_cash_ledger
  FOR ALL USING (public.is_finance_governance_staff()) WITH CHECK (public.is_finance_governance_staff());

DROP POLICY IF EXISTS petty_cash_refill_requests_access ON public.petty_cash_refill_requests;
CREATE POLICY petty_cash_refill_requests_access ON public.petty_cash_refill_requests
  FOR ALL USING (public.is_finance_governance_staff()) WITH CHECK (public.is_finance_governance_staff());

DROP POLICY IF EXISTS petty_cash_reports_access ON public.petty_cash_reports;
CREATE POLICY petty_cash_reports_access ON public.petty_cash_reports
  FOR ALL USING (public.is_finance_governance_staff()) WITH CHECK (public.is_finance_governance_staff());

-- ── (B) vendor_master / vendors ─────────────────────────────
-- Read/written from multiple pages with different role lists
-- ('employee' via vendor-sourcing dashboard, OPS_ROLES via purchase
-- payment forms, FF-specific roles via ff/vendor-payment/new) —
-- broad staff policy to avoid a wrong narrow list breaking one of them.
ALTER TABLE public.vendor_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_master_staff_access ON public.vendor_master;
CREATE POLICY vendor_master_staff_access ON public.vendor_master
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS vendors_staff_access ON public.vendors;
CREATE POLICY vendors_staff_access ON public.vendors
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── (B) invoices ─────────────────────────────────────────────
-- Read from SalesInvoicesPage (field_executive, bde, tele_caller,
-- ff_operations_manager, gm, ceo, hub_manager, admin, back_office)
-- and from FFOperationsHomePage (ff_operations_manager, admin, etc.)
-- — broad staff policy, same reasoning as above.
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoices_staff_access ON public.invoices;
CREATE POLICY invoices_staff_access ON public.invoices
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── (A) refunds ──────────────────────────────────────────────
-- Confirmed unused anywhere in src/ — dead table today.
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refunds_staff_access ON public.refunds;
CREATE POLICY refunds_staff_access ON public.refunds
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── Verify ───────────────────────────────────────────────────
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN (
  'purchase_entries','purchase_entry_items','po_bills','porter_transit_payments',
  'petty_cash_ledger','petty_cash_refill_requests','petty_cash_reports',
  'vendor_master','vendors','invoices','refunds'
)
ORDER BY tablename;
