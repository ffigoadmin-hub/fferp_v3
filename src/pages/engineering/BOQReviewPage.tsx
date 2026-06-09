import { useState, useEffect, useMemo, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle2, ArrowRight, Printer, AlertCircle, Loader2, Clock, Shield, Eye, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useBOQ } from '@/hooks/useBOQ';
import { useProjectLifecycle } from '@/hooks/useProjectLifecycle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useProjectPhases } from '@/hooks/useProjectPhases';

export default function BOQReviewPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const { project, isLoading: projectLoading, refetch: refetchProject } = useProjectLifecycle(projectId);
    const { items, submitBOQ, totalEstimated, isSaving } = useBOQ(projectId || '');
    const { phases, isLoading: phasesLoading } = useProjectPhases(projectId || '');

    // Real-time subscription for project status changes
    useEffect(() => {
        if (!projectId) return;
        const channel = supabase
            .channel(`boq-review-${projectId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, () => {
                refetchProject();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [projectId, refetchProject]);

    const materials = items.filter(i => i.category === 'material');
    const labour = items.filter(i => i.category === 'labour');
    const materialTotal = materials.reduce((sum, i) => sum + (i.quantity * (i.estimated_unit_cost || 0)), 0);
    const labourTotal = labour.reduce((sum, i) => sum + (i.quantity * (i.estimated_unit_cost || 0)), 0);

    const handleSubmit = async () => {
        const result = await submitBOQ();
        if (result.success) {
            toast.success('BOQ submitted successfully to SMO!');
            // Return to projects dashboard after submission
            setTimeout(() => {
                navigate('/employee-projects');
            }, 1500);
        }
    };

    const isAwaitingApproval = project?.lifecycle_stage === 'boq_submitted_smo' || project?.lifecycle_stage === 'boq_submitted_gmo';
    const isApproved = project?.lifecycle_stage === 'boq_approved';
    const isRejected = project?.lifecycle_stage === 'engineering_assigned' && !!project?.boq_rejection_reason;

    // Status steps
    const steps = [
        { id: 'draft', label: 'Engineer Draft', icon: '✏️' },
        { id: 'boq_submitted_smo', label: 'SMO Review', icon: '👤' },
        { id: 'boq_submitted_gmo', label: 'GMO Review', icon: '👥' },
        { id: 'boq_approved', label: 'Approved', icon: '✅' },
    ];

    const currentStepIndex = useMemo(() => {
        if (!project?.lifecycle_stage) return 0;
        if (project.lifecycle_stage === 'boq_submitted_smo') return 1;
        if (project.lifecycle_stage === 'boq_submitted_gmo') return 2;
        if (project.lifecycle_stage === 'boq_approved') return 3;
        return 0;
    }, [project?.lifecycle_stage]);

    // Get the status button config
    const getStatusConfig = () => {
        if (isApproved) {
            return { text: 'BOQ Approved', subtext: 'Approved by GMO', icon: CheckCircle2, color: 'bg-emerald-600', textColor: 'text-emerald-500', borderColor: 'border-emerald-500/30', bgColor: 'bg-emerald-500/5', disabled: true };
        }
        if (project?.lifecycle_stage === 'boq_submitted_gmo') {
            return { text: 'Pending GMO Approval', subtext: 'SMO has approved. Waiting for GMO review.', icon: Clock, color: 'bg-amber-600', textColor: 'text-amber-500', borderColor: 'border-amber-500/30', bgColor: 'bg-amber-500/5', disabled: true };
        }
        if (project?.lifecycle_stage === 'boq_submitted_smo') {
            return { text: 'Pending SMO Approval', subtext: 'BOQ submitted. Waiting for Senior Manager review.', icon: Clock, color: 'bg-amber-600', textColor: 'text-amber-500', borderColor: 'border-amber-500/30', bgColor: 'bg-amber-500/5', disabled: true };
        }
        if (isRejected) {
            return { text: 'Re-submit for Approval', subtext: 'BOQ was rejected. Address the feedback and re-submit.', icon: Send, color: 'bg-rose-600 hover:bg-rose-700', textColor: 'text-rose-500', borderColor: 'border-rose-500/30', bgColor: 'bg-rose-500/5', disabled: false };
        }
        return { text: 'Submit for Approval', subtext: 'This will forward the BOQ to SMO for L1 Approval.', icon: Send, color: 'bg-primary hover:bg-primary/90', textColor: 'text-primary', borderColor: 'border-primary/30', bgColor: 'bg-primary/5', disabled: false };
    };

    const statusConfig = getStatusConfig();
    const StatusIconComponent = statusConfig.icon;

    if (projectLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-100px)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-20 animate-in fade-in duration-500 space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-10 w-10">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">Review & Submit BOQ</h1>
                    <p className="text-sm text-muted-foreground">{project?.project_name}</p>
                </div>
            </div>

            {/* Enhanced Status Stepper */}
            <Card className="border-border/50 overflow-hidden">
                <CardContent className="p-6">
                    <div className="relative flex justify-between w-full">
                        {/* Background track */}
                        <div className="absolute top-5 left-[10%] w-[80%] h-[3px] bg-muted rounded-full" />
                        {/* Active track */}
                        <div
                            className="absolute top-5 left-[10%] h-[3px] bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${Math.min(currentStepIndex / (steps.length - 1), 1) * 80}%` }}
                        />

                        {steps.map((step, index) => {
                            const isCompleted = index < currentStepIndex;
                            const isCurrent = index === currentStepIndex;
                            const isFuture = index > currentStepIndex;

                            return (
                                <div key={step.id} className="flex flex-col items-center gap-2 z-10 relative" style={{ width: `${100 / steps.length}%` }}>
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ring-4 ring-background",
                                        isCompleted
                                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                                            : isCurrent
                                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/40 ring-primary/20 animate-pulse'
                                                : 'bg-muted text-muted-foreground'
                                    )}>
                                        {isCompleted ? (
                                            <CheckCircle2 className="w-5 h-5" />
                                        ) : isCurrent && isAwaitingApproval ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <span>{step.icon}</span>
                                        )}
                                    </div>
                                    <span className={cn(
                                        "text-[11px] font-semibold whitespace-nowrap transition-colors",
                                        isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground/60'
                                    )}>
                                        {step.label}
                                    </span>
                                    {isCurrent && isAwaitingApproval && (
                                        <Badge variant="outline" className="text-[9px] h-5 bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse">
                                            In Progress
                                        </Badge>
                                    )}
                                    {isCompleted && (
                                        <Badge variant="outline" className="text-[9px] h-5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                            Done
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
                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-5 h-5 text-rose-500" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-rose-500">BOQ Rejected</h3>
                            <p className="text-xs text-foreground">
                                <strong>Reason:</strong> {project?.boq_rejection_reason}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                                Please address the feedback and re-submit for review.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Cost Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-border/50">
                    <CardContent className="p-4">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Material Cost</p>
                        <div className="text-2xl font-bold font-mono">₹{materialTotal.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">{materials.length} items</p>
                    </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-4">
                        <p className="text-[10px] uppercase font-bold text-primary tracking-wider mb-1">Grand Total</p>
                        <div className="text-2xl font-bold text-primary font-mono">₹{totalEstimated.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Estimated Budget</p>
                    </CardContent>
                </Card>
            </div>

            {/* Material Summary */}
            <Card className="border-border/50">
                <CardHeader className="py-3 px-5 border-b border-border/30">
                    <CardTitle className="text-sm font-semibold">Material Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/20">
                                <TableHead className="text-[10px] font-bold uppercase">Item</TableHead>
                                <TableHead className="text-right text-[10px] font-bold uppercase">Qty</TableHead>
                                <TableHead className="text-right text-[10px] font-bold uppercase">Est. Cost</TableHead>
                                <TableHead className="text-right text-[10px] font-bold uppercase">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {materials.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground italic">No material items</TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {/* Group by Phases */}
                                    {[...phases, { id: 'none', phase_name: 'Uncategorized Items' }].map(phase => {
                                        const phaseItems = materials.filter(item =>
                                            phase.id === 'none' ? !item.phase_id : item.phase_id === phase.id
                                        );

                                        if (phaseItems.length === 0) return null;

                                        return (
                                            <Fragment key={phase.id}>
                                                <TableRow className="bg-muted/10 border-l-2 border-l-primary/50">
                                                    <TableCell colSpan={4} className="py-2 px-4 shadow-inner">
                                                        <div className="flex items-center gap-2">
                                                            <Layers className="w-3.5 h-3.5 text-primary" />
                                                            <span className="text-xs font-bold uppercase tracking-wider text-primary">
                                                                {phase.phase_name}
                                                            </span>
                                                            <Badge variant="outline" className="text-[9px] h-4 bg-primary/5 border-primary/20">
                                                                {phaseItems.length} Items
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {phaseItems.map((item) => (
                                                    <TableRow key={item.id} className="hover:bg-muted/10 border-l-2 border-l-transparent hover:border-l-primary/30 transition-all">
                                                        <TableCell>
                                                            <div className="text-sm font-medium">{item.material_name}</div>
                                                            <div className="text-[10px] text-muted-foreground">{item.specification}</div>
                                                        </TableCell>
                                                        <TableCell className="text-right text-sm">
                                                            {item.quantity} <span className="text-[10px] text-muted-foreground">{item.unit}</span>
                                                        </TableCell>
                                                        <TableCell className="text-right text-sm font-mono">
                                                            {item.estimated_unit_cost ? `₹${item.estimated_unit_cost}` : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right text-sm font-bold font-mono">
                                                            ₹{(item.quantity * (item.estimated_unit_cost || 0)).toLocaleString()}
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


            {/* Submit / Status Action Bar */}
            <Card className={cn("overflow-hidden", statusConfig.borderColor, statusConfig.bgColor)}>
                <CardContent className="p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", statusConfig.bgColor)}>
                            <StatusIconComponent className={cn("w-5 h-5", statusConfig.textColor, isAwaitingApproval && "animate-spin")} />
                        </div>
                        <div>
                            <p className={cn("text-sm font-bold", statusConfig.textColor)}>{statusConfig.text}</p>
                            <p className="text-xs text-muted-foreground">{statusConfig.subtext}</p>
                        </div>
                    </div>
                    {!statusConfig.disabled ? (
                        <Button
                            size="lg"
                            onClick={handleSubmit}
                            disabled={isSaving}
                            className={cn("px-8 gap-2 shadow-lg", statusConfig.color)}
                        >
                            {isSaving ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                            ) : (
                                <><Send className="w-4 h-4" /> {statusConfig.text}</>
                            )}
                        </Button>
                    ) : (
                        <Badge className={cn(
                            "px-4 py-2 text-sm font-semibold",
                            isApproved ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
                        )}>
                            {isApproved ? '✓ Approved' : '⏳ Awaiting Review'}
                        </Badge>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
