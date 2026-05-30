-- ============================================================
--  FFERPv2 — Project Management Tables
--  Migration: 20260529_002_project_management.sql
-- ============================================================

-- ── 1. PROJECTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                      text UNIQUE NOT NULL,
  project_name                    text NOT NULL,
  client_name                     text NOT NULL,
  status                          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_hold','completed','cancelled')),
  lifecycle_stage                 text DEFAULT 'new_deal',
  intake_status                   text DEFAULT 'pending_admin_review',
  vertical                        text,
  vertical_id                     uuid,
  department                      text,
  project_type                    text,
  project_vertical                text,
  project_category                text,
  project_category_tags           text[],
  location_city                   text,
  location_state                  text,
  location_address                text,
  contract_value                  numeric(15,2) DEFAULT 0,
  base_contract_value             numeric(15,2) DEFAULT 0,
  estimated_start_date            date,
  estimated_end_date              date,
  actual_start_date               date,
  actual_end_date                 date,
  assigned_engineer_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_site_manager_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_manager_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_project_engineer_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by                      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_by_bd_data_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_reviewed_by               uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_reviewed_at               timestamptz,
  onboarded_date                  date,
  stage_new_deal_at               timestamptz,
  stage_engineering_assigned_at   timestamptz,
  stage_boq_submitted_at          timestamptz,
  stage_boq_approved_at           timestamptz,
  stage_sourcing_at               timestamptz,
  stage_execution_at              timestamptz,
  stage_completed_at              timestamptz,
  boq_rejection_reason            text,
  notes                           text,
  created_at                      timestamptz DEFAULT now(),
  updated_at                      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_lifecycle ON public.projects(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_projects_intake ON public.projects(intake_status);
CREATE INDEX IF NOT EXISTS idx_projects_engineer ON public.projects(assigned_engineer_id);
CREATE INDEX IF NOT EXISTS idx_projects_manager ON public.projects(assigned_manager_id);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view projects" ON public.projects;
CREATE POLICY "All staff view projects" ON public.projects
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage projects" ON public.projects;
CREATE POLICY "Admin manage projects" ON public.projects
  FOR ALL USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','director'));
DROP POLICY IF EXISTS "Engineers can insert projects" ON public.projects;
CREATE POLICY "Engineers can insert projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Engineers update assigned projects" ON public.projects;
CREATE POLICY "Engineers update assigned projects" ON public.projects
  FOR UPDATE USING (
    assigned_engineer_id = auth.uid()
    OR assigned_site_manager_id = auth.uid()
    OR assigned_manager_id = auth.uid()
    OR get_my_role() IN ('admin','ceo','gm','gmo','smo','director')
  );
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 2. PROJECT PHASES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_phases (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_name            text NOT NULL,
  description           text,
  phase_order           integer NOT NULL DEFAULT 1,
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','on_hold')),
  estimated_cost        numeric(15,2) DEFAULT 0,
  actual_cost           numeric(15,2) DEFAULT 0,
  completion_percentage integer DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
  started_at            timestamptz,
  completed_at          timestamptz,
  created_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_phases_project ON public.project_phases(project_id);
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view phases" ON public.project_phases;
CREATE POLICY "All staff view phases" ON public.project_phases
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage phases" ON public.project_phases;
CREATE POLICY "Admin manage phases" ON public.project_phases
  FOR ALL USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','engineer','site_manager','director'));
CREATE TRIGGER project_phases_updated_at BEFORE UPDATE ON public.project_phases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 3. PROJECT BOQ (Bill of Quantities) ──────────────────────
CREATE TABLE IF NOT EXISTS public.project_boq (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id            uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  line_number         integer NOT NULL DEFAULT 1,
  material_name       text NOT NULL,
  specification       text,
  quantity            numeric(12,3) NOT NULL DEFAULT 0,
  unit                text NOT NULL DEFAULT 'nos',
  estimated_unit_cost numeric(12,2),
  actual_unit_cost    numeric(12,2),
  actual_total        numeric(15,2) GENERATED ALWAYS AS (COALESCE(actual_unit_cost,0) * quantity) STORED,
  category            text NOT NULL DEFAULT 'material' CHECK (category IN ('material','labour','equipment')),
  sourced_via         text CHECK (sourced_via IN ('po','wo')),
  linked_po_id        uuid,
  linked_wo_id        uuid,
  status              text NOT NULL DEFAULT 'pending',
  notes               text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_boq_project ON public.project_boq(project_id);
CREATE INDEX IF NOT EXISTS idx_project_boq_phase ON public.project_boq(phase_id);
ALTER TABLE public.project_boq ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view boq" ON public.project_boq;
CREATE POLICY "All staff view boq" ON public.project_boq
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Engineers manage boq" ON public.project_boq;
CREATE POLICY "Engineers manage boq" ON public.project_boq
  FOR ALL USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','engineer','site_manager','director','purchase_head','purchase_manager'));
CREATE TRIGGER project_boq_updated_at BEFORE UPDATE ON public.project_boq FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 4. PROJECT TIMELINE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_timeline (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  title       text NOT NULL,
  description text,
  metadata    jsonb DEFAULT '{}',
  event_date  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_timeline_project ON public.project_timeline(project_id);
CREATE INDEX IF NOT EXISTS idx_project_timeline_date ON public.project_timeline(event_date);
ALTER TABLE public.project_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view timeline" ON public.project_timeline;
CREATE POLICY "All staff view timeline" ON public.project_timeline
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Staff create timeline events" ON public.project_timeline;
CREATE POLICY "Staff create timeline events" ON public.project_timeline
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin delete timeline" ON public.project_timeline;
CREATE POLICY "Admin delete timeline" ON public.project_timeline
  FOR DELETE USING (get_my_role() IN ('admin','ceo'));

-- ── 5. PROJECT VARIATIONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_variations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type        text NOT NULL DEFAULT 'addition' CHECK (type IN ('addition','deduction')),
  amount      numeric(15,2) NOT NULL DEFAULT 0,
  category    text NOT NULL,
  description text NOT NULL,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_variations_project ON public.project_variations(project_id);
ALTER TABLE public.project_variations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view variations" ON public.project_variations;
CREATE POLICY "All staff view variations" ON public.project_variations
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage variations" ON public.project_variations;
CREATE POLICY "Admin manage variations" ON public.project_variations
  FOR ALL USING (get_my_role() IN ('admin','ceo','gm','gmo','director'));
CREATE TRIGGER project_variations_updated_at BEFORE UPDATE ON public.project_variations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 6. PROJECT INVENTORY ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_inventory (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id            uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  material_request_id uuid,
  material_name       text NOT NULL,
  specification       text,
  unit                text NOT NULL DEFAULT 'nos',
  quantity_received   numeric(12,3) NOT NULL DEFAULT 0,
  quantity_used       numeric(12,3) NOT NULL DEFAULT 0,
  unit_price          numeric(12,2),
  audit_status        text NOT NULL DEFAULT 'pending' CHECK (audit_status IN ('pending','verified','discrepancy')),
  audited_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  audited_at          timestamptz,
  audit_notes         text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_inventory_project ON public.project_inventory(project_id);
CREATE INDEX IF NOT EXISTS idx_project_inventory_phase ON public.project_inventory(phase_id);
ALTER TABLE public.project_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view project_inventory" ON public.project_inventory;
CREATE POLICY "All staff view project_inventory" ON public.project_inventory
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Engineers manage project_inventory" ON public.project_inventory;
CREATE POLICY "Engineers manage project_inventory" ON public.project_inventory
  FOR ALL USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','engineer','site_manager','director'));
CREATE TRIGGER project_inventory_updated_at BEFORE UPDATE ON public.project_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 7. PROCUREMENT TIMELINE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.procurement_timeline (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('material_request','purchase_order','work_order','payment')),
  entity_id   uuid NOT NULL,
  stage       text NOT NULL,
  status      text NOT NULL DEFAULT 'pending',
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes       text,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_procurement_timeline_project ON public.procurement_timeline(project_id);
CREATE INDEX IF NOT EXISTS idx_procurement_timeline_entity ON public.procurement_timeline(entity_id);
ALTER TABLE public.procurement_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view procurement timeline" ON public.procurement_timeline;
CREATE POLICY "All staff view procurement timeline" ON public.procurement_timeline
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage procurement timeline" ON public.procurement_timeline;
CREATE POLICY "Admin manage procurement timeline" ON public.procurement_timeline
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ── 8. WORK ORDERS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number         text UNIQUE NOT NULL DEFAULT ('WO-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  project_id        uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  work_description  text NOT NULL,
  vendor_id         uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  requester_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount            numeric(15,2) DEFAULT 0,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','smo_approved','gmo_approved','gm_approved','admin_approved','ceo_approved','rejected','completed')),
  smo_approved_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  smo_approved_at   timestamptz,
  gmo_approved_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gmo_approved_at   timestamptz,
  gm_approved_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gm_approved_at    timestamptz,
  admin_approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_approved_at timestamptz,
  ceo_approved_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ceo_approved_at   timestamptz,
  rejection_reason  text,
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_orders_project ON public.work_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON public.work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_requester ON public.work_orders(requester_id);
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view work_orders" ON public.work_orders;
CREATE POLICY "All staff view work_orders" ON public.work_orders
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated create work_orders" ON public.work_orders;
CREATE POLICY "Authenticated create work_orders" ON public.work_orders
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage work_orders" ON public.work_orders;
CREATE POLICY "Admin manage work_orders" ON public.work_orders
  FOR UPDATE USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','director') OR requester_id = auth.uid());
CREATE TRIGGER work_orders_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
