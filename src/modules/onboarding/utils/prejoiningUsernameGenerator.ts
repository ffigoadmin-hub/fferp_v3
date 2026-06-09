/**
 * Username Generator Utility - Pre-Joining Onboarding
 * 
 * Generates unique usernames from employee names for email-based login.
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Clean text by removing special characters and converting to lowercase
 */
export function cleanText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Generate base username from full name
 * Rules:
 * - Convert to lowercase
 * - Remove spaces, dots, special characters
 * - Keep only letters and numbers
 * - No random digits added here
 * 
 * Examples:
 * - "Arun Kumar" → "arunkumar"
 * - "HEMALATHA.T" → "hemalathat"
 * - "Test User" → "testuser"
 */
export function generateBaseUsername(fullName: string): string {
  return cleanText(fullName);
}

/**
 * Check if username already exists in profiles table
 */
export async function checkUsernameExists(username: string): Promise<boolean> {
  try {
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('id')
      .eq('username', username)
      .limit(1);

    if (error) {
      console.error('[UsernameGenerator] Error checking username:', error);
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.error('[UsernameGenerator] Exception checking username:', err);
    return false;
  }
}

/**
 * Ensure username is unique by appending 2-digit number if needed
 * Only adds digits if duplicate exists
 */
export async function ensureUniqueUsername(username: string): Promise<string> {
  let uniqueUsername = username;
  let attempts = 0;
  const maxAttempts = 100;

  while (await checkUsernameExists(uniqueUsername)) {
    attempts++;
    if (attempts >= maxAttempts) {
      // Fallback: append timestamp
      uniqueUsername = `${username}${Date.now().toString().slice(-4)}`;
      break;
    }
    // Append 2 random digits (10-99)
    const randomSuffix = Math.floor(Math.random() * 90 + 10);
    uniqueUsername = `${username}${randomSuffix}`;
  }

  return uniqueUsername;
}

/**
 * Generate unique username from full name
 * Only adds digits if duplicate exists
 * 
 * @param fullName - Employee full name
 * @returns Promise<string> - Unique username without @domain
 * 
 * Examples:
 * - "Arun Kumar" → "arunkumar" (if available) or "arunkumar24" (if taken)
 * - "HEMALATHA.T" → "hemalathat" or "hemalathat45"
 */
export async function generateUsername(fullName: string): Promise<string> {
  const baseUsername = generateBaseUsername(fullName);
  const uniqueUsername = await ensureUniqueUsername(baseUsername);
  
  console.log('[UsernameGenerator] Generated username:', {
    fullName,
    baseUsername,
    uniqueUsername,
  });

  return uniqueUsername;
}

/**
 * Generate email-format username from full name
 * Format: {cleanedName}@igogroups.in
 * Only adds digits before @ if duplicate exists
 * 
 * Examples:
 * - "Arun Kumar" → "arunkumar@igogroups.in"
 * - "Arun Kumar" (if taken) → "arunkumar24@igogroups.in"
 */
export async function generateEmailUsername(fullName: string): Promise<string> {
  const baseUsername = generateBaseUsername(fullName);
  const uniqueUsername = await ensureUniqueUsername(baseUsername);
  
  console.log('[UsernameGenerator] Generated email username:', {
    fullName,
    uniqueEmail: `${uniqueUsername}@igogroups.in`,
  });
  
  return `${uniqueUsername}@igogroups.in`;
}

/**
 * Sync version for UI preview - no DB check
 * Generates clean name only, no random digits
 */
export function generateUsernamePreview(fullName: string): string {
  return generateBaseUsername(fullName);
}

/**
 * Sync version for email preview
 */
export function generateEmailPreview(fullName: string): string {
  return `${generateBaseUsername(fullName)}@igogroups.in`;
}

/**
 * Batch generate usernames with uniqueness check across batch
 */
export async function generateUsernamesBatch(
  names: string[]
): Promise<Map<string, string>> {
  const usernameMap = new Map<string, string>();
  const usedUsernames = new Set<string>();

  for (const name of names) {
    let baseUsername = generateBaseUsername(name);
    let uniqueUsername = baseUsername;
    let suffix = 10;

    // Check against database and already generated in this batch
    while (
      (await checkUsernameExists(uniqueUsername)) ||
      usedUsernames.has(uniqueUsername)
    ) {
      uniqueUsername = `${baseUsername}${suffix}`;
      suffix++;
    }

    usedUsernames.add(uniqueUsername);
    usernameMap.set(name, uniqueUsername);
  }

  return usernameMap;
}

/**
 * Extract username part from email
 * "arunkumar@igogroups.in" → "arunkumar"
 */
export function extractUsernameFromEmail(emailUsername: string): string {
  return emailUsername.split('@')[0];
}

/**
 * Validate if string is in email username format
 */
export function isEmailUsernameFormat(value: string): boolean {
  return value.includes('@') && value.endsWith('@igogroups.in');
}
