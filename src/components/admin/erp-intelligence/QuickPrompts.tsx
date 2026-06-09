import { Calendar, CreditCard, AlertTriangle, TrendingUp, Users, FolderKanban, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickPrompt {
  icon: React.ElementType;
  label: string;
  prompt: string;
  color: string;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  { 
    icon: Calendar, 
    label: "Today's Attendance", 
    prompt: "Give me today's attendance summary with department breakdown",
    color: "from-blue-500/20 to-blue-600/10 text-blue-600 dark:text-blue-400"
  },
  { 
    icon: CreditCard, 
    label: "Pending Payments", 
    prompt: "What's the current pending payments overview?",
    color: "from-emerald-500/20 to-emerald-600/10 text-emerald-600 dark:text-emerald-400"
  },
  { 
    icon: AlertTriangle, 
    label: "Active Escalations", 
    prompt: "Show me the status of active escalations this week",
    color: "from-amber-500/20 to-amber-600/10 text-amber-600 dark:text-amber-400"
  },
  { 
    icon: TrendingUp, 
    label: "Improvements", 
    prompt: "Based on system data, what improvements should we make to the software?",
    color: "from-purple-500/20 to-purple-600/10 text-purple-600 dark:text-purple-400"
  },
  { 
    icon: Users, 
    label: "Employee Stats", 
    prompt: "Give me employee statistics by department and role",
    color: "from-pink-500/20 to-pink-600/10 text-pink-600 dark:text-pink-400"
  },
  { 
    icon: FolderKanban, 
    label: "Project Health", 
    prompt: "What's the current project health status?",
    color: "from-cyan-500/20 to-cyan-600/10 text-cyan-600 dark:text-cyan-400"
  },
  { 
    icon: Clock, 
    label: "Late Logins", 
    prompt: "Who logged in late today?",
    color: "from-orange-500/20 to-orange-600/10 text-orange-600 dark:text-orange-400"
  },
];

interface QuickPromptsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function QuickPrompts({ onSelect, disabled }: QuickPromptsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl">
      {QUICK_PROMPTS.map((item, index) => (
        <button
          key={index}
          onClick={() => onSelect(item.prompt)}
          disabled={disabled}
          className={cn(
            "flex items-center gap-3 p-4 rounded-xl border border-border/50",
            "bg-gradient-to-br hover:scale-[1.02] active:scale-[0.98]",
            "transition-all duration-200 text-left",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
            "hover:shadow-md hover:border-border",
            item.color
          )}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="p-2 rounded-lg bg-background/50 backdrop-blur-sm">
            <item.icon className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium text-foreground">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
