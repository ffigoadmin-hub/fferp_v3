/**
 * Password Generator Utility - Pre-Joining Onboarding
 * 
 * Generates temporary passwords for employee onboarding.
 */

// Department to short code mapping
export const DEPARTMENT_SHORT_CODES: Record<string, string> = {
  'HR': 'hr',
  'IT': 'it',
  'Admin': 'adm',
  'Accounts': 'acc',
  'Marketing': 'mkt',
  'Sales': 'sal',
  'Operations': 'ops',
  'Farm': 'fm',
  'Purchase': 'pur',
  'R&D': 'rd',
  'Chennai Warehouse': 'cw',
  'Buy-Back': 'bb',
};

/**
 * Clean text for password generation
 * - Lowercase
 * - Remove spaces
 * - Remove special characters
 * - Keep only letters and numbers
 */
export function cleanForPassword(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Get department code for password
 * Uses short code if available, otherwise cleans full department name
 */
export function getDepartmentCode(department: string): string {
  // Check for exact match in short codes
  if (DEPARTMENT_SHORT_CODES[department]) {
    return DEPARTMENT_SHORT_CODES[department];
  }

  // Check case-insensitive match
  const upperDept = department.toUpperCase();
  for (const [key, code] of Object.entries(DEPARTMENT_SHORT_CODES)) {
    if (key.toUpperCase() === upperDept) {
      return code;
    }
  }

  // Fallback: clean the department name
  return cleanForPassword(department);
}

/**
 * Generate temporary password
 * 
 * Format: {cleanedName}{departmentCode}#123
 * 
 * @param fullName - Employee full name
 * @param department - Employee department
 * @returns string - Temporary password
 * 
 * Examples:
 * - Name: "test", Dept: "IT" → "testit#123"
 * - Name: "arun", Dept: "HR" → "arunhr#123"
 * - Name: "priya", Dept: "Admin" → "priyaadm#123"
 * - Name: "yuthish priyan", Dept: "Operations" → "yuthishpriyanops#123"
 */
export function generateTemporaryPassword(
  fullName: string,
  department: string
): string {
  // Clean the full name
  const cleanedName = cleanForPassword(fullName);

  // Get department code
  const deptCode = getDepartmentCode(department);

  // Generate password
  const password = `${cleanedName}${deptCode}#123`;

  console.log('[PasswordGenerator] Generated password:', {
    fullName,
    department,
    cleanedName,
    deptCode,
    password,
  });

  return password;
}

/**
 * Alternative password with random suffix
 * More secure but less memorable
 */
export function generateSecureTemporaryPassword(
  fullName: string,
  department: string
): string {
  const cleanedName = cleanForPassword(fullName);
  const deptCode = getDepartmentCode(department);
  
  // Add random 3-digit suffix instead of fixed #123
  const randomSuffix = Math.floor(Math.random() * 900 + 100);
  
  return `${cleanedName}${deptCode}#${randomSuffix}`;
}

/**
 * Validate password meets minimum requirements
 * (For future use if allowing custom passwords)
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain lowercase letters');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain numbers');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Add custom department short code
 */
export function addDepartmentShortCode(
  department: string,
  code: string
): void {
  DEPARTMENT_SHORT_CODES[department] = code.toLowerCase();
}

/**
 * Get all department codes
 */
export function getAllDepartmentCodes(): Record<string, string> {
  return { ...DEPARTMENT_SHORT_CODES };
}

/**
 * Generate password preview (for UI display before sending)
 * Shows first and last 3 characters, masks middle with ***
 */
export function maskPasswordForPreview(password: string): string {
  if (password.length <= 8) {
    return '*'.repeat(password.length);
  }
  return password.slice(0, 3) + '***' + password.slice(-3);
}
