# Onboarding + Login Flow Fix - Complete Summary

## Root Causes Identified

### 1. 404 Error on /onboarding URL
**Cause**: Production hosting (Vercel) was not configured with SPA fallback. When users clicked the onboarding link or refreshed the page, the server looked for a physical `/onboarding` directory instead of serving `index.html` and letting React Router handle the route.

**Fix**: Created `vercel.json` with rewrite rules to redirect all non-asset requests to `index.html`.

### 2. "Invalid Credentials" After Onboarding
**Cause**: The login flow was not checking if the user's account was properly activated. When an admin completes onboarding:
- Auth user is created with the provided password
- Profile is created with `onboarding_completed: false` and `account_activated: false`
- The user tries to login before HR verification
- Login succeeds at auth level but should be blocked at application level

**Fix**: Updated `LoginPage.tsx` to check profile status after auth success and block login with specific messages based on onboarding status.

### 3. Account Activation Gap
**Cause**: The `approveOnboarding` function was not setting `account_activated: true` on the profile after HR verification.

**Fix**: Updated `approveOnboarding` in `onboardingService.ts` to set both `onboarding_completed: true` and `account_activated: true` when HR approves.

---

## Files Changed

### 1. `/vercel.json` (NEW)
SPA fallback configuration for production deployment on Vercel.

### 2. `/src/pages/LoginPage.tsx`
- Added debug logging throughout login flow
- Added profile status check after successful auth
- Added specific error messages for different onboarding states:
  - `admin_completed`: "Please complete your onboarding first. Check your email for the onboarding link."
  - `documents_submitted`: "Your onboarding is under HR verification. Login will be activated after approval."
  - `hr_verified`: "Your account is being finalized. Please try again in a few minutes."
- Signs out user if account is not activated

### 3. `/src/modules/onboarding/pages/OnboardingPage.tsx`
- Added comprehensive debug logging for troubleshooting
- Improved error messages with specific guidance
- Added check for additional completed statuses (`admin_completed`, `active`)

### 4. `/src/modules/onboarding/services/onboardingService.ts`
- Fixed TypeScript type error in `getOnboardingByToken`
- Updated `approveOnboarding` to set `account_activated: true` on profile
- Added debug logging for all onboarding operations

### 5. `/supabase/functions/complete-onboarding-atomic/index.ts`
- Added `account_activated: false` when creating profile during admin completion

### 6. `/supabase/migrations/20260403_add_account_activated_to_profiles.sql` (NEW)
Database migration to add `account_activated` column to profiles table.

### 7. `/src/modules/onboarding/test/onboardingFlowTest.ts` (NEW)
Test script to verify the complete onboarding flow end-to-end.

---

## Complete Onboarding Flow (After Fix)

```
1. HR creates onboarding request
   → Status: pending_ceo_review
   
2. CEO approves candidate
   → Status: ceo_selected
   
3. Admin completes onboarding
   → Creates auth user with password
   → Creates profile (onboarding_completed: false, account_activated: false)
   → Generates activation token
   → Sends email with credentials and /onboarding?token=xxx link
   → Status: admin_completed
   
4. User clicks onboarding link (NO 404 now)
   → OnboardingPage loads with token
   → User fills form and uploads documents
   → Documents submitted to Supabase
   → Status: documents_submitted
   
5. User tries to login BEFORE HR approval
   → Auth succeeds (correct password)
   → Profile check blocks login: "Your onboarding is under HR verification"
   
6. HR verifies documents
   → Sets onboarding_completed: true
   → Sets account_activated: true
   → Sets status: active
   → Status: hr_verified
   
7. User tries to login AFTER HR approval
   → Auth succeeds
   → Profile check passes
   → Login successful, redirected to dashboard
```

---

## Deployment Steps

### 1. Apply Database Migration
```bash
# Run in Supabase SQL Editor or using CLI
supabase db push

# Or manually run the migration:
# supabase/migrations/20260403_add_account_activated_to_profiles.sql
```

### 2. Deploy Edge Function (if modified)
```bash
supabase functions deploy complete-onboarding-atomic
```

### 3. Deploy Frontend
```bash
# Build and deploy to Vercel
vercel --prod

# Or if using Git integration, push to main branch
```

### 4. Verify Environment Variables
Ensure these are set in Vercel/Supabase:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `APP_URL` or `APP_FALLBACK_URL` (should be `https://igogroup.in/`)
- `RESEND_FROM_EMAIL` (verified sender domain)
- `RESEND_API_KEY`

---

## Testing the Flow

### Method 1: Using the Test Script
```typescript
// In browser console after logging in as HR/Admin
import { testOnboardingFlow } from '@/modules/onboarding/test/onboardingFlowTest';

const result = await testOnboardingFlow();
console.log(result);
```

### Method 2: Manual Test
1. Login as HR → Go to `/onboarding/new-user`
2. Create test user with test email
3. Login as CEO → Approve the candidate
4. Login as Admin → Complete onboarding (generate credentials)
5. Check email for onboarding link
6. Open link in incognito window → Should show onboarding form (NO 404)
7. Try login with credentials BEFORE submitting form → Should show "complete your onboarding"
8. Submit onboarding form
9. Login as HR → Verify the submission
10. Try login with credentials AFTER verification → Should succeed

---

## Debug Information

All components now output debug logs to browser console:

- `[Login]` - Login flow steps and status checks
- `[OnboardingPage]` - Token validation and form submission
- `[OnboardingService]` - HR approval operations
- `[complete-onboarding-atomic]` - Edge function operations

To enable debugging:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Filter by `[Login]`, `[OnboardingPage]`, etc.

---

## Error Messages Reference

| Scenario | Error Message Shown |
|----------|---------------------|
| Onboarding link expired | "Invalid or expired onboarding link. Please contact HR for assistance." |
| No token in URL | "Invalid onboarding link. No token provided. Please check your email link or contact HR." |
| Already submitted | "Your onboarding has already been submitted. Please contact HR if you need to make changes." |
| Login before onboarding | "Please complete your onboarding first. Check your email for the onboarding link." |
| Login during HR review | "Your onboarding is under HR verification. Login will be activated after approval." |
| Login after HR verified | "Your account is being finalized. Please try again in a few minutes." |
| Invalid credentials | "Invalid email or password" (only if auth fails) |

---

## Support

If issues persist after deployment:
1. Check browser console for `[Login]` and `[OnboardingPage]` logs
2. Verify `vercel.json` was deployed correctly
3. Check that database migration was applied
4. Verify environment variables are set correctly
5. Test with the provided test script
