import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wrench, Loader2, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Phase {
  id: string;
  phase_name: string;
}

interface VendorWorkRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phases: Phase[];
    onSubmit: (data: {
    phase_id?: string;
    work_type: 'labor' | 'installation' | 'service' | 'maintenance' | 'other';
    work_description: string;
    estimated_budget?: number;
    timeline_days?: number;
  }) => Promise<void>;
  isLoading?: boolean;
  isInternal?: boolean;
}

const workTypes = [
  { value: 'labour_work', label: 'Labour Work' },
  { value: 'contract_work', label: 'Contract Work' },
  { value: 'daily_wages', label: 'Daily Wages' },
  { value: 'installation', label: 'Installation' },
  { value: 'service', label: 'Service' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];

export function VendorWorkRequestModal({
  open,
  onOpenChange,
  projectId,
  phases,
  onSubmit,
  isLoading,
  isInternal = false,
}: VendorWorkRequestModalProps) {
  const [selectedPhase, setSelectedPhase] = useState<string>('');
  const [workType, setWorkType] = useState<string>('labour_work');
  const [otherWorkType, setOtherWorkType] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState<string>('');
  const [timelineDays, setTimelineDays] = useState<string>('');

  const handleSubmit = async () => {
    if (!description.trim()) return;

    await onSubmit({
      phase_id: selectedPhase || undefined,
      work_type: (workType === 'other' ? otherWorkType : workType) as 'installation' | 'labor' | 'maintenance' | 'other' | 'service',
      work_description: description,
      estimated_budget: estimatedBudget ? Number(estimatedBudget) : undefined,
      timeline_days: timelineDays ? Number(timelineDays) : undefined,
    });

    // Reset form
    setSelectedPhase('');
    setWorkType('labour_work');
    setOtherWorkType('');
    setDescription('');
    setEstimatedBudget('');
    setTimelineDays('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isInternal ? (
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            ) : (
              <Wrench className="w-5 h-5 text-primary" />
            )}
            {isInternal ? 'Create Internal Work Request' : 'Request Vendor Work'}
          </DialogTitle>
        </DialogHeader>

        {isInternal && (
          <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 mb-2">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1 italic">Internal Mode Active</p>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
              This request will be flagged for **Internal Sourcing (IGO GROUP)**. No external vendor bids will be required.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Phase Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phase (Optional)</Label>
              <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                <SelectTrigger>
                  <SelectValue placeholder="Select phase" />
                </SelectTrigger>
                <SelectContent>
                  {phases.map(phase => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.phase_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Work Type *</Label>
              <Select value={workType} onValueChange={(v) => setWorkType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {workType === 'other' && (
              <div className="col-span-2 space-y-2">
                <Label>Specify Work Type *</Label>
                <Input
                  value={otherWorkType}
                  onChange={(e) => setOtherWorkType(e.target.value)}
                  placeholder="Enter specific work type"
                />
              </div>
            )}
          </div>

          {/* Work Description */}
          <div className="space-y-2">
            <Label>Work Description *</Label>
            <Textarea
              placeholder="Describe the work to be done in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-24 resize-none"
            />
          </div>

          {/* Budget & Timeline */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estimated Budget (₹)</Label>
              <Input
                type="number"
                placeholder="0"
                value={estimatedBudget}
                onChange={(e) => setEstimatedBudget(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Timeline (Days)</Label>
              <Input
                type="number"
                placeholder="0"
                value={timelineDays}
                onChange={(e) => setTimelineDays(e.target.value)}
              />
            </div>
          </div>


          {/* Info Box */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-[11px] text-primary/70 font-medium">
              This request will be sent for Pre-approval. Once approved, you can download the work order for vendor sourcing.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!description.trim() || (workType === 'other' && !otherWorkType.trim()) || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Request'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
