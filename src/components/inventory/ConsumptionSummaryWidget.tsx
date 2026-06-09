import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  TrendingDown,
  AlertTriangle,
  Clock,
  IndianRupee,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useConsumptionSummary } from '@/hooks/useConsumptionSummary';
import { useProjects } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';

interface ConsumptionSummaryWidgetProps {
  projectId?: string;
  showProjectFilter?: boolean;
}

export function ConsumptionSummaryWidget({ 
  projectId, 
  showProjectFilter = true 
}: ConsumptionSummaryWidgetProps) {
  const { projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || 'all');
  
  const {
    summary,
    alerts,
    isLoading,
    totalStockValue,
    criticalAlerts,
    lowStockAlerts,
    refetch,
  } = useConsumptionSummary(selectedProjectId === 'all' ? undefined : selectedProjectId);

  const getAlertBadge = (alertType: string) => {
    switch (alertType) {
      case 'out_of_stock':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-3 h-3" />
            Out of Stock
          </Badge>
        );
      case 'critical':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="w-3 h-3" />
            Critical
          </Badge>
        );
      case 'low':
        return (
          <Badge variant="outline" className="text-amber-500 border-amber-500/30 gap-1">
            <TrendingDown className="w-3 h-3" />
            Low Stock
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="w-5 h-5" />
            Inventory Summary
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={refetch} disabled={isLoading}>
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
        </div>

        {showProjectFilter && (
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.project_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <IndianRupee className="w-4 h-4" />
              <span className="text-xs">Stock Value</span>
            </div>
            <p className="text-xl font-bold">₹{totalStockValue.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Package className="w-4 h-4" />
              <span className="text-xs">Total Items</span>
            </div>
            <p className="text-xl font-bold">{summary.length}</p>
          </div>
        </div>

        {/* Alerts Section */}
        {(criticalAlerts.length > 0 || lowStockAlerts.length > 0) && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Stock Alerts ({alerts.length})
            </h4>

            {criticalAlerts.length > 0 && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                <p className="text-sm font-medium text-destructive mb-2">
                  Critical ({criticalAlerts.length})
                </p>
                <div className="space-y-1">
                  {criticalAlerts.slice(0, 3).map((alert) => (
                    <div key={alert.inventory_id} className="text-sm flex justify-between">
                      <span>{alert.material_name}</span>
                      <span className="text-destructive font-medium">
                        {alert.balance} {alert.unit}
                      </span>
                    </div>
                  ))}
                  {criticalAlerts.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{criticalAlerts.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {lowStockAlerts.length > 0 && (
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <p className="text-sm font-medium text-amber-600 mb-2">
                  Low Stock ({lowStockAlerts.length})
                </p>
                <div className="space-y-1">
                  {lowStockAlerts.slice(0, 3).map((alert) => (
                    <div key={alert.inventory_id} className="text-sm flex justify-between">
                      <span>{alert.material_name}</span>
                      <span className="text-amber-600 font-medium">
                        {alert.balance} {alert.unit} ({alert.stock_percent}%)
                      </span>
                    </div>
                  ))}
                  {lowStockAlerts.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{lowStockAlerts.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inventory Items */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : summary.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No inventory data available</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {summary.map((item) => {
                const usagePercent = item.quantity_received > 0
                  ? ((item.quantity_used / item.quantity_received) * 100)
                  : 0;
                const balancePercent = 100 - usagePercent;
                const isLow = balancePercent < 20;
                const isCritical = balancePercent < 10;
                const alert = alerts.find(a => a.inventory_id === item.inventory_id);

                return (
                  <div
                    key={item.inventory_id}
                    className={cn(
                      "p-3 rounded-lg border",
                      isCritical && "border-destructive/30 bg-destructive/5",
                      isLow && !isCritical && "border-amber-500/30 bg-amber-500/5"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{item.material_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.project_name}
                        </p>
                      </div>
                      {alert && getAlertBadge(alert.alert_type)}
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-2">
                      <Progress
                        value={balancePercent}
                        className={cn(
                          "h-2",
                          isCritical && "[&>div]:bg-destructive",
                          isLow && !isCritical && "[&>div]:bg-amber-500"
                        )}
                      />
                    </div>

                    {/* Stats */}
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        Balance: {item.balance} {item.unit}
                      </span>
                      <span>
                        {item.today_usage > 0 && (
                          <span className="flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" />
                            Today: {item.today_usage}
                          </span>
                        )}
                      </span>
                    </div>

                    {item.days_remaining_estimate && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="w-3 h-3" />
                        ~{item.days_remaining_estimate} days remaining
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
