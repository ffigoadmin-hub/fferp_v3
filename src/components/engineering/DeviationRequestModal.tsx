import { useState } from 'react';
import { Calendar, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays } from 'date-fns';
import { useDeviationRequests, Milestone } from '@/hooks/useMilestones';
import { toast } from 'sonner';

interface DeviationRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone: Milestone;
  projectId: string;
  onSuccess: () => void;
}

export function DeviationRequestModal({
  open,
  onOpenChange,
  milestone,
  projectId,
  onSuccess,
}: DeviationRequestModalProps) {
  const { createRequest, isSaving } = useDeviationRequests(projectId, milestone.id);
  
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  const [proofUrl, setProofUrl] = useState('');

  const handleSubmit = async () => {
    if (!newDate || !reason) {
      toast.error('Please provide new date and reason');
      return;
    }

    const daysDiff = differenceInDays(new Date(newDate), new Date(milestone.planned_date));
    if (daysDiff <= 0) {
      toast.error('New date must be after the original planned date');
      return;
    }

    const result = await createRequest({
      milestone_id: milestone.id,
      project_id: projectId,
      original_date: milestone.planned_date,
      new_proposed_date: newDate,
      reason,
      proof_url: proofUrl || undefined,
    });

    if (result.success) {
      onSuccess();
      onOpenChange(false);
      setNewDate('');
      setReason('');
      setProofUrl('');
    }
  };

  const daysDiff = newDate ? differenceInDays(new Date(newDate), new Date(milestone.planned_date)) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Request Milestone Deviation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Milestone Info */}
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{milestone.milestone_name}</span>
                <Badge variant="outline" className="text-xs">
                  {milestone.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  Current: {format(new Date(milestone.planned_date), 'MMM d, yyyy')}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* New Date */}
          <div>
            <Label>New Proposed Date *</Label>
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={milestone.planned_date}
              className="mt-1"
            />
            {daysDiff > 0 && (
              <p className="text-xs text-amber-500 mt-1">
                Extension of {daysDiff} days requested
              </p>
            )}
          </div>

          {/* Reason */}
          <div>
            <Label>Reason for Deviation *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why the milestone needs to be delayed..."
              className="mt-1"
              rows={3}
            />
          </div>

          {/* Proof URL */}
          <div>
            <Label>Supporting Document URL (optional)</Label>
            <Input
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="Google Drive or other link"
              className="mt-1"
            />
          </div>

          {/* Approval Chain Info */}
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Approval Chain
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">SMO</Badge>
                <span>→</span>
                <Badge variant="outline" className="text-xs">GMO</Badge>
                <span>→</span>
                <Badge variant="outline" className="text-xs">CEO</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSaving || !newDate || !reason}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Deviation Request'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
