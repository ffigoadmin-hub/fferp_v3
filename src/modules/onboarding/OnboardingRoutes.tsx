import { Route, Routes } from 'react-router-dom';
import NewUserPage from './pages/NewUserPage';
import HrAccessPage from './pages/HrAccessPage';
import OnboardingPage from './pages/OnboardingPage';

/**
 * Pre-Joining Onboarding Routes
 * 
 * /onboarding/new-user - HR creates invitation
 * /onboarding/hr-access - HR verifies submissions
 * /onboarding?token=xxx - Employee fills form (main onboarding page)
 */
export function OnboardingRoutes() {
  return (
    <Routes>
      <Route path="new-user" element={<NewUserPage />} />
      <Route path="hr-access" element={<HrAccessPage />} />
      <Route path="/" element={<OnboardingPage />} />
    </Routes>
  );
}

export default OnboardingRoutes;
