import { useState, useEffect } from 'react';
import { useShiftHourlySlots } from '@/hooks/useShiftHourlySlots';
import { useShiftSession } from '@/hooks/useShiftSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Loader2, Plus, Save, Clock, CheckCircle2, History } from 'lucide-react';
import { toast } from 'sonner';

export default function ShiftHourlyPage() {
    const { currentSession } = useShiftSession();
    const { slots, currentSlot, submitPlan, submitReport, createNextSlot, isLoading } = useShiftHourlySlots(currentSession?.id);

    const [newPlan, setNewPlan] = useState('');
    const [report, setReport] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showReportForm, setShowReportForm] = useState(false);
    const [showEditPlan, setShowEditPlan] = useState(false);

    // Reset states when slot changes
    useEffect(() => {
        setNewPlan('');
        setReport('');
        setShowReportForm(false);
        setShowEditPlan(false);
    }, [currentSlot?.id]);

    const handleSubmitPlan = async () => {
        if (!newPlan.trim() || !currentSession) return;
        setIsSubmitting(true);
        try {
            let result;
            if (currentSlot && currentSlot.status === 'pending') {
                // Update pending slot with plan
                result = await submitPlan(currentSlot.id, newPlan);
            } else if (!currentSlot) {
                // Create generic next slot
                result = await createNextSlot(newPlan);
            }

            if (result?.success) {
                setNewPlan('');
            }
        } catch (err) {
            // handled
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateActivePlan = async () => {
        if (!newPlan.trim() || !currentSlot) return;
        setIsSubmitting(true);
        try {
            const result = await submitPlan(currentSlot.id, newPlan);
            if (result.success) {
                setShowEditPlan(false);
                setNewPlan('');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCompleteSlot = async () => {
        if (!report.trim() || !currentSlot) return;
        setIsSubmitting(true);
        try {
            const result = await submitReport(currentSlot.id, report);
            if (result.success) {
                setShowReportForm(false);
                setReport('');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!currentSession) return <div className="p-8 text-center text-muted-foreground">No active shift session found.</div>;

    const isPlanActive = currentSlot && currentSlot.status === 'plan_submitted';

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Hourly Plan & Report</h1>
                    <p className="text-muted-foreground">Track your work hour by hour</p>
                </div>
                <div className="text-sm font-medium bg-muted px-3 py-1 rounded-full">
                    Shift: {format(new Date(), 'MMM d')}
                </div>
            </div>

            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">
                            {isPlanActive ? 'Current Activity' : 'Plan Next Hour'}
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isPlanActive ? (
                        <div className="space-y-4">
                            {showEditPlan ? (
                                <div className="space-y-2">
                                    <Input
                                        value={newPlan}
                                        onChange={(e) => setNewPlan(e.target.value)}
                                        placeholder="Update your plan..."
                                        className="bg-background"
                                    />
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={handleUpdateActivePlan} disabled={isSubmitting}>Save Plan</Button>
                                        <Button size="sm" variant="ghost" onClick={() => setShowEditPlan(false)}>Cancel</Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-background border rounded-md relative group">
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                                        {format(new Date(currentSlot.slotStart), 'h:mm a')} - Now
                                    </div>
                                    <p className="font-medium text-lg">{currentSlot.plan}</p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => { setNewPlan(currentSlot.plan || ''); setShowEditPlan(true); }}
                                    >
                                        Edit
                                    </Button>
                                </div>
                            )}

                            {showReportForm ? (
                                <div className="space-y-2 pt-4 border-t border-dashed animate-in fade-in slide-in-from-top-2">
                                    <p className="text-sm font-medium">What did you accomplish?</p>
                                    <Input
                                        value={report}
                                        onChange={(e) => setReport(e.target.value)}
                                        placeholder="Report progress..."
                                        className="bg-background"
                                    />
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={handleCompleteSlot} disabled={isSubmitting}>
                                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                            Submit Report & Close Hour
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setShowReportForm(false)}>Cancel</Button>
                                    </div>
                                </div>
                            ) : (
                                <Button className="w-full" onClick={() => setShowReportForm(true)}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Complete Hour & Add Report
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <Input
                                placeholder="What will you be working on?"
                                value={newPlan}
                                onChange={(e) => setNewPlan(e.target.value)}
                                className="bg-background"
                            />
                            <Button
                                onClick={handleSubmitPlan}
                                disabled={!newPlan.trim() || isSubmitting}
                                className="w-full"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                Start Hour
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <History className="w-5 h-5" /> Timeline
                </h3>

                {slots.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        No slots recorded.
                    </div>
                ) : (
                    <div className="relative border-l-2 border-muted ml-3 space-y-8 pl-6 pb-2">
                        {slots.map((slot) => (
                            <div key={slot.id} className="relative">
                                <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 ${slot.status === 'report_submitted' ? 'bg-green-500 border-green-500' :
                                        slot.status === 'missed' ? 'bg-destructive border-destructive' :
                                            slot.status === 'plan_submitted' ? 'bg-background border-primary' : 'bg-muted border-muted'
                                    }`} />

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span className="font-mono">{format(new Date(slot.slotStart), 'h:mm a')}</span>
                                        {slot.slotEnd && <span>- {format(new Date(slot.slotEnd), 'h:mm a')}</span>}
                                        <Badge variant={slot.status === 'report_submitted' ? 'default' : 'secondary'} className="text-[10px] h-5">
                                            {slot.status === 'report_submitted' ? 'Completed' : slot.status.replace('_', ' ')}
                                        </Badge>
                                    </div>

                                    <div className="bg-card border rounded-md p-3 shadow-sm">
                                        <div className="font-medium text-sm mb-1 text-foreground/90">
                                            <span className="text-primary font-semibold text-xs uppercase mr-2 opacity-70">Plan:</span>
                                            {slot.plan || <span className="text-muted-foreground italic">No plan submitted</span>}
                                        </div>
                                        {slot.report && (
                                            <div className="text-sm text-muted-foreground border-t pt-2 mt-2 border-dashed">
                                                <span className="text-green-600 font-semibold text-xs uppercase mr-2 opacity-70">Done:</span>
                                                {slot.report}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
