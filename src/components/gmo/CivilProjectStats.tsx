import { Card, CardContent } from '@/components/ui/card';
import { Building2, IndianRupee, AlertCircle, TrendingUp } from 'lucide-react';
import { GMOProject } from '@/hooks/useGMOData';

interface CivilProjectStatsProps {
    projects: GMOProject[];
}

export function CivilProjectStats({ projects }: CivilProjectStatsProps) {
    const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'in_progress' || p.status === 'execution');
    const totalSpend = projects.reduce((sum, p) => sum + ((p as any).total_paid || p.current_spend || 0), 0);
    // detailed status check could be added here
    const criticalProjects = projects.filter(p => p.status === 'delayed' || p.status === 'on_hold' || p.status === 'rejected');

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-6 relative">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Active Civil Projects</p>
                            <h3 className="text-3xl font-bold mt-2 text-primary">{activeProjects.length}</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Out of {projects.length} total
                            </p>
                        </div>
                        <div className="p-3 bg-primary/10 rounded-xl">
                            <Building2 className="w-5 h-5 text-primary" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-blue-500/20 shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-6 relative">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Expenditure</p>
                            <h3 className="text-3xl font-bold mt-2 text-blue-500">
                                ₹{((totalSpend) / 100000).toFixed(2)}L
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" /> Updated recently
                            </p>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-xl">
                            <IndianRupee className="w-5 h-5 text-blue-500" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-red-500/20 shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-6 relative">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Critical Status</p>
                            <h3 className="text-3xl font-bold mt-2 text-red-500">{criticalProjects.length}</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Requiring attention
                            </p>
                        </div>
                        <div className="p-3 bg-red-500/10 rounded-xl">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
