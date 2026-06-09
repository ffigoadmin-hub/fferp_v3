import { IndianRupee, TrendingUp, FolderKanban, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function CEOQuickActions() {
  const navigate = useNavigate();

  const actions = [
    { label: 'Payments', icon: IndianRupee, path: '/ceo-approvals', color: 'text-primary' },
    { label: 'Reports', icon: TrendingUp, path: '/ceo-intelligence', color: 'text-status-live' },
    { label: 'Projects', icon: FolderKanban, path: '/projects', color: 'text-status-pending' },
    { label: 'Departments', icon: Building2, path: '/ceo-department', color: 'text-authority-ceo' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {actions.map((action, idx) => (
        <Button 
          key={idx}
          variant="outline" 
          onClick={() => navigate(action.path)} 
          className="h-14 flex flex-col gap-1.5 bg-card/60 border-border/50 hover:border-primary/40 hover:bg-card/80 transition-all"
        >
          <action.icon className={`w-4 h-4 ${action.color}`} />
          <span className="text-[10px] font-bold uppercase tracking-wide">{action.label}</span>
        </Button>
      ))}
    </div>
  );
}
