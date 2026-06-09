/**
 * PRODUCTION DOMAIN CONFIGURATION
 * 
 * IMPORTANT - Production Deployment Checklist:
 * =============================================
 * 
 * BEFORE switching to custom domain:
 * 1. Ensure domain is connected in Vercel dashboard
 * 2. Verify SSL certificate is issued and active
 * 3. Check DNS A/CNAME records are correct
 * 4. Test domain with https:// before going live
 * 
 * FALLBACK STRATEGY:
 * - If custom domain SSL is not ready, use Vercel URL
 * - Update APP_BASE_URL when SSL is confirmed working
 * - Never send custom-domain links until SSL is verified
 */

// ============================================
// PRIMARY CONFIGURATION - CHANGE THIS
// ============================================

/** 
 * FINAL PRODUCTION DOMAIN
 * - Use Vercel URL until SSL is ready: https://your-project.vercel.app
 * - Then switch to: https://www.igogroup.in/ (once SSL is confirmed working)
 * - CORRECT DOMAIN: https://www.igogroup.in/
 */
export const APP_BASE_URL = import.meta.env.VITE_APP_BASE_URL || 'https://www.igogroup.in/';

/** 
 * ALTERNATIVE FALLBACK URL 
 * - Used when primary domain has SSL issues
 * - Always use HTTPS
 */
export const APP_FALLBACK_URL = import.meta.env.VITE_APP_FALLBACK_URL || 'https://www.igogroup.in/';

// ============================================
// DOMAIN VALIDATION
// ============================================

/**
 * Check if current domain has SSL issues
 * Returns true if we should redirect to fallback
 */
export function shouldUseFallbackDomain(): boolean {
  // Check if we're in browser environment
  if (typeof window === 'undefined') return false;
  
  const currentHost = window.location.host;
  const currentProtocol = window.location.protocol;
  
  // If not HTTPS, we have an SSL issue
  if (currentProtocol !== 'https:' && !window.location.hostname.includes('localhost')) {
    return true;
  }
  
  // If we're getting SSL protocol errors or wrong domain, fallback
  const problematicDomains = ['igogroups.in']; // Wrong domain with 's' - redirect to correct domain
  if (problematicDomains.some(domain => currentHost.includes(domain))) {
    return true;
  }
  
  return false;
}

/**
 * Get the safe base URL to use
 * Uses fallback if current domain has SSL issues
 */
export function getSafeBaseUrl(): string {
  if (shouldUseFallbackDomain()) {
    return APP_FALLBACK_URL;
  }
  return APP_BASE_URL;
}

// ============================================
// ONBOARDING URL GENERATORS
// ============================================

/**
 * Generate onboarding link with token
 * Always uses the safe/verified base URL
 */
export function generateOnboardingLink(token: string): string {
  const baseUrl = getSafeBaseUrl();
  // Ensure no trailing slash issues
  const cleanBase = baseUrl.replace(/\/$/, '');
  return `${cleanBase}/onboarding?token=${token}`;
}

/**
 * Generate activation link for email
 * Used by backend functions via API call
 */
export function generateActivationLink(token: string): string {
  return generateOnboardingLink(token);
}

// ============================================
// REDIRECT HANDLERS
// ============================================

/**
 * Redirect to safe domain if current domain has SSL issues
 * Preserves all query parameters including token
 */
export function redirectToSafeDomain(): void {
  if (typeof window === 'undefined') return;
  
  const currentUrl = new URL(window.location.href);
  const targetBase = APP_FALLBACK_URL;
  
  // Build new URL preserving path and query
  const targetUrl = new URL(currentUrl.pathname + currentUrl.search, targetBase);
  
  console.log('[DomainRedirect] Redirecting to safe domain:', targetUrl.toString());
  window.location.replace(targetUrl.toString());
}

/**
 * Check domain on page load and redirect if needed
 * Call this in onboarding page useEffect
 */
export function checkAndRedirectDomain(): boolean {
  if (shouldUseFallbackDomain()) {
    redirectToSafeDomain();
    return true; // Redirecting
  }
  return false; // Stay on current domain
}
