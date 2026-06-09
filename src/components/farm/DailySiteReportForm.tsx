import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, Users, Cloud, AlertTriangle, Wrench, 
  Calendar, Plus, X, HardHat, Truck 
} from 'lucide-react';
import { useDailySiteUpdates } from '@/hooks/useDailySiteUpdates';
import { toast } from 'sonner';

interface DailySiteReportFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  phases?: Array<{ id: string; phase_name: string }>;
  onSuccess?: () => void;
}

const WEATHER_CONDITIONS = [
  'Clear',
  'Cloudy',
  'Light Rain',
  'Heavy Rain',
  'Hot',
  'Cold',
  'Windy',
  'Foggy'
];

const EQUIPMENT_OPTIONS = [
  'JCB',
  'Excavator',
  'Concrete Mixer',
  'Crane',
  'Dumper',
  'Roller',
  'Generator',
  'Welding Machine',
  'Scaffolding',
  'Other'
];

export function DailySiteReportForm({
  open,
  onOpenChange,
  projectId,
  projectName,
  phases = [],
  onSuccess
}: DailySiteReportFormProps) {
  const { createUpdate, isSaving } = useDailySiteUpdates();
  
  const [form, setForm] = useState({
    phase_id: '',
    work_done: '',
    progress_percentage: 0,
    weather_conditions: '',
    weather_impact: '',
    issues_faced: '',
    safety_incidents: '',
    tomorrow_plan: '',
  });

  const [laborBreakdown, setLaborBreakdown] = useState({
    skilled: 0,
    unskilled: 0,
    supervisors: 0,
    contractors: 0
  });

  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [customEquipment, setCustomEquipment] = useState('');

  const [materialsUsed, setMaterialsUsed] = useState<Array<{ name: string; quantity: number; unit: string }>>([]);
  const [newMaterial, setNewMaterial] = useState({ name: '', quantity: 0, unit: 'units' });

  const handleAddEquipment = (equipment: string) => {
    if (!selectedEquipment.includes(equipment)) {
      setSelectedEquipment([...selectedEquipment, equipment]);
    }
  };

  const handleRemoveEquipment = (equipment: string) => {
    setSelectedEquipment(selectedEquipment.filter(e => e !== equipment));
  };

  const handleAddMaterial = () => {
    if (newMaterial.name && newMaterial.quantity > 0) {
      setMaterialsUsed([...materialsUsed, { ...newMaterial }]);
      setNewMaterial({ name: '', quantity: 0, unit: 'units' });
    }
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterialsUsed(materialsUsed.filter((_, i) => i !== index));
  };

  const totalLabor = Object.values(laborBreakdown).reduce((sum, val) => sum + val, 0);

  const handleSubmit = async () => {
    if (!form.work_done.trim()) {
      toast.error('Please describe the work done today');
      return;
    }

    try {
      await createUpdate({
        project_id: projectId,
        phase_id: form.phase_id || undefined,
        work_done: form.work_done,
        progress_percentage: form.progress_percentage,
        weather_conditions: form.weather_conditions,
        issues_faced: form.issues_faced || undefined,
        labor_count: totalLabor,
        materials_used: materialsUsed,
        location_data: {
          labor_breakdown: laborBreakdown,
          equipment_used: selectedEquipment,
          weather_impact: form.weather_impact,
          safety_incidents: form.safety_incidents,
          tomorrow_plan: form.tomorrow_plan
        }
      });

      // Reset form
      setForm({
        phase_id: '',
        work_done: '',
        progress_percentage: 0,
        weather_conditions: '',
        weather_impact: '',
        issues_faced: '',
        safety_incidents: '',
        tomorrow_plan: '',
      });
      setLaborBreakdown({ skilled: 0, unskilled: 0, supervisors: 0, contractors: 0 });
      setSelectedEquipment([]);
      setMaterialsUsed([]);
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error already handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Daily Site Report
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{projectName}</p>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            {/* Phase Selection */}
            {phases.length > 0 && (
              <div className="space-y-2">
                <Label>Project Phase</Label>
                <Select value={form.phase_id} onValueChange={(v) => setForm({ ...form, phase_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select phase (optional)" />
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
            )}

            {/* Work Done */}
            <div className="space-y-2">
              <Label>Work Completed Today <span className="text-destructive">*</span></Label>
              <Textarea
                value={form.work_done}
                onChange={(e) => setForm({ ...form, work_done: e.target.value })}
                placeholder="Describe the work completed today in detail..."
                rows={4}
              />
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <Label>Progress Percentage</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.progress_percentage}
                  onChange={(e) => setForm({ ...form, progress_percentage: parseInt(e.target.value) || 0 })}
                  className="w-24"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>

            <Separator />

            {/* Labor Breakdown */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Labor Breakdown
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Skilled</Label>
                  <Input
                    type="number"
                    min={0}
                    value={laborBreakdown.skilled}
                    onChange={(e) => setLaborBreakdown({ ...laborBreakdown, skilled: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Unskilled</Label>
                  <Input
                    type="number"
                    min={0}
                    value={laborBreakdown.unskilled}
                    onChange={(e) => setLaborBreakdown({ ...laborBreakdown, unskilled: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Supervisors</Label>
                  <Input
                    type="number"
                    min={0}
                    value={laborBreakdown.supervisors}
                    onChange={(e) => setLaborBreakdown({ ...laborBreakdown, supervisors: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Contractors</Label>
                  <Input
                    type="number"
                    min={0}
                    value={laborBreakdown.contractors}
                    onChange={(e) => setLaborBreakdown({ ...laborBreakdown, contractors: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Total: {totalLabor} workers</p>
            </div>

            <Separator />

            {/* Equipment Used */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Equipment Used
              </Label>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map(eq => (
                  <Badge
                    key={eq}
                    variant={selectedEquipment.includes(eq) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => 
                      selectedEquipment.includes(eq) 
                        ? handleRemoveEquipment(eq) 
                        : handleAddEquipment(eq)
                    }
                  >
                    {eq}
                  </Badge>
                ))}
              </div>
              {selectedEquipment.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedEquipment.map(eq => (
                    <Badge key={eq} className="gap-1">
                      {eq}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveEquipment(eq)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Weather */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Cloud className="w-4 h-4" />
                  Weather Conditions
                </Label>
                <Select value={form.weather_conditions} onValueChange={(v) => setForm({ ...form, weather_conditions: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select weather" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEATHER_CONDITIONS.map(w => (
                      <SelectItem key={w} value={w}>{w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Weather Impact on Work</Label>
                <Input
                  value={form.weather_impact}
                  onChange={(e) => setForm({ ...form, weather_impact: e.target.value })}
                  placeholder="Any delays due to weather?"
                />
              </div>
            </div>

            <Separator />

            {/* Materials Used */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Materials Consumed
              </Label>
              {materialsUsed.length > 0 && (
                <div className="space-y-2">
                  {materialsUsed.map((mat, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <span className="flex-1">{mat.name}</span>
                      <span>{mat.quantity} {mat.unit}</span>
                      <Button size="icon" variant="ghost" onClick={() => handleRemoveMaterial(idx)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newMaterial.name}
                  onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                  placeholder="Material name"
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={newMaterial.quantity || ''}
                  onChange={(e) => setNewMaterial({ ...newMaterial, quantity: parseFloat(e.target.value) || 0 })}
                  placeholder="Qty"
                  className="w-20"
                />
                <Input
                  value={newMaterial.unit}
                  onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
                  placeholder="Unit"
                  className="w-20"
                />
                <Button size="icon" variant="outline" onClick={handleAddMaterial}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Issues & Safety */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Issues Faced
                </Label>
                <Textarea
                  value={form.issues_faced}
                  onChange={(e) => setForm({ ...form, issues_faced: e.target.value })}
                  placeholder="Any problems or blockers encountered..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-red-500" />
                  Safety Incidents
                </Label>
                <Textarea
                  value={form.safety_incidents}
                  onChange={(e) => setForm({ ...form, safety_incidents: e.target.value })}
                  placeholder="Report any safety incidents (leave blank if none)"
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* Tomorrow's Plan */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Tomorrow's Plan
              </Label>
              <Textarea
                value={form.tomorrow_plan}
                onChange={(e) => setForm({ ...form, tomorrow_plan: e.target.value })}
                placeholder="What's planned for tomorrow..."
                rows={2}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
