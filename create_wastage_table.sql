-- =====================================================================
-- FF ERP — Wastage Entries Table + Storage Bucket
-- Run in: Supabase Dashboard → SQL Editor
-- =====================================================================

-- Step 1: Create wastage_entries table
CREATE TABLE IF NOT EXISTS public.wastage_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id          UUID NOT NULL REFERENCES public.hubs(id),
  hub_name        TEXT,
  product_id      UUID REFERENCES public.products(id),
  item_name       TEXT NOT NULL,
  quantity_kg     NUMERIC(10,2) NOT NULL,
  amount          NUMERIC(10,2),
  reason          TEXT,
  photo_1_url     TEXT,
  photo_2_url     TEXT,
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  submitted_by    UUID REFERENCES auth.users(id),
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Enable RLS
ALTER TABLE public.wastage_entries ENABLE ROW LEVEL SECURITY;

-- Hub managers can only see/edit their own hub's wastage
CREATE POLICY hub_manager_own_hub ON public.wastage_entries
  FOR ALL TO authenticated
  USING (hub_id = (SELECT hub_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (hub_id = (SELECT hub_id FROM profiles WHERE id = auth.uid()));

-- Admins/GM/Operations can see all
CREATE POLICY admin_all_wastage ON public.wastage_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin','gm','ff_operations_manager')
    )
  );

-- Step 3: Storage bucket for wastage photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('wastage-photos', 'wastage-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY wastage_photo_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wastage-photos');

CREATE POLICY wastage_photo_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'wastage-photos');

-- Step 4: Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'wastage_entries'
ORDER BY ordinal_position;
