# Auditor LOP Management Access - Implementation Guide

## Problem
The National Head Auditor role could not view or manage LOP entries due to missing Row Level Security (RLS) permissions in the Supabase database.

## Solution
Grant limited LOP oversight access to the auditor role (similar to CEO), allowing them to:
- ✅ View all LOP entries (real-time)
- ✅ Approve/Reject pending LOPs
- ❌ **CANNOT** Register new LOP entries
- ❌ **CANNOT** Delete LOP entries

This matches the CEO's access level - oversight and approval authority without create/delete permissions.

## Changes Made

### 1. Database Migration (RLS Policies)
**File**: `supabase/migrations/20260124_add_auditor_lop_access.sql`

Updated RLS policies on `lop_entries` table to:
- Grant SELECT permission to auditor role (view all)
- Grant UPDATE permission to auditor role (approve/reject)
- Deny INSERT permission (cannot create)
- Deny DELETE permission (cannot delete)

### 2. Frontend UI Updates
**File**: `src/pages/admin/AdminLOPListPage.tsx`

- ❌ Removed "Unlock Half-Day" button completely (from all roles)
- ❌ Hidden "Register LOP" button for auditors and CEO
- ✅ Enabled Approve/Reject action buttons for auditors
- ❌ Hidden Delete button for auditors and CEO

## Implementation Steps

### Step 1: Apply Database Migration

1. **Go to Supabase Dashboard**  
   Navigate to: https://supabase.com/dashboard/project/pivmjqswqthofwunpbrn

2. **Open SQL Editor**  
   Click on "SQL Editor" in the left sidebar

3. **Run the Following SQL**:

```sql
-- Add Auditor Role Access to LOP Entries
-- Enable auditors to VIEW and APPROVE/REJECT LOPs (similar to CEO)
-- Auditors CANNOT create or delete LOPs

-- Drop existing policy and recreate with auditor access
DROP POLICY IF EXISTS "Employees can view own LOP entries" ON public.lop_entries;

CREATE POLICY "Employees and management can view LOP entries" ON public.lop_entries
  FOR SELECT USING (
    employee_id = auth.uid() OR 
    lower(get_my_role()) IN ('hr', 'admin', 'ceo', 'auditor', 'boi')
  );

-- Allow HR, BOI, and Admin to fully manage LOP entries (create, update, delete)
DROP POLICY IF EXISTS "HR can manage LOP entries" ON public.lop_entries;

CREATE POLICY "HR, BOI, and Admin can fully manage LOP entries" ON public.lop_entries
  FOR ALL USING (lower(get_my_role()) IN ('hr', 'boi', 'admin'))
  WITH CHECK (lower(get_my_role()) IN ('hr', 'boi', 'admin'));

-- Allow CEO and Auditor to update LOPs (for approve/reject workflow)
CREATE POLICY "CEO and Auditor can update LOP status" ON public.lop_entries
  FOR UPDATE USING (lower(get_my_role()) IN ('ceo', 'auditor'));

COMMENT ON POLICY "Employees and management can view LOP entries" ON public.lop_entries 
IS 'Employees can view own entries. HR, Admin, CEO, Auditor, and BOI can view all entries.';

COMMENT ON POLICY "HR, BOI, and Admin can fully manage LOP entries" ON public.lop_entries 
IS 'HR, BOI, and Admin roles have full access: create, update, and delete LOP entries.';

COMMENT ON POLICY "CEO and Auditor can update LOP status" ON public.lop_entries 
IS 'CEO and Auditor can update LOP entries for approval/rejection workflow, but cannot create or delete.';
```

4. **Click "Run"** to execute the migration

### Step 2: Verify the Changes

After running the SQL:

1. **Refresh your browser** on the LOP List page
2. **Log in as an auditor** (if not already)
3. **Verify you can see**:
   - All LOP entries in the table (real-time updates enabled)
   - Approve/Reject buttons for pending entries
   - **NO** "Register LOP" button (correct - auditors can't create)
   - **NO** Delete button (correct - auditors can't delete)

### Step 3: Test Real-time Updates

1. Keep the LOP List page open
2. Have another user (HR/BOI/Admin) create a new LOP entry
3. The new entry should appear **instantly** on your screen without refresh
4. This proves the real-time subscription is working

## Access Control Summary

After this migration, the following roles can manage LOP entries:

| Role | View All | Create | Approve/Reject | Delete |
|------|----------|--------|----------------|--------|
| Employee | Own only | ❌ | ❌ | ❌ |
| HR | ✅ | ✅ | ✅ | ✅ |
| BOI | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ |
| **Auditor** | ✅ | ❌ | ✅ | ❌ |
| CEO | ✅ | ❌ | ✅ (Final) | ❌ |

**Note**: Auditor and CEO have identical LOP permissions - oversight and approval only.

## Technical Details

### Real-time Synchronization
The frontend already has real-time subscriptions configured:
- `useLOPEntries` hook subscribes to `lop_entries` table changes
- `useRealtimeAttendance` global monitor includes LOP entries
- Data updates instantly when database changes occur

### Frontend Implementation
- **Location**: `src/pages/admin/AdminLOPListPage.tsx`
- **Hook**: `useLOPEntries()` from `src/hooks/useLOPEntries.ts`
- **Real-time**: Supabase `.on('postgres_changes')` subscription active

## Troubleshooting

If LOP entries still don't appear after running the SQL:

1. **Check user role**:
   ```sql
   SELECT id, name, email, role FROM profiles WHERE email = 'your-auditor-email@domain.com';
   ```
   Verify the role is exactly `'auditor'` (lowercase)

2. **Verify RLS policies**:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'lop_entries';
   ```
   Should show the new policies with auditor included

3. **Check browser console** for any errors
4. **Hard refresh** the page (Ctrl+Shift+R or Cmd+Shift+R)

## Migration File Location
The migration SQL is saved at:
```
c:\Users\hp\Desktop\IGO GROUP-main\supabase\migrations\20260124_add_auditor_lop_access.sql
```

This file is tracked in git for future reference and deployment.
