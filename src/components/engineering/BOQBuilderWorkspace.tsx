import { useState, useMemo, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Trash2, Loader2, Save, ArrowRight, CheckCircle2, Circle, Pencil, LayoutTemplate, AlertCircle, ChevronDown, ChevronUp, Eye, Clock, X, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBOQ, BOQItem } from '@/hooks/useBOQ';
import { useBOQTemplates, BOQTemplate, BOQTemplateItem } from '@/hooks/useBOQTemplates';
import { useProjectLifecycle } from '@/hooks/useProjectLifecycle';
import { useProjectPhases } from '@/hooks/useProjectPhases';
import { BOQItemUpdateModal } from '@/components/engineering/BOQItemUpdateModal';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';


interface BOQBuilderWorkspaceProps {
    projectId: string;
    onClose?: () => void;
    hideHeader?: boolean;
}

export function BOQBuilderWorkspace({ projectId, onClose, hideHeader = false }: BOQBuilderWorkspaceProps) {
    const navigate = useNavigate();
    const { project, isLoading: projectLoading, refetch: refetchProject } = useProjectLifecycle(projectId);
    const { items, addItem, addItemsBulk, updateItem, deleteItem, isLoading, isSaving, refetch } = useBOQ(projectId);
    const { phases, isLoading: phasesLoading } = useProjectPhases(projectId);
    const { templates, isLoading: templatesLoading, isSaving: templateSaving, createTemplate, updateTemplate, deleteTemplate, addItem: addTemplateItem, updateItem: updateTemplateItem, deleteItem: deleteTemplateItem } = useBOQTemplates();

    // Real-time subscription for project lifecycle changes
    useEffect(() => {
        if (!projectId) return;
        const channel = supabase
            .channel(`boq-workspace-lifecycle-${projectId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, () => {
                refetchProject();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [projectId, refetchProject]);

    // State for Create Template Dialog
    const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateCode, setNewTemplateCode] = useState('');

    // State for Edit Template Dialog
    const [editTemplateOpen, setEditTemplateOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<BOQTemplate | null>(null);
    const [editTemplateName, setEditTemplateName] = useState('');
    const [editTemplateCode, setEditTemplateCode] = useState('');

    // State for Expanded Template (to manage items)
    const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

    // State for Add Template Item form
    const [addItemForm, setAddItemForm] = useState({
        material_name: '',
        specification: '',
        unit: 'units',
        category: 'material' as 'material' | 'labour' | 'equipment',
        default_quantity: '',
        default_unit_cost: '',
    });

    const handleCreateTemplate = async () => {
        if (!newTemplateName || !newTemplateCode) {
            toast.error("Please fill in all fields");
            return;
        }
        await createTemplate(newTemplateCode, newTemplateName);
        setCreateTemplateOpen(false);
        setNewTemplateName('');
        setNewTemplateCode('');
    };

    const handleEditTemplate = async () => {
        if (!editingTemplate || !editTemplateName) return;
        await updateTemplate(editingTemplate.id, { vertical_name: editTemplateName, vertical_code: editTemplateCode });
        setEditTemplateOpen(false);
        setEditingTemplate(null);
    };

    const openEditTemplate = (template: BOQTemplate) => {
        setEditingTemplate(template);
        setEditTemplateName(template.vertical_name);
        setEditTemplateCode(template.vertical_code);
        setEditTemplateOpen(true);
    };

    const handleAddTemplateItem = async (templateId: string) => {
        if (!addItemForm.material_name || !addItemForm.default_quantity) {
            toast.error('Name and quantity are required');
            return;
        }
        const template = templates.find(t => t.id === templateId);
        const sortOrder = template ? template.items.length + 1 : 1;

        await addTemplateItem(templateId, {
            material_name: addItemForm.material_name,
            specification: addItemForm.specification || null,
            unit: addItemForm.unit,
            category: addItemForm.category,
            default_quantity: parseFloat(addItemForm.default_quantity),
            default_unit_cost: addItemForm.default_unit_cost ? parseFloat(addItemForm.default_unit_cost) : 0,
            sort_order: sortOrder,
            phase_name: null,
        });

        setAddItemForm({ material_name: '', specification: '', unit: 'units', category: 'material', default_quantity: '', default_unit_cost: '' });
    };

    // State for Material Form
    const [materialForm, setMaterialForm] = useState({
        material_name: '',
        specification: '',
        quantity: '',
        unit: 'units',
        estimated_unit_cost: '',
        phase_id: '',
    });

    // State for Labour Form
    const [activeTab, setActiveTab] = useState<string>('material');
    const [editItem2, setEditItem2] = useState<BOQItem | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    const steps = [
        { id: 'draft', label: 'Draft' },
        { id: 'boq_submitted_smo', label: 'L1 Approval (SMO)' },
        { id: 'boq_submitted_gmo', label: 'L2 Approval (GMO)' },
        { id: 'boq_approved', label: 'Approved' },
    ];

    const boqRelatedStages = ['new_deal', 'engineering_assigned', 'boq_draft', 'boq_submitted_smo', 'boq_submitted_gmo', 'boq_approved'];

    const currentStepIndex = useMemo(() => {
        if (!project?.lifecycle_stage) return 0;
        
        const stage = project.lifecycle_stage;
        if (stage === 'boq_submitted_smo') return 1;
        if (stage === 'boq_submitted_gmo') return 2;
        if (stage === 'boq_approved') return 3;
        
        // If lifecycle is past BOQ approval (sourcing, execution, etc.), show as approved
        const afterStages = ['sourcing', 'execution', 'completed'];
        if (afterStages.includes(stage)) return 3;
        
        // Otherwise (new_deal, engineering_assigned, boq_draft), it's at step 0
        return 0;
    }, [project?.lifecycle_stage]);

    const isAwaitingApproval = project?.lifecycle_stage === 'boq_submitted_smo' || project?.lifecycle_stage === 'boq_submitted_gmo';
    const isApproved = project?.lifecycle_stage === 'boq_approved' || (!boqRelatedStages.includes(project?.lifecycle_stage || '') && project?.lifecycle_stage !== null);
    const isRejected = project?.lifecycle_stage === 'engineering_assigned' && !!project?.boq_rejection_reason;

    // Material Add Handler
    const handleAddMaterial = async () => {
        if (!materialForm.material_name || !materialForm.quantity) {
            toast.error('Material name and quantity are required');
            return;
        }

        await addItem({
            project_id: projectId,
            phase_id: materialForm.phase_id || null,
            material_name: materialForm.material_name,
            specification: materialForm.specification || null,
            quantity: parseFloat(materialForm.quantity),
            unit: materialForm.unit,
            estimated_unit_cost: materialForm.estimated_unit_cost ? parseFloat(materialForm.estimated_unit_cost) : null,
            category: 'material',
            status: 'pending',
            notes: null,
            actual_unit_cost: null,
            actual_total: null,
            sourced_via: null,
            linked_po_id: null,
            linked_wo_id: null
        });

        setMaterialForm({ ...materialForm, material_name: '', specification: '', quantity: '', estimated_unit_cost: '' });
        toast.success('Material item added');
    };



    const handleApplyTemplate = async (template: BOQTemplate) => {
        if (!template.items || template.items.length === 0) {
            toast.error('Selected template has no items');
            return;
        }

        const newItems = template.items.map(item => ({
            project_id: projectId,
            phase_id: null,
            material_name: item.material_name,
            specification: item.specification || '',
            quantity: item.default_quantity,
            unit: item.unit,
            estimated_unit_cost: item.default_unit_cost,
            category: item.category,
            status: 'pending',
            notes: null,
            actual_unit_cost: null,
            actual_total: null,
            sourced_via: null,
            linked_po_id: null,
            linked_wo_id: null,
        }));

        const success = await addItemsBulk(newItems);
        if (success) {
            toast.success(`Template "${template.vertical_name}" applied successfully`);
            setActiveTab('material');
        }
    };

    const filteredItems = useMemo(() => {
        return items.filter(item => item.category === activeTab);
    }, [items, activeTab]);

    // Determine the status button text and style
    const getStatusButton = () => {
        if (isApproved && items.length > 0) {
            return { text: 'BOQ Approved', className: 'bg-emerald-600 hover:bg-emerald-600 text-white cursor-default', disabled: true, icon: CheckCircle2 };
        }
        if (isAwaitingApproval) {
            const stage = project?.lifecycle_stage === 'boq_submitted_smo' ? 'SMO Review' : 'GMO Review';
            return { text: `Pending ${stage}`, className: 'bg-amber-600 hover:bg-amber-600 text-white cursor-default', disabled: true, icon: Clock };
        }
        if (isRejected) {
            return { text: 'Re-submit for Review', className: 'bg-rose-600 hover:bg-rose-700 text-white', disabled: false, icon: ArrowRight };
        }
        return { text: 'Proceed to Review', className: 'bg-primary', disabled: false, icon: ArrowRight };
    };

    const statusBtn = getStatusButton();

    if (projectLoading || isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Workspace Header */}
            {!hideHeader && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                    <div>
                        <h2 className="text-lg font-bold">BOQ Workspace</h2>
                        <p className="text-xs text-muted-foreground">Manage project scope, material, and templates</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCreateTemplateOpen(true)}
                        >
                            <Plus className="w-4 h-4 mr-2" /> Global Template
                        </Button>
                        {!isApproved && !isAwaitingApproval && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toast.success('Draft Saved Locally')}
                            >
                                <Save className="w-4 h-4 mr-2" /> Save Draft
                            </Button>
                        )}
                        <Button
                            size="sm"
                            className={cn("gap-2", statusBtn.className)}
                            onClick={() => !statusBtn.disabled && navigate(`/engineering/boq/${projectId}/review`)}
                            disabled={statusBtn.disabled}
                        >
                            <statusBtn.icon className="w-4 h-4" />
                            {statusBtn.text}
                        </Button>
                    </div>
                </div>
            )}

            {/* Enhanced Status Stepper */}
            <Card className="border-border/50 overflow-hidden">
                <CardContent className="p-5">
                    <div className="relative flex justify-between w-full">
                        {/* Background Track */}
                        <div className="absolute top-[18px] left-[12%] w-[76%] h-[3px] bg-muted/60 rounded-full" />
                        {/* Active Track */}
                        <div
                            className="absolute top-[18px] left-[12%] h-[3px] rounded-full transition-all duration-700 ease-out"
                            style={{
                                width: `${Math.min(currentStepIndex / (steps.length - 1), 1) * 76}%`,
                                background: isApproved
                                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                                    : isRejected
                                        ? 'linear-gradient(90deg, #f43f5e, #fb7185)'
                                        : 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))'
                            }}
                        />

                        {steps.map((step, index) => {
                            const isCompleted = index < currentStepIndex;
                            const isCurrent = index === currentStepIndex;
                            const isFuture = index > currentStepIndex;
                            const stepIcons = ['✏️', '👤', '👥', '✅'];

                            return (
                                <div key={step.id} className="flex flex-col items-center gap-2 z-10 relative" style={{ width: `${100 / steps.length}%` }}>
                                    <div className={cn(
                                        "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ring-[3px] ring-background",
                                        isCompleted
                                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                                            : isCurrent && isAwaitingApproval
                                                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 animate-pulse'
                                                : isCurrent && isApproved
                                                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                                                    : isCurrent && isRejected
                                                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                                                        : isCurrent
                                                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                                                            : 'bg-muted text-muted-foreground/50'
                                    )}>
                                        {isCompleted ? (
                                            <CheckCircle2 className="w-4 h-4" />
                                        ) : isCurrent && isAwaitingApproval ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <span>{stepIcons[index]}</span>
                                        )}
                                    </div>
                                    <span className={cn(
                                        "text-[10px] font-semibold whitespace-nowrap transition-colors",
                                        isCurrent ? (isApproved ? 'text-emerald-500' : isRejected ? 'text-rose-500' : isAwaitingApproval ? 'text-amber-500' : 'text-primary')
                                            : isCompleted ? 'text-emerald-500' : 'text-muted-foreground/50'
                                    )}>
                                        {step.label}
                                    </span>
                                    {isCurrent && isAwaitingApproval && (
                                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-amber-500/10 text-amber-500 border-amber-500/20">
                                            In Review
                                        </Badge>
                                    )}
                                    {isCurrent && isApproved && (
                                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                            Complete
                                        </Badge>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Status Banners */}
            {isRejected && (
                <Card className="border-rose-500/30 bg-rose-500/5 overflow-hidden">
                    <CardContent className="p-4 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-5 h-5 text-rose-500" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-rose-500">Project Approval Rejected</h3>
                            <p className="text-xs text-foreground">
                                <strong>Reason:</strong> {project?.boq_rejection_reason}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                                Please address the feedback and click "Re-submit for Review".
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {isApproved && items.length > 0 && (
                <Card className="border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-emerald-500">Project Approved ✓</h3>
                            <p className="text-xs text-muted-foreground">The project scope has been reviewed and approved. All items are now read-only.</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {isAwaitingApproval && (
                <Card className="border-amber-500/30 bg-amber-500/5 overflow-hidden">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-amber-500">
                                {project?.lifecycle_stage === 'boq_submitted_smo' ? 'Pending SMO Review (L1)' : 'Pending GMO Review (L2)'}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {project?.lifecycle_stage === 'boq_submitted_smo'
                                    ? 'Project Plan submitted to Senior Manager. Waiting for L1 approval before forwarding to GMO.'
                                    : 'SMO has approved. Waiting for General Manager (L2) final approval.'}
                            </p>
                        </div>
                        <Badge className="ml-auto bg-amber-600 text-white text-[10px] shrink-0">
                            ⏳ {project?.lifecycle_stage === 'boq_submitted_smo' ? 'SMO Queue' : 'GMO Queue'}
                        </Badge>
                    </CardContent>
                </Card>
            )}

            {/* Forms and Table */}
            <div className="space-y-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <div className="flex justify-between items-center">
                        <TabsList className="grid w-full grid-cols-2 max-w-[240px]">
                            <TabsTrigger value="material" className="text-xs gap-2">
                                <Package className="w-3 h-3" /> Material
                            </TabsTrigger>
                            <TabsTrigger value="templates" className="text-xs gap-2">
                                <LayoutTemplate className="w-3 h-3" /> Templates
                            </TabsTrigger>
                        </TabsList>
                        <Button size="sm" onClick={() => setCreateTemplateOpen(true)} variant="ghost" className="h-9 text-xs">
                            <Plus className="w-3 h-3 mr-2" /> Create New Template
                        </Button>
                    </div>

                    {activeTab === 'templates' && (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                            {templatesLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : templates.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No templates available. Create one to get started.
                                </div>
                            ) : (
                                templates.map(template => {
                                    const isExpanded = expandedTemplateId === template.id;
                                    return (
                                        <Card key={template.id} className="border-border/50 overflow-hidden transition-all hover:border-primary/30">
                                            <CardHeader className="py-3 px-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <button onClick={() => setExpandedTemplateId(isExpanded ? null : template.id)} className="shrink-0">
                                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                                        </button>
                                                        <div className="min-w-0">
                                                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                                                {template.vertical_name}
                                                                <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 shrink-0">
                                                                    {template.items.length} Items
                                                                </Badge>
                                                            </CardTitle>
                                                            <CardDescription className="text-[10px]">{template.vertical_code}</CardDescription>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {!isAwaitingApproval && !isApproved && (
                                                            <Button
                                                                className="h-8 text-xs"
                                                                variant="secondary"
                                                                onClick={() => handleApplyTemplate(template)}
                                                                disabled={isSaving || template.items.length === 0}
                                                            >
                                                                {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Plus className="w-3 h-3 mr-1.5" />}
                                                                Load to BOQ
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTemplate(template)}>
                                                            <Pencil className="w-3 h-3 text-primary" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                            onClick={() => {
                                                                if (window.confirm(`Delete template "${template.vertical_name}"?`)) {
                                                                    deleteTemplate(template.id);
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardHeader>

                                            {/* Expanded Template Items */}
                                            {isExpanded && (
                                                <CardContent className="p-0 border-t border-border/30">
                                                    {/* Items Table */}
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-muted/20">
                                                                <TableHead className="text-[10px] font-bold uppercase w-8">#</TableHead>
                                                                <TableHead className="text-[10px] font-bold uppercase">Item Name</TableHead>
                                                                <TableHead className="text-[10px] font-bold uppercase">Spec</TableHead>
                                                                <TableHead className="text-right text-[10px] font-bold uppercase">Qty</TableHead>
                                                                <TableHead className="text-right text-[10px] font-bold uppercase">Unit Cost</TableHead>
                                                                <TableHead className="w-16"></TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {template.items.length === 0 ? (
                                                                <TableRow>
                                                                    <TableCell colSpan={6} className="text-center py-4 text-xs text-muted-foreground italic">
                                                                        No items in this template. Add items below.
                                                                    </TableCell>
                                                                </TableRow>
                                                            ) : (
                                                                template.items.map((tItem, idx) => (
                                                                    <TableRow key={tItem.id} className="hover:bg-muted/10">
                                                                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                                                                        <TableCell className="text-xs font-medium">{tItem.material_name}</TableCell>
                                                                        <TableCell className="text-xs text-muted-foreground">{tItem.specification || '-'}</TableCell>
                                                                        <TableCell className="text-right text-xs">{tItem.default_quantity} {tItem.unit}</TableCell>
                                                                        <TableCell className="text-right text-xs font-mono">₹{tItem.default_unit_cost}</TableCell>
                                                                        <TableCell className="flex items-center gap-1 justify-end">
                                                                            <Button
                                                                                variant="ghost" size="icon" className="h-6 w-6"
                                                                                onClick={() => {
                                                                                    if (window.confirm(`Remove "${tItem.material_name}" from template?`)) {
                                                                                        deleteTemplateItem(tItem.id);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <Trash2 className="w-3 h-3 text-rose-500" />
                                                                            </Button>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))
                                                            )}
                                                        </TableBody>
                                                    </Table>

                                                    {/* Add Item to Template Form */}
                                                    <div className="p-3 border-t border-border/30 bg-muted/10">
                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Add Item to Template</p>
                                                        <div className="grid grid-cols-2 md:grid-cols-7 gap-2 items-end">
                                                            <div className="md:col-span-2 space-y-1">
                                                                <Label className="text-[10px] uppercase text-muted-foreground">Name</Label>
                                                                <Input className="h-8 text-sm" placeholder="e.g. Cement" value={addItemForm.material_name} onChange={e => setAddItemForm(p => ({ ...p, material_name: e.target.value }))} />
                                                            </div>
                                                            <div className="md:col-span-1 space-y-1">
                                                                <Label className="text-[10px] uppercase text-muted-foreground">Spec</Label>
                                                                <Input className="h-8 text-sm" placeholder="Brand/Type" value={addItemForm.specification} onChange={e => setAddItemForm(p => ({ ...p, specification: e.target.value }))} />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] uppercase text-muted-foreground">Qty</Label>
                                                                <Input className="h-8 text-sm" type="number" placeholder="0" value={addItemForm.default_quantity} onChange={e => setAddItemForm(p => ({ ...p, default_quantity: e.target.value }))} />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] uppercase text-muted-foreground">Unit</Label>
                                                                <Select value={addItemForm.unit} onValueChange={val => setAddItemForm(p => ({ ...p, unit: val }))}>
                                                                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="units">Units</SelectItem>
                                                                        <SelectItem value="kg">Kg</SelectItem>
                                                                        <SelectItem value="bags">Bags</SelectItem>
                                                                        <SelectItem value="sqft">Sq.ft</SelectItem>
                                                                        <SelectItem value="cum">Cu.m</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] uppercase text-muted-foreground">Cost</Label>
                                                                <Input className="h-8 text-sm" type="number" placeholder="₹" value={addItemForm.default_unit_cost} onChange={e => setAddItemForm(p => ({ ...p, default_unit_cost: e.target.value }))} />
                                                            </div>
                                                            <Button size="sm" className="h-8" onClick={() => handleAddTemplateItem(template.id)} disabled={templateSaving}>
                                                                {templateSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />} Add
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            )}
                                        </Card>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {activeTab !== 'templates' && (
                        <>
                            {/* Add form - hide when approved or awaiting */}
                            {!isAwaitingApproval && !isApproved && (
                                <Card className="border-border/50 bg-card/50">
                                    <CardContent className="p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
                                            <div className="md:col-span-1 space-y-1.5">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Material Name</Label>
                                                <Input className="h-8 text-sm" placeholder="e.g. Cement" value={materialForm.material_name} onChange={(e) => setMaterialForm(prev => ({ ...prev, material_name: e.target.value }))} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Spec</Label>
                                                <Input className="h-8 text-sm" placeholder="Brand/Type" value={materialForm.specification} onChange={(e) => setMaterialForm(prev => ({ ...prev, specification: e.target.value }))} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Phase</Label>
                                                <Select value={materialForm.phase_id} onValueChange={(val) => setMaterialForm(prev => ({ ...prev, phase_id: val }))}>
                                                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Uncategorized" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Uncategorized</SelectItem>
                                                        {phases.map(p => (
                                                            <SelectItem key={p.id} value={p.id}>{p.phase_name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Qty</Label>
                                                <Input className="h-8 text-sm" type="number" placeholder="0.00" value={materialForm.quantity} onChange={(e) => setMaterialForm(prev => ({ ...prev, quantity: e.target.value }))} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Unit</Label>
                                                <Select value={materialForm.unit} onValueChange={(val) => setMaterialForm(prev => ({ ...prev, unit: val }))}>
                                                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="units">Units</SelectItem>
                                                        <SelectItem value="kg">Kg</SelectItem>
                                                        <SelectItem value="bags">Bags</SelectItem>
                                                        <SelectItem value="sqft">Sq.ft</SelectItem>
                                                        <SelectItem value="cum">Cu.m</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Est. Cost</Label>
                                                <Input className="h-8 text-sm" type="number" placeholder="₹" value={materialForm.estimated_unit_cost} onChange={(e) => setMaterialForm(prev => ({ ...prev, estimated_unit_cost: e.target.value }))} />
                                            </div>
                                            <Button size="sm" onClick={handleAddMaterial} disabled={isSaving} className="h-8">
                                                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />} Add
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <Card className="border-border/50">
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30">
                                                <TableHead className="w-10 text-[10px] font-bold uppercase tracking-wider">#</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-wider">Item</TableHead>
                                                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Qty</TableHead>
                                                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Rate</TableHead>
                                                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Total</TableHead>
                                                <TableHead className="w-10"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredItems.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground italic">
                                                        No {activeTab} items added yet.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                <>
                                                    {/* Group by Phases */}
                                                    {[...phases, { id: 'none', phase_name: 'Uncategorized Items' }].map(phase => {
                                                        const phaseItems = filteredItems.filter(item =>
                                                            phase.id === 'none' ? !item.phase_id : item.phase_id === phase.id
                                                        );

                                                        if (phaseItems.length === 0) return null;

                                                        return (
                                                            <Fragment key={phase.id}>
                                                                <TableRow className="bg-muted/10 border-l-2 border-l-primary/50">
                                                                    <TableCell colSpan={6} className="py-2 px-4">
                                                                        <div className="flex items-center gap-2">
                                                                            <Layers className="w-3.5 h-3.5 text-primary" />
                                                                            <span className="text-xs font-bold uppercase tracking-wider text-primary">
                                                                                {phase.phase_name}
                                                                            </span>
                                                                            <Badge variant="outline" className="text-[9px] h-4 bg-primary/5">
                                                                                {phaseItems.length} Items
                                                                            </Badge>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                                {phaseItems.map((item) => (
                                                                    <TableRow key={item.id} className="hover:bg-muted/20 border-l-2 border-l-transparent hover:border-l-primary/30">
                                                                        <TableCell className="text-xs text-muted-foreground">{item.line_number}</TableCell>
                                                                        <TableCell>
                                                                            <p className="text-xs font-semibold">{item.material_name}</p>
                                                                            <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{item.specification || '-'}</p>
                                                                        </TableCell>
                                                                        <TableCell className="text-right text-xs">
                                                                            {item.quantity} <span className="text-[10px] text-muted-foreground">{item.unit}</span>
                                                                        </TableCell>
                                                                        <TableCell className="text-right text-xs font-mono">
                                                                            {item.estimated_unit_cost ? `₹${item.estimated_unit_cost}` : '-'}
                                                                        </TableCell>
                                                                        <TableCell className="text-right text-xs font-bold font-mono">
                                                                            {item.estimated_unit_cost ? `₹${(item.quantity * item.estimated_unit_cost).toLocaleString()}` : '-'}
                                                                        </TableCell>
                                                                        <TableCell className="flex items-center gap-1 justify-end">
                                                                            {!isAwaitingApproval && !isApproved && (
                                                                                <>
                                                                                    <Button
                                                                                        variant="ghost" size="icon" className="h-6 w-6"
                                                                                        onClick={() => { setEditItem2(item); setShowEditModal(true); }}
                                                                                    >
                                                                                        <Pencil className="w-3 h-3 text-primary" />
                                                                                    </Button>
                                                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteItem(item.id)}>
                                                                                        <Trash2 className="w-3 h-3 text-rose-500" />
                                                                                    </Button>
                                                                                </>
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </Fragment>
                                                        );
                                                    })}
                                                </>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </Tabs>
            </div>

            {/* Edit BOQ Item Modal */}
            {showEditModal && editItem2 && (
                <BOQItemUpdateModal open={showEditModal} onOpenChange={setShowEditModal} item={editItem2} phases={phases} onSuccess={refetch} />
            )}

            {/* Create Template Dialog */}
            <Dialog open={createTemplateOpen} onOpenChange={setCreateTemplateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Template</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Template Name</Label>
                            <Input placeholder="e.g. Electrical Works" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Template Code</Label>
                            <Input placeholder="e.g. ELECTRICAL_001" value={newTemplateCode} onChange={(e) => setNewTemplateCode(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateTemplateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateTemplate} disabled={!newTemplateName || !newTemplateCode}>Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Template Dialog */}
            <Dialog open={editTemplateOpen} onOpenChange={setEditTemplateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Template</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Template Name</Label>
                            <Input value={editTemplateName} onChange={(e) => setEditTemplateName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Template Code</Label>
                            <Input value={editTemplateCode} onChange={(e) => setEditTemplateCode(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditTemplateOpen(false)}>Cancel</Button>
                        <Button onClick={handleEditTemplate} disabled={!editTemplateName || templateSaving}>
                            {templateSaving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
