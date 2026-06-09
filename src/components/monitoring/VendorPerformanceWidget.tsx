import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, Star, TrendingUp, IndianRupee, Clock, 
  Package, Truck, CheckCircle, AlertCircle, Users
} from 'lucide-react';
import { useVendorPerformance } from '@/hooks/useVendorPerformance';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface VendorPerformanceWidgetProps {
  className?: string;
  compact?: boolean;
}

export function VendorPerformanceWidget({ className, compact = false }: VendorPerformanceWidgetProps) {
  const { stats, isLoading } = useVendorPerformance();

  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-5 h-5 text-primary" />
            Vendor Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-40" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No vendor data available</p>
        </CardContent>
      </Card>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'work_order': return <Package className="w-4 h-4 text-blue-500" />;
      case 'payment_completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'payment_pending': return <Clock className="w-4 h-4 text-orange-500" />;
      default: return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Vendor Performance
          </div>
          <Badge variant="outline">{stats.totalVendors} vendors</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800"
          >
            <Users className="w-5 h-5 text-blue-600 mb-1" />
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.activeVendors}</p>
            <p className="text-xs text-blue-600/70">Active Vendors</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-3 rounded-xl bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border border-yellow-200 dark:border-yellow-800"
          >
            <Star className="w-5 h-5 text-yellow-600 mb-1" />
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
              {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '-'}
            </p>
            <p className="text-xs text-yellow-600/70">Avg Rating</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-3 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800"
          >
            <IndianRupee className="w-5 h-5 text-green-600 mb-1" />
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              ₹{(stats.totalSpend / 100000).toFixed(1)}L
            </p>
            <p className="text-xs text-green-600/70">Total Spend</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-200 dark:border-purple-800"
          >
            <Truck className="w-5 h-5 text-purple-600 mb-1" />
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
              {stats.onTimeDeliveryRate > 0 ? `${stats.onTimeDeliveryRate}%` : '-'}
            </p>
            <p className="text-xs text-purple-600/70">On-Time Rate</p>
          </motion.div>
        </div>

        {!compact && (
          <>
            {/* Top Vendors */}
            {stats.topVendors.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Top Rated Vendors
                </h4>
                <div className="space-y-2">
                  {stats.topVendors.slice(0, 5).map((vendor, index) => (
                    <motion.div
                      key={vendor.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{vendor.company_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{vendor.total_orders} orders</span>
                          {vendor.total_spend > 0 && (
                            <>
                              <span>•</span>
                              <span>₹{(vendor.total_spend / 1000).toFixed(0)}K</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold text-sm">{vendor.rating.toFixed(1)}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Vendors by Work Type */}
            {stats.vendorsByWorkType.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Vendors by Work Type
                </h4>
                <div className="space-y-2">
                  {stats.vendorsByWorkType.slice(0, 5).map((item) => (
                    <div key={item.work_type} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">{item.work_type}</span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                      <Progress 
                        value={(item.count / stats.totalVendors) * 100} 
                        className="h-1.5" 
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            {stats.recentActivity.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Recent Vendor Activity
                </h4>
                <ScrollArea className="h-[180px]">
                  <div className="space-y-2 pr-4">
                    {stats.recentActivity.map((activity) => (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          {getActivityIcon(activity.activity_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{activity.vendor_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {activity.project_name && (
                              <>
                                <span className="truncate">{activity.project_name}</span>
                                <span>•</span>
                              </>
                            )}
                            {activity.amount && (
                              <>
                                <span>₹{activity.amount.toLocaleString()}</span>
                                <span>•</span>
                              </>
                            )}
                            <span>{formatDistanceToNow(new Date(activity.date), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
