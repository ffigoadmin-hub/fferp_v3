import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useProjectPhases, ProjectPhase } from '@/hooks/useProjectPhases';
import { Loader2, Save, Trash2 } from 'lucide-react';

interface PhaseUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase: ProjectPhase | null;
  projectId: string;
  onSuccess: () => void;
}

export function PhaseUpdateModal({ open, onOpenChange, phase, projectId, onSuccess }: PhaseUpdateModalProps) {
  const { updatePhaseProgress, deletePhase } = useProjectPhases(projectId);
  const [progress, setProgress] = useState(phase?.completion_percentage || 0);
  const [startDate, setStartDate] = useState(phase?.started_at ? new Date(phase.started_at).toISOString().split('T')[0] : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    if (!phase) return;

    setIsSubmitting(true);
    try {
      const startedAtValue = startDate ? new Date(startDate).toISOString() : undefined;
      await updatePhaseProgress(phase.id, progress, startedAtValue);
      onSuccess();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!phase) return;

    setIsDeleting(true);
    try {
      const result = await deletePhase(phase.id);
      if (result.success) {
        onSuccess();
        onOpenChange(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!phase) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Phase Progress</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <Label className="text-base font-medium">{phase.phase_name}</Label>
            {phase.description && (
              <p className="text-sm text-muted-foreground mt-1">{phase.description}</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Completion Progress</Label>
              <span className="text-2xl font-bold text-primary">{progress}%</span>
            </div>
            <Slider
              value={[progress]}
              onValueChange={(value) => setProgress(value[0])}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phase-start-date">Start Date</Label>
            <Input
              id="phase-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Estimated Cost</p>
              <p className="font-semibold">₹{(phase.estimated_cost || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Actual Cost</p>
              <p className="font-semibold">₹{(phase.actual_cost || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Phase?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{phase.phase_name}" and all associated data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Phase
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Progress
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
