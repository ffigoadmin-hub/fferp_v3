// ─────────────────────────────────────────────────────────────
//  Shared Vendor store — Supabase only (no localStorage)
//  Reads from the same `vendors` table used by FFVendorPaymentForm
// ─────────────────────────────────────────────────────────────

import { supabase } from '@/integrations/supabase/client';

export interface StoredVendor {
  id: string;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  name?: string;          // raw `name` column from DB
  email?: string;
  workPhone?: string;
  mobile?: string;
  phone?: string;         // raw `phone` column from DB
  pan?: string;
  gstin?: string;
  isMsme?: boolean;
  currency?: string;
  billing?: Record<string, string>;
  banks?: any[];
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
  remarks?: string;
}

// ── DB row → StoredVendor ─────────────────────────────────────
function rowToVendor(row: any): StoredVendor {
  return {
    id:           row.id,
    companyName:  row.name ?? '',
    name:         row.name ?? '',
    email:        row.email ?? '',
    mobile:       row.phone ?? '',
    phone:        row.phone ?? '',
    gstin:        row.gstin ?? '',
    pan:          row.pan ?? '',
    bank_name:    row.bank_name ?? '',
    bank_account: row.bank_account ?? '',
    bank_ifsc:    row.bank_ifsc ?? '',
    banks: row.bank_name ? [{
      bankName:      row.bank_name,
      accountNumber: row.bank_account,
      ifscCode:      row.bank_ifsc,
    }] : [],
  };
}

/** Returns display name for a vendor */
export function vendorDisplayName(v: StoredVendor): string {
  return v.companyName?.trim() || v.name?.trim() ||
    `${v.firstName ?? ''} ${v.lastName ?? ''}`.trim() || 'Unknown';
}

/** Fetch all vendors from Supabase — use inside useQuery */
export async function fetchStoredVendors(): Promise<StoredVendor[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select('id, name, email, phone, gstin, pan, bank_name, bank_account, bank_ifsc')
    .order('name');
  if (error) { console.error('[vendorStore] fetchStoredVendors:', error.message); return []; }
  return (data ?? []).map(rowToVendor);
}

/** Fetch vendor names only — use inside useQuery */
export async function fetchVendorNames(): Promise<string[]> {
  const vendors = await fetchStoredVendors();
  return vendors.map(vendorDisplayName);
}

// ── Legacy sync shims ─────────────────────────────────────────
/** @deprecated use fetchStoredVendors() in useQuery instead */
export function getStoredVendors(): StoredVendor[] {
  console.warn('[vendorStore] getStoredVendors() is deprecated — use fetchStoredVendors() in useQuery');
  return [];
}
/** @deprecated use fetchVendorNames() in useQuery instead */
export function getVendorNames(): string[] {
  console.warn('[vendorStore] getVendorNames() is deprecated — use fetchVendorNames() in useQuery');
  return [];
}
