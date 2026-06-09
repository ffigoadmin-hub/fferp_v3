import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertCircle, CheckCircle2, Hourglass } from 'lucide-react';

interface SLAPulseBadgeProps {
    deadline: string;
    status: string;
    createdAt?: string;
    resolvedAt?: string;
    acknowledgedAt?: string; // NEW: Track acknowledgment for timer display
    className?: string;
}

export function SLAPulseBadge({ deadline, status, createdAt, resolvedAt, acknowledgedAt, className }: SLAPulseBadgeProps) {
    const [timerText, setTimerText] = useState('--:--');
    const [timerMode, setTimerMode] = useState<'green' | 'yellow' | 'red' | 'breached' | 'resolved' | 'pending'>('green');

    useEffect(() => {
        if (!deadline || isNaN(new Date(deadline).getTime())) {
            setTimerText('--:--');
            setTimerMode('green');
            return;
        }

        const updateTimer = () => {
            const now = Date.now();
            const deadlineMs = new Date(deadline).getTime();
            const diff = deadlineMs - now;
            const normalizedStatus = status?.toLowerCase() || 'open';

            // Check for resolved/closed states - show time taken
            if (['resolved', 'pending_closure_approval', 'proof_submitted', 'waiting_audit', 'closed'].includes(normalizedStatus)) {
                if (createdAt && (resolvedAt || deadline)) {
                    const start = new Date(createdAt).getTime();
                    const end = new Date(resolvedAt || Date.now()).getTime();
                    const elapsed = end - start;
                    const totalMins = Math.floor(elapsed / 60000);
                    const h = Math.floor(totalMins / 60);
                    const m = totalMins % 60;
                    setTimerText(`TAKEN: ${h > 0 ? `${h}h ${m}m` : `${m}m`}`);
                } else {
                    setTimerText('PROOF SUBMITTED');
                }
                setTimerMode('resolved');
                return;
            }

            // For open/unacknowledged tickets - show "Awaiting ACK" instead of breached timer
            if (normalizedStatus === 'open' && !acknowledgedAt) {
                // Show countdown to ACK deadline if available, otherwise show waiting message
                if (diff <= 0) {
                    const negativeMins = Math.abs(Math.floor(diff / 60000));
                    if (negativeMins >= 60) {
                        const hours = Math.floor(negativeMins / 60);
                        const mins = negativeMins % 60;
                        setTimerText(`ACK: -${hours}h ${mins}m`);
                    } else {
                        setTimerText(`ACK: -${negativeMins}m`);
                    }
                    setTimerMode('red');
                } else {
                    const totalMinutes = Math.floor(diff / 60000);
                    const hours = Math.floor(totalMinutes / 60);
                    const mins = totalMinutes % 60;
                    const secs = Math.floor((diff % 60000) / 1000);
                    
                    if (hours > 0) {
                        setTimerText(`ACK: ${hours}h ${mins}m`);
                    } else {
                        setTimerText(`ACK: ${mins}:${secs.toString().padStart(2, '0')}`);
                    }
                    
                    if (totalMinutes < 5) setTimerMode('red');
                    else if (totalMinutes < 15) setTimerMode('yellow');
                    else setTimerMode('pending');
                }
                return;
            }

            // For acknowledged tickets - show resolution deadline countdown
            if (diff <= 0) {
                const negativeMins = Math.abs(Math.floor(diff / 60000));
                if (negativeMins >= 60) {
                    const hours = Math.floor(negativeMins / 60);
                    const mins = negativeMins % 60;
                    setTimerText(`-${hours}h ${mins}m`);
                } else {
                    setTimerText(`-${negativeMins}m`);
                }
                setTimerMode('breached');
                return;
            }

            const totalMinutes = Math.floor(diff / 60000);
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            const secs = Math.floor((diff % 60000) / 1000);

            if (hours > 0) {
                setTimerText(`${hours}h ${mins}m`);
            } else {
                setTimerText(`${mins}:${secs.toString().padStart(2, '0')}`);
            }

            if (totalMinutes < 15) setTimerMode('red');
            else if (totalMinutes < 60) setTimerMode('yellow');
            else setTimerMode('green');
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [deadline, status, acknowledgedAt, createdAt, resolvedAt]);

    const variants = {
        green: "sla-pulse-green border-status-live/30",
        yellow: "sla-pulse-yellow border-status-late/40",
        red: "sla-pulse-red border-destructive/50 animate-sla-heartbeat",
        breached: "bg-destructive/20 text-destructive border-destructive/60 animate-pulse-glow",
        resolved: "text-status-live border-status-live/40 bg-status-live/5",
        pending: "bg-blue-500/10 text-blue-400 border-blue-500/30"
    };

    return (
        <div className={cn(
            "inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-mono font-bold transition-all duration-300",
            variants[timerMode],
            className
        )}>
            {timerMode === 'resolved' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
            ) : timerMode === 'breached' ? (
                <AlertCircle className="w-3.5 h-3.5" />
            ) : timerMode === 'pending' ? (
                <Hourglass className="w-3.5 h-3.5" />
            ) : (
                <Clock className="w-3.5 h-3.5" />
            )}
            <span>{timerText}</span>
        </div>
    );
}
