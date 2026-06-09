-- FIX: Task Assignment RLS for GMO, SMO, and BOI
-- Also fix notifications constraint to allow task comments and progress

-- 1. Update Task Assignments RLS
DROP POLICY IF EXISTS "Admin/CEO/GM can create tasks" ON public.task_assignments;
CREATE POLICY "Management roles can create tasks" 
ON public.task_assignments 
FOR INSERT 
WITH CHECK (
  assigned_by = (SELECT auth.uid()) 
  AND lower(get_my_role()) IN ('admin', 'ceo', 'gm', 'gmo', 'smo', 'boi')
);

DROP POLICY IF EXISTS "Users can view relevant task assignments" ON public.task_assignments;
CREATE POLICY "Users can view relevant task assignments" 
ON public.task_assignments 
FOR SELECT 
USING (
  assigned_to = (SELECT auth.uid()) 
  OR assigned_by = (SELECT auth.uid()) 
  OR lower(get_my_role()) IN ('admin', 'ceo', 'gm', 'gmo', 'smo', 'boi')
);

-- 2. Update Notifications Type Check Constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IS NULL OR type IN (
  'lop_reversal_progress', 'lop_reversal_rejected', 'lop_reversal_approved',
  'lop_approved', 'lop_rejected', 'late_submission', 
  'payment_paid', 'payment_approved', 'payment_rejected', 'payment_hold',
  'task_assigned', 'task_comment', 'task_progress', 'eod_submitted', 
  'material', 'material_request', 'leave_request', 'escalation', 'critical', 'general', 
  'attendance', 'mention', 'reminder', 
  'compliance_report', 'selfie_compliance', 'absent_alert', 'critical_blast'
));

-- 3. Ensure Task Comments RLS allows relevant parties
DROP POLICY IF EXISTS "Users can view relevant task comments" ON public.task_comments;
CREATE POLICY "Users can view relevant task comments" 
ON public.task_comments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.task_assignments ta 
    WHERE ta.id = task_id 
    AND (
      ta.assigned_to = (SELECT auth.uid()) 
      OR ta.assigned_by = (SELECT auth.uid()) 
      OR lower(get_my_role()) IN ('admin', 'ceo', 'gm', 'gmo', 'smo', 'boi')
    )
  )
);

DROP POLICY IF EXISTS "Users can insert task comments" ON public.task_comments;
CREATE POLICY "Users can insert task comments" 
ON public.task_comments 
FOR INSERT 
WITH CHECK (
  user_id = (SELECT auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.task_assignments ta 
    WHERE ta.id = task_id 
    AND (
      ta.assigned_to = (SELECT auth.uid()) 
      OR ta.assigned_by = (SELECT auth.uid()) 
      OR lower(get_my_role()) IN ('admin', 'ceo', 'gm', 'gmo', 'smo', 'boi')
    )
  )
);
