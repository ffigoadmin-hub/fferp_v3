import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type RentalStatus =
    | 'Active' | 'Inactive'
    | 'DRAFT' | 'ELECTRICITY_UPDATED' | 'RAISED_FOR_APPROVAL' | 'APPROVED_BY_CEO' | 'PAYMENT_EXECUTED' | 'REJECTED'
    | 'Savings' | 'Current';

interface RentalStatusBadgeProps {
    status: string; // weak type to accept direct DB strings
    className?: string;
}

export function RentalStatusBadge({ status, className }: RentalStatusBadgeProps) {
    const getStatusStyles = (status: string) => {
        const normalized = status?.toUpperCase();
        switch (normalized) {
            // Property Status
            case 'ACTIVE': return "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
            case 'INACTIVE': return "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100";

            // Monthly Record Workflow
            case 'DRAFT': return "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100";
            case 'ELECTRICITY_UPDATED': return "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100";
            case 'RAISED_FOR_APPROVAL': return "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100";
            case 'APPROVED_BY_CEO': return "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100";
            case 'PAYMENT_EXECUTED': return "bg-green-100 text-green-700 border-green-200 hover:bg-green-100";
            case 'REJECTED': return "bg-red-100 text-red-700 border-red-200 hover:bg-red-100";

            // Account Types
            case 'SAVINGS': return "bg-indigo-50 text-indigo-600 border-indigo-200";
            case 'CURRENT': return "bg-cyan-50 text-cyan-600 border-cyan-200";

            default: return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    const getLabel = (status: string) => {
        const normalized = status?.toUpperCase();
        switch (normalized) {
            case 'ELECTRICITY_UPDATED': return 'Elec. Updated';
            case 'RAISED_FOR_APPROVAL': return 'Pending Approval';
            case 'APPROVED_BY_CEO': return 'Approved';
            case 'PAYMENT_EXECUTED': return 'Paid';
            default: return status;
        }
    }

    return (
        <Badge variant="outline" className={cn("font-bold tracking-tight uppercase shadow-sm", getStatusStyles(status), className)}>
            {getLabel(status)}
        </Badge>
    );
}
