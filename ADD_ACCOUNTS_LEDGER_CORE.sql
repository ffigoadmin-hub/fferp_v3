-- ADD_ACCOUNTS_LEDGER_CORE.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- FFERP Accounts — Phase 1 ledger core (double-entry general ledger).
--
-- What it creates (all NEW objects, prefix acct_; touches NO existing table):
--   acct_settings          single row: books start date (2026-04-01), period lock date, GST state
--   acct_fiscal_years      FY 2026-27 seeded (Apr–Mar)
--   acct_accounts          chart of accounts tree, seeded with an Indian produce-trading layout
--   acct_voucher_series    per-type / per-FY running numbers (JV/26-27/00001 …)
--   acct_vouchers          every accounting document header (journal, sales invoice, receipt …)
--   acct_voucher_lines     debit/credit lines — the ledger itself once the voucher is posted
--   acct_posting_errors    queue of auto-postings that failed (so operations are never blocked)
--   acct_gl                view: posted lines with account + voucher details (security_invoker)
--   functions              create / post / approve / reject / reverse vouchers, auto-post helper,
--                          trial balance, account ledger, party ageing
--
-- Rules enforced in the database (not just the UI):
--   • a voucher posts only if total debit = total credit > 0, ≥ 2 lines, leaf + active accounts
--   • posting date must be ≥ books start (opening vouchers excepted), after the lock date,
--     and inside an open fiscal year
--   • posted vouchers are immutable; "cancel" = a reversal voucher (original stays in the ledger)
--
-- Access: write = accounts, admin · read = accounts, admin, ceo, director, auditor.
--         Manual journals by `accounts` wait for admin/ceo approval; admin posts directly.
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT (safe to re-run).
-- Before running: CHECK_ACCOUNTS_SOURCE_TABLES.sql query 3 must show no acct_* tables.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- ── 0. Role helpers ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.acct_can_write() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(coalesce(public.get_my_role(), '')) IN ('accounts','admin');
$$;

CREATE OR REPLACE FUNCTION public.acct_can_read() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(coalesce(public.get_my_role(), '')) IN ('accounts','admin','ceo','director','auditor');
$$;

CREATE OR REPLACE FUNCTION public.acct_can_approve() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(coalesce(public.get_my_role(), '')) IN ('admin','ceo');
$$;

-- ── 1. Settings ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.acct_settings (
  id                 int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  books_start_date   date NOT NULL DEFAULT '2026-04-01',
  lock_date          date,                       -- nothing on/before this date can be posted
  company_name       text NOT NULL DEFAULT 'Farmers Factory',
  company_state_code text NOT NULL DEFAULT '33', -- Tamil Nadu (Hyderabad hub = 36 Telangana)
  updated_by         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.acct_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── 2. Fiscal years ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.acct_fiscal_years (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,              -- 'FY 2026-27'
  short_code  text NOT NULL UNIQUE,              -- '26-27' (used in voucher numbers)
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  is_closed   boolean NOT NULL DEFAULT false,
  closed_by   uuid,
  closed_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);
INSERT INTO public.acct_fiscal_years (name, short_code, start_date, end_date)
VALUES ('FY 2026-27', '26-27', '2026-04-01', '2027-03-31')
ON CONFLICT (name) DO NOTHING;

-- ── 3. Chart of accounts ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.acct_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  name          text NOT NULL,
  parent_id     uuid REFERENCES public.acct_accounts(id) ON DELETE RESTRICT,
  is_group      boolean NOT NULL DEFAULT false,
  root_type     text NOT NULL CHECK (root_type IN ('asset','liability','equity','income','expense')),
  account_type  text CHECK (account_type IN ('cash','bank','receivable','payable','stock','tax',
                  'fixed_asset','cost_of_goods','direct_expense','indirect_expense','direct_income',
                  'indirect_income','equity','round_off','temporary','other')),
  system_key    text UNIQUE,                     -- stable handle used by auto-posting
  gst_component text CHECK (gst_component IN ('cgst','sgst','igst')),
  is_active     boolean NOT NULL DEFAULT true,
  description   text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acct_accounts_parent_idx ON public.acct_accounts(parent_id);

-- child must share the parent's root_type, and the parent must be a group
CREATE OR REPLACE FUNCTION public.acct_accounts_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE p record;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT root_type, is_group INTO p FROM public.acct_accounts WHERE id = NEW.parent_id;
    IF NOT p.is_group THEN RAISE EXCEPTION 'Parent account must be a group account'; END IF;
    IF p.root_type <> NEW.root_type THEN
      RAISE EXCEPTION 'Account root type (%) must match its parent (%)', NEW.root_type, p.root_type;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_group = false AND NEW.is_group = true
     AND EXISTS (SELECT 1 FROM public.acct_voucher_lines WHERE account_id = NEW.id) THEN
    RAISE EXCEPTION 'Account % already has ledger entries and cannot become a group', NEW.code;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.root_type <> OLD.root_type
     AND EXISTS (SELECT 1 FROM public.acct_voucher_lines WHERE account_id = NEW.id) THEN
    RAISE EXCEPTION 'Account % already has ledger entries; its root type cannot change', NEW.code;
  END IF;
  -- accounts that auto-posting relies on may be renamed, nothing else
  IF TG_OP = 'UPDATE' AND OLD.system_key IS NOT NULL AND (
       NEW.system_key IS DISTINCT FROM OLD.system_key OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
    OR NEW.root_type <> OLD.root_type OR NEW.account_type IS DISTINCT FROM OLD.account_type
    OR NEW.is_group <> OLD.is_group OR NOT NEW.is_active OR NEW.code <> OLD.code) THEN
    RAISE EXCEPTION 'Account % is used by auto-posting (%); only its name and description can change',
      OLD.code, OLD.system_key;
  END IF;
  RETURN NEW;
END $$;

-- seed: (code, name, parent_code, is_group, root_type, account_type, system_key, gst_component)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('1000','Assets',                       NULL,  true,  'asset',     NULL,              NULL,               NULL),
    ('1100','Current Assets',               '1000',true,  'asset',     NULL,              NULL,               NULL),
    ('1110','Cash in Hand',                 '1100',false, 'asset',     'cash',            'cash',             NULL),
    ('1120','Bank Accounts',                '1100',true,  'asset',     NULL,              NULL,               NULL),
    ('1121','Kotak Mahindra Bank',          '1120',false, 'asset',     'bank',            'bank_default',     NULL),
    ('1130','Sundry Debtors',               '1100',false, 'asset',     'receivable',      'debtors',          NULL),
    ('1140','Stock in Hand',                '1100',false, 'asset',     'stock',           'stock',            NULL),
    ('1150','GST Input Credit',             '1100',true,  'asset',     NULL,              NULL,               NULL),
    ('1151','Input CGST',                   '1150',false, 'asset',     'tax',             'input_cgst',       'cgst'),
    ('1152','Input SGST',                   '1150',false, 'asset',     'tax',             'input_sgst',       'sgst'),
    ('1153','Input IGST',                   '1150',false, 'asset',     'tax',             'input_igst',       'igst'),
    ('1160','Advances to Vendors',          '1100',false, 'asset',     'receivable',      'vendor_advances',  NULL),
    ('1170','TDS Receivable',               '1100',false, 'asset',     'tax',             'tds_receivable',   NULL),
    ('1180','Petty Cash',                   '1100',false, 'asset',     'cash',            'petty_cash',       NULL),
    ('1200','Fixed Assets',                 '1000',true,  'asset',     NULL,              NULL,               NULL),
    ('1210','Vehicles',                     '1200',false, 'asset',     'fixed_asset',     NULL,               NULL),
    ('1220','Crates & Hub Equipment',       '1200',false, 'asset',     'fixed_asset',     NULL,               NULL),
    ('1230','Furniture & Computers',        '1200',false, 'asset',     'fixed_asset',     NULL,               NULL),

    ('2000','Liabilities',                  NULL,  true,  'liability', NULL,              NULL,               NULL),
    ('2100','Current Liabilities',          '2000',true,  'liability', NULL,              NULL,               NULL),
    ('2110','Sundry Creditors',             '2100',false, 'liability', 'payable',         'creditors',        NULL),
    ('2120','Transporters Payable',         '2100',false, 'liability', 'payable',         'transport_payable',NULL),
    ('2130','GST Output',                   '2100',true,  'liability', NULL,              NULL,               NULL),
    ('2131','Output CGST',                  '2130',false, 'liability', 'tax',             'output_cgst',      'cgst'),
    ('2132','Output SGST',                  '2130',false, 'liability', 'tax',             'output_sgst',      'sgst'),
    ('2133','Output IGST',                  '2130',false, 'liability', 'tax',             'output_igst',      'igst'),
    ('2140','TDS Payable',                  '2100',false, 'liability', 'tax',             'tds_payable',      NULL),
    ('2150','Customer Advances',            '2100',false, 'liability', 'payable',         'customer_advances',NULL),
    ('2160','Salaries Payable',             '2100',false, 'liability', 'payable',         'salaries_payable', NULL),
    ('2200','Loans',                        '2000',true,  'liability', NULL,              NULL,               NULL),
    ('2210','Unsecured Loans',              '2200',false, 'liability', 'other',           NULL,               NULL),

    ('3000','Equity',                       NULL,  true,  'equity',    NULL,              NULL,               NULL),
    ('3100','Capital Account',              '3000',false, 'equity',    'equity',          'capital',          NULL),
    ('3200','Retained Earnings',            '3000',false, 'equity',    'equity',          'retained_earnings',NULL),
    ('3300','Opening Balance Equity',       '3000',false, 'equity',    'temporary',       'opening_equity',   NULL),

    ('4000','Income',                       NULL,  true,  'income',    NULL,              NULL,               NULL),
    ('4100','Sales - Fresh Produce',        '4000',false, 'income',    'direct_income',   'sales',            NULL),
    ('4200','Delivery Charges Collected',   '4000',false, 'income',    'direct_income',   'delivery_income',  NULL),
    ('4300','Other Income',                 '4000',false, 'income',    'indirect_income', 'other_income',     NULL),

    ('5000','Expenses',                     NULL,  true,  'expense',   NULL,              NULL,               NULL),
    ('5100','Cost of Goods Sold',           '5000',true,  'expense',   NULL,              NULL,               NULL),
    ('5110','Purchases - Fresh Produce',    '5100',false, 'expense',   'cost_of_goods',   'purchases',        NULL),
    ('5120','Freight Inward & Transport',   '5100',false, 'expense',   'cost_of_goods',   'freight',          NULL),
    ('5200','Direct Expenses',              '5000',true,  'expense',   NULL,              NULL,               NULL),
    ('5210','Wastage & Spoilage',           '5200',false, 'expense',   'direct_expense',  'wastage',          NULL),
    ('5220','Packing Material',             '5200',false, 'expense',   'direct_expense',  NULL,               NULL),
    ('5230','Hub Labour & Loading',         '5200',false, 'expense',   'direct_expense',  NULL,               NULL),
    ('5300','Indirect Expenses',            '5000',true,  'expense',   NULL,              NULL,               NULL),
    ('5310','Salaries & Wages',             '5300',false, 'expense',   'indirect_expense','salaries',         NULL),
    ('5320','Rent',                         '5300',false, 'expense',   'indirect_expense',NULL,               NULL),
    ('5330','Electricity & Utilities',      '5300',false, 'expense',   'indirect_expense',NULL,               NULL),
    ('5340','Fuel & Vehicle Running',       '5300',false, 'expense',   'indirect_expense',NULL,               NULL),
    ('5350','Bank Charges',                 '5300',false, 'expense',   'indirect_expense','bank_charges',     NULL),
    ('5360','Discount Allowed',             '5300',false, 'expense',   'indirect_expense','discount_allowed', NULL),
    ('5370','Office & Admin Expenses',      '5300',false, 'expense',   'indirect_expense',NULL,               NULL),
    ('5390','Round Off',                    '5300',false, 'expense',   'round_off',       'round_off',        NULL)
  ) AS t(code, name, parent_code, is_group, root_type, account_type, system_key, gst_component)
  LOOP
    INSERT INTO public.acct_accounts (code, name, parent_id, is_group, root_type, account_type, system_key, gst_component)
    VALUES (r.code, r.name,
            (SELECT id FROM public.acct_accounts WHERE code = r.parent_code),
            r.is_group, r.root_type, r.account_type, r.system_key, r.gst_component)
    ON CONFLICT (code) DO NOTHING;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS acct_accounts_guard_trg ON public.acct_accounts;
CREATE TRIGGER acct_accounts_guard_trg BEFORE INSERT OR UPDATE ON public.acct_accounts
  FOR EACH ROW EXECUTE FUNCTION public.acct_accounts_guard();

-- ── 4. Vouchers + lines ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.acct_voucher_series (
  prefix          text NOT NULL,
  fiscal_year_id  uuid NOT NULL REFERENCES public.acct_fiscal_years(id),
  last_no         int  NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, fiscal_year_id)
);

CREATE TABLE IF NOT EXISTS public.acct_vouchers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_no      text NOT NULL UNIQUE,
  voucher_type    text NOT NULL CHECK (voucher_type IN ('journal','sales_invoice','receipt','purchase',
                    'payment','credit_note','debit_note','wastage','contra','opening','reversal',
                    'period_closing')),
  posting_date    date NOT NULL,
  fiscal_year_id  uuid REFERENCES public.acct_fiscal_years(id),
  hub_id          uuid REFERENCES public.hubs(id),
  party_type      text CHECK (party_type IN ('customer','vendor','driver','employee','other')),
  party_id        uuid,
  party_name      text,
  reference_no    text,                          -- invoice no / UTR / bill no
  narration       text,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','pending_approval','posted','cancelled')),
  is_opening      boolean NOT NULL DEFAULT false,
  is_auto         boolean NOT NULL DEFAULT false, -- created by an auto-posting trigger
  source_table    text,                          -- e.g. 'invoices', 'ff_vendor_payments'
  source_id       uuid,
  total_debit     numeric(14,2) NOT NULL DEFAULT 0,
  total_credit    numeric(14,2) NOT NULL DEFAULT 0,
  reversal_of     uuid REFERENCES public.acct_vouchers(id),
  reversed_by     uuid REFERENCES public.acct_vouchers(id),
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  submitted_at    timestamptz,
  approved_by     uuid,
  approved_at     timestamptz,
  posted_by       uuid,
  posted_at       timestamptz,
  cancelled_by    uuid,
  cancelled_at    timestamptz,
  cancel_reason   text
);
CREATE INDEX IF NOT EXISTS acct_vouchers_date_idx   ON public.acct_vouchers(posting_date);
CREATE INDEX IF NOT EXISTS acct_vouchers_status_idx ON public.acct_vouchers(status);
CREATE INDEX IF NOT EXISTS acct_vouchers_party_idx  ON public.acct_vouchers(party_type, party_id);
CREATE INDEX IF NOT EXISTS acct_vouchers_source_idx ON public.acct_vouchers(source_table, source_id);
-- one live auto-posting per source document + type (makes back-posting and triggers idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS acct_vouchers_source_uniq
  ON public.acct_vouchers(source_table, source_id, voucher_type)
  WHERE source_table IS NOT NULL AND reversal_of IS NULL AND reversed_by IS NULL AND status <> 'cancelled';

CREATE TABLE IF NOT EXISTS public.acct_voucher_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id     uuid NOT NULL REFERENCES public.acct_vouchers(id) ON DELETE CASCADE,
  line_no        int  NOT NULL,
  account_id     uuid NOT NULL REFERENCES public.acct_accounts(id),
  debit          numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit  >= 0),
  credit         numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  hub_id         uuid REFERENCES public.hubs(id), -- cost centre
  party_type     text CHECK (party_type IN ('customer','vendor','driver','employee','other')),
  party_id       uuid,
  party_name     text,
  remarks        text,
  gst_rate       numeric(5,2),
  taxable_value  numeric(14,2),
  hsn_code       text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (debit = 0 OR credit = 0),
  CHECK (debit > 0 OR credit > 0)
);
CREATE INDEX IF NOT EXISTS acct_lines_voucher_idx ON public.acct_voucher_lines(voucher_id);
CREATE INDEX IF NOT EXISTS acct_lines_account_idx ON public.acct_voucher_lines(account_id);
CREATE INDEX IF NOT EXISTS acct_lines_party_idx   ON public.acct_voucher_lines(party_type, party_id);
CREATE INDEX IF NOT EXISTS acct_lines_hub_idx     ON public.acct_voucher_lines(hub_id);

CREATE TABLE IF NOT EXISTS public.acct_posting_errors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table  text NOT NULL,
  source_id     uuid,
  voucher_type  text,
  error_message text NOT NULL,
  payload       jsonb,
  resolved      boolean NOT NULL DEFAULT false,
  resolved_by   uuid,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acct_posting_errors_open_idx ON public.acct_posting_errors(resolved, created_at);

-- ── 5. Immutability guards ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.acct_vouchers_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('posted','cancelled') THEN
      RAISE EXCEPTION 'Voucher % is %; it cannot be deleted (reverse it instead)', OLD.voucher_no, OLD.status;
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'posted' THEN
    -- the only change allowed on a posted voucher is linking the reversal that cancels it
    IF (to_jsonb(NEW) - 'reversed_by') IS DISTINCT FROM (to_jsonb(OLD) - 'reversed_by') THEN
      RAISE EXCEPTION 'Voucher % is posted and cannot be edited (reverse it instead)', OLD.voucher_no;
    END IF;
  ELSIF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Voucher % is cancelled and cannot be edited', OLD.voucher_no;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS acct_vouchers_guard_trg ON public.acct_vouchers;
CREATE TRIGGER acct_vouchers_guard_trg BEFORE UPDATE OR DELETE ON public.acct_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.acct_vouchers_guard();

CREATE OR REPLACE FUNCTION public.acct_lines_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_status text; v_id uuid;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.voucher_id ELSE NEW.voucher_id END;
  SELECT status INTO v_status FROM public.acct_vouchers WHERE id = v_id;
  IF v_status IN ('posted','cancelled') THEN          -- NULL (parent being deleted) is allowed
    RAISE EXCEPTION 'Lines of a % voucher cannot be changed', v_status;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS acct_lines_guard_trg ON public.acct_voucher_lines;
CREATE TRIGGER acct_lines_guard_trg BEFORE INSERT OR UPDATE OR DELETE ON public.acct_voucher_lines
  FOR EACH ROW EXECUTE FUNCTION public.acct_lines_guard();

-- ── 6. Numbering ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.acct__fiscal_year_for(p_date date) RETURNS public.acct_fiscal_years
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.acct_fiscal_years WHERE p_date BETWEEN start_date AND end_date LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.acct__next_voucher_no(p_type text, p_date date) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  fy public.acct_fiscal_years; v_prefix text; v_no int;
BEGIN
  fy := public.acct__fiscal_year_for(p_date);
  IF fy.id IS NULL THEN RAISE EXCEPTION 'No fiscal year covers %', p_date; END IF;
  v_prefix := CASE p_type
    WHEN 'journal' THEN 'JV'  WHEN 'sales_invoice' THEN 'SV' WHEN 'receipt' THEN 'RV'
    WHEN 'purchase' THEN 'PV' WHEN 'payment' THEN 'PY'       WHEN 'credit_note' THEN 'CN'
    WHEN 'debit_note' THEN 'DN' WHEN 'wastage' THEN 'WS'     WHEN 'contra' THEN 'CT'
    WHEN 'opening' THEN 'OB'  WHEN 'reversal' THEN 'RX'      WHEN 'period_closing' THEN 'PC'
    ELSE 'XX' END;
  INSERT INTO public.acct_voucher_series (prefix, fiscal_year_id, last_no) VALUES (v_prefix, fy.id, 1)
  ON CONFLICT (prefix, fiscal_year_id) DO UPDATE SET last_no = acct_voucher_series.last_no + 1
  RETURNING last_no INTO v_no;
  RETURN v_prefix || '/' || fy.short_code || '/' || lpad(v_no::text, 5, '0');
END $$;

-- ── 7. Internal create / post (no role check — called by the public wrappers and triggers) ─────
-- p: { voucher_type, posting_date, hub_id, party_type, party_id, party_name, reference_no,
--      narration, source_table, source_id, is_opening, is_auto, reversal_of,
--      lines: [ { account_id | account_code | system_key, debit, credit, hub_id, party_type,
--                 party_id, party_name, remarks, gst_rate, taxable_value, hsn_code } ] }
CREATE OR REPLACE FUNCTION public.acct__insert_voucher(p jsonb, p_user uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid; v_date date; v_type text; l jsonb; v_acc uuid; n int := 0; fy public.acct_fiscal_years;
BEGIN
  v_type := p->>'voucher_type';
  v_date := coalesce((p->>'posting_date')::date, current_date);
  fy := public.acct__fiscal_year_for(v_date);
  IF jsonb_typeof(p->'lines') <> 'array' OR jsonb_array_length(p->'lines') < 2 THEN
    RAISE EXCEPTION 'A voucher needs at least two lines';
  END IF;

  INSERT INTO public.acct_vouchers (voucher_no, voucher_type, posting_date, fiscal_year_id, hub_id,
    party_type, party_id, party_name, reference_no, narration, is_opening, is_auto,
    source_table, source_id, reversal_of, created_by)
  VALUES (public.acct__next_voucher_no(v_type, v_date), v_type, v_date, fy.id,
    nullif(p->>'hub_id','')::uuid, nullif(p->>'party_type',''), nullif(p->>'party_id','')::uuid,
    p->>'party_name', p->>'reference_no', p->>'narration',
    coalesce((p->>'is_opening')::boolean, v_type = 'opening'), coalesce((p->>'is_auto')::boolean, false),
    p->>'source_table', nullif(p->>'source_id','')::uuid, nullif(p->>'reversal_of','')::uuid, p_user)
  RETURNING id INTO v_id;

  FOR l IN SELECT * FROM jsonb_array_elements(p->'lines') LOOP
    -- skip zero lines (e.g. GST components that are 0 on exempt produce)
    CONTINUE WHEN coalesce((l->>'debit')::numeric, 0) = 0 AND coalesce((l->>'credit')::numeric, 0) = 0;
    v_acc := coalesce(nullif(l->>'account_id','')::uuid,
                      (SELECT id FROM public.acct_accounts WHERE code = l->>'account_code'),
                      (SELECT id FROM public.acct_accounts WHERE system_key = l->>'system_key'));
    IF v_acc IS NULL THEN
      RAISE EXCEPTION 'Unknown account in line % (%)', n + 1,
        coalesce(l->>'account_id', l->>'account_code', l->>'system_key', 'none given');
    END IF;
    n := n + 1;
    INSERT INTO public.acct_voucher_lines (voucher_id, line_no, account_id, debit, credit, hub_id,
      party_type, party_id, party_name, remarks, gst_rate, taxable_value, hsn_code)
    VALUES (v_id, n, v_acc,
      round(coalesce((l->>'debit')::numeric, 0), 2), round(coalesce((l->>'credit')::numeric, 0), 2),
      coalesce(nullif(l->>'hub_id','')::uuid, nullif(p->>'hub_id','')::uuid),
      nullif(l->>'party_type',''), nullif(l->>'party_id','')::uuid, l->>'party_name', l->>'remarks',
      nullif(l->>'gst_rate','')::numeric, nullif(l->>'taxable_value','')::numeric, l->>'hsn_code');
  END LOOP;

  UPDATE public.acct_vouchers v SET
    total_debit  = (SELECT coalesce(sum(debit), 0)  FROM public.acct_voucher_lines WHERE voucher_id = v_id),
    total_credit = (SELECT coalesce(sum(credit), 0) FROM public.acct_voucher_lines WHERE voucher_id = v_id)
  WHERE v.id = v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.acct__post(p_id uuid, p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.acct_vouchers; s public.acct_settings; fy public.acct_fiscal_years;
  v_dr numeric; v_cr numeric; v_lines int; v_bad text;
BEGIN
  SELECT * INTO v FROM public.acct_vouchers WHERE id = p_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Voucher not found'; END IF;
  IF v.status NOT IN ('draft','pending_approval') THEN
    RAISE EXCEPTION 'Voucher % is already %', v.voucher_no, v.status;
  END IF;
  SELECT * INTO s FROM public.acct_settings WHERE id = 1;

  IF v.posting_date < s.books_start_date AND NOT v.is_opening THEN
    RAISE EXCEPTION 'Posting date % is before the books start date %', v.posting_date, s.books_start_date;
  END IF;
  IF s.lock_date IS NOT NULL AND v.posting_date <= s.lock_date THEN
    RAISE EXCEPTION 'Books are locked up to %; post this on a later date', s.lock_date;
  END IF;
  fy := public.acct__fiscal_year_for(v.posting_date);
  IF fy.id IS NULL THEN RAISE EXCEPTION 'No fiscal year covers %', v.posting_date; END IF;
  IF fy.is_closed AND v.voucher_type <> 'period_closing' THEN
    RAISE EXCEPTION '% is closed', fy.name;
  END IF;

  SELECT coalesce(sum(debit),0), coalesce(sum(credit),0), count(*) INTO v_dr, v_cr, v_lines
  FROM public.acct_voucher_lines WHERE voucher_id = p_id;
  IF v_lines < 2 THEN RAISE EXCEPTION 'A voucher needs at least two lines'; END IF;
  IF v_dr <> v_cr THEN RAISE EXCEPTION 'Voucher does not balance: debit % ≠ credit %', v_dr, v_cr; END IF;
  IF v_dr = 0 THEN RAISE EXCEPTION 'Voucher total is zero'; END IF;

  SELECT string_agg(a.code || ' ' || a.name, ', ') INTO v_bad
  FROM public.acct_voucher_lines l JOIN public.acct_accounts a ON a.id = l.account_id
  WHERE l.voucher_id = p_id AND (a.is_group OR NOT a.is_active);
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Cannot post to group or inactive account(s): %', v_bad; END IF;

  UPDATE public.acct_vouchers SET status = 'posted', total_debit = v_dr, total_credit = v_cr,
    fiscal_year_id = fy.id, posted_by = p_user, posted_at = now()
  WHERE id = p_id;
END $$;

-- Auto-posting entry point for triggers and back-posting. Never raises: failures go to
-- acct_posting_errors so the operational action (invoice, payment …) always succeeds.
-- Returns the voucher id, or NULL if skipped (already posted) or failed.
CREATE OR REPLACE FUNCTION public.acct_auto_post(p jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.acct_vouchers
             WHERE source_table = p->>'source_table' AND source_id = (p->>'source_id')::uuid
               AND voucher_type = p->>'voucher_type'
               AND reversal_of IS NULL AND reversed_by IS NULL AND status <> 'cancelled') THEN
    RETURN NULL;
  END IF;
  BEGIN
    v_id := public.acct__insert_voucher(p || '{"is_auto": true}'::jsonb, auth.uid());
    PERFORM public.acct__post(v_id, auth.uid());
    UPDATE public.acct_posting_errors SET resolved = true, resolved_at = now()
    WHERE source_table = p->>'source_table' AND source_id = (p->>'source_id')::uuid AND NOT resolved;
    RETURN v_id;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.acct_posting_errors (source_table, source_id, voucher_type, error_message, payload)
    VALUES (coalesce(p->>'source_table','?'), nullif(p->>'source_id','')::uuid, p->>'voucher_type', SQLERRM, p);
    RETURN NULL;
  END;
END $$;

-- ── 8. Public API (role-checked) ─────────────────────────────────────────────────────────────
-- Create a voucher. p_action: 'draft' | 'submit' (accounts → pending_approval, admin/ceo → posted)
--                              | 'post' (admin/ceo only)
CREATE OR REPLACE FUNCTION public.acct_create_voucher(p jsonb, p_action text DEFAULT 'submit') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.acct_can_write() THEN RAISE EXCEPTION 'Only Accounts or Admin can create vouchers'; END IF;
  IF p->>'voucher_type' IN ('reversal','period_closing') THEN
    RAISE EXCEPTION 'Use the reverse / close-year actions for % vouchers', p->>'voucher_type';
  END IF;
  v_id := public.acct__insert_voucher(p - 'source_table' - 'source_id' - 'is_auto', auth.uid());
  IF p_action = 'draft' THEN
    RETURN v_id;
  ELSIF public.acct_can_approve() AND p_action IN ('submit','post') THEN
    UPDATE public.acct_vouchers SET approved_by = auth.uid(), approved_at = now(), submitted_at = now() WHERE id = v_id;
    PERFORM public.acct__post(v_id, auth.uid());
  ELSE
    UPDATE public.acct_vouchers SET status = 'pending_approval', submitted_at = now() WHERE id = v_id;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.acct_submit_voucher(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.acct_can_write() THEN RAISE EXCEPTION 'Only Accounts or Admin can submit vouchers'; END IF;
  IF public.acct_can_approve() THEN
    UPDATE public.acct_vouchers SET approved_by = auth.uid(), approved_at = now(), submitted_at = now()
    WHERE id = p_id AND status = 'draft';
    PERFORM public.acct__post(p_id, auth.uid());
  ELSE
    UPDATE public.acct_vouchers SET status = 'pending_approval', submitted_at = now()
    WHERE id = p_id AND status = 'draft';
    IF NOT FOUND THEN RAISE EXCEPTION 'Only draft vouchers can be submitted'; END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.acct_approve_voucher(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.acct_can_approve() THEN RAISE EXCEPTION 'Only Admin or CEO can approve vouchers'; END IF;
  UPDATE public.acct_vouchers SET approved_by = auth.uid(), approved_at = now()
  WHERE id = p_id AND status = 'pending_approval';
  IF NOT FOUND THEN RAISE EXCEPTION 'Voucher is not pending approval'; END IF;
  PERFORM public.acct__post(p_id, auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.acct_reject_voucher(p_id uuid, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.acct_can_approve() OR public.acct_can_write()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF coalesce(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  UPDATE public.acct_vouchers SET status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(),
    cancel_reason = p_reason
  WHERE id = p_id AND status IN ('draft','pending_approval')
    AND (public.acct_can_approve() OR created_by = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'Only your own draft/pending vouchers can be cancelled (approvers: any pending)'; END IF;
END $$;

-- Reverse a posted voucher: new 'reversal' voucher with debit/credit swapped; original stays.
CREATE OR REPLACE FUNCTION public.acct_reverse_voucher(p_id uuid, p_reason text, p_date date DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.acct_vouchers; v_new uuid; v_lines jsonb;
BEGIN
  IF NOT public.acct_can_approve() THEN RAISE EXCEPTION 'Only Admin or CEO can reverse posted vouchers'; END IF;
  IF coalesce(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO v FROM public.acct_vouchers WHERE id = p_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Voucher not found'; END IF;
  IF v.status <> 'posted' THEN RAISE EXCEPTION 'Only posted vouchers can be reversed'; END IF;
  IF v.reversed_by IS NOT NULL THEN RAISE EXCEPTION 'Voucher % is already reversed', v.voucher_no; END IF;
  IF v.voucher_type = 'reversal' THEN RAISE EXCEPTION 'A reversal cannot itself be reversed'; END IF;

  SELECT jsonb_agg(jsonb_build_object('account_id', account_id, 'debit', credit, 'credit', debit,
           'hub_id', hub_id, 'party_type', party_type, 'party_id', party_id, 'party_name', party_name,
           'remarks', remarks, 'gst_rate', gst_rate,
           'taxable_value', CASE WHEN taxable_value IS NULL THEN NULL ELSE -taxable_value END,
           'hsn_code', hsn_code) ORDER BY line_no)
  INTO v_lines FROM public.acct_voucher_lines WHERE voucher_id = p_id;

  v_new := public.acct__insert_voucher(jsonb_build_object(
    'voucher_type', 'reversal', 'posting_date', coalesce(p_date, current_date),
    'hub_id', v.hub_id, 'party_type', v.party_type, 'party_id', v.party_id, 'party_name', v.party_name,
    'reference_no', v.voucher_no, 'narration', 'Reversal of ' || v.voucher_no || ': ' || p_reason,
    'reversal_of', v.id, 'lines', v_lines), auth.uid());
  UPDATE public.acct_vouchers SET approved_by = auth.uid(), approved_at = now() WHERE id = v_new;
  PERFORM public.acct__post(v_new, auth.uid());
  UPDATE public.acct_vouchers SET reversed_by = v_new WHERE id = p_id;
  RETURN v_new;
END $$;

-- ── 9. Ledger view + report functions ────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.acct_gl WITH (security_invoker = on) AS
SELECT l.id, l.voucher_id, v.voucher_no, v.voucher_type, v.posting_date, v.narration, v.reference_no,
       v.source_table, v.source_id, v.is_opening, v.is_auto, v.reversal_of, v.reversed_by,
       l.line_no, l.account_id, a.code AS account_code, a.name AS account_name, a.root_type,
       a.account_type, l.debit, l.credit, coalesce(l.hub_id, v.hub_id) AS hub_id,
       coalesce(l.party_type, v.party_type) AS party_type, coalesce(l.party_id, v.party_id) AS party_id,
       coalesce(l.party_name, v.party_name) AS party_name, l.remarks, l.gst_rate, l.taxable_value,
       l.hsn_code
FROM public.acct_voucher_lines l
JOIN public.acct_vouchers v ON v.id = l.voucher_id
JOIN public.acct_accounts a ON a.id = l.account_id
WHERE v.status = 'posted';

-- Trial balance per leaf account. Opening = everything before p_from (incl. opening vouchers).
CREATE OR REPLACE FUNCTION public.acct_trial_balance(p_from date, p_to date, p_hub uuid DEFAULT NULL)
RETURNS TABLE (account_id uuid, code text, name text, parent_id uuid, root_type text, account_type text,
               opening numeric, period_debit numeric, period_credit numeric, closing numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT a.id, a.code, a.name, a.parent_id, a.root_type, a.account_type,
         coalesce(sum(g.debit - g.credit) FILTER (WHERE g.posting_date < p_from), 0),
         coalesce(sum(g.debit)  FILTER (WHERE g.posting_date BETWEEN p_from AND p_to), 0),
         coalesce(sum(g.credit) FILTER (WHERE g.posting_date BETWEEN p_from AND p_to), 0),
         coalesce(sum(g.debit - g.credit) FILTER (WHERE g.posting_date <= p_to), 0)
  FROM public.acct_accounts a
  LEFT JOIN public.acct_gl g ON g.account_id = a.id AND (p_hub IS NULL OR g.hub_id = p_hub)
  WHERE NOT a.is_group
  GROUP BY a.id
  ORDER BY a.code;
$$;

-- Account (or party) ledger with running balance. Balance is debit-positive.
-- The first row is always the opening balance (line_id NULL) so it survives an empty period.
CREATE OR REPLACE FUNCTION public.acct_account_ledger(p_account uuid, p_from date, p_to date,
  p_hub uuid DEFAULT NULL, p_party_type text DEFAULT NULL, p_party uuid DEFAULT NULL)
RETURNS TABLE (line_id uuid, voucher_id uuid, line_no int, voucher_no text, voucher_type text,
               posting_date date, narration text, reference_no text, party_name text, account_code text,
               account_name text, hub_id uuid, debit numeric, credit numeric, balance numeric, opening numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH f AS (
    SELECT * FROM public.acct_gl g
    WHERE (p_account IS NULL OR g.account_id = p_account)
      AND (p_hub IS NULL OR g.hub_id = p_hub)
      AND (p_party_type IS NULL OR g.party_type = p_party_type)
      AND (p_party IS NULL OR g.party_id = p_party)
      AND g.posting_date <= p_to
  ), ob AS (SELECT coalesce(sum(debit - credit), 0) AS amt FROM f WHERE posting_date < p_from)
  SELECT * FROM (
    SELECT NULL::uuid AS line_id, NULL::uuid AS voucher_id, 0 AS line_no, NULL::text AS voucher_no,
           'opening_balance'::text AS voucher_type, p_from AS posting_date, 'Opening balance'::text AS narration,
           NULL::text AS reference_no, NULL::text AS party_name, NULL::text AS account_code,
           NULL::text AS account_name, NULL::uuid AS hub_id, 0::numeric AS debit, 0::numeric AS credit,
           ob.amt AS balance, ob.amt AS opening
    FROM ob
    UNION ALL
    SELECT f.id, f.voucher_id, f.line_no, f.voucher_no, f.voucher_type, f.posting_date, f.narration,
           f.reference_no, f.party_name, f.account_code, f.account_name, f.hub_id, f.debit, f.credit,
           ob.amt + sum(f.debit - f.credit) OVER (ORDER BY f.posting_date, f.voucher_no, f.line_no
                                                  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
           ob.amt
    FROM f, ob
    WHERE f.posting_date >= p_from
  ) x
  ORDER BY (x.line_id IS NOT NULL), x.posting_date, x.voucher_no, x.line_no;
$$;

-- Receivable / payable ageing as of a date. Outstanding is matched to the most recent
-- bills first (FIFO settlement), then bucketed by bill age.
CREATE OR REPLACE FUNCTION public.acct_party_ageing(p_kind text, p_as_of date DEFAULT current_date)
RETURNS TABLE (party_type text, party_id uuid, party_name text, outstanding numeric,
               d0_30 numeric, d31_60 numeric, d61_90 numeric, d90_plus numeric, last_txn date)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH g AS (
    SELECT g.party_type, g.party_id, g.party_name, g.posting_date,
           CASE WHEN p_kind = 'receivable' THEN g.debit - g.credit ELSE g.credit - g.debit END AS amt
    FROM public.acct_gl g
    -- customers net debtors against customer advances; vendors/transporters net creditors
    -- against vendor advances — so split by party type, not by which side the account sits on
    WHERE g.account_type IN ('receivable','payable')
      AND ((p_kind = 'receivable' AND g.party_type = 'customer')
        OR (p_kind = 'payable'    AND g.party_type IN ('vendor','driver')))
      AND g.party_id IS NOT NULL AND g.posting_date <= p_as_of
  ), bal AS (
    SELECT party_type, party_id, max(party_name) AS party_name, sum(amt) AS outstanding, max(posting_date) AS last_txn
    FROM g GROUP BY party_type, party_id HAVING sum(amt) > 0.009
  ), bills AS (                                   -- positive movements = bills, newest first
    SELECT g.party_type, g.party_id, g.posting_date, g.amt,
           sum(g.amt) OVER (PARTITION BY g.party_type, g.party_id ORDER BY g.posting_date DESC
                            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running
    FROM g WHERE g.amt > 0
  ), alloc AS (
    SELECT b.party_type, b.party_id, (p_as_of - b.posting_date) AS age,
           greatest(0, least(b.amt, bal.outstanding - (b.running - b.amt))) AS open_amt
    FROM bills b JOIN bal USING (party_type, party_id)
  )
  SELECT bal.party_type, bal.party_id, bal.party_name, round(bal.outstanding, 2),
         round(coalesce(sum(open_amt) FILTER (WHERE age <= 30), 0), 2),
         round(coalesce(sum(open_amt) FILTER (WHERE age BETWEEN 31 AND 60), 0), 2),
         round(coalesce(sum(open_amt) FILTER (WHERE age BETWEEN 61 AND 90), 0), 2),
         round(coalesce(sum(open_amt) FILTER (WHERE age > 90), 0), 2),
         bal.last_txn
  FROM bal LEFT JOIN alloc USING (party_type, party_id)
  GROUP BY bal.party_type, bal.party_id, bal.party_name, bal.outstanding, bal.last_txn
  ORDER BY bal.outstanding DESC;
$$;

-- ── 10. RLS ──────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.acct_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acct_fiscal_years    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acct_accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acct_voucher_series  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acct_vouchers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acct_voucher_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acct_posting_errors  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['acct_settings','acct_fiscal_years','acct_accounts','acct_voucher_series',
                           'acct_vouchers','acct_voucher_lines','acct_posting_errors'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (public.acct_can_read())', t || '_read', t);
  END LOOP;
END $$;

-- direct writes: master data only. Vouchers/lines are written through the functions above
-- (SECURITY DEFINER), so no INSERT/UPDATE/DELETE policy is granted on them.
DROP POLICY IF EXISTS acct_accounts_write ON public.acct_accounts;
CREATE POLICY acct_accounts_write ON public.acct_accounts FOR ALL
  USING (public.acct_can_write()) WITH CHECK (public.acct_can_write());

DROP POLICY IF EXISTS acct_settings_write ON public.acct_settings;
CREATE POLICY acct_settings_write ON public.acct_settings FOR UPDATE
  USING (public.acct_can_approve()) WITH CHECK (public.acct_can_approve());

DROP POLICY IF EXISTS acct_fiscal_years_write ON public.acct_fiscal_years;
CREATE POLICY acct_fiscal_years_write ON public.acct_fiscal_years FOR ALL
  USING (public.acct_can_approve()) WITH CHECK (public.acct_can_approve());

DROP POLICY IF EXISTS acct_posting_errors_write ON public.acct_posting_errors;
CREATE POLICY acct_posting_errors_write ON public.acct_posting_errors FOR UPDATE
  USING (public.acct_can_write()) WITH CHECK (public.acct_can_write());

-- internal helpers are not callable from the client
REVOKE EXECUTE ON FUNCTION public.acct__insert_voucher(jsonb, uuid)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct__post(uuid, uuid)              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct__next_voucher_no(text, date)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_auto_post(jsonb)               FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.acct_create_voucher(jsonb, text)    TO authenticated;
GRANT  EXECUTE ON FUNCTION public.acct_submit_voucher(uuid)           TO authenticated;
GRANT  EXECUTE ON FUNCTION public.acct_approve_voucher(uuid)          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.acct_reject_voucher(uuid, text)     TO authenticated;
GRANT  EXECUTE ON FUNCTION public.acct_reverse_voucher(uuid, text, date) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.acct_trial_balance(date, date, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.acct_account_ledger(uuid, date, date, uuid, text, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.acct_party_ageing(text, date)       TO authenticated;

-- ── 11. Verify (paste this result back) ──────────────────────────────────────────────────────
SELECT 'tables'   AS what, count(*)::text AS value FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE 'acct\_%'
UNION ALL SELECT 'accounts (leaf / group)',
  (SELECT count(*) FILTER (WHERE NOT is_group) || ' / ' || count(*) FILTER (WHERE is_group) FROM public.acct_accounts)
UNION ALL SELECT 'system keys', (SELECT count(*)::text FROM public.acct_accounts WHERE system_key IS NOT NULL)
UNION ALL SELECT 'fiscal years', (SELECT string_agg(name || ' ' || start_date || '→' || end_date, ', ') FROM public.acct_fiscal_years)
UNION ALL SELECT 'books start', (SELECT books_start_date::text FROM public.acct_settings)
UNION ALL SELECT 'functions', (SELECT count(*)::text FROM pg_proc WHERE proname LIKE 'acct%' AND pronamespace = 'public'::regnamespace)
UNION ALL SELECT 'policies', (SELECT count(*)::text FROM pg_policies WHERE tablename LIKE 'acct\_%');
