import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, Timer, Coffee, LogOut, CheckCircle2, AlertTriangle, ArrowRight, Play, Banknote, MapPin } from 'lucide-react';
import { useShiftSession } from '@/hooks/useShiftSession';
import { useShiftBreaks } from '@/hooks/useShiftBreaks';
import { useShiftHourlySlots } from '@/hooks/useShiftHourlySlots';
import { useAllSiteVisitRequests } from '@/hooks/useSiteVisitRequests';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function ShiftDashboardPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { currentSession, todayStats, isLoading: sessionLoading } = useShiftSession();
    const { isOnBreak, totalBreakMinutes } = useShiftBreaks(currentSession?.id);
    const { currentSlot, completedSlots, needsNewSlot } = useShiftHourlySlots(currentSession?.id);
    
    // Fetch assigned, in-progress, and recently halted missions for the FM
    const { data: allRequests, isLoading: requestsLoading } = useAllSiteVisitRequests(['assigned', 'visit_in_progress', 'returned_to_rsh']);

    const activeAssignments = allRequests?.map(r => {
        const myAssignment = r.site_visit_assignments?.find((a: any) => a.assigned_person_user_id === user?.id);
        return myAssignment ? { ...r, assignment_id: myAssignment.id } : null;
    }).filter(Boolean) as any[] || [];

    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Realtime Auto-Switch for Site Visit Activation & Halt State
    useEffect(() => {
        if (!user || requestsLoading) return;
        
        // 1. Initial Check on load
        const activeMission = activeAssignments.find(a => a.status === 'visit_in_progress');
        if (activeMission && activeMission.assignment_id) {
            navigate(`/site-visit-daily-report/${activeMission.assignment_id}`);
            return;
        }

        const channel = (supabase as any)
            .channel('site_visit_updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'site_visit_requests'
                },
                async (payload: any) => {
                    // Quick check if this update concerns the current user
                    const { data: assignment } = await (supabase as any)
                        .from('site_visit_assignments')
                        .select('id')
                        .eq('request_id', payload.new.id)
                        .eq('assigned_person_user_id', user.id)
                        .maybeSingle();
                    
                    if (assignment) {
                        if (payload.new.status === 'visit_in_progress') {
                            toast.success("FIELD MISSION ACTIVATED", {
                                description: `SMO has triggered deployment. Redirecting...`,
                                duration: 4000
                            });
                            setTimeout(() => {
                                navigate(`/site-visit-daily-report/${assignment.id}`);
                            }, 1500);
                        } 
                        else if (payload.new.status === 'returned_to_rsh' || payload.new.status === 'on_hold') {
                            toast.warning("MISSION HALTED", {
                                description: `Deployment stopped and returned for review.`,
                                duration: 6000
                            });
                            queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            (supabase as any).removeChannel(channel);
        };
    }, [user, navigate, requestsLoading, activeAssignments, queryClient]);

    if (sessionLoading) {
        return (
            <div className="space-y-4 max-w-4xl mx-auto py-8">
                <Skeleton className="h-48 w-full" />
                <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        );
    }

    // Handle session not started or completed
    if (!currentSession || currentSession.status !== 'active') {
        if (currentSession?.status === 'completed') {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
                    <div className="p-4 bg-green-100 rounded-full">
                        <CheckCircle2 className="w-12 h-12 text-green-600" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight">Shift Completed</h1>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            You have completed your shift for today. Good work officer!
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => navigate('/shift/history')} className="gap-2">
                        View History <ArrowRight className="w-4 h-4" />
                    </Button>
                </div>
            );
        }

        return (
            <div className="max-w-4xl mx-auto space-y-8 py-8 animate-in fade-in duration-500">
                {/* Mission Alert visible even if shift not started */}
                {activeAssignments.length > 0 && (
                    <div className="relative overflow-hidden group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-primary to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 animate-pulse" />
                        <Card className="relative bg-[#020817]/90 border-primary/20 shadow-2xl">
                             <CardContent className="p-6">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-5 text-left">
                                        <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                                            <MapPin className="h-7 w-7 text-primary animate-bounce-slow" />
                                        </div>
                                        <div>
                                            <Badge className={cn(
                                                "border-primary/20 text-[10px] uppercase font-bold tracking-widest px-2 py-0 mb-1",
                                                activeAssignments[0].status === 'returned_to_rsh' ? "bg-red-500 text-white" : "bg-primary text-white"
                                            )}>
                                                {activeAssignments[0].status === 'returned_to_rsh' ? 'Halted Mission' : 'Assigned Field Mission'}
                                            </Badge>
                                            <h2 className="text-xl font-bold text-white tracking-tight">
                                                {activeAssignments[0].location_title}
                                            </h2>
                                            <p className="text-sm text-muted-foreground line-clamp-1 italic">
                                                {activeAssignments[0].status === 'returned_to_rsh' ? "Returned to SMO for Review" : "Mission pending shift start."}
                                            </p>
                                        </div>
                                    </div>
                                    <Button 
                                        className={cn(
                                            "w-full md:w-auto gap-2 px-6 h-11 uppercase font-bold tracking-widest text-xs",
                                            activeAssignments[0].status === 'returned_to_rsh' ? "bg-red-900/50 hover:bg-red-800" : "bg-primary hover:bg-primary/90"
                                        )}
                                        onClick={() => navigate(`/site-visit-daily-report/${activeAssignments[0].assignment_id}`)}
                                        disabled={activeAssignments[0].status === 'returned_to_rsh'}
                                    >
                                        {activeAssignments[0].status === 'returned_to_rsh' ? (
                                            'Mission Stopped'
                                        ) : (
                                            <><Play className="h-4 w-4 fill-current" /> Activate Mission & Shift</>
                                        )}
                                    </Button>
                                </div>
                             </CardContent>
                        </Card>
                    </div>
                )}

                <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-6">
                    <div className="p-4 bg-primary/10 rounded-full">
                        <Clock className="w-12 h-12 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-white">Shift Not Started</h1>
                        <p className="text-zinc-500 max-w-md mx-auto leading-relaxed">
                            Log in with a selfie to begin tracking your work hours and mission timing.
                        </p>
                    </div>
                    <Button size="lg" onClick={() => navigate('/shift/login')} className="gap-2 h-12 px-8 uppercase tracking-widest text-xs font-bold">
                        <Play className="w-4 h-4" /> Start Standard Shift
                    </Button>
                </div>
            </div>
        );
    }

    // Status mapping for standard labels
    const hoursDisplay = todayStats?.hoursWorked ? todayStats.hoursWorked.toFixed(1) : '0.0';

    return (
        <div className="space-y-6 max-w-4xl mx-auto py-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Shift Dashboard</h1>
                    <p className="text-sm text-zinc-500 font-medium">
                        {format(time, 'EEEE, MMMM do, yyyy')} • {format(time, 'h:mm:ss a')}
                    </p>
                </div>
                {isOnBreak ? (
                    <Badge variant="destructive" className="text-xs py-1 px-4 animate-pulse font-bold tracking-widest">ON BREAK</Badge>
                ) : (
                    <Badge variant="outline" className="text-xs py-1 px-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold tracking-widest uppercase">ACTIVE</Badge>
                )}
            </div>
            
            {activeAssignments.length > 0 && (
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/50 to-indigo-600/50 rounded-xl blur-md opacity-25 group-hover:opacity-40 transition" />
                    <Card className="relative bg-zinc-950/80 border-zinc-800/50 shadow-xl overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                        <CardContent className="p-6">
                            <div className="space-y-4">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-5">
                                        <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                                            <MapPin className="h-7 w-7 text-primary animate-bounce-slow" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Badge className={cn(
                                                    "text-[10px] font-black uppercase tracking-widest py-0",
                                                    activeAssignments[0].status === 'returned_to_rsh' ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-primary/20 text-primary border-primary/30"
                                                )}>
                                                    {activeAssignments[0].status === 'returned_to_rsh' ? 'Halted' : 'Active Field Mission'}
                                                </Badge>
                                            </div>
                                            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                                {activeAssignments[0].location_title}
                                                {activeAssignments[0].status === 'returned_to_rsh' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                                            </h2>
                                            <p className="text-sm text-zinc-500 line-clamp-1 mt-0.5">
                                                {activeAssignments[0].assignment_instructions || "Mission in progress..."}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto">
                                        <Button 
                                            variant="outline" 
                                            className="flex-1 md:flex-none border-zinc-800 hover:bg-zinc-900 text-xs font-bold uppercase tracking-wider"
                                            onClick={() => navigate(`/site-visit-requests/${activeAssignments[0].id}`)}
                                        >
                                            Details
                                        </Button>
                                        <Button 
                                            className={cn(
                                                "flex-1 md:w-48 h-11 uppercase font-black tracking-widest text-[10px] transition-all",
                                                activeAssignments[0].status === 'returned_to_rsh' ? "bg-red-950/50 text-red-500 cursor-not-allowed" : "bg-primary hover:bg-primary/90"
                                            )}
                                            onClick={() => navigate(`/site-visit-daily-report/${activeAssignments[0].assignment_id}`)}
                                            disabled={activeAssignments[0].status === 'returned_to_rsh'}
                                        >
                                            {activeAssignments[0].status === 'returned_to_rsh' ? 'Stopped' : 'Start Mission'}
                                        </Button>
                                    </div>
                                </div>
                                {activeAssignments[0].status === 'returned_to_rsh' && (
                                    <div className="bg-red-950/20 border border-red-900/30 p-3 rounded-lg flex gap-3 items-start animate-in scale-95 duration-200">
                                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-red-200/80 leading-relaxed">
                                            <span className="text-white font-bold uppercase mr-1">Returned:</span> This mission has been halted and sent back for review. No further entries permitted.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Card className="bg-zinc-950/50 border-zinc-800/50">
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex flex-col items-center justify-center p-6 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Net Work Time</span>
                            <div className="text-4xl font-bold tracking-tighter text-primary">
                                {hoursDisplay} <span className="text-lg text-zinc-600 font-normal">/ {currentSession?.targetHours}h</span>
                            </div>
                            <Progress value={todayStats?.progressPercent || 0} className="h-1.5 w-full mt-4 bg-zinc-800" />
                        </div>

                        <div className="col-span-2 space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                    <Timer className="w-4 h-4 text-primary" /> Current Slot
                                </h3>
                                {needsNewSlot && <Badge variant="destructive" className="animate-pulse">Next Plan Due</Badge>}
                            </div>
                            <div className="p-5 bg-zinc-900/30 border border-zinc-800/50 rounded-xl">
                                {currentSlot ? (
                                    <div className="space-y-2">
                                        <div className="text-xs font-bold text-zinc-600 mb-1">
                                            {format(new Date(currentSlot.slotStart), 'h:mm a')} - ACTIVE
                                        </div>
                                        <p className="font-semibold text-lg text-white leading-relaxed">
                                            {currentSlot.plan || "Awaiting task update..."}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-zinc-600 text-sm italic">No active task slot. Update your report to begin.</p>
                                )}
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={() => navigate('/shift/hourly')} className="h-10 px-6 uppercase text-[10px] font-black tracking-[0.2em] gap-2">
                                    {needsNewSlot ? 'Submit Next Slot' : 'Update Activity'} <ArrowRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className={`grid grid-cols-2 ${user?.role === 'director' ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4`}>
                <Card className="bg-zinc-900/40 border-zinc-800/50 hover:bg-zinc-800/40 transition cursor-pointer" onClick={() => navigate('/shift/hourly')}>
                    <CardHeader className="p-4 pb-0"><Timer className="w-5 h-5 text-blue-500 mb-2" /></CardHeader>
                    <CardContent className="p-4 pt-1">
                        <div className="text-2xl font-bold text-white">{completedSlots}</div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Slots Done</p>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/40 border-zinc-800/50 hover:bg-zinc-800/40 transition cursor-pointer" onClick={() => navigate('/shift/break')}>
                    <CardHeader className="p-4 pb-0"><Coffee className="w-5 h-5 text-orange-500 mb-2" /></CardHeader>
                    <CardContent className="p-4 pt-1">
                        <div className="text-2xl font-bold text-white">{Math.round(totalBreakMinutes)}m</div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Break Time</p>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/40 border-zinc-800/50 hover:bg-zinc-800/40 transition cursor-pointer" onClick={() => navigate('/shift/logout')}>
                    <CardHeader className="p-4 pb-0"><LogOut className="w-5 h-5 text-red-500 mb-2" /></CardHeader>
                    <CardContent className="p-4 pt-1">
                        <div className="text-sm font-bold text-white uppercase tracking-widest">Logout</div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">End Shift</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
