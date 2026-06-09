/**
 * Material Request Status Resolver
 * 
 * Resolves the correct display status for a material request by checking
 * the full lifecycle: order_status → delivery_status → approval_status → status.
 * 
 * After CEO approval, `approval_status` stays at `ceo_approved` but the actual
 * progress is tracked by `order_status` and `delivery_status`.
 */

/** Order statuses that indicate post-approval progress */
const ACTIVE_ORDER_STATUSES = ['ordered', 'loading', 'shipped', 'unloading', 'delivered', 'delayed'] as const;

/** Lifecycle statuses that should override approval_status display */
const PROGRESS_STATUSES = ['sourcing', 'quoted', 'cancelled', 'wo_created', 'vendor_aligned'] as const;

/**
 * Returns the most meaningful status key for a material or work request.
 * Priority: order_status (if active) → approval_status → status
 */
export function getMaterialDisplayStatus(req: {
    order_status?: string | null;
    delivery_status?: string | null;
    approval_status?: string | null;
    status?: string;
}): string {
    // 1. If order_status is set and meaningful, show that
    if (req.order_status && ACTIVE_ORDER_STATUSES.includes(req.order_status as any)) {
        return req.order_status;
    }

    // 2. If status is in a progress phase (sourcing/quoted/cancelled), show that
    if (req.status && PROGRESS_STATUSES.includes(req.status as any)) {
        return req.status;
    }

    // 3. If approval_status is set, show that
    if (req.approval_status) {
        return req.approval_status;
    }

    // 3. Fall back to base status (convert 'pending' → 'pending_smo' for first approval step)
    if (req.status === 'pending') {
        return 'pending_smo';
    }

    return req.status || 'pending';
}
