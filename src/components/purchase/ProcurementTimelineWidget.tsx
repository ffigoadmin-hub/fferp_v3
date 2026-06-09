import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Clock, Package, Truck, CheckCircle2, FileText, CreditCard,
  User, ArrowRight, Loader2, Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProcurementTimeline, TimelineEntry } from '@/hooks/useProcurementTimeline';
import { cn } from '@/lib/utils';

interface ProcurementTimelineWidgetProps {
  materialRequestId?: string;
  vendorWorkRequestId?: string;
  title?: string;
}

const actionConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  request_created: { icon: FileText, color: 'bg-blue-500/20 text-blue-400', label: 'Request Created' },
  sourcing_started: { icon: Search, color: 'bg-violet-500/20 text-violet-400', label: 'Sourcing Started' },
  quote_added: { icon: FileText, color: 'bg-indigo-500/20 text-indigo-400', label: 'Quote Added' },
  quote_selected: { icon: CheckCircle2, color: 'bg-emerald-500/20 text-emerald-400', label: 'Quote Selected' },
  approval_submitted: { icon: Clock, color: 'bg-amber-500/20 text-amber-400', label: 'Submitted for Approval' },
  gm_approved: { icon: CheckCircle2, color: 'bg-sky-500/20 text-sky-400', label: 'GM Approved' },
  admin_approved: { icon: CheckCircle2, color: 'bg-teal-500/20 text-teal-400', label: 'Admin Approved' },
  ceo_approved: { icon: CheckCircle2, color: 'bg-green-500/20 text-green-400', label: 'CEO Approved' },
  payment_executed: { icon: CreditCard, color: 'bg-emerald-500/20 text-emerald-400', label: 'Payment Executed' },
  order_placed: { icon: Package, color: 'bg-blue-500/20 text-blue-400', label: 'Order Placed' },
  loading_started: { icon: Package, color: 'bg-orange-500/20 text-orange-400', label: 'Loading Started' },
  order_shipped: { icon: Truck, color: 'bg-cyan-500/20 text-cyan-400', label: 'Shipped' },
  unloading_started: { icon: Truck, color: 'bg-amber-500/20 text-amber-400', label: 'Unloading at Site' },
  delivery_received: { icon: CheckCircle2, color: 'bg-green-500/20 text-green-400', label: 'Delivered' },
  delivery_verified: { icon: CheckCircle2, color: 'bg-emerald-500/20 text-emerald-400', label: 'Delivery Verified' },
  delivery_discrepancy: { icon: Clock, color: 'bg-red-500/20 text-red-400', label: 'Discrepancy Flagged' },
  inventory_added: { icon: Package, color: 'bg-green-500/20 text-green-400', label: 'Added to Inventory' },
  wo_created: { icon: FileText, color: 'bg-violet-500/20 text-violet-400', label: 'Work Order Created' },
  vendor_aligned: { icon: User, color: 'bg-indigo-500/20 text-indigo-400', label: 'Vendor Aligned' },
  status_updated: { icon: Clock, color: 'bg-muted text-muted-foreground', label: 'Status Updated' },
};

export function ProcurementTimelineWidget({
  materialRequestId,
  vendorWorkRequestId,
  title = "Procurement Timeline"
}: ProcurementTimelineWidgetProps) {
  const { entries, isLoading } = useProcurementTimeline(materialRequestId, vendorWorkRequestId);

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="py-4 px-5 border-b border-border/30">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          No timeline entries yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="py-4 px-5 border-b border-border/30">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          {title}
          <Badge variant="secondary" className="ml-2">{entries.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <ScrollArea className="h-[300px]">
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

            {/* Timeline Entries */}
            <div className="space-y-4">
              {entries.map((entry, index) => {
                const config = actionConfig[entry.action] || {
                  icon: Clock,
                  color: 'bg-muted text-muted-foreground',
                  label: entry.action.replace(/_/g, ' '),
                };
                const Icon = config.icon;

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative pl-10"
                  >
                    {/* Timeline Node */}
                    <div className={cn(
                      "absolute left-2 w-5 h-5 rounded-full flex items-center justify-center -translate-x-1/2 z-10",
                      config.color
                    )}>
                      <Icon className="w-3 h-3" />
                    </div>

                    {/* Entry Content */}
                    <div className="p-3 rounded-lg border border-border/30 bg-card hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm capitalize">
                          {config.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(entry.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>

                      {entry.performed_by_name && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />
                          {entry.performed_by_name}
                        </div>
                      )}

                      {entry.details && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {typeof entry.details === 'object' ? (
                            <div className="space-y-1">
                              {Object.entries(entry.details).map(([key, value]) => (
                                value && (
                                  <div key={key} className="flex items-center gap-2">
                                    <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                                    <span className="text-foreground">
                                      {typeof value === 'number'
                                        ? value.toLocaleString('en-IN')
                                        : String(value)
                                      }
                                    </span>
                                  </div>
                                )
                              ))}
                            </div>
                          ) : (
                            String(entry.details)
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
