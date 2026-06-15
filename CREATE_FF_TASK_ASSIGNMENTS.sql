-- Run in Supabase Dashboard → SQL Editor
-- Creates ff_task_assignments table for FF daily task & target assignment

CREATE TABLE IF NOT EXISTS public.ff_task_assignments (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assigned_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_date      date NOT NULL DEFAULT CURRENT_DATE,
  order_target   integer NOT NULL DEFAULT 0,
  amount_target  numeric(12,2) NOT NULL DEFAULT 0,
  area_assigned  text,
  task_notes     text,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','in_progress','completed','missed')),
  completed_orders integer DEFAULT 0,
  completed_amount numeric(12,2) DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE (assigned_to, task_date)
);

-- Enable RLS
ALTER TABLE public.ff_task_assignments ENABLE ROW LEVEL SECURITY;

-- FF Ops Manager / Admin can read & write all
CREATE POLICY IF NOT EXISTS "ff_task_all_ops"
ON public.ff_task_assignments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('ff_operations_manager','admin','ceo','gm','l1_manager')
  )
);

-- Employees can read their own
CREATE POLICY IF NOT EXISTS "ff_task_own_read"
ON public.ff_task_assignments FOR SELECT
USING (assigned_to = auth.uid());

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS ff_task_date_idx ON public.ff_task_assignments (task_date);
CREATE INDEX IF NOT EXISTS ff_task_assignee_idx ON public.ff_task_assignments (assigned_to, task_date);

RAISE NOTICE 'ff_task_assignments table ready';
