import {
    MessageSquare,
    Users,
    Calendar,
    UserCircle,
    Building2,
    Hash,
    Video as VideoIcon,
    ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";

type NavItem = {
    id: string;
    label: string;
    icon: any;
    badge?: number;
};

export const ChatNavRail = ({
    activeTab,
    onTabChange
}: {
    activeTab: string;
    onTabChange: (id: string) => void;
}) => {
    const { user } = useAuth();
    const isAdmin = user?.role?.toLowerCase() === 'admin';

    const items: NavItem[] = [
        { id: 'chat', label: 'Chat', icon: MessageSquare },
        { id: 'groups', label: 'Groups', icon: Hash },
        { id: 'teams', label: 'Teams', icon: Users },
        ...(isAdmin ? [{ id: 'employees', label: 'People', icon: UserCircle }] : []),
        ...(isAdmin ? [{ id: 'departments', label: 'Departments', icon: Building2 }] : []),
        ...(isAdmin ? [{ id: 'admin-audit', label: 'Audit', icon: ShieldCheck }] : []),
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'meeting', label: 'Meeting', icon: VideoIcon },
    ];

    return (
        <div className="w-[68px] flex flex-col items-center py-4 bg-muted/40 border-r border-border/50 h-full gap-2">
            <TooltipProvider delayDuration={0}>
                {items.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;

                    return (
                        <Tooltip key={item.id}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => onTabChange(item.id)}
                                    className={cn(
                                        "relative group flex flex-col items-center justify-center w-full py-2 outline-none transition-all duration-200",
                                        isActive
                                            ? "text-primary border-l-[3px] border-primary bg-primary/5"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                    )}
                                >
                                    <Icon className={cn(
                                        "h-6 w-6 transition-transform duration-200",
                                        isActive ? "scale-110" : "group-hover:scale-110"
                                    )} />
                                    <span className="text-[10px] font-medium mt-1 truncate w-full px-1 text-center">
                                        {item.label}
                                    </span>
                                    {item.badge && item.badge > 0 && (
                                        <span className="absolute top-1 right-2 bg-destructive text-destructive-foreground text-[10px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center ring-2 ring-background">
                                            {item.badge}
                                        </span>
                                    )}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={10}>
                                {item.label}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </TooltipProvider>


        </div>
    );
};
