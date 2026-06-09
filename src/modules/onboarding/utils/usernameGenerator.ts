/**
 * Username Generator Utility
 * 
 * Generates unique usernames from employee names with duplicate detection.
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
 */
export function generateBaseUsername(fullName: string): string {
  return cleanText(fullName);
}

/**
 * Check if username already exists in profiles table
 */
export async function checkUsernameExists(username: string): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('id')
    .eq('username', username)
    .limit(1);

  if (error) {
    console.error('[UsernameGenerator] Error checking username:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Ensure username is unique by appending random digits if needed
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
    // Append 2-3 random digits
    const randomSuffix = Math.floor(Math.random() * 900 + 10); // 10-999
    uniqueUsername = `${username}${randomSuffix}`;
  }

  return uniqueUsername;
}

/**
 * Generate unique username from full name
 * 
 * @param fullName - Employee full name
 * @returns Promise<string> - Unique username
 * 
 * Examples:
 * - "Arun" → "arun" or "arun11" if taken
 * - "Yuthish Priyan" → "yuthishpriyan" or "yuthishpriyan82" if taken
 * - "HEMALATHA.T" → "hemalathat" or "hemalathat45" if taken
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
 * Format: {cleanedName}@igogroups.com
 * 
 * Examples:
 * - "Arun" → "arun@igogroups.com"
 * - "Yuthish Priyan" → "yuthishpriyan@igogroups.com"
 * - "HEMALATHA.T" → "hemalathat@igogroups.com"
 */
export function generateEmailUsername(fullName: string): string {
  const baseUsername = generateBaseUsername(fullName);
  return `${baseUsername}@igogroups.com`;
}

/**
 * Generate unique email-format username with duplicate check
 * If duplicate exists, appends digits before @ symbol
 */
export async function generateUniqueEmailUsername(fullName: string): Promise<string> {
  const baseUsername = generateBaseUsername(fullName);
  const emailUsername = `${baseUsername}@igogroups.com`;
  
  // Check if email username exists
  let uniqueEmail = emailUsername;
  let attempts = 0;
  const maxAttempts = 100;
  
  while (await checkUsernameExists(uniqueEmail)) {
    attempts++;
    if (attempts >= maxAttempts) {
      // Fallback: append timestamp
      uniqueEmail = `${baseUsername}${Date.now().toString().slice(-4)}@igogroups.com`;
      break;
    }
    // Append 2-3 random digits before @
    const randomSuffix = Math.floor(Math.random() * 900 + 10); // 10-999
    uniqueEmail = `${baseUsername}${randomSuffix}@igogroups.com`;
  }
  
  console.log('[UsernameGenerator] Generated email username:', {
    fullName,
    baseUsername,
    uniqueEmail,
  });
  
  return uniqueEmail;
}
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
