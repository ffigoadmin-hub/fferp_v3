/**
 * Onboarding Service
 * 
 * Handles all onboarding-related operations:
 * - Submit new user requests (HR)
 * - Resume upload to Supabase Storage
 * - CEO approval/rejection
 * - Admin credential generation and completion
 * - Email sending via Edge Function
 */

import { supabase } from '@/integrations/supabase/client';
import { generateUsername, generateBaseUsername, generateEmailUsername } from '../utils/usernameGenerator';
import { generateTemporaryPassword, cleanForPassword, getDepartmentCode } from '../utils/passwordGenerator';
import type {
  OnboardingRequest,
  NewUserFormData,
  SubmitOnboardingResponse,
  CeoActionResponse,
  AdminCompleteResponse,
  UploadResumeResult,
  GenerateCredentialsResult,
  OnboardingStatus,
} from '../types/onboarding.types';

// ============================================
// Constants
// ============================================

const RESUME_BUCKET = 'onboarding-resumes';
// Use Supabase client functions.invoke instead of raw fetch for better reliability

// ============================================
// Form Submission (HR)
// ============================================

/**
 * Submit a new onboarding request from HR
 */
export async function submitNewUserRequest(data: NewUserFormData): Promise<SubmitOnboardingResponse> {
  try {
    // Check for duplicate pending requests
    const { data: existingRequests, error: checkError } = await supabase
      .from('onboarding_requests')
      .select('id, status')
      .eq('email', data.email)
      .in('status', ['pending_ceo_review', 'ceo_selected']);

    if (checkError) throw checkError;

    if (existingRequests && existingRequests.length > 0) {
      return {
        success: false,
        error: 'A pending onboarding request already exists for this email address.',
      };
    }

    // Upload resume if provided
    let resumeData: UploadResumeResult | null = null;
    if (data.resume) {
      resumeData = await uploadResume(data.resume, data.email);
    }

    // Insert onboarding request
    const { data: request, error: insertError } = await supabase
      .from('onboarding_requests')
      .insert({
        full_name: data.fullName.trim(),
        email: data.email.trim().toLowerCase(),
        department: data.department,
        resume_url: resumeData?.url || null,
        resume_path: resumeData?.path || null,
        status: 'pending_ceo_review',
      })
      .select()
      .single();

    if (insertError) {
      // If insert fails and we uploaded a resume, try to clean it up
      if (resumeData?.path) {
        await supabase.storage.from(RESUME_BUCKET).remove([resumeData.path]);
      }
      throw insertError;
    }

    return {
      success: true,
      data: request as unknown as OnboardingRequest,
    };
  } catch (error) {
    console.error('Error submitting onboarding request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit request',
    };
  }
}

// ============================================
// Resume Upload
// ============================================

/**
 * Upload resume to Supabase Storage
 */
export async function uploadResume(file: File, email: string): Promise<UploadResumeResult> {
  try {
    // Sanitize email for filename
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const fileName = `${sanitizedEmail}_${timestamp}.${fileExt}`;
    const filePath = `resumes/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(RESUME_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(RESUME_BUCKET)
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: filePath,
    };
  } catch (error) {
    console.error('Error uploading resume:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to upload resume');
  }
}

/**
 * Get a signed URL for viewing a resume (for private buckets)
 */
export async function getResumeSignedUrl(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(RESUME_BUCKET)
      .createSignedUrl(path, 60 * 60); // 1 hour expiry

    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }
}

// ============================================
// CEO Queue Management
// ============================================

/**
 * Get all pending CEO review requests
 */
export async function getPendingCeoRequests(): Promise<OnboardingRequest[]> {
  try {
    const { data, error } = await supabase
      .from('onboarding_requests')
      .select('*')
      .eq('status', 'pending_ceo_review')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as OnboardingRequest[];
  } catch (error) {
    console.error('Error fetching pending CEO requests:', error);
    throw error;
  }
}

/**
 * Get CEO-approved onboarding history (including progressed downstream statuses)
 */
export async function getCeoApprovedHistory(): Promise<OnboardingRequest[]> {
  try {
    const approvedStatuses: OnboardingStatus[] = [
      'ceo_selected',
      'admin_completed',
      'documents_submitted',
      'pending_hr',
      'hr_review',
      'hr_verified',
      'correction_requested',
      'active',
      'rejected',
    ];

    const { data, error } = await supabase
      .from('onboarding_requests')
      .select('*')
      .in('status', approvedStatuses)
      .order('ceo_action_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as OnboardingRequest[];
  } catch (error) {
    console.error('Error fetching CEO approved history:', error);
    throw error;
  }
}

/**
 * CEO selects a candidate (moves to admin queue)
 */
export async function selectByCeo(requestId: string): Promise<CeoActionResponse> {
  try {
    // Get current user for ceo_action_by
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('onboarding_requests')
      .update({
        status: 'ceo_selected',
        ceo_action_at: new Date().toISOString(),
        ceo_action_by: user?.id || null,
      })
      .eq('id', requestId)
      .eq('status', 'pending_ceo_review'); // Ensure still pending

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error selecting candidate:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to select candidate',
    };
  }
}

/**
 * CEO rejects a candidate
 */
export async function rejectByCeo(
  requestId: string,
  remark?: string
): Promise<CeoActionResponse> {
  try {
    const { error } = await supabase
      .from('onboarding_requests')
      .update({
        status: 'ceo_rejected',
        ceo_action_at: new Date().toISOString(),
        ceo_rejection_reason: remark || null,
      })
      .eq('id', requestId)
      .eq('status', 'pending_ceo_review'); // Ensure still pending

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error rejecting candidate:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reject candidate',
    };
  }
}

// ============================================
// Admin Queue Management
// ============================================

/**
 * Get all CEO-selected requests (admin queue)
 */
export async function getAdminQueue(): Promise<OnboardingRequest[]> {
  try {
    const { data, error } = await supabase
      .from('onboarding_requests')
      .select('*')
      .eq('status', 'ceo_selected')
      .order('ceo_action_at', { ascending: true });

    if (error) throw error;
    return (data || []) as unknown as OnboardingRequest[];
  } catch (error) {
    console.error('Error fetching admin queue:', error);
    throw error;
  }
}

// ============================================
// Credential Generation
// ============================================

/**
 * Generate both username and password for a candidate
 * Uses async username generation with database uniqueness check
 */
export async function generateCredentials(
  fullName: string,
  department: string
): Promise<GenerateCredentialsResult> {
  const username = await generateUsername(fullName);
  const password = generateTemporaryPassword(fullName, department);
  
  console.log('[Onboarding] Generated credentials:', {
    fullName,
    department,
    username,
  });
  
  return {
    username,
    password,
  };
}

/**
 * Sync version for UI responsiveness - generates credentials without DB check
 * Uses Math.random() for browser compatibility (no Node crypto)
 * Generates email-format username: {name}@igogroups.com
 */
export function generateCredentialsSync(
  fullName: string,
  department: string
): GenerateCredentialsResult {
  // Generate email-format username: yuthishpriyan@igogroups.com
  const username = generateEmailUsername(fullName);
  const password = `${cleanForPassword(fullName)}${getDepartmentCode(department)}#123`;
  
  return { username, password };
}

// ============================================
// Admin Completion (with Edge Function)
// ============================================

export interface CompleteAdminApprovalParams {
  onboardingId: string;
  generatedUsername: string;
  generatedPassword: string;
  fullName: string;
  email: string;
  department: string;
}

/**
 * Complete the onboarding process
 * Calls Edge Function to:
 * 1. Create Supabase Auth user
 * 2. Create profile entry
 * 3. Update onboarding record
 * 4. Send welcome email
 */
export async function completeAdminApproval(
  params: CompleteAdminApprovalParams
): Promise<AdminCompleteResponse> {
  try {
    console.log('[Onboarding] Calling Edge Function with params:', {
      onboardingId: params.onboardingId,
      email: params.email,
      fullName: params.fullName,
    });

    // STEP 1: Ensure we have a valid, fresh session before invoking
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session) {
      console.error('[Onboarding] No active session:', sessionError);
      return {
        success: false,
        error: 'You must be logged in to complete onboarding. Please refresh the page and log in again.',
      };
    }

    // STEP 2: Explicitly refresh the token and extract the new access_token
    // Note: we pass the access_token manually to functions.invoke to avoid any
    // race condition where the FunctionsClient hasn't picked up the new token yet.
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData?.session) {
      console.error('[Onboarding] Session refresh failed:', refreshError);
      return {
        success: false,
        error: 'Your session has expired. Please log out and log in again.',
      };
    }

    const accessToken = refreshData.session.access_token;
    console.log('[Onboarding] Session refreshed, access token obtained (length:', accessToken.length, ')');

    // STEP 3: Invoke Edge Function with explicit Authorization header
    console.log('[OnboardingService] Invoking complete-onboarding-atomic...');
    const { data, error } = await supabase.functions.invoke('complete-onboarding-atomic', {
      body: params,
      headers: {
        // Explicitly pass the fresh JWT — prevents stale-token race condition
        Authorization: `Bearer ${accessToken}`,
      },
    });
    console.log('[OnboardingService] Edge Function response:', { data, error });


    // Handle Edge Function invocation errors (network, deployment, etc.)
    // IMPORTANT: When Edge Function returns non-2xx, error contains "non-2xx status code"
    // BUT the actual structured error response is in error.context (a Response object) or data
    if (error) {
      console.error('[Onboarding] Edge function invocation error:', error);
      console.error('[Onboarding] Error details:', {
        message: error.message,
        name: error.name,
        context: (error as any).context,
      });
      
      // Try to extract structured error from various locations.
      // When Edge Function returns non-2xx, Supabase client puts the raw Response
      // object in error.context — we must call .json() on it to read the body.
      let errorData: any = data; // data may already be parsed by the client

      // error.context is the raw Response object from a non-2xx Edge Function reply
      if (!errorData && (error as any).context) {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          // It's a Response object — read the JSON body
          try {
            errorData = await ctx.json();
            console.error('[Onboarding] Parsed error from error.context Response:', errorData);
          } catch {
            // Body not JSON — errorData stays null
          }
        } else if (ctx && typeof ctx === 'object') {
          // Already a plain object (older Supabase client versions)
          errorData = ctx;
          console.error('[Onboarding] Found error data in error.context object:', errorData);
        }
      }
      
      // Fallback: sometimes the error message itself IS the JSON response body
      if (!errorData && error.message) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.code || parsed.message || parsed.error) {
            errorData = parsed;
            console.error('[Onboarding] Parsed error data from error.message:', errorData);
          }
        } catch {
          // Not JSON, continue
        }
      }
      
      // Use structured error from Edge Function if available
      if (errorData && typeof errorData === 'object') {
        const step = errorData.step || 'unknown';
        const message = errorData.message || errorData.error || error.message || 'Edge Function error';
        const details = errorData.details || null;
        
        console.error('[Onboarding] Structured error from Edge Function:', { step, message, details });
        
        return {
          success: false,
          error: `${message} (Step: ${step})`,
          details: details,
          step: step,
        };
      }
      
      // No structured data - use error message mapping
      let errorMessage = 'Failed to complete onboarding';
      
      if (error.message?.includes('non-2xx status code')) {
        // This is the generic case - we should have caught structured data above
        // If we reach here, the Edge Function didn't return proper JSON
        errorMessage = 'Server error: Edge Function did not return a valid response. Check Supabase logs for details.';
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error: Cannot connect to Edge Function. Please check your internet connection.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Request timed out. The operation may still be processing. Please check the admin queue.';
      } else {
        errorMessage = `Edge Function Error: ${error.message || 'Unknown error'}`;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    // Handle structured error responses from the Edge Function
    if (data && !data.success) {
      console.error('[Onboarding] Edge Function returned error:', data);

      // Use 'message' field if present (new format), fall back to 'error' (legacy)
      let errorMessage = data.message || data.error || 'Failed to complete onboarding';

      // Map specific error messages to user-friendly ones
      if (errorMessage?.includes('already exists') || errorMessage?.includes('already existed')) {
        errorMessage = 'A user with this email already exists in the system.';
      } else if (errorMessage?.includes('Missing required fields') || errorMessage?.includes('Missing required')) {
        errorMessage = `Missing required information: ${data.details || 'Please check all fields'}`;
      } else if (errorMessage?.includes('not approved by CEO')) {
        errorMessage = 'This onboarding request has not been approved by CEO yet.';
      } else if (errorMessage?.includes('Only admins can complete')) {
        errorMessage = 'You do not have permission to complete onboarding.';
      } else if (errorMessage?.includes('Unauthorized') || errorMessage?.includes('Invalid JWT') || errorMessage?.includes('401')) {
        errorMessage = 'Your session has expired or is invalid. Please log in again.';
      } else if (data.code === 'missing_sender_config') {
        errorMessage = 'Email sending is not configured. Contact your system admin to set RESEND_FROM_EMAIL in Supabase secrets.';
      } else if (data.code === 'invalid_sender_format') {
        errorMessage = `The configured sender email is malformed. Contact your system admin to update RESEND_FROM_EMAIL. (${data.senderUsed || errorMessage})`;
      } else if (data.code === 'unverified_sender_domain') {
        errorMessage = `The sender domain is not verified in Resend. Contact your system admin to verify the domain or change RESEND_FROM_EMAIL. (${data.senderUsed || errorMessage})`;
      } else if (errorMessage?.includes('Failed to send onboarding email') || data.step === 'send_email') {
        errorMessage = `Email sending failed: ${data.details || errorMessage}. Account was NOT created. Check email configuration and try again.`;
      } else if (data.step) {
        // Include the step in the error for debugging
        errorMessage = `${errorMessage} (Step: ${data.step})`;
      }

      return {
        success: false,
        error: errorMessage,
        details: data.details || data.message || data.error,
        step: data.step,
      };
    }

    // Normalize success response - handle both old format and new format with data wrapper
    const normalizedResponse: AdminCompleteResponse = {
      success: true,
      message: data.message || 'Onboarding completed successfully',
      userId: data.data?.userId || data.userId,
      emailSent: data.data?.emailSent ?? data.emailSent ?? true,
      // Include the full data object
      data: data.data,
    };

    console.log('[Onboarding] Edge Function success:', normalizedResponse);
    return normalizedResponse;
    
  } catch (error) {
    console.error('[Onboarding] Unexpected error in completeAdminApproval:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred while completing onboarding',
    };
  }
}


export async function resendOnboardingEmail(
  onboardingId: string
): Promise<{ success: boolean; message?: string; error?: string; code?: string }> {
  try {
    console.log('[Onboarding] Resending email for:', onboardingId);

    const { data, error } = await supabase.functions.invoke('resend-onboarding-email', {
      body: { onboardingId },
    });

    if (error) {
      console.error('[Onboarding] Resend invocation error:', error);

      // Try to extract structured error from error.context (non-2xx Edge Function response)
      let errorData: any = data;
      if (!errorData && (error as any).context) {
        const ctx = (error as any).context;
        try {
          errorData = typeof ctx.json === 'function' ? await ctx.json() : ctx;
          console.error('[Onboarding] Resend structured error from context:', errorData);
        } catch {
          // body not JSON
        }
      }
      if (!errorData && error.message) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.code || parsed.error) errorData = parsed;
        } catch { /* not JSON */ }
      }

      if (errorData && typeof errorData === 'object') {
        const msg = errorData.error || errorData.message || error.message;
        const code = errorData.code;
        // Surface config errors with friendly messages
        if (code === 'missing_sender_config') {
          return { success: false, error: 'Email not configured: RESEND_FROM_EMAIL is missing. Contact system admin.', code };
        } else if (code === 'invalid_sender_format') {
          return { success: false, error: `Sender email is malformed. Contact system admin. (${errorData.senderUsed || msg})`, code };
        } else if (code === 'unverified_sender_domain') {
          return { success: false, error: `Sender domain is not verified in Resend. Contact system admin. (${errorData.senderUsed || msg})`, code };
        }
        return { success: false, error: msg || 'Failed to resend email', code };
      }

      return {
        success: false,
        error: error.message || 'Failed to resend email',
      };
    }

    if (data && !data.success) {
      const code = data.code;
      let msg = data.error || 'Failed to resend email';
      if (code === 'missing_sender_config') msg = 'Email not configured: RESEND_FROM_EMAIL is missing. Contact system admin.';
      else if (code === 'invalid_sender_format') msg = `Sender email is malformed. Contact system admin. (${data.senderUsed || msg})`;
      else if (code === 'unverified_sender_domain') msg = `Sender domain not verified in Resend. Contact system admin. (${data.senderUsed || msg})`;
      return { success: false, error: msg, code };
    }

    return {
      success: true,
      message: data?.message || 'Email resent successfully',
    };
  } catch (error) {
    console.error('[Onboarding] Resend error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
    };
  }
}

// ============================================
// Status Helpers
// ============================================

export function getStatusLabel(status: OnboardingStatus): string {
  const labels: Record<OnboardingStatus, string> = {
    pending_ceo_review: 'Pending CEO Review',
    ceo_selected: 'CEO Selected',
    ceo_rejected: 'Rejected',
    admin_completed: 'Completed',
    documents_submitted: 'Documents Submitted',
    pending_hr: 'Pending HR',
    hr_review: 'HR Review',
    hr_verified: 'HR Verified',
    correction_requested: 'Correction Requested',
    rejected: 'Rejected',
    active: 'Active',
  };
  return labels[status];
}

export function getStatusColorClass(status: OnboardingStatus): string {
  const colors: Record<OnboardingStatus, string> = {
    pending_ceo_review: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    ceo_selected: 'bg-blue-100 text-blue-800 border-blue-200',
    ceo_rejected: 'bg-red-100 text-red-800 border-red-200',
    admin_completed: 'bg-green-100 text-green-800 border-green-200',
    documents_submitted: 'bg-purple-100 text-purple-800 border-purple-200',
    pending_hr: 'bg-orange-100 text-orange-800 border-orange-200',
    hr_review: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    hr_verified: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    correction_requested: 'bg-amber-100 text-amber-800 border-amber-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
    active: 'bg-green-100 text-green-800 border-green-200',
  };
  return colors[status];
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate email format (RFC 5322 simplified)
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > 254) return false;
  // Reject consecutive dots, leading/trailing dots in local part
  const emailRegex = /^[a-zA-Z0-9]([a-zA-Z0-9._%+\-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
  return emailRegex.test(trimmed);
}

/**
 * Validate full name — allows letters, spaces, hyphens, apostrophes, periods, accented chars
 */
export function isValidFullName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && /^[\p{L}\s.''\-]+$/u.test(trimmed);
}

/**
 * Validate resume file
 */
export function validateResumeFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!file || file.size === 0) {
    return { valid: false, error: 'File appears to be empty or corrupted' };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only PDF and Word documents are allowed' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 5MB' };
  }

  return { valid: true };
}

/**
 * Onboarding documents interface
 */
export interface OnboardingDocuments {
  contactNumber: string;
  emergencyContactNumber: string;
  parentsNumber: string;
  permanentAddress: string;
  currentAddress: string;
  aadhaarFile: File | null;
  passbookFile: File | null;
  marksheet10File: File | null;
  marksheet12File: File | null;
  degreeMarksheetFile: File | null;
  resumeFile: File | null;
  photoFile: File | null;
  hrPolicyFile: File | null;
  offerLetterFile: File | null;
  hrPolicyAccepted: boolean;
  offerLetterAccepted: boolean;
}

export async function getOnboardingByToken(token: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('onboarding_requests')
      .select('*')
      .eq('activation_token', token)
      .single();

    if (error) {
      console.error('Error fetching onboarding:', error);
      return { success: false, error: 'Invalid or expired token' };
    }

    // Check if token is expired
    const onboardingData = data as Record<string, any>;
    if (onboardingData.token_expires_at && new Date(onboardingData.token_expires_at) < new Date()) {
      return { success: false, error: 'Token has expired' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: 'An error occurred' };
  }
}

export async function uploadDocument(file: File, path: string, token?: string): Promise<string | null> {
  // Validate token expiry before uploading if token is provided
  if (token) {
    const tokenCheck = await getOnboardingByToken(token);
    if (!tokenCheck.success) {
      console.error('Token invalid or expired before upload');
      return null;
    }
  }
  try {
    const { data, error } = await supabase.storage
      .from('onboarding-documents')
      .upload(`${path}/${Date.now()}_${file.name}`, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('onboarding-documents')
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('Upload error:', error);
    return null;
  }
}

export async function submitOnboardingDocuments(token: string, documents: OnboardingDocuments) {
  try {
    // Get onboarding record
    const { data: onboarding, error: fetchError } = await supabase
      .from('onboarding_requests')
      .select('*')
      .eq('activation_token', token)
      .single();

    if (fetchError || !onboarding) {
      return { success: false, error: 'Invalid token or record not found' };
    }

    // Check token expiry before submitting
    if (onboarding.token_expires_at && new Date(onboarding.token_expires_at) < new Date()) {
      return { success: false, error: 'Your activation link has expired. Please contact HR for a new invitation.' };
    }

    const updateData: any = {
      contact_number: documents.contactNumber,
      emergency_contact_number: documents.emergencyContactNumber,
      parents_number: documents.parentsNumber,
      permanent_address: documents.permanentAddress,
      current_address: documents.currentAddress,
      hr_policy_accepted: documents.hrPolicyAccepted,
      offer_letter_accepted: documents.offerLetterAccepted,
      status: 'documents_submitted',
      documents_submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Upload documents
    const onboardingId = onboarding.id;

    if (documents.contactNumber) {
      updateData.contact_number = documents.contactNumber;
    }

    if (documents.emergencyContactNumber) {
      updateData.emergency_contact_number = documents.emergencyContactNumber;
    }

    if (documents.parentsNumber) {
      updateData.parents_number = documents.parentsNumber;
    }

    if (documents.permanentAddress) {
      updateData.permanent_address = documents.permanentAddress;
    }

    if (documents.currentAddress) {
      updateData.current_address = documents.currentAddress;
    }

    if (documents.aadhaarFile) {
      const url = await uploadDocument(documents.aadhaarFile, `aadhaar/${onboardingId}`);
      if (url) updateData.aadhaar_url = url;
    }
    if (documents.passbookFile) {
      const url = await uploadDocument(documents.passbookFile, `passbook/${onboardingId}`);
      if (url) updateData.passbook_url = url;
    }
    if (documents.marksheet10File) {
      const url = await uploadDocument(documents.marksheet10File, `marksheet10/${onboardingId}`);
      if (url) updateData.marksheet_10_url = url;
    }
    if (documents.marksheet12File) {
      const url = await uploadDocument(documents.marksheet12File, `marksheet12/${onboardingId}`);
      if (url) updateData.marksheet_12_url = url;
    }
    if (documents.degreeMarksheetFile) {
      const url = await uploadDocument(documents.degreeMarksheetFile, `degree/${onboardingId}`);
      if (url) updateData.degree_marksheet_url = url;
    }
    if (documents.resumeFile) {
      const url = await uploadDocument(documents.resumeFile, `resume/${onboardingId}`);
      if (url) updateData.resume_url = url;
    }
    if (documents.photoFile) {
      const url = await uploadDocument(documents.photoFile, `photo/${onboardingId}`);
      if (url) updateData.photo_url = url;
    }
    if (documents.hrPolicyFile) {
      const url = await uploadDocument(documents.hrPolicyFile, `hr-policy/${onboardingId}`);
      if (url) updateData.hr_policy_url = url;
    }
    if (documents.offerLetterFile) {
      const url = await uploadDocument(documents.offerLetterFile, `offer-letter/${onboardingId}`);
      if (url) updateData.offer_letter_url = url;
    }

    // Update onboarding record
    const { error: updateError } = await supabase
      .from('onboarding_requests')
      .update(updateData)
      .eq('id', onboardingId);

    if (updateError) {
      console.error('Update error:', updateError);
      return { success: false, error: 'Failed to update onboarding record' };
    }

    return { success: true };
  } catch (error) {
    console.error('Submit error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// HR Dashboard Functions
export async function getPendingOnboardingRequests() {
  try {
    const { data, error } = await supabase
      .from('onboarding_requests')
      .select('*')
      .in('status', ['documents_submitted', 'pending_hr', 'hr_review'])
      .order('documents_submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching requests:', error);
      return { success: false, error: 'Failed to fetch requests' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: 'An error occurred' };
  }
}

export async function approveOnboarding(onboardingId: string, hrNotes?: string) {
  try {
    console.log('[OnboardingService] Approving onboarding:', onboardingId);
    
    // Get the onboarding record
    const { data: onboarding, error: fetchError } = await supabase
      .from('onboarding_requests')
      .select('*')
      .eq('id', onboardingId)
      .single();

    if (fetchError || !onboarding) {
      console.error('[OnboardingService] Onboarding record not found:', fetchError);
      return { success: false, error: 'Onboarding record not found' };
    }

    console.log('[OnboardingService] Found onboarding record:', {
      id: onboarding.id,
      email: onboarding.email,
      status: onboarding.status,
      auth_user_id: onboarding.auth_user_id,
    });

    // Update onboarding status
    const { error: updateError } = await supabase
      .from('onboarding_requests')
      .update({
        status: 'hr_verified',
        hr_verified_at: new Date().toISOString(),
        hr_verified_by: (await supabase.auth.getUser()).data.user?.id,
        hr_notes: hrNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', onboardingId);

    if (updateError) {
      console.error('[OnboardingService] Update error:', updateError);
      return { success: false, error: 'Failed to approve onboarding' };
    }

    console.log('[OnboardingService] Onboarding status updated to hr_verified');

    // Activate user account if auth_user_id exists
    if (onboarding.auth_user_id) {
      console.log('[OnboardingService] Activating user account:', onboarding.auth_user_id);
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          account_activated: true,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', onboarding.auth_user_id);

      if (profileError) {
        console.error('[OnboardingService] Profile update error:', profileError);
        // Continue - onboarding is still approved even if profile update fails
      } else {
        console.log('[OnboardingService] User account activated successfully');
      }
    } else {
      console.warn('[OnboardingService] No auth_user_id found for onboarding:', onboardingId);
    }

    return { success: true, message: 'Onboarding approved and account activated' };
  } catch (error) {
    console.error('[OnboardingService] Approve error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function rejectOnboarding(onboardingId: string, reason: string) {
  try {
    const { error } = await supabase
      .from('onboarding_requests')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejected_by: (await supabase.auth.getUser()).data.user?.id,
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', onboardingId);

    if (error) {
      console.error('Reject error:', error);
      return { success: false, error: 'Failed to reject onboarding' };
    }

    return { success: true };
  } catch (error) {
    console.error('Reject error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function requestDocumentsCorrection(onboardingId: string, correctionNotes: string) {
  try {
    const { error } = await supabase
      .from('onboarding_requests')
      .update({
        status: 'correction_requested',
        correction_requested_at: new Date().toISOString(),
        correction_notes: correctionNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', onboardingId);

    if (error) {
      console.error('Correction request error:', error);
      return { success: false, error: 'Failed to request correction' };
    }

    return { success: true };
  } catch (error) {
    console.error('Correction request error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
