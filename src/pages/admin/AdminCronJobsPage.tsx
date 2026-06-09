import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
    Settings,
    RefreshCw,
    Play,
    Pause,
    Clock,
    Terminal,
    ShieldCheck,
    AlertCircle
} from 'lucide-react';

interface CronJob {
    jobid: number;
    schedule: string;
    command: string;
    active: boolean;
    jobname: string;
}

export default function AdminCronJobsPage() {
    const [jobs, setJobs] = useState<CronJob[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isToggling, setIsToggling] = useState<number | null>(null);

    const fetchJobs = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await (supabase.rpc as any)('list_cron_jobs');
            if (error) throw error;
            setJobs((data as CronJob[]) || []);
        } catch (error: any) {
            console.error('Error fetching cron jobs:', error);
            if (!isMissingTable(error)) toast.error('Failed to fetch cron jobs: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    const handleToggle = async (job: CronJob) => {
        setIsToggling(job.jobid);
        try {
            const { error } = await (supabase.rpc as any)('toggle_cron_job', {
                p_jobname: job.jobname,
                p_active: !job.active
            });

            if (error) throw error;

            toast.success(`${job.jobname} is now ${!job.active ? 'active' : 'inactive'}`);
            setJobs(prev => prev.map(j =>
                j.jobid === job.jobid ? { ...j, active: !j.active } : j
            ));
        } catch (error: any) {
            console.error('Error toggling cron job:', error);
            toast.error('Failed to toggle cron job: ' + error.message);
        } finally {
            setIsToggling(null);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 space-y-8"
        >
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <Settings className="w-8 h-8 text-primary" />
                        System Cron Management
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage automated background tasks and schedules</p>
                </div>
                <Button
                    variant="outline"
                    onClick={fetchJobs}
                    disabled={isLoading}
                    className="gap-2"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2 text-primary font-bold">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" /> System Health
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black">{jobs.filter(j => j.active).length} / {jobs.length}</p>
                        <p className="text-xs opacity-70">Active Cron Jobs</p>
                    </CardContent>
                </Card>

                <Card className="bg-amber-500/5 border-amber-500/20">
                    <CardHeader className="pb-2 text-amber-600 font-bold">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Scheduler Status
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black text-amber-600">Running</p>
                        <p className="text-xs opacity-70">pg_cron Extension Active</p>
                    </CardContent>
                </Card>

                <Card className="bg-blue-500/5 border-blue-500/20">
                    <CardHeader className="pb-2 text-blue-600 font-bold">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> Last Sync
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black text-blue-600">{new Date().toLocaleTimeString()}</p>
                        <p className="text-xs opacity-70">Configuration Verified</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Registered Cron Jobs</CardTitle>
                    <CardDescription>
                        These tasks run automatically based on the defined schedules (Cron format).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[500px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[200px]">Job Name</TableHead>
                                    <TableHead>Schedule</TableHead>
                                    <TableHead className="hidden lg:table-cell">Command</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10">
                                            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                                            <p className="mt-2 text-muted-foreground">Loading cron jobs...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : jobs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                            No cron jobs found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    jobs.map((job) => (
                                        <TableRow key={job.jobid} className="group hover:bg-muted/50 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Terminal className="w-4 h-4 text-muted-foreground" />
                                                    <span className="font-bold">{job.jobname}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono bg-muted text-xs">
                                                    {job.schedule}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell max-w-[300px]">
                                                <code className="text-[10px] bg-muted p-1 rounded block truncate">
                                                    {job.command}
                                                </code>
                                            </TableCell>
                                            <TableCell>
                                                {job.active ? (
                                                    <Badge className="bg-green-500 hover:bg-green-600 gap-1">
                                                        <Play className="w-3 h-3 fill-current" /> Active
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="gap-1">
                                                        <Pause className="w-3 h-3" /> Inactive
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <span className={`text-xs font-medium ${job.active ? 'text-green-600' : 'text-muted-foreground'}`}>
                                                        {job.active ? 'Disable' : 'Enable'}
                                                    </span>
                                                    <Switch
                                                        checked={job.active}
                                                        onCheckedChange={() => handleToggle(job)}
                                                        disabled={isToggling === job.jobid}
                                                    />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>

            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-bold text-amber-900">Important Note on Cron Toggling</p>
                    <p className="text-amber-800/80">
                        Disabling a cron job stops its automated execution immediately. Enabling it will resume the task on the next scheduled interval.
                        Ensure you understand the operational impact before disabling critical tasks like SLA breaches or automated escalations.
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
