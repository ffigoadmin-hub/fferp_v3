import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Loader2, Calendar } from 'lucide-react';

export default function ShiftHistoryPage() {
    const { user } = useAuth();

    const { data: history, isLoading } = useQuery({
        queryKey: ['shift-history', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await (supabase
                .from('shift_sessions') as any)
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: false });

            if (error) throw error;
            return data as any[];
        },
        enabled: !!user
    });

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Shift History</h1>
                <p className="text-muted-foreground">Your past work sessions</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5" /> Past Sessions
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Start Time</TableHead>
                                <TableHead>End Time</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Breaks</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {history?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                        No shift history found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                history?.map((session) => (
                                    <TableRow key={session.id}>
                                        <TableCell className="font-medium">
                                            {format(new Date(session.date), 'MMM d, yyyy')}
                                        </TableCell>
                                        <TableCell>
                                            {session.start_time ? format(new Date(session.start_time), 'h:mm a') : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {session.end_time ? format(new Date(session.end_time), 'h:mm a') : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {session.net_working_minutes ? (
                                                <span className="font-mono">
                                                    {(session.net_working_minutes / 60).toFixed(1)}h
                                                </span>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {session.break_minutes ? `${session.break_minutes}m` : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={session.status === 'completed' ? 'secondary' : 'default'} className={
                                                session.status === 'active' ? 'bg-green-100 text-green-800' : ''
                                            }>
                                                {session.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
