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
// The live `vendors` table has no `gstin`/`pan` columns (the real GST
// column is `gst_number`, and there's no PAN column at all) — selecting
// `gstin`/`pan` used to make the whole query error out and silently
// return zero rows, which is why vendor bank details never showed up
// anywhere that read from this store. `gstin` here is sourced from the
// real `gst_number` column; `pan` has nothing to source from yet.
//
// Bank details live in TWO independent column pairs on `vendors` —
// bank_account/bank_ifsc (written by PurchaseOrdersPage/PurchaseReportPage)
// and account_number/ifsc_code (written by BuyPage.tsx's inline "New /
// Dynamic Vendor" flow, the most common way a field vendor gets created).
// Reading only one pair made every BuyPage-created vendor look bank-detail-
// less here even when real bank info existed under the other name.
export function rowToVendor(row: any): StoredVendor {
  const bankAccount = row.bank_account || row.account_number || '';
  const bankIfsc     = row.bank_ifsc || row.ifsc_code || '';
  return {
    id:           row.id,
    companyName:  row.name ?? '',
    name:         row.name ?? '',
    email:        row.email ?? '',
    mobile:       row.phone ?? '',
    phone:        row.phone ?? '',
    gstin:        row.gst_number ?? '',
    pan:          row.pan ?? '',
    bank_name:    row.bank_name ?? '',
    bank_account: bankAccount,
    bank_ifsc:    bankIfsc,
    banks: row.bank_name ? [{
      bankName:      row.bank_name,
      accountNumber: bankAccount,
      ifscCode:      bankIfsc,
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
    .select('id, name, email, phone, gst_number, bank_name, bank_account, bank_ifsc, account_number, ifsc_code, is_active')
    .eq('is_active', true)
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
