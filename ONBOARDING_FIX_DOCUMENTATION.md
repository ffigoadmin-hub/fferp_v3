# Onboarding Admin "Send Credentials & Create Account" - Fix Documentation

## Summary

Fixed the onboarding Admin flow that was failing with "Edge Function Error: Edge Function returned a non-2xx status code".

---

## Changes Made

### 1. Edge Function: `supabase/functions/onboarding-complete/index.ts`

**Improvements:**
- ✅ Added detailed logging at every step with `[Onboarding]` prefix
- ✅ Added environment variable validation with clear error messages
- ✅ Added `checkExistingUser()` function to prevent duplicate user creation
- ✅ Added email format validation
- ✅ Added structured error responses with `details` field
- ✅ Added CORS header `Content-Type: application/json`
- ✅ Improved error handling for specific cases (duplicate users, missing fields, etc.)
- ✅ Added comprehensive try-catch around request body parsing
- ✅ All responses now use consistent `corsHeaders`

**Key Fixes:**
- Better error messages for debugging
- Prevents duplicate user creation (returns 409 status)
- Validates all required fields before processing
- Returns proper JSON for all error cases

---

### 2. Frontend Service: `src/modules/onboarding/services/onboardingService.ts`

**Improvements:**
- ✅ Enhanced error handling with specific error message mapping
- ✅ Distinguishes between Edge Function invocation errors vs. Edge Function returned errors
- ✅ User-friendly error messages for common scenarios:
  - User already exists
  - Missing required fields
  - CEO approval required
  - Permission denied
  - Session expired
- ✅ Added `details` property to error response

---

### 3. Type Definitions: `src/modules/onboarding/types/onboarding.types.ts`

**Changes:**
- ✅ Added `details?: string` to `AdminCompleteResponse` interface

---

## Deployment Steps

### Step 1: Set Environment Variables in Supabase

Run these commands in your terminal with Supabase CLI:

```bash
# Set Resend API Key (for email sending)
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx

# Set Supabase Service Role Key (should already be set)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx

# Verify environment variables
supabase secrets list
```

**Note:** If you don't have a Resend API key:
1. Go to https://resend.com and create an account
2. Verify your domain (igoagritech.com)
3. Create an API key
4. Set it in Supabase secrets

---

### Step 2: Deploy the Edge Function

```bash
# Deploy the updated function
supabase functions deploy onboarding-complete

# Or if using the legacy method
supabase functions deploy onboarding-complete --project-ref <your-project-ref>
```

---

### Step 3: Verify Function Deployment

```bash
# Check function logs
supabase functions logs onboarding-complete

# Or test via HTTP request
curl -X POST https://<project-ref>.supabase.co/functions/v1/onboarding-complete \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "onboardingId": "test-id",
    "generatedUsername": "testuser",
    "generatedPassword": "TestPass123#",
    "fullName": "Test User",
    "email": "test@example.com",
    "department": "IT"
  }'
```

---

### Step 4: Test the Complete Flow

1. **HR**: Submit a new onboarding request
2. **CEO**: Select the candidate (status → `ceo_selected`)
3. **Admin**: Go to Admin Access page
4. Click "Send Credentials & Create Account"
5. Confirm in dialog

**Expected Result:**
- ✅ Toast: "Account created and credentials sent to [email]"
- ✅ User appears in Supabase Auth
- ✅ Profile entry created in `profiles` table
- ✅ Onboarding status updated to `admin_completed`
- ✅ Welcome email sent

---

## Troubleshooting

### Issue: "Edge Function returned a non-2xx status code"

**Causes & Fixes:**
1. **Function not deployed** → Run `supabase functions deploy onboarding-complete`
2. **Missing RESEND_API_KEY** → Set the secret (email won't send without it, but user will still be created)
3. **Missing SUPABASE_SERVICE_ROLE_KEY** → Required for creating auth users
4. **Function crashed** → Check logs: `supabase functions logs onboarding-complete`

### Issue: "A user with this email already exists"

**Fix:**
- The email is already registered in Supabase Auth
- Delete the existing user first (from Auth dashboard) or use a different email

### Issue: "Unauthorized - Invalid or expired token"

**Fix:**
- User session expired
- Refresh the page and log in again

### Issue: "Onboarding request not found or not approved by CEO"

**Fix:**
- CEO must select the candidate first
- Check the onboarding request status is `ceo_selected`

---

## Environment Variables Reference

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | For JWT validation |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | For admin operations (create user) |
| `RESEND_API_KEY` | No* | For sending welcome emails |

*Without RESEND_API_KEY, the user will still be created but no email will be sent.

---

## Files Modified

1. `supabase/functions/onboarding-complete/index.ts` - Edge Function
2. `src/modules/onboarding/services/onboardingService.ts` - Frontend service
3. `src/modules/onboarding/types/onboarding.types.ts` - Type definitions

---

## Testing Checklist

- [ ] Deploy Edge Function
- [ ] Set RESEND_API_KEY secret
- [ ] Submit onboarding request (HR)
- [ ] CEO selects candidate
- [ ] Admin clicks "Send Credentials"
- [ ] Verify user created in Auth
- [ ] Verify profile created
- [ ] Verify status updated to `admin_completed`
- [ ] Verify welcome email received
- [ ] Test duplicate user prevention
- [ ] Test error handling (expired session, etc.)

---

## Support

If issues persist after deployment:

1. Check Edge Function logs: `supabase functions logs onboarding-complete`
2. Check browser console for detailed error messages
3. Verify all environment variables are set: `supabase secrets list`
4. Ensure the function is deployed: `supabase functions list`
