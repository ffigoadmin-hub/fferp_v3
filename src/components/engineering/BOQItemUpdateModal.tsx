import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Package, Edit, Truck } from 'lucide-react';
import { BOQ_CATEGORIES } from '@/constants/projectCategories';

interface BOQItem {
  id: string;
  line_number: number;
  material_name: string;
  specification?: string | null;
  quantity: number;
  unit: string;
  category?: string;
  phase_id?: string | null;
  status: string;
  estimated_unit_cost?: number | null;
  actual_unit_cost?: number | null;
  sourced_via?: string | null;
  notes?: string | null;
  delivery_notes?: string | null;
  ordered_at?: string | null;
  delivered_at?: string | null;
}

interface BOQItemUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: BOQItem | null;
  phases?: { id: string; phase_name: string }[];
  onSuccess: () => void;
}

const BOQ_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'requested', label: 'Requested', color: 'bg-orange-100 text-orange-800' },
  { value: 'ordered', label: 'Ordered', color: 'bg-blue-100 text-blue-800' },
  { value: 'sourced', label: 'Sourced', color: 'bg-purple-100 text-purple-800' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-800' },
];

export function BOQItemUpdateModal({ open, onOpenChange, item, phases = [], onSuccess }: BOQItemUpdateModalProps) {
  // Edit form state for pending items
  const [editFormData, setEditFormData] = useState({
    material_name: '',
    specification: '',
    quantity: '',
    unit: '',
    estimated_unit_cost: '',
    category: 'material',
    phase_id: '',
    notes: '',
  });

  // Status update form state
  const [status, setStatus] = useState('pending');
  const [actualUnitCost, setActualUnitCost] = useState('');
  const [sourcedVia, setSourcedVia] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data when item changes
  useEffect(() => {
    if (item) {
      setEditFormData({
        material_name: item.material_name || '',
        specification: item.specification || '',
        quantity: item.quantity?.toString() || '',
        unit: item.unit || 'units',
        estimated_unit_cost: item.estimated_unit_cost?.toString() || '',
        category: item.category || 'material',
        phase_id: item.phase_id || '',
        notes: item.notes || '',
      });
      setStatus(item.status || 'pending');
      setActualUnitCost(item.actual_unit_cost?.toString() || '');
      setSourcedVia(item.sourced_via || '');
      setDeliveryNotes(item.delivery_notes || '');
    }
  }, [item]);

  const handleEditSave = async () => {
    if (!item) return;

    if (!editFormData.material_name || !editFormData.quantity) {
      toast.error('Material name and quantity are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const updates: any = {
        material_name: editFormData.material_name,
        specification: editFormData.specification || null,
        quantity: parseFloat(editFormData.quantity),
        unit: editFormData.unit || 'units',
        estimated_unit_cost: editFormData.estimated_unit_cost ? parseFloat(editFormData.estimated_unit_cost) : null,
        category: editFormData.category,
        phase_id: editFormData.phase_id || null,
        notes: editFormData.notes || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('project_boq')
        .update(updates)
        .eq('id', item.id);

      if (error) throw error;

      toast.success('BOQ item updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusSave = async () => {
    if (!item) return;

    setIsSubmitting(true);
    try {
      const updates: any = {
        status,
        sourced_via: sourcedVia || null,
        delivery_notes: deliveryNotes || null,
        updated_at: new Date().toISOString()
      };

      if (actualUnitCost) {
        updates.actual_unit_cost = parseFloat(actualUnitCost);
        updates.actual_total = parseFloat(actualUnitCost) * item.quantity;
      }

      if (status === 'ordered' && !item.ordered_at) {
        updates.ordered_at = new Date().toISOString();
      }

      if (status === 'delivered' && !item.delivered_at) {
        updates.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('project_boq')
        .update(updates)
        .eq('id', item.id);

      if (error) throw error;

      toast.success('BOQ item updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update item');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!item) return null;

  const isPending = item.status === 'pending';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Update BOQ Item #{item.line_number}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {/* Only Edit Details logic for BOQ Builder Workspace */}
          <div className="space-y-4">
            {!isPending ? (
              <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                This item cannot be edited because it has been {item.status}.
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-xs uppercase text-muted-foreground font-bold">Material/Item Name *</Label>
                  <Input
                    value={editFormData.material_name}
                    onChange={(e) => setEditFormData({ ...editFormData, material_name: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label className="text-xs uppercase text-muted-foreground font-bold">Phase</Label>
                    <Select
                      value={editFormData.phase_id || 'none'}
                      onValueChange={(v) => setEditFormData({ ...editFormData, phase_id: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select phase" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Uncategorized</SelectItem>
                        {phases.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.phase_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase text-muted-foreground font-bold">Quantity *</Label>
                    <Input
                      type="number"
                      value={editFormData.quantity}
                      onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs uppercase text-muted-foreground font-bold">Unit</Label>
                    <Select value={editFormData.unit} onValueChange={(val) => setEditFormData(p => ({ ...p, unit: val }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="units">Units</SelectItem>
                        <SelectItem value="kg">Kg</SelectItem>
                        <SelectItem value="bags">Bags</SelectItem>
                        <SelectItem value="sqft">Sq.ft</SelectItem>
                        <SelectItem value="cum">Cu.m</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground font-bold">Specification</Label>
                  <Input
                    value={editFormData.specification}
                    onChange={(e) => setEditFormData({ ...editFormData, specification: e.target.value })}
                    className="mt-1"
                    placeholder="Brand/Type"
                  />
                </div>

                <div>
                  <Label className="text-xs uppercase text-muted-foreground font-bold">Notes</Label>
                  <Textarea
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    className="mt-1"
                    rows={2}
                  />
                </div>

                <DialogFooter className="pt-4">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                  <Button onClick={handleEditSave} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
