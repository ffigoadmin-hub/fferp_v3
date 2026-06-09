/**
 * Pre-Joining Onboarding Service
 * 
 * Handles:
 * - HR invitation creation
 * - Username/password generation
 * - Activation token/link generation
 * - Document uploads
 * - Employee form submission
 * - HR verification workflow
 * - Auth user creation after verification
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  EmployeeOnboardingRequest,
  NewUserInvitationFormData,
  EmployeeOnboardingFormData,
  CreateInvitationResponse,
  SubmitOnboardingDetailsResponse,
  HrVerificationResponse,
  GetOnboardingByTokenResponse,
  GeneratedCredentials,
  DocumentUploadResult,
  OnboardingFilterOptions,
  OnboardingListItem,
} from '../types/prejoining.types';
import { generateUsername, generateEmailUsername, generateUsernamePreview } from '../utils/prejoiningUsernameGenerator';
import { generateTemporaryPassword, getDepartmentCode } from '../utils/prejoiningPasswordGenerator';

// Constants
const ONBOARDING_BUCKET = 'onboarding-documents';
const TOKEN_EXPIRY_DAYS = 7;
const APP_BASE_URL = import.meta.env.VITE_APP_URL || window.location.origin;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate secure activation token
 */
function generateActivationToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Build activation link
 */
function buildActivationLink(token: string): string {
  return `${APP_BASE_URL}/onboarding/complete?token=${token}`;
}

/**
 * Check if token is expired
 */
function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt) < new Date();
}

// ============================================
// INVITATION CREATION (HR)
// ============================================

/**
 * Create new onboarding invitation
 * Auto-generates username, password, token, and sends email
 */
export async function createOnboardingInvitation(
  data: NewUserInvitationFormData
): Promise<CreateInvitationResponse> {
  try {
    // Check for duplicate invitations
    const { data: existing, error: checkError } = await supabase
      .from('employee_onboarding_requests')
      .select('id, status')
      .eq('email', data.email)
      .in('status', ['invited', 'details_submitted', 'correction_requested'])
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows
      throw checkError;
    }

    if (existing) {
      return {
        success: false,
        error: 'An active onboarding invitation already exists for this email.',
      };
    }

    // Get current user (HR/Admin)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to create invitations.',
      };
    }

    // Generate credentials
    const username = await generateEmailUsername(data.fullName);
    const password = generateTemporaryPassword(data.fullName, data.department);
    const token = generateActivationToken();
    const activationLink = buildActivationLink(token);
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + TOKEN_EXPIRY_DAYS);

    // Create onboarding record
    const { data: onboarding, error: insertError } = await supabase
      .from('employee_onboarding_requests')
      .insert({
        full_name: data.fullName.trim(),
        email: data.email.trim().toLowerCase(),
        department: data.department,
        generated_username: username,
        temporary_password_hint: password.slice(0, 3) + '***', // Mask for storage
        activation_token: token,
        activation_link: activationLink,
        token_expires_at: tokenExpiresAt.toISOString(),
        status: 'invited',
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[OnboardingService] Error creating invitation:', insertError);
      return {
        success: false,
        error: `Failed to create invitation: ${insertError.message}`,
      };
    }

    // Send email via Edge Function
    const emailResult = await sendOnboardingEmail({
      fullName: data.fullName,
      email: data.email,
      username,
      password,
      activationLink,
    });

    if (!emailResult.success) {
      // Email failed - update record but mark as not sent
      console.error('[OnboardingService] Email failed:', emailResult.error);
      return {
        success: true,
        data: onboarding as EmployeeOnboardingRequest,
        activationLink,
        error: `Invitation created but email failed: ${emailResult.error}`,
      };
    }

    // Update email_sent flag
    await supabase
      .from('employee_onboarding_requests')
      .update({
        email_sent: true,
        email_sent_at: new Date().toISOString(),
      })
      .eq('id', onboarding.id);

    return {
      success: true,
      data: { ...onboarding, email_sent: true } as EmployeeOnboardingRequest,
      activationLink,
    };

  } catch (error) {
    console.error('[OnboardingService] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create invitation',
    };
  }
}

/**
 * Send onboarding email via Edge Function
 */
async function sendOnboardingEmail(data: {
  fullName: string;
  email: string;
  username: string;
  password: string;
  activationLink: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke('send-onboarding-email', {
      body: data,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email sending failed',
    };
  }
}

// ============================================
// CREDENTIAL PREVIEW (No DB check)
// ============================================

/**
 * Generate credentials preview for UI display
 */
export function generateCredentialsPreview(
  fullName: string,
  department: string
): GeneratedCredentials {
  const usernamePreview = generateUsernamePreview(fullName);
  const password = generateTemporaryPassword(fullName, department);
  
  return {
    username: `${usernamePreview}@igogroups.in`,
    password,
  };
}

// ============================================
// DOCUMENT UPLOAD
// ============================================

/**
 * Upload document to Supabase Storage
 */
export async function uploadOnboardingDocument(
  file: File,
  documentType: string,
  email: string
): Promise<DocumentUploadResult> {
  try {
    // Validate file
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only PDF, JPG, PNG, DOC, DOCX allowed.');
    }

    if (file.size > maxSize) {
      throw new Error('File too large. Maximum size is 10MB.');
    }

    // Sanitize email for filename
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const folder = documentType.toLowerCase().replace(/_/g, '-');
    const fileName = `${timestamp}-${sanitizedEmail}-${documentType}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from(ONBOARDING_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(ONBOARDING_BUCKET)
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: filePath,
    };

  } catch (error) {
    console.error('[OnboardingService] Document upload error:', error);
    throw error;
  }
}

// ============================================
// ONBOARDING BY TOKEN (EMPLOYEE)
// ============================================

/**
 * Get onboarding request by activation token
 */
export async function getOnboardingByToken(
  token: string
): Promise<GetOnboardingByTokenResponse> {
  try {
    const { data, error } = await supabase
      .from('employee_onboarding_requests')
      .select('*')
      .eq('activation_token', token)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: 'Invalid or expired onboarding link.',
      };
    }

    // Check if already verified
    if (data.status === 'hr_verified' || data.status === 'active') {
      return {
        success: false,
        error: 'This onboarding has already been completed. Please login to ERP.',
      };
    }

    // Check if rejected
    if (data.status === 'rejected') {
      return {
        success: false,
        error: 'This onboarding request has been rejected.',
      };
    }

    // Check token expiry
    if (isTokenExpired(data.token_expires_at)) {
      return {
        success: false,
        expired: true,
        error: 'This onboarding link has expired. Please contact HR for a new invitation.',
      };
    }

    return {
      success: true,
      data: data as EmployeeOnboardingRequest,
    };

  } catch (error) {
    console.error('[OnboardingService] Error fetching by token:', error);
    return {
      success: false,
      error: 'Failed to load onboarding details.',
    };
  }
}

// ============================================
// EMPLOYEE FORM SUBMISSION
// ============================================

/**
 * Submit employee onboarding details
 */
export async function submitEmployeeOnboardingDetails(
  token: string,
  formData: EmployeeOnboardingFormData
): Promise<SubmitOnboardingDetailsResponse> {
  try {
    // First get the onboarding record
    const { data: onboarding, error: fetchError } = await supabase
      .from('employee_onboarding_requests')
      .select('id, email')
      .eq('activation_token', token)
      .single();

    if (fetchError || !onboarding) {
      return {
        success: false,
        error: 'Invalid onboarding link.',
      };
    }

    // Upload documents
    const uploads: Record<string, DocumentUploadResult> = {};
    
    const uploadPromises = [];
    
    if (formData.aadhaarFile) {
      uploadPromises.push(
        uploadOnboardingDocument(formData.aadhaarFile, 'aadhaar', onboarding.email)
          .then(result => uploads.aadhaar = result)
      );
    }
    if (formData.passbookFile) {
      uploadPromises.push(
        uploadOnboardingDocument(formData.passbookFile, 'passbook', onboarding.email)
          .then(result => uploads.passbook = result)
      );
    }
    if (formData.marksheet10File) {
      uploadPromises.push(
        uploadOnboardingDocument(formData.marksheet10File, 'marksheet_10', onboarding.email)
          .then(result => uploads.marksheet10 = result)
      );
    }
    if (formData.marksheet12File) {
      uploadPromises.push(
        uploadOnboardingDocument(formData.marksheet12File, 'marksheet_12', onboarding.email)
          .then(result => uploads.marksheet12 = result)
      );
    }
    if (formData.degreeMarksheetFile) {
      uploadPromises.push(
        uploadOnboardingDocument(formData.degreeMarksheetFile, 'degree', onboarding.email)
          .then(result => uploads.degree = result)
      );
    }
    if (formData.resumeFile) {
      uploadPromises.push(
        uploadOnboardingDocument(formData.resumeFile, 'resume', onboarding.email)
          .then(result => uploads.resume = result)
      );
    }
    if (formData.photoFile) {
      uploadPromises.push(
        uploadOnboardingDocument(formData.photoFile, 'photo', onboarding.email)
          .then(result => uploads.photo = result)
      );
    }
    if (formData.hrPolicyFile) {
      uploadPromises.push(
        uploadOnboardingDocument(formData.hrPolicyFile, 'hr_policy', onboarding.email)
          .then(result => uploads.hrPolicy = result)
      );
    }
    if (formData.offerLetterFile) {
      uploadPromises.push(
        uploadOnboardingDocument(formData.offerLetterFile, 'offer_letter', onboarding.email)
          .then(result => uploads.offerLetter = result)
      );
    }

    await Promise.all(uploadPromises);

    // Update onboarding record
    const { error: updateError } = await supabase
      .from('employee_onboarding_requests')
      .update({
        contact_number: formData.contactNumber,
        emergency_contact_number: formData.emergencyContactNumber,
        parents_number: formData.parentsNumber,
        permanent_address: formData.permanentAddress,
        current_address: formData.currentAddress,
        aadhaar_url: uploads.aadhaar?.url,
        aadhaar_path: uploads.aadhaar?.path,
        passbook_url: uploads.passbook?.url,
        passbook_path: uploads.passbook?.path,
        marksheet_10_url: uploads.marksheet10?.url,
        marksheet_10_path: uploads.marksheet10?.path,
        marksheet_12_url: uploads.marksheet12?.url,
        marksheet_12_path: uploads.marksheet12?.path,
        degree_marksheet_url: uploads.degree?.url,
        degree_marksheet_path: uploads.degree?.path,
        resume_url: uploads.resume?.url,
        resume_path: uploads.resume?.path,
        photo_url: uploads.photo?.url,
        photo_path: uploads.photo?.path,
        hr_policy_url: uploads.hrPolicy?.url,
        hr_policy_path: uploads.hrPolicy?.path,
        hr_policy_accepted: formData.hrPolicyAccepted,
        offer_letter_url: uploads.offerLetter?.url,
        offer_letter_path: uploads.offerLetter?.path,
        offer_letter_accepted: formData.offerLetterAccepted,
        status: 'details_submitted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', onboarding.id);

    if (updateError) {
      return {
        success: false,
        error: `Failed to submit details: ${updateError.message}`,
      };
    }

    return { success: true };

  } catch (error) {
    console.error('[OnboardingService] Error submitting details:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit details',
    };
  }
}

// ============================================
// HR ACCESS - GET SUBMITTED REQUESTS
// ============================================

/**
 * Get all submitted onboarding requests for HR review
 */
export async function getSubmittedOnboardingRequests(
  filters?: OnboardingFilterOptions
): Promise<OnboardingListItem[]> {
  try {
    let query = supabase
      .from('employee_onboarding_requests')
      .select('*')
      .order('updated_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.department) {
      query = query.eq('department', filters.department);
    }

    if (filters?.searchQuery) {
      query = query.or(`full_name.ilike.%${filters.searchQuery}%,email.ilike.%${filters.searchQuery}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      full_name: item.full_name,
      email: item.email,
      department: item.department,
      generated_username: item.generated_username,
      status: item.status as any,
      contact_number: item.contact_number,
      created_at: item.created_at,
      hasDocuments: !!(item.aadhaar_url || item.resume_url || item.photo_url),
    }));

  } catch (error) {
    console.error('[OnboardingService] Error fetching submitted requests:', error);
    throw error;
  }
}

// ============================================
// HR VERIFICATION ACTIONS
// ============================================

/**
 * HR verifies onboarding - activates employee account
 */
export async function verifyOnboardingByHr(
  onboardingId: string,
  remarks?: string
): Promise<HrVerificationResponse> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get onboarding details
    const { data: onboarding, error: fetchError } = await supabase
      .from('employee_onboarding_requests')
      .select('*')
      .eq('id', onboardingId)
      .single();

    if (fetchError || !onboarding) {
      return { success: false, error: 'Onboarding request not found' };
    }

    if (onboarding.status !== 'details_submitted' && onboarding.status !== 'correction_requested') {
      return { success: false, error: 'Can only verify submitted or correction requests' };
    }

    // Create auth user and profile via Edge Function
    const { data: activationResult, error: activationError } = await supabase.functions.invoke(
      'activate-employee-account',
      {
        body: {
          onboardingId,
          email: onboarding.email,
          fullName: onboarding.full_name,
          username: onboarding.generated_username,
          department: onboarding.department,
        },
      }
    );

    if (activationError || !activationResult?.success) {
      return {
        success: false,
        error: activationResult?.error || activationError?.message || 'Account activation failed',
      };
    }

    // Update onboarding status
    const { error: updateError } = await supabase
      .from('employee_onboarding_requests')
      .update({
        status: 'hr_verified',
        hr_verified_by: user.id,
        hr_verified_at: new Date().toISOString(),
        auth_user_id: activationResult.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', onboardingId);

    if (updateError) {
      return {
        success: false,
        error: `Failed to update status: ${updateError.message}`,
      };
    }

    return { success: true };

  } catch (error) {
    console.error('[OnboardingService] Error verifying onboarding:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * HR requests correction from employee
 */
export async function requestCorrectionByHr(
  onboardingId: string,
  reason: string
): Promise<HrVerificationResponse> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('employee_onboarding_requests')
      .update({
        status: 'correction_requested',
        correction_reason: reason,
        correction_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', onboardingId);

    if (error) {
      return {
        success: false,
        error: `Failed to request correction: ${error.message}`,
      };
    }

    return { success: true };

  } catch (error) {
    console.error('[OnboardingService] Error requesting correction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to request correction',
    };
  }
}

/**
 * HR rejects onboarding
 */
export async function rejectOnboardingByHr(
  onboardingId: string,
  reason: string
): Promise<HrVerificationResponse> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('employee_onboarding_requests')
      .update({
        status: 'rejected',
        rejected_reason: reason,
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', onboardingId);

    if (error) {
      return {
        success: false,
        error: `Failed to reject: ${error.message}`,
      };
    }

    return { success: true };

  } catch (error) {
    console.error('[OnboardingService] Error rejecting onboarding:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reject',
    };
  }
}

// ============================================
// CHECK ONBOARDING STATUS
// ============================================

/**
 * Check if employee onboarding is verified and account is active
 */
export async function checkEmployeeOnboardingStatus(
  email: string
): Promise<{
  isActive: boolean;
  status?: string;
  message?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('employee_onboarding_requests')
      .select('status')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // No onboarding found - might be an existing user
      return { isActive: true };
    }

    if (data.status === 'hr_verified' || data.status === 'active') {
      return { isActive: true, status: data.status };
    }

    const messages: Record<string, string> = {
      invited: 'Your onboarding invitation is pending. Please check your email and complete the onboarding form.',
      details_submitted: 'Your onboarding details are under HR verification. ERP access will be enabled after approval.',
      correction_requested: 'HR has requested corrections to your onboarding details. Please check your email for instructions.',
      rejected: 'Your onboarding request has been rejected. Please contact HR for more information.',
    };

    return {
      isActive: false,
      status: data.status,
      message: messages[data.status] || 'Your account is being processed. Please contact HR.',
    };

  } catch (error) {
    console.error('[OnboardingService] Error checking status:', error);
    return { isActive: true }; // Default to allowing access on error
  }
}

// ============================================
// RESEND INVITATION
// ============================================

/**
 * Resend onboarding invitation with new token
 */
export async function resendOnboardingInvitation(
  onboardingId: string
): Promise<CreateInvitationResponse> {
  try {
    const { data: onboarding, error: fetchError } = await supabase
      .from('employee_onboarding_requests')
      .select('*')
      .eq('id', onboardingId)
      .single();

    if (fetchError || !onboarding) {
      return { success: false, error: 'Onboarding request not found' };
    }

    // Generate new token and link
    const token = generateActivationToken();
    const activationLink = buildActivationLink(token);
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + TOKEN_EXPIRY_DAYS);

    // Update record
    await supabase
      .from('employee_onboarding_requests')
      .update({
        activation_token: token,
        activation_link: activationLink,
        token_expires_at: tokenExpiresAt.toISOString(),
        email_sent: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', onboardingId);

    // Send email
    const emailResult = await sendOnboardingEmail({
      fullName: onboarding.full_name,
      email: onboarding.email,
      username: onboarding.generated_username || '',
      password: '', // Don't resend password
      activationLink,
    });

    if (emailResult.success) {
      await supabase
        .from('employee_onboarding_requests')
        .update({ email_sent: true, email_sent_at: new Date().toISOString() })
        .eq('id', onboardingId);
    }

    return {
      success: true,
      activationLink,
      error: emailResult.success ? undefined : emailResult.error,
    };

  } catch (error) {
    console.error('[OnboardingService] Error resending invitation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resend invitation',
    };
  }
}
