import { useState, useEffect } from 'react';
import { useShiftBreaks } from '@/hooks/useShiftBreaks';
import { useShiftSession } from '@/hooks/useShiftSession';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coffee, Play, Square, Clock, History } from 'lucide-react';
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
                setTimer(Math.floor((Date.now() - start) / 1000));
            }, 1000);
        } else {
            setTimer(0);
        }
        return () => clearInterval(interval);
    }, [isOnBreak, activeBreak]);

    const formatTimer = (s: number) =>
        `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    return (
        <div className="max-w-md mx-auto space-y-6 py-6 px-4">
            {/* Header */}
            <div className="text-center space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">Break Control</h1>
                <p className="text-muted-foreground text-sm">Manage your rest periods</p>
            </div>

            {/* Timer card */}
            <Card className={isOnBreak ? 'border-orange-300 bg-orange-50' : ''}>
                <CardContent className="pt-8 pb-6 flex flex-col items-center gap-6">
                    {/* Icon */}
                    <div className={`rounded-full w-28 h-28 flex items-center justify-center border-2 transition-all
                        ${isOnBreak ? 'bg-orange-100 border-orange-300' : 'bg-muted border-border'}`}>
                        <Coffee className={`w-12 h-12 ${isOnBreak ? 'text-orange-500' : 'text-muted-foreground'}`} />
                    </div>

                    {/* Timer */}
                    <div className={`text-6xl font-mono font-bold tabular-nums tracking-widest
                        ${isOnBreak ? 'text-orange-500' : 'text-foreground'}`}>
                        {isOnBreak ? formatTimer(timer) : '00:00'}
                    </div>

                    {/* Status badge */}
                    {isOnBreak ? (
                        <Badge className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-1.5 text-sm font-bold tracking-widest">
                            ON BREAK
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="px-5 py-1.5 text-sm font-bold tracking-widest">
                            WORKING
                        </Badge>
                    )}

                    {/* Button */}
                    {isOnBreak ? (
                        <Button size="lg" variant="destructive" className="w-full h-13 text-base" onClick={endBreak}>
                            <Square className="w-5 h-5 mr-2 fill-current" /> End Break
                        </Button>
                    ) : (
                        <Button size="lg" className="w-full h-13 text-base bg-orange-500 hover:bg-orange-600 text-white" onClick={() => startBreak()}>
                            <Play className="w-5 h-5 mr-2 fill-current" /> Start Break
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Today's breaks */}
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <History className="w-4 h-4" /> Today's Breaks
                </h3>

                <Card>
                    <CardContent className="p-0 divide-y">
                        {breaks.length === 0 ? (
                            <p className="p-6 text-center text-sm text-muted-foreground italic">No breaks taken today</p>
                        ) : (
                            breaks.map((b) => (
                                <div key={b.id} className="p-4 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-muted rounded-md">
                                            <Clock className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                        <span className="text-sm font-medium">
                                            {format(new Date(b.breakStart), 'h:mm a')}
                                            {b.breakEnd && ` – ${format(new Date(b.breakEnd), 'h:mm a')}`}
                                        </span>
                                    </div>
                                    <Badge variant="outline">{b.durationMinutes ?? 0}m</Badge>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-between text-sm font-medium px-1">
                    <span className="text-muted-foreground">Total Break Time</span>
                    <span className="font-bold text-orange-500">{Math.round(totalBreakMinutes)} mins</span>
                </div>
            </div>
        </div>
    );
}
