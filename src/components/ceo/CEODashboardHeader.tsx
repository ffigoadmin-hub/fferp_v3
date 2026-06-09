import { Crown, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface CEODashboardHeaderProps {
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function CEODashboardHeader({ isRefreshing, onRefresh }: CEODashboardHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-authority-ceo/5 via-transparent to-primary/5" />
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-authority-ceo/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-primary/10 rounded-full blur-2xl" />

      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-5">
          {/* Premium Icon */}
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-authority-ceo via-authority-ceo/80 to-authority-ceo/60 flex items-center justify-center shadow-lg shadow-authority-ceo/30">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-status-live flex items-center justify-center shadow-lg shadow-status-live/50">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Command Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Real-time intelligence & control center
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/ceo-approvals')}
            className="gap-2 bg-authority-ceo hover:bg-authority-ceo/90 text-white shadow-lg shadow-authority-ceo/25"
          >
            View Pending Approvals
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-10 w-10 border-border/50 hover:bg-secondary/50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
    </div>
  );
}
