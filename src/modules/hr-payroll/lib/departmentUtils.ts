/**
 * Department utilities for HR Payroll module
 * Provides reusable helpers for department display, selection, and formatting
 */

import { Building2, Briefcase, Factory, Leaf, Users, Wallet, ShoppingCart, Code, Cpu, Truck, Utensils, Stethoscope } from 'lucide-react';

// Fallback department list when master data is unavailable
export const DEFAULT_DEPARTMENTS = [
  'HR',
  'Finance',
  'Engineering',
  'Sales',
  'Marketing',
  'Operations',
  'Admin',
  'Agri',
  'Nursery',
  'Accounts',
  'IT',
  'Logistics',
  'Procurement',
  'Quality',
  'R&D',
  'Support',
  'Management',
] as const;

export type Department = string;

/**
 * Department configuration with icons and colors for UI display
 */
export interface DepartmentConfig {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  gradient: string;
  label: string;
  emoji: string;
}

/**
 * Get department configuration for visual display
 */
export function getDepartmentConfig(dept: string | null | undefined): DepartmentConfig {
  const deptLower = (dept || '').toLowerCase().trim();
  
  if (!deptLower || deptLower === 'unknown' || deptLower === 'null' || deptLower === 'undefined') {
    return {
      icon: Briefcase,
      color: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
      gradient: 'from-slate-500/20 to-slate-600/10',
      label: 'Not Assigned',
      emoji: '📋',
    };
  }

  if (deptLower.includes('hr') || deptLower.includes('human resource')) {
    return {
      icon: Users,
      color: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
      gradient: 'from-pink-500/20 to-pink-600/10',
      label: dept || 'HR',
      emoji: '👥',
    };
  }

  if (deptLower.includes('finance') || deptLower.includes('accounts') || deptLower.includes('accounting')) {
    return {
      icon: Wallet,
      color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
      gradient: 'from-emerald-500/20 to-emerald-600/10',
      label: dept || 'Finance',
      emoji: '💰',
    };
  }

  if (deptLower.includes('eng') || deptLower === 'engineering' || deptLower.includes('tech') || deptLower.includes('development')) {
    return {
      icon: Code,
      color: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      gradient: 'from-blue-500/20 to-blue-600/10',
      label: dept || 'Engineering',
      emoji: '💻',
    };
  }

  if (deptLower.includes('sales') || deptLower.includes('business')) {
    return {
      icon: ShoppingCart,
      color: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
      gradient: 'from-amber-500/20 to-amber-600/10',
      label: dept || 'Sales',
      emoji: '🛒',
    };
  }

  if (deptLower.includes('marketing')) {
    return {
      icon: Building2,
      color: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
      gradient: 'from-purple-500/20 to-purple-600/10',
      label: dept || 'Marketing',
      emoji: '📢',
    };
  }

  if (deptLower.includes('agri') || deptLower.includes('farm') || deptLower.includes('nursery') || deptLower.includes('agriculture')) {
    return {
      icon: Leaf,
      color: 'bg-green-500/20 text-green-400 border-green-500/50',
      gradient: 'from-green-500/20 to-green-600/10',
      label: dept || 'Agri',
      emoji: '🌾',
    };
  }

  if (deptLower.includes('operation') || deptLower.includes('ops')) {
    return {
      icon: Factory,
      color: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
      gradient: 'from-orange-500/20 to-orange-600/10',
      label: dept || 'Operations',
      emoji: '⚙️',
    };
  }

  if (deptLower.includes('admin')) {
    return {
      icon: Building2,
      color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
      gradient: 'from-cyan-500/20 to-cyan-600/10',
      label: dept || 'Admin',
      emoji: '🏢',
    };
  }

  if (deptLower.includes('it') || deptLower.includes('information technology')) {
    return {
      icon: Cpu,
      color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50',
      gradient: 'from-indigo-500/20 to-indigo-600/10',
      label: dept || 'IT',
      emoji: '💻',
    };
  }

  if (deptLower.includes('logistic') || deptLower.includes('supply') || deptLower.includes('warehouse')) {
    return {
      icon: Truck,
      color: 'bg-rose-500/20 text-rose-400 border-rose-500/50',
      gradient: 'from-rose-500/20 to-rose-600/10',
      label: dept || 'Logistics',
      emoji: '🚚',
    };
  }

  if (deptLower.includes('procurement') || deptLower.includes('purchase')) {
    return {
      icon: ShoppingCart,
      color: 'bg-teal-500/20 text-teal-400 border-teal-500/50',
      gradient: 'from-teal-500/20 to-teal-600/10',
      label: dept || 'Procurement',
      emoji: '🛍️',
    };
  }

  if (deptLower.includes('quality') || deptLower.includes('qa')) {
    return {
      icon: Stethoscope,
      color: 'bg-violet-500/20 text-violet-400 border-violet-500/50',
      gradient: 'from-violet-500/20 to-violet-600/10',
      label: dept || 'Quality',
      emoji: '✅',
    };
  }

  if (deptLower.includes('support') || deptLower.includes('service')) {
    return {
      icon: Users,
      color: 'bg-sky-500/20 text-sky-400 border-sky-500/50',
      gradient: 'from-sky-500/20 to-sky-600/10',
      label: dept || 'Support',
      emoji: '🎧',
    };
  }

  if (deptLower.includes('management') || deptLower.includes('executive')) {
    return {
      icon: Briefcase,
      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      gradient: 'from-yellow-500/20 to-yellow-600/10',
      label: dept || 'Management',
      emoji: '👔',
    };
  }

  // Default fallback
  return {
    icon: Briefcase,
    color: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
    gradient: 'from-slate-500/20 to-slate-600/10',
    label: dept || 'Others',
    emoji: '📋',
  };
}

/**
 * Format department list for batch display
 * Handles single department, multiple departments, and missing data
 */
export function formatBatchDepartment(
  departments: string[] | string | null | undefined,
  options: { maxDisplay?: number; showCount?: boolean } = {}
): string {
  const { maxDisplay = 3, showCount = true } = options;

  // Handle null/undefined
  if (!departments) {
    return 'Department Not Assigned';
  }

  // Convert string to array if needed
  let deptArray: string[];
  if (typeof departments === 'string') {
    // Handle potential encoding issues by cleaning the string
    const cleaned = sanitizeDepartmentString(departments);
    deptArray = cleaned ? [cleaned] : [];
  } else {
    deptArray = departments
      .map(d => sanitizeDepartmentString(d))
      .filter(Boolean);
  }

  // Remove duplicates
  const uniqueDepts = Array.from(new Set(deptArray));

  if (uniqueDepts.length === 0) {
    return 'Department Not Assigned';
  }

  if (uniqueDepts.length === 1) {
    return `Department: ${uniqueDepts[0]}`;
  }

  // Multiple departments
  const displayList = uniqueDepts.slice(0, maxDisplay);
  const remaining = uniqueDepts.length - maxDisplay;

  if (remaining > 0 && showCount) {
    return `Multi Department: ${displayList.join(', ')} +${remaining} more`;
  }

  return `Multi Department: ${uniqueDepts.join(', ')}`;
}

/**
 * Get a short display format for batch cards
 */
export function formatBatchDepartmentShort(
  departments: string[] | string | null | undefined
): { text: string; isMulti: boolean; count: number } {
  if (!departments) {
    return { text: 'Not Assigned', isMulti: false, count: 0 };
  }

  let deptArray: string[];
  if (typeof departments === 'string') {
    const cleaned = sanitizeDepartmentString(departments);
    deptArray = cleaned ? [cleaned] : [];
  } else {
    deptArray = departments
      .map(d => sanitizeDepartmentString(d))
      .filter(Boolean);
  }

  const uniqueDepts = Array.from(new Set(deptArray));

  if (uniqueDepts.length === 0) {
    return { text: 'Not Assigned', isMulti: false, count: 0 };
  }

  if (uniqueDepts.length === 1) {
    return { text: uniqueDepts[0], isMulti: false, count: 1 };
  }

  return {
    text: `${uniqueDepts.slice(0, 2).join(', ')}${uniqueDepts.length > 2 ? ` +${uniqueDepts.length - 2}` : ''}`,
    isMulti: true,
    count: uniqueDepts.length,
  };
}

/**
 * Sanitize department string to fix encoding issues and remove garbage characters
 */
export function sanitizeDepartmentString(dept: string | null | undefined): string {
  if (!dept) return '';
  
  return dept
    // Remove zero-width characters and other invisible unicode
    .replace(/[\u200B-\u200D\uFEFF\u00a0]/g, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    // Fix common encoding artifacts
    .replace(/â€[“”]/g, '-')
    .replace(/â€[˜']/g, "'")
    .replace(/â€[""]/g, '"')
    // Remove em dash, en dash artifacts
    .replace(/â€”/g, '')
    .replace(/â€“/g, '')
    // Trim whitespace
    .trim();
}

/**
 * Extract unique departments from batch employees
 */
export function extractDepartmentsFromEmployees(
  employees: Array<{ department?: string | null }>
): string[] {
  const depts = employees
    .map(e => sanitizeDepartmentString(e.department))
    .filter(Boolean);
  
  return Array.from(new Set(depts));
}
