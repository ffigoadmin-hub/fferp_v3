import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Clock, Package, User, MapPin, FileText, AlertCircle, CheckCircle, ArrowRight, Plus, Split } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { MaterialRequest } from '@/hooks/useMaterialRequests';
import { PurchaseProgressLog } from '@/hooks/usePurchaseProgress';
import { SplitRequestModal } from './SplitRequestModal';
import { useState } from 'react';

interface MaterialRequestDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: MaterialRequest | null;
  progressLogs: PurchaseProgressLog[];
  onStartSourcing?: () => void;
  onAddQuote?: () => void;
  onSplit?: (originalRequestId: string, itemsToMove: any[]) => Promise<void>;
  isLoading?: boolean;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-amber-500/20 text-amber-400' },
  sourcing: { label: 'Sourcing', color: 'bg-blue-500/20 text-blue-400' },
  quoted: { label: 'Quoted', color: 'bg-violet-500/20 text-violet-400' },
  approved: { label: 'Approved', color: 'bg-emerald-500/20 text-emerald-400' },
  ordered: { label: 'Ordered', color: 'bg-indigo-500/20 text-indigo-400' },
  delivered: { label: 'Delivered', color: 'bg-green-500/20 text-green-400' },
  pending_smo: { label: 'Pending SMO', color: 'bg-amber-500/20 text-amber-400' },
  pending_gmo: { label: 'Pending GMO', color: 'bg-amber-500/20 text-amber-400' },
  pending_gm: { label: 'Pending GM', color: 'bg-violet-500/20 text-violet-400' },
  pending_admin: { label: 'Pending Admin', color: 'bg-cyan-500/20 text-cyan-400' },
  pending_ceo: { label: 'Pending CEO', color: 'bg-orange-500/20 text-orange-400' },
  rejected_smo: { label: 'Rejected (SMO)', color: 'bg-red-500/20 text-red-400' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-500/20 text-slate-400' },
  approved_for_sourcing: { label: 'Ready for Sourcing', color: 'bg-purple-500/20 text-purple-400' },
};

const urgencyConfig: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: 'bg-red-500/20 text-red-400' },
  high: { label: 'High', color: 'bg-amber-500/20 text-amber-400' },
  normal: { label: 'Normal', color: 'bg-blue-500/20 text-blue-400' },
  low: { label: 'Low', color: 'bg-slate-500/20 text-slate-400' },
};

export function MaterialRequestDetailModal({
  open,
  onOpenChange,
  request,
  progressLogs,
  onStartSourcing,
  onAddQuote,
  onSplit,
  isLoading,
}: MaterialRequestDetailModalProps) {
  const [splitModalOpen, setSplitModalOpen] = useState(false);

  if (!request) return null;

  // Normalize phase - Supabase may return as array or object
  const phase = Array.isArray((request as any).phase)
    ? (request as any).phase[0]
    : (request as any).phase;

  // Logic to prioritize approval_status if available and meaningful
  const effectiveStatus = (request as any).approval_status && (request as any).approval_status !== 'null'
    ? (request as any).approval_status
    : request.status;

  // Fallback to searching request.status if approval_status mapping fails, or finally pending
  const status = statusConfig[effectiveStatus] || statusConfig[request.status] || statusConfig.pending;
  const urgency = urgencyConfig[request.urgency] || urgencyConfig.normal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Package className="w-5 h-5 text-primary" />
              Material Request
            </DialogTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("border-0", urgency.color)}>{urgency.label}</Badge>
              <Badge className={cn("border-0", status.color)}>{status.label}</Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-6 space-y-5">
            {/* Project & Requester Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <MapPin className="w-4 h-4" />
                  Project
                </div>
                <p className="font-semibold">{request.project?.project_name || 'N/A'}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground/80">Phase: </span>
                  {phase?.phase_name || 'No phase specified'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <User className="w-4 h-4" />
                  Requested By
                </div>
                <p className="font-semibold">{request.requester?.name || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">{request.requester?.department || ''}</p>
              </div>
            </div>

            {/* Request Time */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <Clock className="w-4 h-4" />
              <span>Requested on {format(new Date(request.created_at), 'dd MMM yyyy, hh:mm a')}</span>
            </div>

            <Separator />

            {/* BOQ Items */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Requested Items
                <Badge variant="outline" className="ml-1">{request.boq_items?.length || 0}</Badge>
              </h3>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                {request.boq_items && request.boq_items.length > 0 ? (
                  request.boq_items.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg bg-card border border-border/50 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{item.material_name || 'Unnamed Item'}</p>
                        {item.specification && (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-0.5 border-l-2 border-primary/20 pl-2">{item.specification}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">{item.quantity || item.quantity_needed || 0} {item.unit || 'units'}</p>
                        {item.estimated_unit_cost && (
                          <p className="text-sm text-muted-foreground">₹{Number(item.estimated_unit_cost).toLocaleString()}/unit</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                    No items specified
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {request.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/40 border border-border/50">
                    {request.notes}
                  </p>
                </div>
              </>
            )}

            <Separator />

            {/* Progress Timeline */}
            <div>
              <h3 className="font-semibold mb-3">Progress Updates</h3>
              {progressLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No updates yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2">
                  {progressLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-lg bg-card border border-border/50">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-primary" />
                          <span className="font-medium">{log.updated_by_name || 'Unknown'}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'dd MMM HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{log.update_text}</p>
                      {log.status_update && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          Status → {log.status_update}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-2 p-4 border-t bg-muted/20 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:mr-auto">
            Close
          </Button>
          {request.status === 'pending' && onStartSourcing && (
            <Button onClick={onStartSourcing} disabled={isLoading} className="gap-2">
              <ArrowRight className="w-4 h-4" />
              Start Sourcing
            </Button>
          )}
          {['pending', 'sourcing', 'quoted'].includes(request.status) && onSplit && (
            <Button variant="outline" onClick={() => setSplitModalOpen(true)} className="gap-2 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10">
              <Split className="w-4 h-4" />
              Split Request
            </Button>
          )}
          {request.status === 'sourcing' && onAddQuote && (
            <Button onClick={onAddQuote} disabled={isLoading} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Quote
            </Button>
          )}
        </div>
      </DialogContent>

      <SplitRequestModal
        open={splitModalOpen}
        onOpenChange={setSplitModalOpen}
        request={request}
        onSplit={onSplit || (async () => { })}
        isSplitting={isLoading}
      />
    </Dialog>
  );
}
