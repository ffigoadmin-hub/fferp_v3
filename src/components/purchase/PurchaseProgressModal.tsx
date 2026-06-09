import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Clock, MessageSquare, User, Send } from 'lucide-react';
import { format } from 'date-fns';
import { PurchaseProgressLog } from '@/hooks/usePurchaseProgress';

interface PurchaseProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  projectName?: string;
  existingLogs: PurchaseProgressLog[];
  onSubmit: (requestId: string, updateText: string, statusUpdate?: string) => Promise<void>;
  isLoading?: boolean;
}

const statusOptions = [
  { value: 'sourcing', label: 'Sourcing Vendors' },
  { value: 'quotes_collected', label: 'Quotes Collected' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'ordered', label: 'Order Placed' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'partial_delivery', label: 'Partial Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'issue', label: 'Issue/Delay' },
];

export function PurchaseProgressModal({
  open,
  onOpenChange,
  requestId,
  projectName,
  existingLogs,
  onSubmit,
  isLoading,
}: PurchaseProgressModalProps) {
  const [updateText, setUpdateText] = useState('');
  const [statusUpdate, setStatusUpdate] = useState<string>('');

  const handleSubmit = async () => {
    if (!updateText.trim()) return;
    await onSubmit(requestId, updateText, statusUpdate || undefined);
    setUpdateText('');
    setStatusUpdate('');
    onOpenChange(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-500/20 text-green-400';
      case 'in_transit': return 'bg-blue-500/20 text-blue-400';
      case 'ordered': return 'bg-indigo-500/20 text-indigo-400';
      case 'issue': return 'bg-red-500/20 text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <span className="truncate">Progress Updates</span>
          </DialogTitle>
          {projectName && (
            <p className="text-sm text-muted-foreground truncate">{projectName}</p>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-6 space-y-5">
            {/* New Update Form */}
            <div className="space-y-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                Add New Update
              </h3>
              
              <div className="space-y-2">
                <Label>Progress Update <span className="text-destructive">*</span></Label>
                <Textarea
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  placeholder="Describe today's progress, status, or any updates..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label>Status Change (optional)</Label>
                <Select value={statusUpdate} onValueChange={setStatusUpdate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select if status changed..." />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Existing Logs */}
            {existingLogs.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Previous Updates
                  <Badge variant="outline" className="ml-1">{existingLogs.length}</Badge>
                </h3>
                <div className="space-y-2">
                  {existingLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-lg bg-card border border-border/50">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium">{log.updated_by_name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {log.status_update && (
                            <Badge className={getStatusColor(log.status_update) + " text-xs border-0"}>
                              {statusOptions.find(s => s.value === log.status_update)?.label || log.status_update}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), 'dd MMM HH:mm')}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{log.update_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {existingLogs.length === 0 && (
              <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No previous updates</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row gap-2 p-4 border-t bg-muted/20 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:mr-auto">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!updateText.trim() || isLoading} className="gap-2">
            <Send className="w-4 h-4" />
            {isLoading ? 'Saving...' : 'Add Update'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
