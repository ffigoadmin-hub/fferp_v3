import { useState, useEffect } from 'react';
import { useShiftEOD } from '@/hooks/useShiftEOD';
import { useShiftSession } from '@/hooks/useShiftSession';
import { useShiftHourlySlots } from '@/hooks/useShiftHourlySlots';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, CheckCircle2, History } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ShiftEODPage() {
    const { currentSession } = useShiftSession();
    const { eodSummary, loading: eodLoading, submitEOD } = useShiftEOD(currentSession?.id);
    const { slots } = useShiftHourlySlots(currentSession?.id);
    const [summary, setSummary] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (eodSummary) {
            setSummary(eodSummary.summary || '');
        }
    }, [eodSummary]);

    const handleSubmit = async () => {
        if (!summary.trim() || !currentSession) return;
        setSubmitting(true);
        try {
            const result = await submitEOD(summary);
            if (result.success) {
                toast.success('EOD Summary submitted successfully');
            } else {
                toast.error('Failed to submit EOD');
            }
        } catch (err) {
            toast.error('Error submitting EOD');
        } finally {
            setSubmitting(false);
        }
    };

    if (eodLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    if (!currentSession) return <div className="p-8 text-center text-muted-foreground">Shift not active</div>;

    const isSubmitted = !!eodSummary;

    return (
        <div className="max-w-4xl mx-auto space-y-8 pt-4">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-white px-1">End of Day Summary</h1>
                <p className="text-slate-400 text-lg px-1">Review today's work and submit your final report.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Left: Summary Form (3/5) */}
                <div className="lg:col-span-3 space-y-6">
                    <Card className={`border-2 shadow-2xl backdrop-blur-xl transition-all duration-500 overflow-hidden ${isSubmitted ? 'border-green-500/30 bg-slate-900/60' : 'border-primary/20 bg-slate-900/40'}`}>
                        <div className={`p-6 border-b ${isSubmitted ? 'bg-green-500/10 border-green-500/20' : 'bg-primary/5 border-primary/10'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isSubmitted ? 'bg-green-500/20 text-green-400' : 'bg-primary/20 text-primary'}`}>
                                    <FileTextIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <CardTitle className={`text-xl ${isSubmitted ? 'text-green-100' : 'text-white'}`}>Daily Summary</CardTitle>
                                    <p className="text-slate-400 text-sm mt-0.5">Summarize key achievements and blockers.</p>
                                </div>
                            </div>
                        </div>

                        <CardContent className="p-6 space-y-6">
                            <Textarea
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                placeholder="What did you focus on today? Any challenges encountered?"
                                className="min-h-[250px] bg-slate-950/50 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:ring-primary/30 resize-none text-base leading-relaxed"
                                disabled={isSubmitted || submitting}
                            />

                            {isSubmitted ? (
                                <div className="flex items-center justify-center p-4 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl font-bold text-lg animate-in fade-in zoom-in-95 duration-300">
                                    <CheckCircle2 className="w-6 h-6 mr-3" />
                                    Summary Submitted
                                </div>
                            ) : (
                                <Button
                                    onClick={handleSubmit}
                                    disabled={!summary.trim() || submitting}
                                    className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                                >
                                    {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Send className="w-5 h-5 mr-3" />}
                                    Submit Final Report
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Hourly Recap (2/5) */}
                <div className="lg:col-span-2 space-y-5">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                        <History className="w-4 h-4" /> Hourly Recap
                    </h3>

                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-3 custom-scrollbar">
                        {slots.length === 0 ? (
                            <div className="text-sm text-slate-500 italic p-8 bg-slate-900/40 border border-slate-800 border-dashed rounded-xl text-center">
                                No hourly slots recorded today.
                            </div>
                        ) : (
                            slots.map((slot) => (
                                <div key={slot.id} className="group relative bg-slate-900/30 border border-slate-800 backdrop-blur-sm rounded-xl p-4 shadow-sm hover:border-slate-700 transition-all hover:bg-slate-900/50">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <div className="p-1 bg-slate-800 rounded text-[10px] font-mono border border-slate-700">
                                                {format(new Date(slot.slotStart), 'h:mm a')}
                                            </div>
                                        </div>
                                        <Badge variant={slot.status === 'report_submitted' ? 'outline' : 'secondary'} className={`text-[10px] font-bold px-2 py-0 h-5 tracking-tighter ${slot.status === 'report_submitted' ? 'border-green-500/50 text-green-400 bg-green-500/5' : ''
                                            }`}>
                                            {slot.status.toUpperCase()}
                                        </Badge>
                                    </div>
                                    <p className="font-semibold text-slate-200 text-sm mb-2 group-hover:text-white transition-colors">{slot.plan}</p>
                                    {slot.report && (
                                        <div className="text-xs text-green-400/80 bg-green-500/5 border border-green-500/10 rounded-lg p-2 mt-3 flex items-start gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1 flex-shrink-0" />
                                            <span>{slot.report}</span>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function FileTextIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
    );
}
