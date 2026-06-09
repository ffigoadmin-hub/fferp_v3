import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Package, Truck, CheckCircle, AlertTriangle, 
  IndianRupee, ArrowRight, Clock, TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useMaterialRequests } from '@/hooks/useMaterialRequests';
import { useVendorQuotes } from '@/hooks/useVendorQuotes';
import { cn } from '@/lib/utils';

export function ProcurementOverviewWidget() {
  const navigate = useNavigate();
  const { requests } = useMaterialRequests();
  const { quotes } = useVendorQuotes();

  const stats = useMemo(() => {
    let ordered = 0;
    let loading = 0;
    let shipped = 0;
    let unloading = 0;
    let delivered = 0;
    let pendingAudit = 0;
    let totalValue = 0;
    let deliveredValue = 0;
    const projectsWithOrders = new Set<string>();

    requests.forEach(req => {
      if (!req.order_status || req.order_status === 'not_ordered') return;
      
      if (req.project_id) projectsWithOrders.add(req.project_id);

      const quote = quotes.find(q => q.id === req.selected_quote_id);
      const value = quote?.quoted_total || 0;
      totalValue += value;

      switch (req.order_status) {
        case 'ordered':
          ordered++;
          break;
        case 'loading':
          loading++;
          break;
        case 'shipped':
          shipped++;
          break;
        case 'unloading':
          unloading++;
          break;
        case 'delivered':
          delivered++;
          deliveredValue += value;
          if (req.farm_audit_status === 'pending') pendingAudit++;
          break;
      }
    });

    const inProgress = ordered + loading + shipped + unloading;
    const total = inProgress + delivered;
    const completionRate = total > 0 ? (delivered / total) * 100 : 0;

    return {
      ordered,
      loading,
      shipped,
      unloading,
      delivered,
      pendingAudit,
      inProgress,
      total,
      totalValue,
      deliveredValue,
      completionRate,
      projectsCount: projectsWithOrders.size,
    };
  }, [requests, quotes]);

  const hasBottlenecks = stats.ordered > 5 || stats.pendingAudit > 3;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg">
            <Truck className="w-5 h-5 text-primary" />
            Procurement Overview
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1 text-xs"
            onClick={() => navigate('/procurement-tracking')}
          >
            View All <ArrowRight className="w-3 h-3" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">In Progress</span>
            </div>
            <p className="text-2xl font-bold">{stats.inProgress}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs text-muted-foreground">Delivered</span>
            </div>
            <p className="text-2xl font-bold">{stats.delivered}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Completion Rate</span>
            <span className="font-medium">{stats.completionRate.toFixed(0)}%</span>
          </div>
          <Progress value={stats.completionRate} className="h-2" />
        </div>

        {/* Status Breakdown */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Status Breakdown</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
              <Package className="w-3 h-3 mr-1" />
              {stats.ordered} Ordered
            </Badge>
            <Badge variant="secondary" className="bg-orange-500/20 text-orange-400">
              <Package className="w-3 h-3 mr-1" />
              {stats.loading} Loading
            </Badge>
            <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-400">
              <Truck className="w-3 h-3 mr-1" />
              {stats.shipped} Shipped
            </Badge>
            <Badge variant="secondary" className="bg-amber-500/20 text-amber-400">
              <Truck className="w-3 h-3 mr-1" />
              {stats.unloading} Unloading
            </Badge>
          </div>
        </div>

        {/* Value Metrics */}
        <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Procurement Value</p>
              <p className="text-xl font-bold flex items-center gap-1">
                <IndianRupee className="w-4 h-4" />
                {(stats.totalValue / 100000).toFixed(1)}L
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Delivered Value</p>
              <p className="text-lg font-semibold text-green-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                ₹{(stats.deliveredValue / 100000).toFixed(1)}L
              </p>
            </div>
          </div>
        </div>

        {/* Bottleneck Alerts */}
        {hasBottlenecks && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-400">Attention Required</p>
                <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  {stats.ordered > 5 && (
                    <li>• {stats.ordered} orders waiting for dispatch</li>
                  )}
                  {stats.pendingAudit > 3 && (
                    <li>• {stats.pendingAudit} deliveries pending audit</li>
                  )}
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {/* Projects Count */}
        <p className="text-xs text-center text-muted-foreground">
          Across {stats.projectsCount} active projects
        </p>
      </CardContent>
    </Card>
  );
}
