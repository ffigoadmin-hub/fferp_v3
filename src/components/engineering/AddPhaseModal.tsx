import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProjectPhases } from '@/hooks/useProjectPhases';
import { Loader2, Plus } from 'lucide-react';

interface AddPhaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}

export function AddPhaseModal({ open, onOpenChange, projectId, onSuccess }: AddPhaseModalProps) {
  const { addPhase } = useProjectPhases(projectId);
  const [phaseName, setPhaseName] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [startDate, setStartDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!phaseName.trim()) return;

    setIsSubmitting(true);
    try {
      await addPhase({
        phase_name: phaseName,
        description: description || undefined,
        estimated_cost: parseFloat(estimatedCost) || 0,
        started_at: startDate ? new Date(startDate).toISOString() : undefined,
      });

      setPhaseName('');
      setDescription('');
      setEstimatedCost('');
      setStartDate('');
      onSuccess();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Project Phase</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">

          <div className="space-y-2">
            <Label htmlFor="phase-name">Phase Name *</Label>
            <Input
              id="phase-name"
              placeholder="e.g., Foundation, Structure, Finishing"
              value={phaseName}
              onChange={(e) => setPhaseName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the work involved in this phase"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-date">Target Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimated-cost">Estimated Cost (₹)</Label>
            <Input
              id="estimated-cost"
              type="number"
              placeholder="0"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!phaseName.trim() || isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Add Phase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
