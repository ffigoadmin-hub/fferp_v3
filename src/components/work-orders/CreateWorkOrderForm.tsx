import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import { useProjectPhases } from '@/hooks/useProjectPhases';
import { useMilestones } from '@/hooks/useMilestones';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useStorageUrl } from '@/hooks/useStorageUrl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, FileText, IndianRupee, Layers, Target, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CreateWorkOrderFormProps {
  initialProjectId?: string;
  onSuccess?: () => void;
}

export function CreateWorkOrderForm({ initialProjectId, onSuccess }: CreateWorkOrderFormProps) {
  const { user } = useAuth();
  const { projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('');
  
  const { phases } = useProjectPhases(selectedProjectId);
  const { milestones } = useMilestones(selectedProjectId);
  const { createWorkOrder, isSaving } = useWorkOrders(selectedProjectId);
  
  const [formData, setFormData] = useState({
    workDescription: '',
    detailedScope: '',
    approvedBudget: 0,
    advanceAmount: 0,
    termsAndConditions: '',
    startDate: '',
    woDocumentUrl: ''
  });

  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedProjectId}/${Date.now()}.${fileExt}`;
      const filePath = `work-orders/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('project_documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('project_documents')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, woDocumentUrl: publicUrl }));
      toast.success('Work Order document uploaded');
    } catch (error: any) {
      toast.error('Upload failed: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast.error('Please select a project');
      return;
    }

    const res = await createWorkOrder({
      projectId: selectedProjectId,
      phaseId: selectedPhaseId,
      milestoneId: selectedMilestoneId,
      ...formData
    });

    if (res.success) {
      setFormData({
        workDescription: '',
        detailedScope: '',
        approvedBudget: 0,
        advanceAmount: 0,
        termsAndConditions: '',
        startDate: '',
        woDocumentUrl: ''
      });
      setSelectedPhaseId('');
      setSelectedMilestoneId('');
      if (onSuccess) onSuccess();
    }
  };

  return (
    <Card className="authority-card overflow-hidden">
      <CardHeader className="bg-primary/5 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Create New Work Order</CardTitle>
            <p className="text-sm text-muted-foreground">Initiate Stage 1: Budget Pre-approval</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Project Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> Project *
              </Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.project_id} value={p.project_id}>
                      {p.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Phase & Milestone Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" /> Phase
                </Label>
                <Select 
                  value={selectedPhaseId} 
                  onValueChange={setSelectedPhaseId}
                  disabled={!selectedProjectId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Phase" />
                  </SelectTrigger>
                  <SelectContent>
                    {phases.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.phase_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" /> Milestone
                </Label>
                <Select 
                  value={selectedMilestoneId} 
                  onValueChange={setSelectedMilestoneId}
                  disabled={!selectedProjectId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Milestone" />
                  </SelectTrigger>
                  <SelectContent>
                    {milestones.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.description?.slice(0, 30)}...</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Work Description *</Label>
              <Input 
                required
                value={formData.workDescription}
                onChange={e => setFormData(prev => ({ ...prev, workDescription: e.target.value }))}
                placeholder="e.g., Electrical Wiring for Main Hall"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Detailed Scope of Work</Label>
              <Textarea 
                value={formData.detailedScope}
                onChange={e => setFormData(prev => ({ ...prev, detailedScope: e.target.value }))}
                placeholder="List technical specifications and detailed work scope..."
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-primary" /> Approved Budget Amount (₹) *
              </Label>
              <Input 
                type="number"
                required
                value={formData.approvedBudget}
                onChange={e => setFormData(prev => ({ ...prev, approvedBudget: Number(e.target.value) }))}
                placeholder="Allocated budget for this work"
              />
            </div>

            <div className="space-y-2">
              <Label>Advance Amount (₹)</Label>
              <Input 
                type="number"
                value={formData.advanceAmount}
                onChange={e => setFormData(prev => ({ ...prev, advanceAmount: Number(e.target.value) }))}
                placeholder="Initial advance if applicable"
              />
            </div>

            <div className="space-y-2">
              <Label>Preferred Start Date</Label>
              <Input 
                type="date"
                value={formData.startDate}
                onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Work Order Document / Request Proof</Label>
              <div className="flex gap-2">
                <Input 
                  type="file" 
                  onChange={handleFileUpload} 
                  disabled={isUploading || !selectedProjectId}
                  className="cursor-pointer"
                />
                {isUploading && <Loader2 className="w-4 h-4 animate-spin mt-3" />}
              </div>
              {!selectedProjectId && <p className="text-xs text-status-late mt-1">Select project first to upload</p>}
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end gap-3">
            <Button 
              type="submit" 
              disabled={isSaving || isUploading}
              className="bg-primary hover:bg-primary/90 min-w-[150px]"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Submit for Approval
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
