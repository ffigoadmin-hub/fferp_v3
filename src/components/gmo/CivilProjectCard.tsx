import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { GMOProject } from '@/hooks/useGMOData';
import { format, differenceInDays } from 'date-fns';
import { MapPin, Calendar, IndianRupee, Eye, Users, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CivilProjectCardProps {
    project: GMOProject;
    onAssignEngineer: (project: GMOProject) => void;
    onAssignManager: (project: GMOProject) => void;
}

export function CivilProjectCard({ project, onAssignEngineer, onAssignManager }: CivilProjectCardProps) {
    const startDate = new Date(project.target_start_date || new Date());
    const endDate = new Date(project.target_completion_date);
    const today = new Date();

    const totalDays = differenceInDays(endDate, startDate);
    const daysElapsed = differenceInDays(today, startDate);
    const progress = Math.min(Math.max((daysElapsed / (totalDays || 1)) * 100, 0), 100);

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'active': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'completed': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'delayed': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
        }
    };

    return (
        <div className="group relative bg-card hover:bg-muted/30 border rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/20">

            {/* Header Band */}
            <div className="h-1 w-full bg-gradient-to-r from-primary/50 via-blue-500/50 to-primary/50" />

            <div className="p-5 space-y-4">
                {/* Top Row */}
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg tracking-tight group-hover:text-primary transition-colors">
                                {project.project_name}
                            </h3>
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 uppercase tracking-wider opacity-70">
                                {project.project_id}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5 text-primary/70" />
                            <span>{project.location_city}, {project.location_state}</span>
                        </div>
                    </div>
                    <Badge className={`capitalize ${getStatusColor(project.status)}`}>
                        {project.status.replace('_', ' ')}
                    </Badge>
                </div>

                {/* Timeline & Progress */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Start: {format(startDate, 'dd MMM')}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Target: {format(endDate, 'dd MMM yyyy')}
                        </span>
                    </div>
                    <Progress value={progress} className="h-1.5 bg-muted" />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{Math.round(progress)}% Timeline Elapsed</span>
                        {daysElapsed > totalDays && <span className="text-red-500 font-medium">Overdue</span>}
                    </div>
                </div>

                {/* Financials */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <IndianRupee className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total Paid</p>
                            <p className="font-bold font-mono">₹{(((project as any).total_paid || project.current_spend || 0) / 100000).toFixed(2)}L</p>
                        </div>
                    </div>
                    {(project as any).pending_payments > 0 && (
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Pending</p>
                            <p className="text-xs font-bold text-amber-600">₹{((project as any).pending_payments / 1000).toFixed(0)}K</p>
                        </div>
                    )}
                </div>

                {/* Actions - Animated on Group Hover */}
                <div className="pt-2 grid grid-cols-2 gap-2">
                    <Link to={`/projects/execution/${project.id}`} className="col-span-2">
                        <Button className="w-full bg-primary/10 hover:bg-primary/20 text-primary border-0" variant="outline">
                            <Eye className="w-4 h-4 mr-2" />
                            Project Cockpit
                        </Button>
                    </Link>

                    <Button size="sm" variant="ghost" className="text-xs border border-border/50" onClick={() => onAssignEngineer(project)}>
                        <Users className="w-3 h-3 mr-1.5" />
                        {project.assigned_engineer_id ? 'Reassign' : 'Assign'} Eng.
                    </Button>

                    <Button size="sm" variant="ghost" className="text-xs border border-border/50" onClick={() => onAssignManager(project)}>
                        <Users className="w-3 h-3 mr-1.5" />
                        {project.assigned_manager_id ? 'Reassign' : 'Assign'} Mgr.
                    </Button>
                </div>
            </div>
        </div>
    );
}
