import { PaymentRequestData } from '@/hooks/usePaymentRequests';

// ========================================
// Kotak Bank Compliance Validation Module
// ========================================

/**
 * IFSC Code Regex - RBI Standard Format
 * Format: 4 letters (bank code) + 0 + 6 alphanumeric (branch code)
 * Example: KKBK0000123, HDFC0001234
 */
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/**
 * Bank Account Number Regex
 * Standard Indian bank accounts: 9-18 digits
 */
export const ACCOUNT_REGEX = /^\d{9,18}$/;

/**
 * Validates IFSC Code against RBI standard format
 */
export function validateIFSC(ifsc: string | null | undefined): boolean {
    if (!ifsc) return false;
    return IFSC_REGEX.test(ifsc.toUpperCase().trim());
}

/**
 * Validates Bank Account Number (9-18 digits)
 */
export function validateAccountNumber(account: string | null | undefined): boolean {
    if (!account) return false;
    return ACCOUNT_REGEX.test(account.trim());
}

/**
 * Finds duplicate payments within a batch based on Account + Amount combination
 * Returns array of payment IDs that are duplicates
 */
export function findDuplicatePayments(payments: PaymentRequestData[]): string[] {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];

    payments.forEach(p => {
        if (!p.vendor_account_number) return;
        const key = `${p.vendor_account_number}|${Number(p.amount).toFixed(2)}`;
        
        if (seen.has(key)) {
            duplicates.push(p.id);
            const existingId = seen.get(key);
            if (existingId && !duplicates.includes(existingId)) {
                duplicates.push(existingId);
            }
        } else {
            seen.set(key, p.id);
        }
    });

    return [...new Set(duplicates)];
}

export interface BatchValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validates a single payment request for bank file compatibility.
 * Now optionally checks against payee master for known vendors.
 */
export function isPaymentValid(p: PaymentRequestData, payees: any[] = []): { isValid: boolean; error?: string; isMasterMatch?: boolean } {
    if (p.is_petty_cash) return { isValid: true };

    const isTransport = !!(p.is_transport_payment || 
                          p.purpose?.toLowerCase().includes('transport') || 
                          p.vendor_name?.toLowerCase().includes('multiple vendors'));

    // Multi-vendor: vendor_name explicitly set to 'Multiple Vendors' by TransportSubmissionForm,
    // OR the transport_trips actually have different driver names
    const isTransportMultiVendor = isTransport && (() => {
        if (p.vendor_name?.toLowerCase() === 'multiple vendors' || p.vendor_name?.toLowerCase() === 'split_payment_batch') return true;
        if (p.transport_trips && p.transport_trips.length > 1) {
            const drivers = new Set(p.transport_trips.map((t: any) => t.driver_name?.toLowerCase().trim()).filter(Boolean));
            return drivers.size > 1; // Only multi-vendor if trips have DIFFERENT drivers
        }
        return false;
    })();

    if (p.is_split_payment || isTransportMultiVendor) {
        const splits = p.splits || [];
        if (splits.length === 0) {
            return { 
                isValid: false, 
                error: isTransportMultiVendor 
                    ? 'Transport Multi-Vendor request requires individual payee details (Convert to Split Payment)' 
                    : 'Split payment requires individual beneficiary details' 
            };
        }
        
        const allSplitsValid = splits.every(s => {
            if (s.payment_method === 'upi') return !!s.upi_id;
            if (s.payment_method === 'cash') return true;
            return validateIFSC(s.ifsc_code) && validateAccountNumber(s.account_number) && (s.beneficiary_name || s.payee_name);
        });
        
        return { 
            isValid: allSplitsValid, 
            error: allSplitsValid ? undefined : 'One or more split beneficiaries have invalid bank/UPI details' 
        };
    }

    // Bank Transfer Validation
    // For transport, we can fallback to details in the first trip
    const firstTrip = isTransport && p.transport_trips && p.transport_trips.length > 0 ? p.transport_trips[0] as any : null;
    
    // Check master match if primary fields are missing
    const hasPrimaryDetails = (p.vendor_account_number && validateAccountNumber(p.vendor_account_number)) || 
                             (p.vendor_upi) ||
                             (firstTrip?.payee_account && validateAccountNumber(firstTrip.payee_account)) ||
                             (firstTrip?.payee_upi);

    if (!hasPrimaryDetails && payees.length > 0) {
        const vendorName = p.vendor_name?.toLowerCase().trim();
        const beneficiaryName = p.beneficiary_name?.toLowerCase().trim();
        const tripDrivers = isTransport ? (p.transport_trips || []).map((t: any) => t.driver_name?.toLowerCase().trim()).filter(Boolean) : [];
        
        const match = payees.find(master => {
            const mName = master.name?.toLowerCase().trim();
            return (vendorName && mName === vendorName) || 
                   (beneficiaryName && mName === beneficiaryName) ||
                   (tripDrivers.some((d: string) => mName === d));
        });

        if (match) {
            const matchValid = (match.upi_id) || (validateIFSC(match.ifsc_code) && validateAccountNumber(match.account_number));
            if (matchValid) {
                return { isValid: true, isMasterMatch: true };
            }
        }
    }

    const ifscToValidate = p.vendor_ifsc_code || firstTrip?.payee_ifsc;
    const accountToValidate = p.vendor_account_number || firstTrip?.payee_account;
    const upiToValidate = p.vendor_upi || firstTrip?.payee_upi;
    
    const ifscValid = validateIFSC(ifscToValidate);
    const accountValid = validateAccountNumber(accountToValidate);
    const upiValid = !!upiToValidate;
    const nameValid = !!(p.beneficiary_name || p.vendor_name || firstTrip?.beneficiary_name || firstTrip?.vendor_name);

    if (p.payment_type === 'upi' || upiValid) {
        if (!upiValid) return { isValid: false, error: 'Missing UPI ID' };
        return { isValid: true };
    }

    if (!ifscValid) return { isValid: false, error: 'Invalid or missing IFSC' };
    if (!accountValid) return { isValid: false, error: 'Invalid or missing Account Number' };
    if (!nameValid) return { isValid: false, error: 'Missing Beneficiary Name' };

    return { isValid: true };
}

/**
 * Comprehensive validation for batch payments before Kotak export
 * CRITICAL: Blocks batch creation if any validation fails
 */
export function validateBatchPayments(payments: PaymentRequestData[]): BatchValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (payments.length === 0) {
        errors.push('No payments selected for batch');
        return { isValid: false, errors, warnings };
    }

    payments.forEach(p => {
        const payRef = `PAY-${p.payment_number || p.id.slice(0, 4).toUpperCase()}`;
        const validation = isPaymentValid(p);
        
        if (!validation.isValid) {
            errors.push(`${payRef}: ${validation.error}`);
        }

        // Amount Validation (CRITICAL)
        if (!p.amount || Number(p.amount) <= 0) {
            errors.push(`${payRef}: Invalid Amount (must be > 0)`);
        }

        // Warnings (non-blocking)
        if (Number(p.amount) >= 200000 && !p.is_split_payment) {
            warnings.push(`${payRef}: High value payment (₹${Number(p.amount).toLocaleString()}) - Will use RTGS`);
        }
    });

    // Duplicate Detection (CRITICAL)
    const duplicates = findDuplicatePayments(payments);
    if (duplicates.length > 0) {
        errors.push(`Duplicate payments detected: ${duplicates.length} payments have same Account + Amount combination`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Get payment type based on amount (NEFT vs RTGS)
 * RTGS: ₹2 Lakh and above (instant settlement)
 * NEFT: Below ₹2 Lakh (batch settlement)
 */
export function getPaymentType(amount: number): 'RTGS' | 'NEFT' {
    return amount >= 200000 ? 'RTGS' : 'NEFT';
}

/**
 * Format amount for bank export (2 decimal places, no separators)
 */
export function formatAmountForBank(amount: number): string {
    return Number(amount).toFixed(2);
}

/**
 * Sanitize beneficiary name for bank export
 * - Remove special characters that might cause issues
 * - Truncate to 50 characters (bank limit)
 */
export function sanitizeBeneficiaryName(name: string | null | undefined): string {
    if (!name) return '';
    return name
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
        .substring(0, 50) // Bank limit
        .trim();
}
