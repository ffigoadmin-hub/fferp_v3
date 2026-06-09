import { format } from 'date-fns';
import { User, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeaveRequest } from '@/hooks/useLeaveRequests';

interface LeaveWorkflowTimelineProps {
    request: LeaveRequest;
}

export function LeaveWorkflowTimeline({ request }: LeaveWorkflowTimelineProps) {
    const timelineItems = [];

    // Applied by (always first)
    timelineItems.push({
        key: 'applied',
        icon: <User className="w-3 h-3" />,
        iconBg: 'bg-primary/20',
        iconColor: 'text-primary',
        title: 'Leave Applied',
        actor: request.employee_name,
        time: request.created_at,
        type: 'applied'
    });

    // HR Review
    if (request.hr_reviewed_at) {
        timelineItems.push({
            key: 'hr',
            icon: <CheckCircle className="w-3 h-3" />,
            iconBg: 'bg-status-live/20',
            iconColor: 'text-status-live',
            title: 'HR Approved',
            actor: request.hr_reviewer_name || 'Unknown',
            time: request.hr_reviewed_at,
            remarks: request.hr_remarks,
            type: 'approved'
        });
    }

    // Admin Review
    if (request.admin_reviewed_at) {
        timelineItems.push({
            key: 'admin',
            icon: <CheckCircle className="w-3 h-3" />,
            iconBg: 'bg-status-live/20',
            iconColor: 'text-status-live',
            title: 'Admin Approved',
            actor: request.admin_reviewer_name || 'Unknown',
            time: request.admin_reviewed_at,
            remarks: request.admin_remarks,
            type: 'approved'
        });
    }

    // CEO Review
    if (request.ceo_reviewed_at) {
        timelineItems.push({
            key: 'ceo',
            icon: <CheckCircle className="w-3 h-3" />,
            iconBg: 'bg-status-live/20',
            iconColor: 'text-status-live',
            title: 'CEO Approved',
            actor: request.ceo_reviewer_name || 'Unknown',
            time: request.ceo_reviewed_at,
            remarks: request.ceo_remarks,
            type: 'approved'
        });
    }

    // Rejected
    if (request.status === 'rejected' && request.rejected_by) {
        timelineItems.push({
            key: 'rejected',
            icon: <XCircle className="w-3 h-3" />,
            iconBg: 'bg-destructive/20',
            iconColor: 'text-destructive',
            title: 'Rejected',
            actor: request.rejected_by_name || 'Unknown',
            time: request.updated_at,
            remarks: request.rejection_reason,
            type: 'rejected'
        });
    }

    return (
        <div className="relative">
            {timelineItems.map((item, index) => (
                <div key={item.key} className="relative flex gap-3 pb-4 last:pb-0">
                    {/* Vertical line connector */}
                    {index < timelineItems.length - 1 && (
                        <div className="absolute left-[11px] top-6 w-0.5 h-[calc(100%-12px)] bg-border" />
                    )}

                    {/* Icon */}
                    <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10",
                        item.iconBg
                    )}>
                        <span className={item.iconColor}>{item.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                                "font-medium text-sm",
                                item.type === 'rejected' ? 'text-destructive' : ''
                            )}>
                                {item.title}
                            </span>
                            <span className="text-xs text-muted-foreground">by</span>
                            <span className="font-medium text-sm">{item.actor}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(item.time), 'dd MMM yyyy, HH:mm')}
                        </p>
                        {item.remarks && (
                            <p className={cn(
                                "text-xs mt-1 p-2 rounded",
                                item.type === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-muted/50'
                            )}>
                                {item.remarks}
                            </p>
                        )}
                    </div>
                </div>
            ))}

            {/* Current pending status */}
            {request.status.startsWith('pending_') && (
                <div className="relative flex gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-status-late/20 z-10">
                        <Clock className="w-3 h-3 text-status-late" />
                    </div>
                    <div className="flex-1">
                        <span className="font-medium text-sm text-status-late">
                            Pending {request.status === 'pending_hr' ? 'HR' : request.status === 'pending_boi' ? 'BOI' : request.status === 'pending_admin' ? 'Admin' : 'CEO'} Review
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">Awaiting action</p>
                    </div>
                </div>
            )}
        </div>
    );
}
