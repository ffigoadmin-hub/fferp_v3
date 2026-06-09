/**
 * OnboardingStatusBadge Component
 * 
 * Displays the status of an onboarding request with appropriate colors
 */

import { getStatusLabel, getStatusColorClass } from '../services/onboardingService';
import type { OnboardingStatus } from '../types/onboarding.types';

interface OnboardingStatusBadgeProps {
  status: OnboardingStatus;
  className?: string;
}

export function OnboardingStatusBadge({ status, className = '' }: OnboardingStatusBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
        ${getStatusColorClass(status)}
        ${className}
      `}
    >
      {getStatusLabel(status)}
    </span>
  );
}
