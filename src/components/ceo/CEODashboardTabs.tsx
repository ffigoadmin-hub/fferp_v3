import {
  Crown, History, FileText, Flag, Leaf
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export type DashboardTab = 'overview' | 'selfie' | 'activity' | 'lop-summary' | 'projects' | 'deliveries' | 'deviations' | 'farm' | 'my-activity' | 'work-orders';

interface CEODashboardTabsProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}

export function CEODashboardTabs({ activeTab, onTabChange }: CEODashboardTabsProps) {
  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Crown },
    { id: 'my-activity' as const, label: 'My Activity', icon: History },
    { id: 'lop-summary' as const, label: 'LOP Summary', icon: FileText },
    { id: 'deviations' as const, label: 'Deviations', icon: Flag },
    { id: 'farm' as const, label: 'Farm', icon: Leaf },
  ];

  return (
    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl">
      <ScrollArea className="w-full">
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as DashboardTab)}>
          <TabsList className="inline-flex h-14 w-max min-w-full items-center justify-start gap-1 bg-transparent p-2">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all duration-300",
                  "text-muted-foreground/70 hover:text-white hover:bg-white/5",
                  "data-[state=active]:bg-violet-500/10 data-[state=active]:text-violet-300 data-[state=active]:border data-[state=active]:border-violet-500/20 data-[state=active]:shadow-[0_0_20px_rgba(124,58,237,0.1)]",
                  "focus-visible:outline-none focus-visible:ring-0"
                )}
              >
                <tab.icon className={cn(
                  "w-4 h-4 shrink-0 transition-transform duration-300",
                  activeTab === tab.id ? "scale-110 text-violet-400" : ""
                )} />
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <ScrollBar orientation="horizontal" className="h-1.5 bg-white/5" />
      </ScrollArea>
    </div>
  );
}
