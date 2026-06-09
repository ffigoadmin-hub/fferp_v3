
/**
 * Payment Workflow Logic
 * 
 * Defines how payments route through different approval stages based on:
 * - Department
 * - User Role
 * - Payment Categories (Tags)
 */

// import { PaymentStatus } from '@/hooks/usePaymentRequests';

export type PaymentStatus =
    | 'pending'
    | 'smo_audit'
    | 'gmo_audit'
    | 'director_audit'
    | 'auditor_audit'      // New: Auditor verification stage
    | 'boi_audit'
    | 'gm_audit'
    | 'admin_audit'
    | 'ceo_audit'
    | 'ceo_hold'
    | 'gm_hold'
    | 'rejected'
    | 'paid'
    | 'bulk_prepared'       // New: Ready for batching
    | 'batch_ceo_approved'  // New: CEO confirmed batch
    | 'bank_uploaded'       // New: XLS uploaded to Kotak
    | 'reconciliation_exception' // New: Automated matching failed
    | 'hr_audit'               // New: HR verification stage for Salary Advance
    | 'draft'               // New: Manual or Auto-saved draft
    | 'smo_verified' | 'gm_approved' | 'admin_approved' | 'ceo_approved'; // Legacy

export type PaymentDepartment = 'engineering' | 'jv_engineering' | 'agri' | 'farmers_factory' | 'agri_mart' | 'accounts' | 'r_and_d' | 'purchase' | 'logistics' | 'others';
export type UserRole = 'admin' | 'ceo' | 'smo' | 'gmo' | 'boi' | 'gm' | 'director' | 'auditor' | string;

export interface PaymentTimelineStep {
    role: string;
    label: string;
    status: PaymentStatus | 'paid';
}

/**
 * Normalizes raw department strings to defined PaymentDepartment constants.
 */
export function normalizeDepartment(rawDept?: string | null): PaymentDepartment | 'others' {
    if (!rawDept) return 'others';
    const d = rawDept.toLowerCase().trim();
    if (d === 'agrimart') return 'agri_mart';
    if (d.includes('r&d') || d === 'rnd' || d === 'r_and_d' || d.includes('research')) return 'r_and_d';
    if (d === 'purchase' || d.includes('procurement')) return 'purchase';
    if (d === 'jv engineering' || d === 'jv_engineering' || d === 'jv eng' || d.includes('jv')) return 'jv_engineering';
    if (d.includes('agri') || d.includes('farm')) return 'agri';
    if (d.includes('engineering') || d === 'eng') return 'engineering';
    if (d === 'accounts') return 'accounts';
    if (d === 'logistics') return 'logistics';
    if (d === 'farmers_factory') return 'farmers_factory';
    return d as PaymentDepartment;
}

/**
 * Determines the next approval status for a payment request based on category and department.
 * 
 * ROUTING RULES:
 * - Farmers Factory payments with specific categories go through Auditor
 * - Categories requiring Auditor: "Farmers Factory Purchase Chennai", "Hyderabad Purchase"
 * - All other Farmers Factory payments skip Auditor and go directly to Admin
 * 
 * @param payment - Payment request data
 * @param userRole - Role of the user creating/submitting the payment
 * @returns Next approval status in the workflow
 */
export function getNextPaymentStatus(payment: {
    department: string;
    tags?: string[];
}, userRole: UserRole): PaymentStatus {
    const department = normalizeDepartment(payment.department);

    // 1. Admin payments go to admin_audit queue first, then CEO
    if (userRole === 'admin') {
        return 'admin_audit';
    }

    // 2. CEO goes directly to CEO audit
    if (userRole === 'ceo') {
        return 'ceo_audit';
    }

    // 3. Salary Advance Routing - Applies to all departments (Higher Priority than Dept logic)
    const requiresHRAudit = payment.tags?.some(tag =>
        ['salary advance', 'salary_advance'].includes(tag.toLowerCase())
    );

    if (requiresHRAudit) {
        // If user is HR, they are verifying, so it goes to Admin next
        if (userRole === 'hr') return 'admin_audit';
        // If it's a new request (not from HR), it goes to HR audit
        return 'hr_audit';
    }

    // 4. Engineering Flow: User -> SMO -> GMO -> GM -> Admin -> CEO
    if (department === 'engineering') {
        if (userRole === 'smo') return 'gmo_audit';
        if (userRole === 'gmo') return 'gm_audit';
        if (userRole === 'gm') return 'admin_audit';
        return 'smo_audit';
    }

    // 4b. JV Engineering Flow: User -> SMO -> Director -> GM -> Admin -> CEO
    // Skips GMO and BOI stages
    if (department === 'jv_engineering') {
        if (userRole === 'smo') return 'director_audit';
        if (userRole === 'director') return 'gm_audit';
        if (userRole === 'gm') return 'admin_audit';
        return 'smo_audit';
    }

    // 5. Farmers Factory Flow: User -> Admin -> CEO
    // * with conditional Auditor step based on tags
    else if (department === 'farmers_factory') {
        // If user is Auditor, they are approving/raising, so it goes to Admin next
        if (userRole === 'auditor') return 'admin_audit';

        // Check strict category routing for Auditor
        // Categories that require Auditor approval:
        const AUDITOR_REQUIRED_CATEGORIES = [
            'Farmers Factory Purchase Chennai',
            'Hyderabad Purchase',
        ];

        // Check if payment has any tags that require Auditor
        const requiresAuditor = payment.tags?.some(tag =>
            AUDITOR_REQUIRED_CATEGORIES.includes(tag)
        );

        if (requiresAuditor) {
            return 'auditor_audit';
        } else {
            // Default for Farmers Factory: Skip Auditor
            return 'admin_audit';
        }
    }

    // 6. Agri Flow: User -> SMO -> BOI -> Director -> Admin -> CEO
    else if (department === 'agri') {
        if (userRole === 'smo') return 'boi_audit';
        if (userRole === 'boi') return 'director_audit';
        if (userRole === 'director') return 'admin_audit';
        return 'smo_audit';
    }

    // 7. Agri Mart Flow: User -> Director -> Admin -> CEO
    else if (department === 'agri_mart') {
        if (userRole === 'director') return 'admin_audit';
        return 'director_audit';
    }

    // 8. Accounts Flow: User -> Director -> Admin -> CEO
    else if (department === 'accounts') {
        if (userRole === 'director') return 'admin_audit';
        return 'director_audit';
    }

    // 9. R&D & Purchase Flow: User -> GM -> Admin -> CEO
    else if (department === 'r_and_d' || department === 'purchase') {
        if (userRole === 'gm') return 'admin_audit';
        return 'gm_audit';
    }

    // 10. Others / Default Flow: User -> Admin -> CEO
    return 'admin_audit';
}

/**
 * Get the complete approval workflow for a payment.
 * Useful for displaying progress to users.
 */
export function getPaymentWorkflow(payment: {
    department: string;
    tags?: string[];
}): PaymentStatus[] {
    const department = normalizeDepartment(payment.department);
    const baseWorkflow: PaymentStatus[] = ['pending'];

    if (department === 'engineering') {
        baseWorkflow.push('smo_audit', 'gmo_audit', 'gm_audit');
    } else if (department === 'jv_engineering') {
        // JV Engineering: SMO -> Director -> GM (skips GMO/BOI)
        baseWorkflow.push('smo_audit', 'director_audit', 'gm_audit');
    } else if (department === 'farmers_factory') {
        // Conditional Auditor Step
        const AUDITOR_REQUIRED_CATEGORIES = [
            'Farmers Factory Purchase Chennai',
            'Hyderabad Purchase',
        ];

        const requiresAuditor = payment.tags?.some(tag =>
            AUDITOR_REQUIRED_CATEGORIES.includes(tag)
        );

        if (requiresAuditor) {
            baseWorkflow.push('auditor_audit');
        }
    } else if (department === 'agri') {
        baseWorkflow.push('smo_audit', 'boi_audit', 'director_audit');
    } else if (department === 'agri_mart' || department === 'accounts') {
        baseWorkflow.push('director_audit');
    } else if (department === 'r_and_d' || department === 'purchase') {
        baseWorkflow.push('gm_audit');
    }

    // Common final steps
    const requiresHRAudit = payment.tags?.some(tag =>
        ['salary advance', 'salary_advance'].includes(tag.toLowerCase())
    );

    if (requiresHRAudit) {
        // Salary advance specifically inserts HR Audit in the middle
        baseWorkflow.push('hr_audit');
    }

    baseWorkflow.push('admin_audit', 'ceo_audit', 'paid');

    return baseWorkflow;
}

/**
 * Returns the visual timeline steps used across request history and "my requests" views.
 * This keeps all UI timelines aligned with the business workflow, including JV Engineering.
 */
export function getPaymentTimelineSteps(payment: {
    department?: string | null;
    requester?: { department?: string | null } | null;
    is_jv_payment?: boolean | null;
}): PaymentTimelineStep[] {
    const rawDept = payment.requester?.department || payment.department || 'others';
    const department = payment.is_jv_payment ? 'jv_engineering' : normalizeDepartment(rawDept);

    if (department === 'jv_engineering') {
        return [
            { role: 'requester', label: 'Payment Requested', status: 'smo_audit' },
            { role: 'smo', label: 'SMO Audited', status: 'director_audit' },
            { role: 'director', label: 'Director Audited', status: 'gm_audit' },
            { role: 'gm', label: 'GM Audited', status: 'admin_audit' },
            { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
            { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
            { role: 'accounts', label: 'Payment Completed', status: 'paid' },
        ];
    }

    if (department === 'engineering') {
        return [
            { role: 'requester', label: 'Payment Requested', status: 'smo_audit' },
            { role: 'smo', label: 'SMO Audited', status: 'gmo_audit' },
            { role: 'gmo', label: 'GMO Audited', status: 'boi_audit' },
            { role: 'boi', label: 'BOI Audited', status: 'gm_audit' },
            { role: 'gm', label: 'GM Audited', status: 'admin_audit' },
            { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
            { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
            { role: 'accounts', label: 'Payment Completed', status: 'paid' },
        ];
    }

    if (department === 'agri_mart' || department === 'accounts') {
        return [
            { role: 'requester', label: 'Payment Requested', status: 'director_audit' },
            { role: 'director', label: 'Director Audited', status: 'admin_audit' },
            { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
            { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
            { role: 'accounts', label: 'Payment Completed', status: 'paid' },
        ];
    }

    if (department === 'agri') {
        return [
            { role: 'requester', label: 'Payment Requested', status: 'smo_audit' },
            { role: 'smo', label: 'SMO Audited', status: 'boi_audit' },
            { role: 'boi', label: 'BOI Audited', status: 'director_audit' },
            { role: 'director', label: 'Director Audited', status: 'admin_audit' },
            { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
            { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
            { role: 'accounts', label: 'Payment Completed', status: 'paid' },
        ];
    }

    if (department === 'r_and_d' || department === 'purchase') {
        return [
            { role: 'requester', label: 'Payment Requested', status: 'gm_audit' },
            { role: 'gm', label: 'GM Audited', status: 'admin_audit' },
            { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
            { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
            { role: 'accounts', label: 'Payment Completed', status: 'paid' },
        ];
    }

    return [
        { role: 'requester', label: 'Payment Requested', status: 'admin_audit' },
        { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
        { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
        { role: 'accounts', label: 'Payment Completed', status: 'paid' },
    ];
}
