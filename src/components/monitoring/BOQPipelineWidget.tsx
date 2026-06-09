import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ClipboardCheck, FileEdit, Clock, CheckCircle2,
  RefreshCw, Loader2, Eye, IndianRupee, AlertTriangle, ArrowRight
} from 'lucide-react';
import { useBOQPipeline, BOQPipelineItem } from '@/hooks/useBOQPipeline';

interface BOQPipelineWidgetProps {
  compact?: boolean;
  maxItems?: number;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'approved':
      return <Badge className="bg-green-500/20 text-green-600 border-0">Approved</Badge>;
    case 'submitted':
    case 'boq_submitted':
      return <Badge className="bg-amber-500/20 text-amber-600 border-0">L1 Approval</Badge>;
    case 'boq_submitted_smo':
      return <Badge className="bg-amber-500/20 text-amber-600 border-0">L1 Review (SMO)</Badge>;
    case 'boq_submitted_gmo':
      return <Badge className="bg-orange-500/20 text-orange-600 border-0">L2 Review (GMO)</Badge>;
    case 'draft':
    case 'boq_draft':
      return <Badge className="bg-blue-500/20 text-blue-600 border-0">Draft</Badge>;
    default:
      return <Badge variant="secondary" className="capitalize">{status?.replace(/_/g, ' ')}</Badge>;
  }
};

export function BOQPipelineWidget({ compact = false, maxItems = 10 }: BOQPipelineWidgetProps) {
  const { items, summary, isLoading, refetch } = useBOQPipeline();

  const displayItems = items.slice(0, maxItems);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            BOQ Pipeline
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-xl font-bold">{summary.total_boqs}</p>
            <p className="text-xs text-muted-foreground">Total Items</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-amber-500/10">
            <p className="text-xl font-bold text-amber-600">{summary.pending_approval}</p>
            <p className="text-xs text-amber-600">Pending</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-green-500/10">
            <p className="text-xl font-bold text-green-600">{summary.approved_today}</p>
            <p className="text-xs text-green-600">Today</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-primary/10">
            <p className="text-lg font-bold text-primary">
              ₹{(summary.total_pipeline_value / 100000).toFixed(1)}L
            </p>
            <p className="text-xs text-primary">Value</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pt-0">
        <ScrollArea className={compact ? "h-[250px]" : "h-[350px]"}>
          {displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileEdit className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No BOQs in pipeline</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayItems.map((item, index) => (
                <BOQPipelineItemCard key={item.id} item={item} index={index} compact={compact} />
              ))}
            </div>
          )}
        </ScrollArea>

        {!compact && items.length > maxItems && (
          <div className="mt-4 text-center">
            <Link to="/smo/boq-approvals">
              <Button variant="outline" size="sm" className="gap-2">
                View All BOQs <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BOQPipelineItemCard({ item, index, compact }: { item: BOQPipelineItem; index: number; compact: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-sm truncate">{item.project_name}</p>
            {getStatusBadge(item.boq_status)}
          </div>
          <p className="text-xs text-muted-foreground truncate">{item.client_name}</p>

          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <ClipboardCheck className="w-3 h-3" />
              {item.boq_count} items
            </span>
            <span className="flex items-center gap-1 font-medium">
              <IndianRupee className="w-3 h-3" />
              ₹{(item.total_estimated_value / 1000).toFixed(0)}K
            </span>
            {item.boq_status === 'submitted' && item.days_pending > 0 && (
              <span className={`flex items-center gap-1 ${item.days_pending > 3 ? 'text-red-500' : 'text-amber-500'}`}>
                <Clock className="w-3 h-3" />
                {item.days_pending}d pending
              </span>
            )}
          </div>
        </div>

        <Link to={`/engineering/boq/${item.project_id}`}>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Eye className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
