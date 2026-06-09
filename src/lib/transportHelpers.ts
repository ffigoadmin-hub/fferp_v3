export function calculateTransportAmount(km: number, ratePerKm: number): number {
    return Math.round(km * ratePerKm * 100) / 100;
}

export function getTransportStatusColor(status: string): string {
    switch (status) {
        case 'paid': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        case 'rejected': return 'bg-red-500/15 text-red-400 border-red-500/30';
        case 'accounts_approved': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
        case 'admin_approved': return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
        case 'dept_head_approved': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
        case 'pending': return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
        default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
    }
}

export function getTransportStatusLabel(status: string): string {
    switch (status) {
        case 'pending': return 'Pending';
        case 'dept_head_approved': return 'Dept Head Approved';
        case 'admin_approved': return 'Admin Verified';
        case 'accounts_approved': return 'Accounts Approved';
        case 'paid': return 'Paid';
        case 'rejected': return 'Rejected';
        default: return status;
    }
}

export function getPaymentStatusBadge(paymentStatus: string): string {
    return paymentStatus === 'paid' ? 'Paid' : 'Pending';
}

export function getCategoryColor(categoryCode: string): string {
    const colors: Record<string, string> = {
        ff: '#22c55e',
        blinkit: '#ff6b6b',
        zepto: '#8b5cf6',
        dmart: '#3b82f6',
        bigbasket: '#f59e0b',
        farm_harvest: '#10b981',
        office_work: '#6366f1',
        other: '#6b7280',
    };
    return colors[categoryCode] || '#6b7280';
}

export interface TransportExpenseRow {
    id: string;
    trip_date: string;
    from_location: string;
    to_location: string;
    total_km: number;
    rate_per_km: number;
    total_amount: number;
    category_code: string;
    purpose: string;
    vendor_name: string | null;
    driver_id: string | null;
    driver_name: string | null;
    vehicle_id: string | null;
    vehicle_number: string | null;
    proof_file_url: string;
    proof_file_name: string | null;
    proof_file_type: string | null;
    department: string;
    status: string;
    payment_status: string;
    batch_id: string | null;
    is_batch_entry: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
    rejection_reason: string | null;
    utr_number: string | null;
    payment_date: string | null;
    payment_mode: string | null;
    payment_remarks: string | null;
    // Joined fields
    creator?: { name: string; email: string; department: string } | null;
    category?: { category_name: string; color_code: string } | null;
}
