import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, AlertTriangle, Plus, Trash2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BOQItem {
  id: string;
  material_name: string;
  specification?: string;
  quantity: number;
  unit: string;
}

interface Phase {
  id: string;
  phase_name: string;
}

interface MaterialRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phases: Phase[];
  boqItems: BOQItem[];
  onSubmit: (data: {
    phase_id?: string;
    boq_items: { id: string; quantity_needed: number; specification?: string }[];
    urgency: 'low' | 'normal' | 'high' | 'critical';
    notes?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

const urgencyConfig = {
  low: { label: 'Low', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  normal: { label: 'Normal', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  high: { label: 'High', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  critical: { label: 'Critical', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export function MaterialRequestModal({
  open,
  onOpenChange,
  projectId,
  phases,
  boqItems,
  onSubmit,
  isLoading,
}: MaterialRequestModalProps) {
  const [selectedPhase, setSelectedPhase] = useState<string>('');
  const [urgency, setUrgency] = useState<'low' | 'normal' | 'high' | 'critical'>('normal');
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ id: string; quantity_needed: number; specification?: string }[]>([]);

  const toggleItem = (item: BOQItem) => {
    const exists = selectedItems.find(i => i.id === item.id);
    if (exists) {
      setSelectedItems(selectedItems.filter(i => i.id !== item.id));
    } else {
      setSelectedItems([...selectedItems, {
        id: item.id,
        quantity_needed: item.quantity,
        specification: item.specification
      }]);
    }
  };

  const updateQuantity = (id: string, quantity: number) => {
    setSelectedItems(selectedItems.map(i =>
      i.id === id ? { ...i, quantity_needed: quantity } : i
    ));
  };

  const updateSpecification = (id: string, specification: string) => {
    setSelectedItems(selectedItems.map(i =>
      i.id === id ? { ...i, specification } : i
    ));
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) return;

    // Validate Phase if phases are available for this project
    if (phases.length > 0 && !selectedPhase) {
      return;
    }

    await onSubmit({
      phase_id: selectedPhase || undefined,
      boq_items: selectedItems,
      urgency,
      notes: notes || undefined,
    });

    // Reset form
    setSelectedPhase('');
    setUrgency('normal');
    setNotes('');
    setSelectedItems([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Request Materials
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Phase Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phase {phases.length > 0 && <span className="text-red-500">*</span>}</Label>
              <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                <SelectTrigger className={phases.length > 0 && !selectedPhase ? "border-red-300 ring-offset-red-100" : ""}>
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
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={(v) => setUrgency(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(urgencyConfig).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* BOQ Items Selection */}
          <div className="space-y-2">
            <Label>Select Materials from BOQ</Label>
            <ScrollArea className="h-[280px] border rounded-lg p-2">
              {boqItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Package className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No BOQ items available</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {boqItems.map(item => {
                    const isSelected = selectedItems.some(i => i.id === item.id);
                    const selectedItem = selectedItems.find(i => i.id === item.id);

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={cn(
                          "flex flex-col gap-3 p-3 rounded-lg border transition-all",
                          isSelected
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/50 bg-card hover:border-primary/30"
                        )}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleItem(item)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.material_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.specification || 'No specification'} • {item.quantity} {item.unit}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-2 shrink-0">
                              <Input
                                type="number"
                                value={selectedItem?.quantity_needed || 0}
                                onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                                className="w-24 h-8 text-sm"
                                min={1}
                                max={item.quantity}
                              />
                              <span className="text-xs text-muted-foreground w-8">{item.unit}</span>
                            </div>
                          )}
                        </div>

                        {isSelected && (
                          <div className="pl-8 pr-1 w-full animate-in fade-in slide-in-from-top-1 duration-200">
                            <Label className="text-xs text-muted-foreground mb-1.5 block">Specification / Brand (Optional)</Label>
                            <Textarea
                              placeholder={`Default: ${item.specification || 'Standard'}`}
                              value={selectedItem?.specification || ''}
                              onChange={(e) => updateSpecification(item.id, e.target.value)}
                              className="h-16 text-sm resize-none"
                            />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Add any special instructions or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-20 resize-none"
            />
          </div>

          {/* Selected Summary */}
          {selectedItems.length > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <span className="text-sm text-muted-foreground">
                {selectedItems.length} item(s) selected
              </span>
              <Badge className={urgencyConfig[urgency].color}>
                {urgencyConfig[urgency].label} Priority
              </Badge>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedItems.length === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Submit Request
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
