import { useLocation, NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
    Clock,
    Timer,
    FileText,
    Calendar,
    AlertTriangle,
    CreditCard,
    History,
    LogOut,
    Coffee,
    CheckSquare,
    LayoutDashboard,
    ChevronRight,
    ChevronDown,
    Plus,
    Shield
} from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NavItem {
    icon: React.ElementType;
    label: string;
    path: string;
}

interface NavGroup {
    title: string;
    icon: React.ElementType;
    items: NavItem[];
    defaultOpen?: boolean;
}

const getShiftNavigation = (role: string): NavGroup[] => {
    const nav: NavGroup[] = [
        {
            title: 'Current Shift',
            icon: Clock,
            defaultOpen: true,
            items: [
                { icon: LayoutDashboard, label: 'Shift Dashboard', path: '/shift/dashboard' },
                { icon: Timer, label: 'Hourly Report', path: '/shift/hourly' },
                { icon: Coffee, label: 'Break Control', path: '/shift/break' },
                { icon: AlertTriangle, label: 'My Escalations', path: '/dashboard/my-escalations' },
                { icon: Plus, label: 'Raise Escalation', path: '/nsm-dashboard?create=true' },
                { icon: FileText, label: 'EOD Summary', path: '/shift/eod' },
                { icon: LogOut, label: 'End Shift', path: '/shift/logout' },
            ],
        },
    ];

    // Add Director Board for directors
    if (role.toLowerCase() === 'director') {
        nav.push({
            title: 'Director Board',
            icon: Shield,
            defaultOpen: true,
            items: [
                { icon: LayoutDashboard, label: 'Audit Dashboard', path: '/dashboard/director' },
            ],
        });
    }

    // Add Accounts/HR Board
    if (role.toLowerCase() === 'accounts' || role.toLowerCase() === 'admin' || role.toLowerCase() === 'hr') {
        nav.push({
            title: role.toLowerCase() === 'hr' ? 'HR Operations' : 'Accounts Board',
            icon: Shield,
            defaultOpen: true,
            items: [
                ...(role.toLowerCase() !== 'hr' ? [{ icon: LayoutDashboard, label: 'Execution Board', path: '/accounts-execution' }] : []),
                { icon: CreditCard, label: 'Raise Payment', path: '/payment-request' },
                { icon: CheckSquare, label: 'My Tasks', path: '/my-tasks' },
            ],
        });
    }

    nav.push(
        {
            title: 'My Records',
            icon: History,
            defaultOpen: true,
            items: [
                { icon: History, label: 'Shift History', path: '/shift/history' },
                { icon: AlertTriangle, label: 'My LOPs', path: '/my-lop' },
                { icon: Calendar, label: 'Company Calendar', path: '/company-calendar' },
            ],
        },
        {
            title: 'Requests',
            icon: CreditCard,
            defaultOpen: false,
            items: [
                { icon: Calendar, label: 'Leave Request', path: '/leave-request' },
                ...(!['accounts', 'admin', 'hr'].includes(role.toLowerCase())
                    ? [{ icon: CreditCard, label: 'Raise Payment', path: '/payment-request' }]
                    : []),
                { icon: History, label: 'My Requests', path: '/my-requests' },
                { icon: CheckSquare, label: 'My Tasks', path: '/my-tasks' },
            ],
        }
    );

    return nav;
};

export function ShiftSidebar() {
    const { user } = useAuth();
    const location = useLocation();
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

    if (!user) return null;

    const navItems = getShiftNavigation(user.role);

    const toggleGroup = (title: string) => {
        setOpenGroups(prev => ({
            ...prev,
            [title]: !prev[title]
        }));
    };

    const isGroupOpen = (group: NavGroup) => {
        if (openGroups[group.title] !== undefined) {
            return openGroups[group.title];
        }
        const hasActiveItem = group.items.some(item => location.pathname === item.path);
        return group.defaultOpen || hasActiveItem;
    };

    return (
        <aside className="hidden md:block w-64 border-r border-border bg-sidebar min-h-[calc(100vh-4rem)] p-4 overflow-y-auto shrink-0">
            <div className="mb-6 px-4 py-2 bg-primary/5 rounded-lg border border-primary/10">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                    Active Mode
                </div>
                <div className="font-bold text-sm">Flexible Shift</div>
            </div>

            <nav className="space-y-2">
                {navItems.map((group) => {
                    const isOpen = isGroupOpen(group);
                    const GroupIcon = group.icon;

                    return (
                        <Collapsible
                            key={group.title}
                            open={isOpen}
                            onOpenChange={() => toggleGroup(group.title)}
                        >
                            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors">
                                <div className="flex items-center gap-2">
                                    <GroupIcon className="w-4 h-4" />
                                    <span>{group.title}</span>
                                </div>
                                {isOpen ? (
                                    <ChevronDown className="w-4 h-4" />
                                ) : (
                                    <ChevronRight className="w-4 h-4" />
                                )}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-1 mt-1">
                                {group.items.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) =>
                                            cn(
                                                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors pl-9",
                                                isActive
                                                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                            )
                                        }
                                    >
                                        <item.icon className="w-4 h-4" />
                                        {item.label}
                                    </NavLink>
                                ))}
                            </CollapsibleContent>
                        </Collapsible>
                    );
                })}
            </nav>
        </aside>
    );
}
