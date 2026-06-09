import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useWeekOffAssignments } from '@/hooks/useWeekOffAssignments';
import { format, isToday, isFuture, addDays, startOfWeek, endOfWeek } from 'date-fns';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function WeekOffWidget() {
    const { user } = useAuth();
    const { weekOffs, isLoading, isWeekOffDay } = useWeekOffAssignments(user?.id);
    const [isTodayWeekOff, setIsTodayWeekOff] = useState(false);
    const [upcomingWeekOffs, setUpcomingWeekOffs] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;

        const checkToday = async () => {
            const today = new Date().toISOString().split('T')[0];
            const result = await isWeekOffDay(user.id, today);
            setIsTodayWeekOff(result);
        };

        checkToday();

        // Calculate upcoming week offs (next 30 days)
        const today = new Date();
        const endDate = addDays(today, 30);
        const upcoming: any[] = [];

        // Add one-time week offs
        weekOffs
            .filter(wo => wo.assignment_type === 'one_time')
            .forEach(wo => {
                const woDate = new Date(wo.week_off_date);
                if (woDate >= today && woDate <= endDate) {
                    upcoming.push({
                        date: wo.week_off_date,
                        type: 'one_time',
                        reason: wo.reason,
                        dayName: format(woDate, 'EEEE')
                    });
                }
            });

        // Add recurring week offs
        weekOffs
            .filter(wo => wo.assignment_type === 'recurring_weekly')
            .forEach(wo => {
                const recurringDay = wo.recurring_day;
                for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
                    if (d.getDay() === recurringDay) {
                        upcoming.push({
                            date: format(d, 'yyyy-MM-dd'),
                            type: 'recurring',
                            reason: wo.reason,
                            dayName: DAYS_OF_WEEK[recurringDay]
                        });
                    }
                }
            });

        // Sort by date
        upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setUpcomingWeekOffs(upcoming.slice(0, 5)); // Show next 5 week offs
    }, [user, weekOffs, isWeekOffDay]);

    if (isLoading || !user) return null;

    // Don't show widget if no week offs assigned
    if (weekOffs.length === 0) return null;

    return (
        <div className="space-y-4">
            {/* Today's Week Off Alert */}
            {isTodayWeekOff && (
                <Alert className="bg-purple-500/10 border-purple-500">
                    <Calendar className="h-4 w-4 text-purple-500" />
                    <AlertTitle className="text-purple-700 font-semibold">Today is Your Week Off!</AlertTitle>
                    <AlertDescription className="text-purple-600">
                        You are not required to mark attendance or work today. Enjoy your day off!
                    </AlertDescription>
                </Alert>
            )}

            {/* Week Off Schedule Card */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-purple-500" />
                        Your Week Off Schedule
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {upcomingWeekOffs.length > 0 ? (
                        <div className="space-y-2">
                            {upcomingWeekOffs.map((wo, index) => (
                                <div
                                    key={`${wo.date}-${index}`}
                                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Calendar className="w-4 h-4 text-purple-500" />
                                        <div>
                                            <p className="font-medium text-sm">
                                                {format(new Date(wo.date), 'MMM dd, yyyy')} ({wo.dayName})
                                            </p>
                                            {wo.reason && (
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {wo.reason}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <Badge
                                        variant={wo.type === 'recurring' ? 'default' : 'secondary'}
                                        className="text-xs"
                                    >
                                        {wo.type === 'recurring' ? 'Recurring' : 'One-time'}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-muted-foreground">
                            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No upcoming week offs in the next 30 days</p>
                        </div>
                    )}

                    {/* Recurring Week Offs Summary */}
                    {weekOffs.some(wo => wo.assignment_type === 'recurring_weekly') && (
                        <div className="mt-4 pt-4 border-t">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Recurring Week Offs:</p>
                            <div className="flex flex-wrap gap-2">
                                {weekOffs
                                    .filter(wo => wo.assignment_type === 'recurring_weekly')
                                    .map(wo => (
                                        <Badge key={wo.id} variant="outline" className="text-xs">
                                            Every {DAYS_OF_WEEK[wo.recurring_day || 0]}
                                        </Badge>
                                    ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
