import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, Clock, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface CommandStripRowProps {
    id: string;
    title: string;
    subtitle?: string;
    department?: string;
    leftElement?: ReactNode;
    rightElement?: ReactNode;
    onClick?: () => void;
    status?: string;
    rawStatus?: string; // The actual database status for display
    isAssigned?: boolean; // Whether the ticket is assigned
    hasProofSubmitted?: boolean; // Whether proof has been submitted
    className?: string;
    isPriority?: boolean;
    priorityLevel?: 'P0' | 'P1' | 'P2' | 'P3';
    isWarRoom?: boolean;
    isSelected?: boolean;
    createdAt?: string; // ISO date string for ticket creation time
}

// Helper to get display status label
function getDisplayStatus(
    rawStatus: string,
    isAssigned: boolean = false,
    hasProofSubmitted: boolean = false
): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string } {
    const normalizedStatus = rawStatus?.toLowerCase() || 'open';

    // Priority order: check specific workflow stages
    if (normalizedStatus === 'closed') {
        return { label: 'Closed', variant: 'secondary', className: 'bg-muted/50 text-muted-foreground border-muted' };
    }

    if (hasProofSubmitted || normalizedStatus === 'resolved' || normalizedStatus === 'pending_closure_approval' || normalizedStatus === 'waiting_audit' || normalizedStatus === 'proof_submitted') {
        return { label: 'Proof Submitted', variant: 'default', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' };
    }

    if (normalizedStatus === 'escalated_ceo') {
        return { label: 'Escalated to CEO', variant: 'destructive', className: 'bg-purple-500/20 text-purple-400 border-purple-500/40' };
    }

    if (normalizedStatus === 'escalated_gm') {
        return { label: 'Escalated to GM', variant: 'destructive', className: 'bg-orange-500/20 text-orange-400 border-orange-500/40' };
    }

    if (normalizedStatus === 'acknowledged' || normalizedStatus === 'in_progress') {
        return { label: 'Acknowledged', variant: 'default', className: 'bg-primary/20 text-primary border-primary/40' };
    }

    if (isAssigned && normalizedStatus === 'open') {
        return { label: 'Assigned', variant: 'default', className: 'bg-blue-500/20 text-blue-400 border-blue-500/40' };
    }

    // Default open status
    return { label: 'Open', variant: 'outline', className: 'bg-red-500/20 text-red-400 border-red-500/40' };
}

// Map to simplified status for styling
function getStatusCategory(rawStatus: string): 'open' | 'acknowledged' | 'resolved' | 'breached' | 'closed' {
    const normalizedStatus = rawStatus?.toLowerCase() || 'open';

    if (normalizedStatus === 'closed') return 'closed';
    if (['resolved', 'pending_closure_approval', 'waiting_audit', 'proof_submitted'].includes(normalizedStatus)) return 'resolved';
    if (['acknowledged', 'in_progress', 'escalated_gm', 'escalated_ceo'].includes(normalizedStatus)) return 'acknowledged';
    if (normalizedStatus === 'breached') return 'breached';
    return 'open';
}

// Department display config
const DEPT_CONFIG: Record<string, { label: string; color: string }> = {
    engineering: { label: 'ENG', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    civil: { label: 'CIVIL', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    agri: { label: 'AGRI', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    agri_operations: { label: 'AGRI OPS', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    agri_mart: { label: 'AGRI MART', color: 'bg-lime-500/15 text-lime-400 border-lime-500/30' },
    farmers_factory: { label: 'FACTORY', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    farm_manager: { label: 'FARM MGR', color: 'bg-teal-500/15 text-teal-400 border-teal-500/30' },
    buy_back: { label: 'BUY-BACK', color: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
    business_development: { label: 'BIZ DEV', color: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
    ceo_office: { label: 'CEO', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
    data_analytics___legal: { label: 'DATA/LEGAL', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
    management_operations_team: { label: 'MGMT OPS', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
    rental_sourcing: { label: 'RENTAL', color: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30' },
    vendor_sourcing: { label: 'VENDOR', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
    hr: { label: 'HR', color: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
    accounts: { label: 'ACCTS', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
    purchase: { label: 'PURCHASE', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
    it: { label: 'IT', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
    data: { label: 'DATA', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
    unknown: { label: 'DEPT N/A', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
};

export function CommandStripRow({
    id,
    title,
    subtitle,
    department,
    leftElement,
    rightElement,
    onClick,
    status = 'open',
    rawStatus,
    isAssigned = false,
    hasProofSubmitted = false,
    className,
    isPriority = false,
    priorityLevel,
    isWarRoom,
    isSelected = false,
    createdAt
}: CommandStripRowProps) {
    const effectiveRawStatus = rawStatus || status;
    const statusCategory = getStatusCategory(effectiveRawStatus);
    const displayStatus = getDisplayStatus(effectiveRawStatus, isAssigned, hasProofSubmitted);

    const statusColors = {
        open: "border-l-status-late",
        acknowledged: "border-l-primary",
        resolved: "border-l-status-live",
        breached: "border-l-destructive",
        closed: "border-l-muted-foreground/30",
    };

    return (
        <div
            onClick={onClick}
            className={cn(
                "glass-row group flex items-center gap-3 p-3 cursor-pointer border-l-4 transition-all duration-300 relative overflow-hidden",
                statusColors[statusCategory],
                isSelected ? "bg-white/10 ring-1 ring-inset ring-primary/40 border-l-[8px]" : "hover:border-l-[8px] hover:bg-white/5",
                isPriority && statusCategory === 'breached' ? "neon-border-destructive bg-destructive/5" : "",
                className
            )}
        >
            {/* Scanned Effect for Active Items */}
            {statusCategory !== 'resolved' && statusCategory !== 'closed' && (
                <div className="absolute inset-0 scanned-text opacity-10 pointer-events-none" />
            )}
            {/* Left Decoration / Icon */}
            {leftElement && (
                <div className="flex-shrink-0">
                    {leftElement}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{id}</span>
                    {department && (() => {
                        const deptKey = (department || 'unknown').toLowerCase().replace(/[\s-]+/g, '_');
                        const config = DEPT_CONFIG[deptKey] || DEPT_CONFIG.unknown;
                        return (
                            <span className={cn(
                                "inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-tight",
                                config.color
                            )}>
                                <Building2 className="w-2.5 h-2.5" />
                                {config.label}
                            </span>
                        );
                    })()}
                    {isPriority && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-bold uppercase tracking-tighter animate-pulse">
                            Priority
                        </span>
                    )}
                    {priorityLevel && (
                        <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter",
                            priorityLevel === 'P0' ? "bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.5)]" :
                            priorityLevel === 'P1' ? "bg-orange-600 text-white" :
                            priorityLevel === 'P2' ? "bg-blue-600 text-white" :
                            "bg-slate-600 text-white"
                        )}>
                            {priorityLevel}
                        </span>
                    )}
                    {isWarRoom && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-status-live text-white font-black uppercase tracking-tighter animate-pulse shadow-[0_0_8px_rgba(var(--status-live),0.5)]">
                            WAR ROOM
                        </span>
                    )}
                </div>
                <h4 className="text-sm font-semibold group-hover:text-primary transition-colors">
                    {title}
                </h4>
                {subtitle && (
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}

                {/* Created Date & Time - displayed outside below the ticket info */}
                {createdAt && (
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">
                        <Clock className="w-3 h-3" />
                        <span>
                            Created: {format(new Date(createdAt), 'dd MMM yyyy, hh:mm a')}
                        </span>
                    </div>
                )}
            </div>

            {/* Status Badge */}
            <div className="flex-shrink-0">
                <Badge
                    variant={displayStatus.variant}
                    className={cn(
                        "text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 border",
                        displayStatus.className
                    )}
                >
                    {displayStatus.label}
                </Badge>
            </div>

            {/* Right Content / Metrics */}
            <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 mb-1">
                    {[40, 70, 45, 90, 65].map((h, i) => (
                        <div
                            key={i}
                            className={cn(
                                "w-1 rounded-t-[1px] transition-all duration-500",
                                statusCategory === 'breached' ? "bg-destructive/40" : "bg-primary/30"
                            )}
                            style={{ height: `${h * 0.15}px` }}
                        />
                    ))}
                </div>
                {rightElement}
            </div>

            {/* Navigation Arrow */}
            <div className="flex-shrink-0 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1">
                <ChevronRight className="w-4 h-4" />
            </div>
        </div>
    );
}
