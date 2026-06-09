-- Flexible Shift-Based Work Tracking Schema
-- Created: 2026-01-30
-- Purpose: Enable time-flexible but discipline-driven tracking for shift workers

-- ============================================
-- 1. SHIFT USER ASSIGNMENTS TABLE
-- ============================================
-- Tracks which users are assigned to flexible shift mode
-- Only Super Admin/CEO can assign users

CREATE TABLE IF NOT EXISTS public.shift_user_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_hours DECIMAL(3,1) NOT NULL DEFAULT 9.0 CHECK (target_hours >= 6 AND target_hours <= 12),
    max_hours DECIMAL(3,1) NOT NULL DEFAULT 12.0, -- Overtime cap
    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id) -- One assignment per user
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_shift_assignments_user_id ON public.shift_user_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_active ON public.shift_user_assignments(is_active) WHERE is_active = true;

-- ============================================
-- 2. SHIFT ASSIGNMENT HISTORY TABLE
-- ============================================
-- Tracks all changes to shift assignments (add/remove/toggle/update)

CREATE TABLE IF NOT EXISTS public.shift_assignment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES public.shift_user_assignments(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('assigned', 'activated', 'deactivated', 'target_hours_updated', 'removed')),
    performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_history_user_id ON public.shift_assignment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_history_created ON public.shift_assignment_history(created_at DESC);

-- ============================================
-- 3. SHIFT SESSIONS TABLE
-- ============================================
-- Tracks daily shift login/logout with selfie and location

CREATE TABLE IF NOT EXISTS public.shift_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    shift_end TIMESTAMPTZ,
    login_selfie_url TEXT NOT NULL,
    logout_selfie_url TEXT,
    login_location JSONB, -- { lat: number, lng: number }
    logout_location JSONB,
    target_hours DECIMAL(3,1) NOT NULL DEFAULT 9.0,
    max_hours DECIMAL(3,1) NOT NULL DEFAULT 12.0,
    total_break_minutes INTEGER NOT NULL DEFAULT 0,
    net_working_minutes INTEGER, -- Calculated on logout
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'incomplete')),
    day_plan TEXT, -- Initial plan for the day
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, date) -- One session per user per day
);

CREATE INDEX IF NOT EXISTS idx_shift_sessions_user_date ON public.shift_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_status ON public.shift_sessions(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_shift_sessions_date ON public.shift_sessions(date DESC);

-- ============================================
-- 4. SHIFT BREAKS TABLE
-- ============================================
-- Tracks break periods within a shift session

CREATE TABLE IF NOT EXISTS public.shift_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
    break_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    break_end TIMESTAMPTZ,
    duration_minutes INTEGER, -- Calculated when break ends
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_breaks_session ON public.shift_breaks(session_id);

-- ============================================
-- 5. SHIFT HOURLY SLOTS TABLE
-- ============================================
-- Rolling hourly plans and reports (not clock-based)

CREATE TABLE IF NOT EXISTS public.shift_hourly_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
    slot_number INTEGER NOT NULL CHECK (slot_number >= 1 AND slot_number <= 15),
    slot_start TIMESTAMPTZ NOT NULL,
    slot_end TIMESTAMPTZ,
    plan TEXT,
    plan_submitted_at TIMESTAMPTZ,
    report TEXT,
    report_submitted_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'plan_submitted', 'report_submitted', 'missed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, slot_number)
);

CREATE INDEX IF NOT EXISTS idx_shift_slots_session ON public.shift_hourly_slots(session_id);
CREATE INDEX IF NOT EXISTS idx_shift_slots_status ON public.shift_hourly_slots(status);

-- ============================================
-- 6. SHIFT EOD REPORTS TABLE
-- ============================================
-- End of Day summary (mandatory before logout)

CREATE TABLE IF NOT EXISTS public.shift_eod_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
    planned_vs_completed INTEGER NOT NULL DEFAULT 0 CHECK (planned_vs_completed >= 0 AND planned_vs_completed <= 100),
    pending_tasks TEXT,
    issues_faced TEXT,
    self_score INTEGER NOT NULL DEFAULT 70 CHECK (self_score >= 0 AND self_score <= 100),
    notes TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_eod_session ON public.shift_eod_reports(session_id);

-- ============================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.shift_user_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_hourly_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_eod_reports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. RLS POLICIES - SHIFT USER ASSIGNMENTS
-- ============================================

-- Admins and CEO can view all assignments
CREATE POLICY "Admins can view all shift assignments"
ON public.shift_user_assignments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'ADMIN', 'ceo', 'CEO')
    )
);

-- Users can view their own assignment
CREATE POLICY "Users can view own shift assignment"
ON public.shift_user_assignments FOR SELECT
USING (user_id = auth.uid());

-- Only Admin/CEO can insert
CREATE POLICY "Admins can insert shift assignments"
ON public.shift_user_assignments FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'ADMIN', 'ceo', 'CEO')
    )
);

-- Only Admin/CEO can update
CREATE POLICY "Admins can update shift assignments"
ON public.shift_user_assignments FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'ADMIN', 'ceo', 'CEO')
    )
);

-- Only Admin/CEO can delete
CREATE POLICY "Admins can delete shift assignments"
ON public.shift_user_assignments FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'ADMIN', 'ceo', 'CEO')
    )
);

-- ============================================
-- 9. RLS POLICIES - ASSIGNMENT HISTORY
-- ============================================

-- Admins can view all history
CREATE POLICY "Admins can view all shift history"
ON public.shift_assignment_history FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'ADMIN', 'ceo', 'CEO')
    )
);

-- Users can view their own history
CREATE POLICY "Users can view own assignment history"
ON public.shift_assignment_history FOR SELECT
USING (user_id = auth.uid());

-- System inserts only (via triggers or admin actions)
CREATE POLICY "Admins can insert shift history"
ON public.shift_assignment_history FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'ADMIN', 'ceo', 'CEO', 'hr', 'HR', 'boi', 'BOI')
    )
);

-- ============================================
-- 10. RLS POLICIES - SHIFT SESSIONS
-- ============================================

-- Users can view their own sessions
CREATE POLICY "Users can view own shift sessions"
ON public.shift_sessions FOR SELECT
USING (user_id = auth.uid());

-- Admins/HR/BOI can view all sessions
CREATE POLICY "Admins can view all shift sessions"
ON public.shift_sessions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'ADMIN', 'ceo', 'CEO', 'hr', 'HR', 'boi', 'BOI')
    )
);

-- Users can insert their own sessions
CREATE POLICY "Users can insert own shift sessions"
ON public.shift_sessions FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own active sessions
CREATE POLICY "Users can update own shift sessions"
ON public.shift_sessions FOR UPDATE
USING (user_id = auth.uid());

-- ============================================
-- 11. RLS POLICIES - SHIFT BREAKS
-- ============================================

-- Users can view their own breaks
CREATE POLICY "Users can view own shift breaks"
ON public.shift_breaks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.shift_sessions
        WHERE id = shift_breaks.session_id
        AND user_id = auth.uid()
    )
);

-- Admins can view all breaks
CREATE POLICY "Admins can view all shift breaks"
ON public.shift_breaks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'ADMIN', 'ceo', 'CEO', 'hr', 'HR', 'boi', 'BOI')
    )
);

-- Users can insert breaks for their sessions
CREATE POLICY "Users can insert own shift breaks"
ON public.shift_breaks FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.shift_sessions
        WHERE id = shift_breaks.session_id
        AND user_id = auth.uid()
    )
);

-- Users can update their own breaks
CREATE POLICY "Users can update own shift breaks"
ON public.shift_breaks FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.shift_sessions
        WHERE id = shift_breaks.session_id
        AND user_id = auth.uid()
    )
);

-- ============================================
-- 12. RLS POLICIES - SHIFT HOURLY SLOTS
-- ============================================

-- Users can view their own slots
CREATE POLICY "Users can view own shift slots"
ON public.shift_hourly_slots FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.shift_sessions
        WHERE id = shift_hourly_slots.session_id
        AND user_id = auth.uid()
    )
);

-- Admins can view all slots
CREATE POLICY "Admins can view all shift slots"
ON public.shift_hourly_slots FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'ADMIN', 'ceo', 'CEO', 'hr', 'HR', 'boi', 'BOI')
    )
);

-- Users can insert slots for their sessions
CREATE POLICY "Users can insert own shift slots"
ON public.shift_hourly_slots FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.shift_sessions
        WHERE id = shift_hourly_slots.session_id
        AND user_id = auth.uid()
    )
);

-- Users can update their own slots
CREATE POLICY "Users can update own shift slots"
ON public.shift_hourly_slots FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.shift_sessions
        WHERE id = shift_hourly_slots.session_id
        AND user_id = auth.uid()
    )
);

-- ============================================
-- 13. RLS POLICIES - SHIFT EOD REPORTS
-- ============================================

-- Users can view their own EOD
CREATE POLICY "Users can view own shift eod"
ON public.shift_eod_reports FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.shift_sessions
        WHERE id = shift_eod_reports.session_id
        AND user_id = auth.uid()
    )
);

-- Admins can view all EODs
CREATE POLICY "Admins can view all shift eod"
ON public.shift_eod_reports FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'ADMIN', 'ceo', 'CEO', 'hr', 'HR', 'boi', 'BOI')
    )
);

-- Users can insert EOD for their sessions
CREATE POLICY "Users can insert own shift eod"
ON public.shift_eod_reports FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.shift_sessions
        WHERE id = shift_eod_reports.session_id
        AND user_id = auth.uid()
    )
);

-- Users can update their own EOD
CREATE POLICY "Users can update own shift eod"
ON public.shift_eod_reports FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.shift_sessions
        WHERE id = shift_eod_reports.session_id
        AND user_id = auth.uid()
    )
);

-- ============================================
-- 14. HELPER FUNCTION - IS SHIFT USER
-- ============================================

CREATE OR REPLACE FUNCTION public.is_shift_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.shift_user_assignments
        WHERE user_id = p_user_id
        AND is_active = true
    );
END;
$$;

-- ============================================
-- 15. HELPER FUNCTION - GET ACTIVE SHIFT USERS
-- ============================================

CREATE OR REPLACE FUNCTION public.get_active_shift_user_ids()
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT user_id FROM public.shift_user_assignments
    WHERE is_active = true;
END;
$$;

-- ============================================
-- 16. TRIGGER - AUTO UPDATE BREAK DURATION
-- ============================================

CREATE OR REPLACE FUNCTION public.calculate_break_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.break_end IS NOT NULL AND OLD.break_end IS NULL THEN
        NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.break_end - NEW.break_start)) / 60;
        
        -- Update total break minutes in session
        UPDATE public.shift_sessions
        SET total_break_minutes = total_break_minutes + NEW.duration_minutes,
            updated_at = now()
        WHERE id = NEW.session_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_break_duration
BEFORE UPDATE ON public.shift_breaks
FOR EACH ROW
EXECUTE FUNCTION public.calculate_break_duration();

-- ============================================
-- 17. TRIGGER - AUTO CALCULATE NET WORKING MINUTES
-- ============================================

CREATE OR REPLACE FUNCTION public.calculate_net_working()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.shift_end IS NOT NULL AND OLD.shift_end IS NULL THEN
        NEW.net_working_minutes := EXTRACT(EPOCH FROM (NEW.shift_end - NEW.shift_start)) / 60 - NEW.total_break_minutes;
        NEW.status := CASE 
            WHEN NEW.net_working_minutes >= (NEW.target_hours * 60) THEN 'completed'
            ELSE 'incomplete'
        END;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_net_working
BEFORE UPDATE ON public.shift_sessions
FOR EACH ROW
EXECUTE FUNCTION public.calculate_net_working();

-- ============================================
-- 18. GRANT PERMISSIONS
-- ============================================

GRANT ALL ON public.shift_user_assignments TO authenticated;
GRANT ALL ON public.shift_assignment_history TO authenticated;
GRANT ALL ON public.shift_sessions TO authenticated;
GRANT ALL ON public.shift_breaks TO authenticated;
GRANT ALL ON public.shift_hourly_slots TO authenticated;
GRANT ALL ON public.shift_eod_reports TO authenticated;

-- ============================================
-- 19. ENABLE REALTIME FOR LIVE TRACKING
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'shift_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE shift_sessions;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'shift_breaks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE shift_breaks;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'shift_hourly_slots'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE shift_hourly_slots;
    END IF;
END $$;
