import { useState, useEffect } from 'react';
import { useShiftBreaks } from '@/hooks/useShiftBreaks';
import { useShiftSession } from '@/hooks/useShiftSession';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coffee, Play, Square, Clock, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ShiftBreakPage() {
    const { currentSession } = useShiftSession();
    const { isOnBreak, breaks, activeBreak, startBreak, endBreak, totalBreakMinutes } = useShiftBreaks(currentSession?.id);
    const [timer, setTimer] = useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isOnBreak && activeBreak) {
            interval = setInterval(() => {
                const start = new Date(activeBreak.breakStart).getTime();
                const now = new Date().getTime();
                setTimer(Math.floor((now - start) / 1000));
            }, 1000);
        } else {
            setTimer(0);
        }
        return () => clearInterval(interval);
    }, [isOnBreak, activeBreak]);

    const formatTimer = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartBreak = async () => {
        try {
            await startBreak();
            // toast handled in hook
        } catch (err) {
            // error handled in hook
        }
    };

    const handleEndBreak = async () => {
        try {
            await endBreak();
            // toast handled in hook
        } catch (err) {
            // error handled in hook
        }
    };

    if (!currentSession) return <div className="p-8 text-center text-muted-foreground">Shift not started</div>;

    return (
        <div className="max-w-md mx-auto space-y-6 text-center">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">Break Control</h1>
                <p className="text-slate-400">Manage your rest periods</p>
            </div>

            <Card className={`border-2 shadow-2xl transition-all duration-300 backdrop-blur-xl ${isOnBreak ? 'border-orange-500/50 bg-slate-900/60' : 'border-slate-800 bg-slate-900/40'}`}>
                <CardContent className="pt-8 space-y-8">
                    <div className={`mx-auto rounded-full w-32 h-32 flex items-center justify-center transition-all duration-500 ${isOnBreak ? 'bg-orange-500/20 shadow-[0_0_40px_rgba(249,115,22,0.2)] border border-orange-500/30' : 'bg-slate-950/50 border border-slate-800'}`}>
                        <Coffee className={`w-14 h-14 ${isOnBreak ? 'text-orange-400 animate-[pulse_3s_ease-in-out_infinite]' : 'text-slate-600'}`} />
                    </div>

                    <div className="space-y-3">
                        <div className={`text-6xl font-mono font-bold tracking-wider tabular-nums ${isOnBreak ? 'text-orange-400' : 'text-slate-300'}`}>
                            {isOnBreak ? formatTimer(timer) : '00:00'}
                        </div>
                        <Badge variant={isOnBreak ? 'destructive' : 'secondary'} className={`px-4 py-1 text-sm font-semibold tracking-wide ${isOnBreak ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                            {isOnBreak ? 'ON BREAK' : 'WORKING'}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-4 pt-2">
                        {isOnBreak ? (
                            <Button size="lg" variant="destructive" className="w-full text-lg h-14 shadow-lg shadow-red-900/20 transition-all active:scale-[0.98]" onClick={handleEndBreak}>
                                <Square className="w-5 h-5 mr-3 fill-current" />
                                End Break
                            </Button>
                        ) : (
                            <Button size="lg" className="w-full text-lg h-14 bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-900/20 transition-all active:scale-[0.98]" onClick={handleStartBreak}>
                                <Play className="w-5 h-5 mr-3 fill-current" />
                                Start Break
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4 text-left pt-4">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 px-1">
                    <HistoryIcon className="w-4 h-4" /> Today's Breaks
                </h3>

                <div className="bg-slate-900/40 border border-slate-800 backdrop-blur-sm rounded-xl divide-y divide-slate-800 overflow-hidden">
                    {breaks.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-500 italic">No breaks taken today</div>
                    ) : (
                        breaks.map((b) => (
                            <div key={b.id} className="p-4 flex justify-between items-center text-sm hover:bg-slate-800/20 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 bg-slate-800 rounded-md text-slate-400">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                    <span className="text-slate-200">
                                        {format(new Date(b.breakStart), 'h:mm a')}
                                        {b.breakEnd && ` - ${format(new Date(b.breakEnd), 'h:mm a')}`}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="border-slate-700 text-slate-400 bg-slate-800/50">{b.durationMinutes}m</Badge>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex justify-between text-sm font-medium px-2 py-1">
                    <span className="text-slate-400">Total Break Time:</span>
                    <span className="text-orange-400">{Math.round(totalBreakMinutes)} mins</span>
                </div>
            </div>
        </div>
    );
}

function HistoryIcon({ className }: { className?: string }) {
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
            <path d="M3 3v5h5" />
            <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
            <path d="M12 7v5l4 2" />
        </svg>
    );
}
