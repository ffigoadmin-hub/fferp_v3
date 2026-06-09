import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Zap, 
  IndianRupee,
  Users,
  Timer,
  CheckCircle2,
  XCircle,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentRequestData } from '@/hooks/usePaymentRequests';
import { differenceInHours, differenceInMinutes } from 'date-fns';

interface PaymentAuditInsightsProps {
  requests: PaymentRequestData[];
  roleLabel?: string;
}

interface InsightCard {
  label: string;
  value: string | number;
  subLabel?: string;
  icon: React.ElementType;
  color: 'primary' | 'warning' | 'danger' | 'success' | 'muted';
  trend?: 'up' | 'down' | 'neutral';
}

const colorMap = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  warning: 'bg-status-late/10 text-status-late border-status-late/20',
  danger: 'bg-status-missed/10 text-status-missed border-status-missed/20',
  success: 'bg-status-live/10 text-status-live border-status-live/20',
  muted: 'bg-muted/50 text-foreground border-border',
};

export function PaymentAuditInsights({ requests, roleLabel }: PaymentAuditInsightsProps) {
  const insights = useMemo(() => {
    const now = new Date();
    
    // Urgency breakdown
    const emergency = requests.filter(r => r.urgency === 'emergency').length;
    const important = requests.filter(r => r.urgency === 'important').length;
    const normal = requests.filter(r => r.urgency === 'normal').length;

    // Total amount pending
    const totalAmount = requests.reduce((sum, r) => sum + Number(r.amount), 0);

    // Overdue items (past cutoff)
    const overdueItems = requests.filter(r => {
      const cutoff = new Date(`${r.cutoff_date}T${r.cutoff_time}`);
      return cutoff < now;
    }).length;

    // Critical items (emergency OR < 12h to cutoff)
    const criticalItems = requests.filter(r => {
      if (r.urgency === 'emergency') return true;
      const cutoff = new Date(`${r.cutoff_date}T${r.cutoff_time}`);
      return differenceInHours(cutoff, now) <= 12 && cutoff > now;
    }).length;

    // Average wait time in queue
    const avgWaitHours = requests.length > 0
      ? requests.reduce((sum, r) => {
          return sum + differenceInHours(now, new Date(r.created_at));
        }, 0) / requests.length
      : 0;

    // Unique requesters
    const uniqueRequesters = new Set(requests.map(r => r.requester_id)).size;

    // Department breakdown
    const byDepartment = requests.reduce((acc, r) => {
      const dept = r.requester?.department || r.department || 'Others';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: requests.length,
      emergency,
      important,
      normal,
      totalAmount,
      overdueItems,
      criticalItems,
      avgWaitHours,
      uniqueRequesters,
      byDepartment
    };
  }, [requests]);

  const cards: InsightCard[] = [
    {
      label: 'Queue Size',
      value: insights.total,
      subLabel: 'Pending review',
      icon: Clock,
      color: insights.total > 10 ? 'warning' : 'primary',
    },
    {
      label: 'Total Value',
      value: `₹${(insights.totalAmount / 100000).toFixed(1)}L`,
      subLabel: insights.totalAmount.toLocaleString('en-IN'),
      icon: IndianRupee,
      color: 'muted',
    },
    {
      label: 'Critical',
      value: insights.criticalItems,
      subLabel: 'Needs immediate action',
      icon: Zap,
      color: insights.criticalItems > 0 ? 'danger' : 'success',
    },
    {
      label: 'Avg Wait',
      value: `${insights.avgWaitHours.toFixed(0)}h`,
      subLabel: 'In current queue',
      icon: Timer,
      color: insights.avgWaitHours > 24 ? 'warning' : 'muted',
    },
  ];

  if (requests.length === 0) {
    return (
      <div className="p-6 rounded-xl bg-status-live/5 border border-status-live/20 text-center">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-status-live" />
        <h3 className="text-lg font-bold text-status-live">All Clear!</h3>
        <p className="text-sm text-muted-foreground">No pending items in your {roleLabel || 'audit'} queue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={cn(
              "p-4 rounded-xl border",
              colorMap[card.color]
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <card.icon className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                {card.label}
              </span>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            {card.subLabel && (
              <p className="text-xs text-muted-foreground mt-0.5">{card.subLabel}</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Urgency & Department Breakdown */}
      <div className="grid md:grid-cols-2 gap-3">
        {/* Urgency Distribution */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border">
          <p className="text-xs font-bold text-muted-foreground uppercase mb-3">
            Urgency Distribution
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-status-missed" />
                <span className="text-sm">Emergency</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{insights.emergency}</span>
                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-status-missed"
                    style={{ width: `${insights.total ? (insights.emergency / insights.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-status-late" />
                <span className="text-sm">Important</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{insights.important}</span>
                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-status-late"
                    style={{ width: `${insights.total ? (insights.important / insights.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-status-live" />
                <span className="text-sm">Normal</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{insights.normal}</span>
                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-status-live"
                    style={{ width: `${insights.total ? (insights.normal / insights.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border">
          <p className="text-xs font-bold text-muted-foreground uppercase mb-3">
            By Department
          </p>
          <div className="space-y-2">
            {Object.entries(insights.byDepartment)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([dept, count]) => (
                <div key={dept} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{dept}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{count}</span>
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary"
                        style={{ width: `${insights.total ? (count / insights.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(insights.overdueItems > 0 || insights.criticalItems > 0) && (
        <div className={cn(
          "p-4 rounded-xl border flex items-start gap-3",
          insights.overdueItems > 0 
            ? "bg-status-missed/10 border-status-missed/30" 
            : "bg-status-late/10 border-status-late/30"
        )}>
          <AlertTriangle className={cn(
            "w-5 h-5 mt-0.5",
            insights.overdueItems > 0 ? "text-status-missed" : "text-status-late"
          )} />
          <div className="flex-1">
            <p className={cn(
              "font-semibold",
              insights.overdueItems > 0 ? "text-status-missed" : "text-status-late"
            )}>
              {insights.overdueItems > 0 
                ? `${insights.overdueItems} Overdue Payments!` 
                : `${insights.criticalItems} Approaching Cutoff`}
            </p>
            <p className="text-sm text-muted-foreground">
              {insights.overdueItems > 0 
                ? "These payments have passed their cutoff time and require immediate action."
                : "These payments are due within the next 12 hours."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
