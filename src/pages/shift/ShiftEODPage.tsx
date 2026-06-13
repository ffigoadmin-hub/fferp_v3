import { useState, useEffect } from 'react';
import { useShiftEOD } from '@/hooks/useShiftEOD';
import { useShiftSession } from '@/hooks/useShiftSession';
import { useShiftHourlySlots } from '@/hooks/useShiftHourlySlots';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, CheckCircle2, History, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ShiftEODPage() {
    const { currentSession } = useShiftSession();
    const { eodSummary, loading: eodLoading, submitEOD } = useShiftEOD(currentSession?.id);
    const { slots } = useShiftHourlySlots(currentSession?.id);
    const [summary, setSummary] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { if (eodSummary) setSummary(eodSummary.summary || ''); }, [eodSummary]);

    const handleSubmit = async () => {
        if (!summary.trim() || !currentSession) return;
        setSubmitting(true);
        try {
            const result = await submitEOD(summary);
            if (result.success) toast.success('EOD Summary submitted successfully');
            else toast.error('Failed to submit EOD');
        } catch { toast.error('Error submitting EOD'); }
        finally { setSubmitting(false); }
    };

    if (eodLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    if (!currentSession) return <div className="p-8 text-center text-muted-foreground">No active shift.</div>;

    const isSubmitted = !!eodSummary;

    return (
        <div className="max-w-4xl mx-auto space-y-6 py-6 px-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">End of Day Summary</h1>
                <p className="text-muted-foreground text-sm">Review today's work and submit your final report.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Summary form */}
                <div className="lg:col-span-3">
                    <Card className={isSubmitted ? 'border-green-200' : ''}>
                        <CardHeader className={`pb-3 rounded-t-xl ${isSubmitted ? 'bg-green-50 border-b border-green-100' : 'bg-muted/30 border-b'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isSubmitted ? 'bg-green-100' : 'bg-primary/10'}`}>
                                    <FileText className={`w-5 h-5 ${isSubmitted ? 'text-green-600' : 'text-primary'}`} />
                                </div>
                                <div>
                                    <CardTitle className="text-base">Daily Summary</CardTitle>
                                    <p className="text-xs text-muted-foreground mt-0.5">Summarize key achievements and blockers.</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <Textarea
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                placeholder="What did you focus on today? Any challenges?"
                                className="min-h-[220px] resize-none text-sm"
                                disabled={isSubmitted || submitting}
                            />
                            {isSubmitted ? (
                                <div className="flex items-center justify-center p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg font-semibold">
                                    <CheckCircle2 className="w-5 h-5 mr-2" /> Summary Submitted
                                </div>
                            ) : (
                                <Button onClick={handleSubmit} disabled={!summary.trim() || submitting} className="w-full h-11">
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                    Submit Final Report
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Hourly recap */}
                <div className="lg:col-span-2 space-y-3">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <History className="w-4 h-4" /> Hourly Recap
                    </h3>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        {slots.length === 0 ? (
                            <div className="p-6 text-center text-sm text-muted-foreground border border-dashed rounded-xl">
                                No hourly slots recorded today.
                            </div>
                        ) : (
                            slots.map((slot) => (
                                <Card key={slot.id} className="shadow-none">
                                    <CardContent className="p-4 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded font-medium">
                                                {format(new Date(slot.slotStart), 'h:mm a')}
                                            </span>
                                            <Badge variant={slot.status === 'report_submitted' ? 'default' : 'secondary'}
                                                className={`text-[10px] font-bold ${slot.status === 'report_submitted' ? 'bg-green-100 text-green-700 border-green-200' : ''}`}>
                                                {slot.status.replace('_', ' ').toUpperCase()}
                                            </Badge>
                                        </div>
                                        <p className="font-semibold text-sm">{slot.plan}</p>
                                        {slot.report && (
                                            <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                                                {slot.report}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
