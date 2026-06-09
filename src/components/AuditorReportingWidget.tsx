import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Download,
    FileText,
    Calendar,
    Users,
    Search,
    Filter,
    BarChart3,
    Loader2,
    ShieldCheck,
    TrendingUp,
    Clock,
    MapPin,
    Banknote
} from 'lucide-react';
import { useActivityReport, ActivityReportMember } from '@/hooks/useActivityReport';
import { DEPARTMENTS } from '@/constants/departments';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';

export function AuditorReportingWidget() {
    const { isLoading, fetchMembers, downloadFullActivityReport, downloadLOPMasterReport, downloadLOPAuditReport } = useActivityReport();

    const [members, setMembers] = useState<ActivityReportMember[]>([]);
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [filterType, setFilterType] = useState<'all' | 'department' | 'person'>('all');
    const [filterValue, setFilterValue] = useState<string>('');

    useEffect(() => {
        fetchMembers().then(setMembers).catch(console.error);
    }, [fetchMembers]);

    const handleDownloadActivity = async () => {
        await downloadFullActivityReport(
            new Date(startDate),
            new Date(endDate),
            filterType,
            filterValue
        );
    };

    const handleDownloadLOP = async () => {
        await downloadLOPMasterReport(
            new Date(startDate),
            new Date(endDate)
        );
    };

    const handleDownloadLOPAudit = async () => {
        await downloadLOPAuditReport(
            new Date(startDate),
            new Date(endDate)
        );
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-gradient-to-br from-authority-admin/10 to-transparent border-authority-admin/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-authority-admin flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" /> Compliance Access
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black">Full Oversight</p>
                        <p className="text-xs text-muted-foreground">National Level Intelligence</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                            <Users className="w-4 h-4" /> Team Coverage
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black">{members.length} Members</p>
                        <p className="text-xs text-muted-foreground">All Departments Tracked</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-green-600 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Activity Granularity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black">Hourly Sync</p>
                        <p className="text-xs text-muted-foreground">Detailed Slot Intelligence</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-purple-600 flex items-center gap-2">
                            <MapPin className="w-4 h-4" /> Bio-Tracking
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black">Selfie + GPS</p>
                        <p className="text-xs text-muted-foreground">Location Verified Status</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-2 border-authority-admin/10 shadow-xl overflow-hidden bg-gradient-to-br from-background via-background to-authority-admin/5">
                <div className="h-2 bg-gradient-to-r from-authority-admin via-primary to-authority-admin shadow-[0_0_15px_rgba(var(--authority-admin),0.5)]" />
                <CardHeader className="bg-authority-admin/5 py-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <CardTitle className="text-3xl font-black flex items-center gap-3">
                                <BarChart3 className="w-8 h-8 text-authority-admin" />
                                Strategic Reporting Hub
                            </CardTitle>
                            <CardDescription className="text-base text-muted-foreground mt-2">
                                Generate high-granularity organization intelligence reports
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="px-5 py-3 rounded-2xl bg-authority-admin/10 border border-authority-admin/20 backdrop-blur-md">
                                <span className="text-xs font-bold text-authority-admin uppercase tracking-[0.2em]">Intelligence Standard v5.0</span>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-8 space-y-12">
                    {/* Real-time Pulse Section */}
                    {/* Real-time Pulse Section Removed */}

                    {/* Filters Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end p-8 rounded-[2.5rem] bg-muted/30 border border-border/50 shadow-inner">
                        <div className="space-y-3">
                            <Label className="text-sm font-bold flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-authority-admin" /> Start Date
                            </Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="rounded-xl border-border/50 bg-background focus:ring-authority-admin/20 h-12"
                            />
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm font-bold flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-authority-admin" /> End Date
                            </Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="rounded-xl border-border/50 bg-background focus:ring-authority-admin/20 h-12"
                            />
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm font-bold flex items-center gap-2">
                                <Filter className="w-4 h-4 text-authority-admin" /> Report Scope
                            </Label>
                            <Select value={filterType} onValueChange={(v: any) => { setFilterType(v); setFilterValue(''); }}>
                                <SelectTrigger className="rounded-xl border-border/50 bg-background h-12">
                                    <SelectValue placeholder="Select scope" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all">Entire Organization</SelectItem>
                                    <SelectItem value="department">Department Wise</SelectItem>
                                    <SelectItem value="person">Specific Employee</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm font-bold flex items-center gap-2">
                                <Search className="w-4 h-4 text-authority-admin" /> {filterType === 'all' ? 'Target' : filterType === 'department' ? 'Select Department' : 'Select Employee'}
                            </Label>
                            {filterType === 'all' ? (
                                <div className="h-12 flex items-center px-4 rounded-xl bg-muted text-xs font-medium text-muted-foreground border border-dashed border-border/50 italic">
                                    Full organization metadata inclusion active
                                </div>
                            ) : filterType === 'department' ? (
                                <Select value={filterValue} onValueChange={setFilterValue}>
                                    <SelectTrigger className="rounded-xl border-border/50 bg-background h-12">
                                        <SelectValue placeholder="Choose department" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {DEPARTMENTS.map(d => (
                                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Select value={filterValue} onValueChange={setFilterValue}>
                                    <SelectTrigger className="rounded-xl border-border/50 bg-background h-12">
                                        <SelectValue placeholder="Search employee" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl max-h-[300px]">
                                        {members.map(m => (
                                            <SelectItem key={m.id} value={m.id}>{m.name} ({m.employee_id})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>

                    {/* Action Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-4">
                        {/* Activity Intelligence Report */}
                        <div className="group relative">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-500" />
                            <div className="relative flex flex-col h-full rounded-[2.5rem] bg-background border border-border/50 p-8 shadow-sm">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
                                        <BarChart3 className="w-8 h-8 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black">Historical Activity Ledger</h3>
                                        <p className="text-sm text-muted-foreground font-medium">Bulk intelligence export (Excel/CSV)</p>
                                    </div>
                                </div>

                                <ul className="space-y-3 mb-8 flex-1">
                                    {[
                                        'Full temporal login & late analysis',
                                        'Granular hourly plan metadata',
                                        'Slot-wise punctuality metrics',
                                        'Report intelligence consolidation',
                                        'EOD completion performance data'
                                    ].map((item, idx) => (
                                        <li key={idx} className="text-sm flex items-center gap-3 text-foreground/80">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>

                                <Button
                                    className="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-lg gap-3 shadow-lg shadow-primary/20 transition-all duration-300 active:scale-[0.98]"
                                    onClick={handleDownloadActivity}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <>
                                            <Download className="w-6 h-6" />
                                            Export Global Activity Ledger
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* LOP Master Ledger */}
                        <div className="group relative">
                            <div className="absolute -inset-1 bg-gradient-to-r from-authority-admin to-purple-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-500" />
                            <div className="relative flex flex-col h-full rounded-[2.5rem] bg-background border border-border/50 p-8 shadow-sm">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="p-4 rounded-2xl bg-authority-admin/10 border border-authority-admin/20">
                                        <FileText className="w-8 h-8 text-authority-admin" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black">Audit Discipline Ledger</h3>
                                        <p className="text-sm text-muted-foreground font-medium">Organization-wide LOP audit trail</p>
                                    </div>
                                </div>

                                <ul className="space-y-3 mb-8 flex-1">
                                    {[
                                        'Authenticated discipline records',
                                        'Automated vs Manual attribution',
                                        'Evidence & reason metadata',
                                        'Status-based categorization',
                                        'Departmental discrepancy mapping'
                                    ].map((item, idx) => (
                                        <li key={idx} className="text-sm flex items-center gap-3 text-foreground/80">
                                            <div className="w-1.5 h-1.5 rounded-full bg-authority-admin" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>

                                <Button
                                    className="w-full h-16 rounded-2xl bg-authority-admin hover:bg-authority-admin/90 text-white font-black text-lg gap-3 shadow-lg shadow-authority-admin/20 transition-all duration-300 active:scale-[0.98]"
                                    onClick={handleDownloadLOP}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <>
                                            <Download className="w-6 h-6" />
                                            Export LOP Master Ledger
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* LOP Audit Report - Grouped by Employee */}
                        <div className="group relative">
                            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-500" />
                            <div className="relative flex flex-col h-full rounded-[2.5rem] bg-background border border-border/50 p-8 shadow-sm">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                                        <TrendingUp className="w-8 h-8 text-emerald-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black">LOP Audit Summary</h3>
                                        <p className="text-sm text-muted-foreground font-medium">Employee-wise LOP analysis report</p>
                                    </div>
                                </div>

                                <ul className="space-y-3 mb-8 flex-1">
                                    {[
                                        'Grouped by employee name',
                                        'Individual LOP entries listed',
                                        'Reason for each LOP entry',
                                        'Total LOP days per employee',
                                        'Summary & detailed worksheets'
                                    ].map((item, idx) => (
                                        <li key={idx} className="text-sm flex items-center gap-3 text-foreground/80">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>

                                <Button
                                    className="w-full h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-500/90 text-white font-black text-lg gap-3 shadow-lg shadow-emerald-500/20 transition-all duration-300 active:scale-[0.98]"
                                    onClick={handleDownloadLOPAudit}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <>
                                            <Download className="w-6 h-6" />
                                            Export LOP Audit Report
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>

                <div className="bg-muted/50 p-8 border-t border-border/50 text-center">
                    <p className="text-sm font-bold text-muted-foreground flex items-center justify-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-authority-admin" />
                        SECURE AUDIT INTELLIGENCE SUITE • NATIONAL COMMAND CENTER • {format(new Date(), 'yyyy')}
                    </p>
                </div>
            </Card>
        </div>
    );
}
