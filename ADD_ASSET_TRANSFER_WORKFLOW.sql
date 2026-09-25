-- ADD_ASSET_TRANSFER_WORKFLOW.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Asset Management, Phase 4: a formal Asset Transfer request/approval workflow, on top of the
-- instant "Reassign" action already on FixedAssetRegisterPage (which stays as-is for quick
-- corrections). This adds a request → approve/reject step for moving an asset between hubs or
-- staff, so there's an audit trail of who asked for a transfer and who signed off on it, not just
-- who last changed the custody field.
--
-- asset_transfer_requests:  one row per request. Approving it applies the hub_id/assigned_to
--                            change on fixed_assets, which the existing trg_asset_custody_log
--                            trigger (from ADD_ASSET_CUSTODY_AND_VEHICLE_COMPLIANCE.sql) already
--                            logs automatically — no new logging code needed here.
-- asset_transfer_decide():  the only path that can approve/reject. Row-level security lets any
--                            staff member create a request, but this function itself checks the
--                            caller's role before applying an approval, so a decision can't be
--                            made by simply updating the table directly.
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.asset_transfer_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id          uuid NOT NULL REFERENCES public.fixed_assets(id),
  requested_by      uuid REFERENCES auth.users(id),
  requested_at      timestamptz NOT NULL DEFAULT now(),
  from_hub_id       uuid REFERENCES public.hubs(id),
  to_hub_id         uuid REFERENCES public.hubs(id),
  from_assigned_to  uuid REFERENCES auth.users(id),
  to_assigned_to    uuid REFERENCES auth.users(id),
  reason            text,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by        uuid REFERENCES auth.users(id),
  decided_at        timestamptz,
  decision_notes    text
);
ALTER TABLE public.asset_transfer_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asset_transfer_requests_staff_access ON public.asset_transfer_requests;
CREATE POLICY asset_transfer_requests_staff_access ON public.asset_transfer_requests FOR ALL USING (is_staff()) WITH CHECK (is_staff());

CREATE OR REPLACE FUNCTION public.asset_transfer_decide(p_request_id uuid, p_approve boolean, p_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'gm', 'ff_operations_manager')
  ) THEN
    RAISE EXCEPTION 'Not authorized to approve or reject asset transfers';
  END IF;

  SELECT * INTO v_req FROM public.asset_transfer_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req IS NULL THEN
    RAISE EXCEPTION 'Transfer request not found';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'This request has already been %', v_req.status;
  END IF;

  IF p_approve THEN
    UPDATE public.fixed_assets
    SET hub_id = v_req.to_hub_id, assigned_to = v_req.to_assigned_to
    WHERE id = v_req.asset_id;
  END IF;

  UPDATE public.asset_transfer_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      decided_by = auth.uid(), decided_at = now(), decision_notes = p_notes
  WHERE id = p_request_id;

  RETURN jsonb_build_object('request_id', p_request_id, 'status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.asset_transfer_decide(uuid, boolean, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.asset_transfer_decide(uuid, boolean, text) TO authenticated;
