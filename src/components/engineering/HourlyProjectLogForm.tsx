import { useState } from 'react';
import { Clock, Send, Loader2, Camera, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDailySiteUpdates } from '@/hooks/useDailySiteUpdates';
import { toast } from 'sonner';

interface HourlyProjectLogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phases: { id: string; phase_name: string }[];
  onSuccess?: () => void;
}

const TIME_SLOTS = [
  '09:00-10:00',
  '10:00-11:00',
  '11:00-12:00',
  '12:00-13:00',
  '13:00-14:00',
  '14:00-15:00',
  '15:00-16:00',
  '16:00-17:00',
  '17:00-18:00',
];

export function HourlyProjectLogForm({
  open,
  onOpenChange,
  projectId,
  phases,
  onSuccess,
}: HourlyProjectLogFormProps) {
  const { createUpdate, isSaving } = useDailySiteUpdates(projectId);
  
  const [formData, setFormData] = useState({
    timeSlot: '',
    phaseId: '',
    workDone: '',
    issues: '',
    laborCount: 0,
    progressPct: 0,
    photoUrl: '',
  });

  const handleSubmit = async () => {
    if (!formData.workDone.trim()) {
      toast.error('Please describe work done');
      return;
    }

    if (!formData.timeSlot) {
      toast.error('Please select a time slot');
      return;
    }

    try {
      await createUpdate({
        project_id: projectId,
        phase_id: formData.phaseId || undefined,
        work_done: `[${formData.timeSlot}] ${formData.workDone}`,
        issues_faced: formData.issues || undefined,
        labor_count: formData.laborCount || undefined,
        progress_percentage: formData.progressPct || undefined,
        photos: formData.photoUrl ? [formData.photoUrl] : undefined,
      });

      toast.success('Hourly log submitted');
      onSuccess?.();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        timeSlot: '',
        phaseId: '',
        workDone: '',
        issues: '',
        laborCount: 0,
        progressPct: 0,
        photoUrl: '',
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit log');
    }
  };

  // Determine current slot suggestion
  const currentHour = new Date().getHours();
  const suggestedSlot = TIME_SLOTS.find(slot => {
    const startHour = parseInt(slot.split(':')[0]);
    return currentHour >= startHour && currentHour < startHour + 1;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Log Hourly Work
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Time Slot Selection */}
          <div>
            <Label>Time Slot *</Label>
            <Select 
              value={formData.timeSlot} 
              onValueChange={(v) => setFormData({ ...formData, timeSlot: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select time slot" />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map(slot => (
                  <SelectItem key={slot} value={slot}>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {slot}
                      {slot === suggestedSlot && (
                        <Badge variant="secondary" className="text-[10px] ml-1">Current</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Phase Selection */}
          <div>
            <Label>Phase (optional)</Label>
            <Select 
              value={formData.phaseId || 'none'} 
              onValueChange={(v) => setFormData({ ...formData, phaseId: v === 'none' ? '' : v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">General Update</SelectItem>
                {phases.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.phase_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Work Done */}
          <div>
            <Label>Work Done *</Label>
            <Textarea
              value={formData.workDone}
              onChange={(e) => setFormData({ ...formData, workDone: e.target.value })}
              placeholder="Describe what was accomplished in this hour..."
              className="mt-1"
              rows={3}
            />
          </div>

          {/* Issues */}
          <div>
            <Label className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              Issues Faced
            </Label>
            <Textarea
              value={formData.issues}
              onChange={(e) => setFormData({ ...formData, issues: e.target.value })}
              placeholder="Any problems or blockers..."
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Labor Count</Label>
              <Input
                type="number"
                value={formData.laborCount}
                onChange={(e) => setFormData({ ...formData, laborCount: Number(e.target.value) })}
                className="mt-1"
                min={0}
              />
            </div>
            <div>
              <Label>Progress %</Label>
              <Input
                type="number"
                value={formData.progressPct}
                onChange={(e) => setFormData({ ...formData, progressPct: Number(e.target.value) })}
                className="mt-1"
                min={0}
                max={100}
              />
            </div>
          </div>

          {/* Photo URL */}
          <div>
            <Label className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              Photo URL (optional)
            </Label>
            <Input
              value={formData.photoUrl}
              onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
              placeholder="Google Drive or image link"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSaving || !formData.workDone.trim() || !formData.timeSlot}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Log
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
