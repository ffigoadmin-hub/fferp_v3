import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { checkEmployeeOnboardingStatus } from '../services/prejoiningOnboardingService';
import { Loader2, AlertCircle } from 'lucide-react';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

/**
 * OnboardingGuard - Protects ERP routes from unverified employees
 * 
 * If employee onboarding is not verified:
 * - Shows pending message
 * - Blocks access to ERP dashboard
 * 
 * If verified:
 * - Allows normal ERP access
 */
export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<{
    isActive: boolean;
    status?: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/login');
      return;
    }

    checkOnboardingStatus();
  }, [user, authLoading]);

  const checkOnboardingStatus = async () => {
    if (!user?.email) {
      setChecking(false);
      return;
    }

    try {
      const status = await checkEmployeeOnboardingStatus(user.email);
      setOnboardingStatus(status);
    } catch (error) {
      console.error('[OnboardingGuard] Error checking status:', error);
    } finally {
      setChecking(false);
    }
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // If no user, redirect handled above
  if (!user) return null;

  // If onboarding is active/verified, allow access
  if (onboardingStatus?.isActive) {
    return <>{children}</>;
  }

  // If onboarding is not verified, show blocking message
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
      <div className="max-w-md w-full bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-3">Account Pending Verification</h2>
        <p className="text-gray-400 mb-4">
          {onboardingStatus?.message || 'Your account is being processed. Please contact HR for assistance.'}
        </p>
        
        {onboardingStatus?.status === 'invited' && (
          <div className="bg-blue-900/20 border border-blue-800 rounded p-3 mb-4">
            <p className="text-sm text-blue-300">
              Please check your email for the onboarding invitation link and complete your profile.
            </p>
          </div>
        )}

        {onboardingStatus?.status === 'details_submitted' && (
          <div className="bg-yellow-900/20 border border-yellow-800 rounded p-3 mb-4">
            <p className="text-sm text-yellow-300">
              Your details have been submitted and are currently under HR review. You will receive an email once your account is activated.
            </p>
          </div>
        )}

        {onboardingStatus?.status === 'correction_requested' && (
          <div className="bg-orange-900/20 border border-orange-800 rounded p-3 mb-4">
            <p className="text-sm text-orange-300">
              HR has requested corrections to your onboarding details. Please check your email for the correction link.
            </p>
          </div>
        )}

        {onboardingStatus?.status === 'rejected' && (
          <div className="bg-red-900/20 border border-red-800 rounded p-3 mb-4">
            <p className="text-sm text-red-300">
              Your onboarding request has been rejected. Please contact HR for more information.
            </p>
          </div>
        )}

        <button
          onClick={() => navigate('/login')}
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}

export default OnboardingGuard;
