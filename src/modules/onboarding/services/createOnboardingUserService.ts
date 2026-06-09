/**
 * New User Creation Service - Atomic User Creation + Email
 * 
 * This service creates onboarding invitations with guaranteed email delivery.
 * If email fails, the entire operation fails - no partial success.
 */

import { supabase } from '@/integrations/supabase/client';
import type { EmployeeOnboardingRequest } from '../types/prejoining.types';

export interface CreateOnboardingUserParams {
  fullName: string;
  email: string;
  department: string;
  generatedUsername: string;
  generatedPassword: string;
}

export interface CreateOnboardingUserResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  onboardingId?: string;
  activationLink?: string;
  emailSent?: boolean;
}

/**
 * Create new onboarding user with guaranteed email delivery
 * 
 * This function:
 * 1. Generates activation token and link
 * 2. Creates onboarding record
 * 3. SENDS EMAIL (mandatory)
 * 4. If email fails → rolls back everything and returns error
 * 5. If email succeeds → marks record as complete and returns success
 * 
 * NO PARTIAL SUCCESS - either everything works or nothing is created.
 */
export async function createOnboardingUser(
  params: CreateOnboardingUserParams
): Promise<CreateOnboardingUserResponse> {
  try {
    console.log('[CreateOnboardingUser] Starting atomic creation...');
    console.log('[CreateOnboardingUser] Params:', {
      fullName: params.fullName,
      email: params.email,
      department: params.department,
      username: params.generatedUsername,
    });

    // Call the Edge Function
    const { data, error } = await supabase.functions.invoke('create-onboarding-user', {
      body: {
        fullName: params.fullName,
        email: params.email,
        department: params.department,
        generatedUsername: params.generatedUsername,
        generatedPassword: params.generatedPassword,
      },
    });

    console.log('[CreateOnboardingUser] Edge Function response:', { data, error });

    // Handle invocation errors (network, deployment, etc.)
    if (error) {
      console.error('[CreateOnboardingUser] Edge Function invocation error:', error);
      
      let errorMessage = 'Failed to create onboarding user';
      let details = error.message;
      
      if (error.message?.includes('non-2xx status code')) {
        errorMessage = 'Server error while creating user';
        details = 'The Edge Function returned an error. Check Supabase logs.';
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error';
        details = 'Cannot connect to server. Check your internet connection.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Request timed out';
        details = 'The operation took too long. Please try again.';
      }
      
      return {
        success: false,
        error: errorMessage,
        details,
      };
    }

    // Handle structured error responses from the Edge Function
    if (data && !data.success) {
      console.error('[CreateOnboardingUser] Edge Function returned error:', data);
      
      return {
        success: false,
        error: data.error || 'Failed to create onboarding user',
        details: data.details || data.message,
      };
    }

    // Success!
    console.log('[CreateOnboardingUser] SUCCESS:', data);
    
    return {
      success: true,
      message: data.message || 'Onboarding invitation created and email sent successfully',
      onboardingId: data.onboardingId,
      activationLink: data.activationLink,
      emailSent: data.emailSent,
    };

  } catch (error) {
    console.error('[CreateOnboardingUser] Unexpected error:', error);
    return {
      success: false,
      error: 'Unexpected error occurred',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Resend onboarding email for existing invitation
 */
export async function resendOnboardingEmail(
  onboardingId: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
}> {
  try {
    console.log('[ResendOnboardingEmail] Resending for onboarding:', onboardingId);

    const { data, error } = await supabase.functions.invoke('resend-onboarding-email', {
      body: { onboardingId },
    });

    console.log('[ResendOnboardingEmail] Edge Function response:', { data, error });

    if (error) {
      console.error('[ResendOnboardingEmail] Invocation error:', error);
      return {
        success: false,
        error: 'Failed to resend email',
        details: error.message,
      };
    }

    if (data && !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to resend email',
        details: data.details,
      };
    }

    return {
      success: true,
      message: data.message || 'Email resent successfully',
    };

  } catch (error) {
    console.error('[ResendOnboardingEmail] Unexpected error:', error);
    return {
      success: false,
      error: 'Unexpected error occurred',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get pending onboarding invitations (status = 'invited')
 */
export async function getPendingInvitations(): Promise<EmployeeOnboardingRequest[]> {
  try {
    const { data, error } = await supabase
      .from('employee_onboarding_requests')
      .select('*')
      .eq('status', 'invited')
      .order('invited_at', { ascending: false });

    if (error) throw error;

    return (data || []) as EmployeeOnboardingRequest[];
  } catch (error) {
    console.error('[GetPendingInvitations] Error:', error);
    throw error;
  }
}

/**
 * Delete onboarding invitation (for cleanup if needed)
 */
export async function deleteOnboardingInvitation(
  onboardingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('employee_onboarding_requests')
      .delete()
      .eq('id', onboardingId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('[DeleteOnboardingInvitation] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete',
    };
  }
}
