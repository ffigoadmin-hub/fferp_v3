import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Clock, FileText, MapPin, ChevronRight, Shield, UserCheck, Search, Plus, Activity, FileBarChart, RotateCcw, FileCheck, History, LogOut } from 'lucide-react';
import { useAllSiteVisitRequests } from '@/hooks/useSiteVisitRequests';
import { useSiteVisitSLAAll, enrichSLA } from '@/hooks/useSiteVisitSLA';
import { SLASummaryRow } from '@/components/site-visit/SLATimerBadge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

const PRIORITY_COLOR: Record<string, string> = {
  standard: 'text-zinc-400',
  urgent: 'text-amber-400',
  emergency: 'text-red-400 animate-pulse',
};

function RequestMiniCard({ req, onClick }: { req: any; onClick: () => void }) {
  const statusColors: Record<string, string> = {
    submitted: 'bg-purple-500',
    smo_reviewed: 'bg-amber-500',
    assigned: 'bg-blue-500',
    visit_in_progress: 'bg-indigo-500',
    visit_completed: 'bg-emerald-500',
    report_submitted: 'bg-emerald-400',
    returned_to_rsh: 'bg-red-600',
    on_hold: 'bg-amber-600',
    closed: 'bg-zinc-500',
  };

  const accentColor = statusColors[req.status] || 'bg-zinc-700';

  return (
    <div
      className="bg-zinc-950/40 border border-zinc-800/50 rounded-xl p-3 cursor-pointer hover:border-zinc-700 hover:bg-zinc-900/60 transition-all group relative overflow-hidden active:scale-[0.98]"
      onClick={onClick}
    >
      {/* Status Side Strip */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 opacity-40 group-hover:opacity-100 transition-opacity", accentColor)} />
      
      <div className="flex items-start justify-between pl-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono font-black text-zinc-600 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
              {req.request_number}
            </span>
            <span className={cn('text-[9px] font-black uppercase tracking-widest', PRIORITY_COLOR[req.priority])}>
              {req.priority}
            </span>
            {(req.status === 'returned_to_rsh' || req.status === 'on_hold') && (
              <Badge variant="destructive" className="ml-auto text-[8px] font-black py-0 px-1.5 h-4 tracking-tighter shadow-sm bg-red-600 border-none animate-pulse">
                {req.status === 'returned_to_rsh' ? 'HALTED' : 'ON HOLD'}
              </Badge>
            )}
          </div>
          <p className="text-white text-[13px] font-black tracking-tight leading-tight truncate group-hover:text-blue-400 transition-colors uppercase italic">{req.location_title}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-zinc-600 text-[9px] font-black flex items-center gap-1 uppercase tracking-widest">
              <MapPin className="h-2.5 w-2.5 opacity-50" /> {req.location_city}
            </p>
            <p className="text-zinc-600 text-[9px] font-black flex items-center gap-1 uppercase tracking-widest">
              <Clock className="h-2.5 w-2.5 opacity-50" /> {format(new Date(req.created_at), 'd MMM')}
            </p>
          </div>
        </div>
        <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-blue-500/10 transition-colors self-center">
          <ChevronRight className="h-3 w-3 text-zinc-700 group-hover:text-blue-400 transition-colors shrink-0" />
        </div>
      </div>

      {req.site_visit_sla_tracking?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-800/30 pl-2">
          <SLASummaryRow slas={req.site_visit_sla_tracking.map(enrichSLA)} />
        </div>
      )}
    </div>
  );
}

export function SiteVisitFMDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const { user } = useAuth();
  const { data: allRequests = [], isLoading } = useAllSiteVisitRequests();
  const { data: slaAlerts = [] } = useSiteVisitSLAAll();

  const [searchQuery, setSearchQuery] = useState('');

  // Realtime Sync for Dashboard
  useEffect(() => {
    const channel = supabase
      .channel('site_visit_dashboard_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_visit_requests' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const isSMO = ['smo', 'admin', 'ceo', 'boi'].includes(user?.role?.toLowerCase() || '') || 
                user?.department?.toLowerCase() === 'site_visit' || 
                user?.department?.toLowerCase() === 'site visit';

  const historyStatuses = ['visit_completed', 'report_submitted', 'closed', 'quotation_submitted', 'soil_water_submitted', 'cancelled', 'approved'];
  
  const historyRequests = allRequests.filter(r => historyStatuses.includes(r.status));
  
  const filteredHistory = historyRequests.filter(r => 
    r.location_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.request_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.location_city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingReview = allRequests.filter((r) => r.status === 'submitted');
  const returnedRequests = allRequests.filter((r) => ['returned_to_rsh', 'on_hold'].includes(r.status));
  const pendingAssignment = allRequests.filter((r) => r.status === 'smo_reviewed');
  const inProgress = allRequests.filter((r) => ['assigned', 'visit_in_progress', 'assigned_emergency'].includes(r.status));
  const awaitingDocs = allRequests.filter((r) =>
    ['visit_completed', 'report_submitted', 'quotation_submitted', 'soil_water_submitted'].includes(r.status)
  );

  const breachedSLAs = slaAlerts.filter((s: any) => s.status === 'breached');

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[100px] rounded-full" />
      </div>

      <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left duration-500">
            <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-lg shadow-blue-500/5">
              <Shield className="h-7 w-7 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white uppercase italic tracking-wider">
                {isSMO ? 'Departmental Siting Dashboard' : 'Field Operations Control'}
              </h1>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                 <span className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse" />
                 Command Center
              </p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-1 bg-zinc-950/50 p-1 rounded-xl border border-zinc-800/50 backdrop-blur-md shadow-inner">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('active')}
                className={cn(
                  "h-8 text-[10px] font-black uppercase tracking-widest px-4 rounded-lg transition-all duration-300",
                  activeTab === 'active' 
                    ? "bg-blue-600 text-white shadow-lg border border-blue-400/30" 
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                )}
              >
                <Activity className="h-3 w-3 mr-2 opacity-70" />
                Active Dashboard
                {allRequests.filter(r => !historyStatuses.includes(r.status)).length > 0 && (
                  <span className="ml-2 px-1 py-0.5 rounded bg-white/10 text-[8px] font-bold">
                    {allRequests.filter(r => !historyStatuses.includes(r.status)).length}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('history')}
                className={cn(
                  "h-8 text-[10px] font-black uppercase tracking-widest px-4 rounded-lg transition-all duration-300",
                  activeTab === 'history' 
                    ? "bg-emerald-600 text-white shadow-lg border border-emerald-400/30" 
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                )}
              >
                <History className="h-3 w-3 mr-2 opacity-70" />
                Site Visit History
              </Button>
            </div>

            {!isSMO && (
              <Button 
                onClick={() => navigate('/site-visit-request/new')}
                className="bg-white text-black hover:bg-zinc-200 font-bold px-5 h-8 rounded-lg shadow-xl shadow-white/5 transition-all text-[10px] uppercase tracking-wider"
              >
                <Plus className="h-3 w-3 mr-2" /> NEW DEPLOYMENT
              </Button>
            )}
          </div>
        </div>

        {/* SLA Breach Banner */}
        {breachedSLAs.length > 0 && (
          <div className="bg-red-950/20 border border-red-900/30 rounded-2xl p-4 flex items-center gap-4 animate-in zoom-in-95 duration-500">
            <div className="p-2 bg-red-500/20 rounded-xl animate-pulse">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-red-400 font-black text-xs uppercase tracking-widest leading-none mb-1">
                SYSTEM CRITICAL: {breachedSLAs.length} BREACHED SLA{breachedSLAs.length > 1 ? 'S' : ''} DETECTED
              </p>
              <p className="text-red-500/70 text-[11px] font-medium italic">Immediate response protocols should be activated for overdue site artifacts.</p>
            </div>
          </div>
        )}

        {/* Conditional Dashboard Grid */}
        {activeTab === 'history' ? (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <Card className="glass-card border-zinc-800/50 overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle className="text-sm font-black text-emerald-400 uppercase italic tracking-widest flex items-center gap-2">
                      <History className="h-4 w-4" /> Site Visit History Master List
                    </CardTitle>
                    
                    <div className="flex items-center gap-3">
                      {!isSMO && (
                        <Button
                          onClick={() => navigate('/login')}
                          variant="outline"
                          className="h-9 px-4 bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-black uppercase tracking-widest rounded-xl"
                        >
                          <LogOut className="h-3.5 w-3.5 mr-2" /> Shift Login
                        </Button>
                      )}
                      
                      <div className="relative w-full md:w-80 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                        <Input 
                          placeholder="SEARCH PROJECTS, NUMBERS, CITIES..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-9 pl-10 bg-zinc-950/50 border-zinc-800 text-[10px] font-bold uppercase tracking-widest focus:ring-emerald-500/20 focus:border-emerald-500/50 rounded-xl transition-all"
                        />
                        {searchQuery && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-white/5 text-zinc-500"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
              </CardHeader>
              <CardContent className="p-6">
                {filteredHistory.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredHistory.map((req) => (
                      <RequestMiniCard key={req.id} req={req} onClick={() => navigate(`/site-visit-fm-dashboard/${req.id}`)} />
                    ))}
                  </div>
                ) : (
                  <div className="py-32 text-center opacity-30 grayscale items-center flex flex-col justify-center">
                    <History className="h-16 w-16 mb-4 text-zinc-700" />
                    <h3 className="text-lg font-black italic uppercase tracking-tighter text-zinc-500">Master List Empty</h3>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] mt-2 text-zinc-600">
                      {searchQuery ? `NO RESULTS MATCHING "${searchQuery.toUpperCase()}"` : 'NO ARCHIVED DEPLOYMENTS OR FINALIZED REPORTS'}
                    </p>
                    {searchQuery && (
                      <Button variant="link" onClick={() => setSearchQuery('')} className="mt-4 text-emerald-500 font-bold uppercase tracking-widest text-[10px]">
                        Clear Search Query
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : isSMO ? (
          <div className="space-y-6">
            <div className="flex lg:grid lg:grid-cols-5 gap-4 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
              {/* Column 1: Pending Review */}
              <Card className="glass-card border-zinc-800/50 flex flex-col min-w-[280px] lg:min-w-0 min-h-[400px] shadow-[0_0_20px_rgba(168,85,247,0.03)] border-t-purple-500/20">
                <CardHeader className="pb-3 pt-5 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-400">
                      <Search className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Pending & Returned</span>
                    </div>
                    {pendingReview.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 font-black border-purple-500/30">
                        {pendingReview.length}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-4 space-y-3 flex-1 overflow-y-auto">
                  {pendingReview.map((req) => (
                    <RequestMiniCard key={req.id} req={req} onClick={() => navigate(`/site-visit-fm-dashboard/${req.id}`)} />
                  ))}
                  {!isLoading && pendingReview.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 opacity-30 grayscale">
                       <Clock className="h-10 w-10 text-zinc-700 mb-3" />
                       <p className="text-[10px] uppercase font-bold text-zinc-600 tracking-tighter">Queue Clear</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Column 2: Pending Allocation */}
              <Card className="glass-card border-zinc-800/50 flex flex-col min-w-[280px] lg:min-w-0 min-h-[400px] shadow-[0_0_20px_rgba(245,158,11,0.03)] border-t-amber-500/20">
                <CardHeader className="pb-3 pt-5 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-400">
                      <UserCheck className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Assignment Queue</span>
                    </div>
                    {pendingAssignment.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 font-black border-amber-500/30">
                        {pendingAssignment.length}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-4 space-y-3 flex-1 overflow-y-auto">
                  {pendingAssignment.map((req) => (
                    <RequestMiniCard key={req.id} req={req} onClick={() => navigate(`/site-visit-fm-dashboard/${req.id}`)} />
                  ))}
                  {!isLoading && pendingAssignment.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 opacity-30 grayscale">
                       <UserCheck className="h-10 w-10 text-zinc-700 mb-3" />
                       <p className="text-[10px] uppercase font-bold text-zinc-600 tracking-tighter">All Allocated</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Column 3: In Progress */}
              <Card className="glass-card border-zinc-800/50 flex flex-col min-w-[280px] lg:min-w-0 min-h-[400px] shadow-[0_0_20px_rgba(59,130,246,0.03)] border-t-blue-500/20">
                <CardHeader className="pb-3 pt-5 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-400">
                      <MapPin className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Active Visits</span>
                    </div>
                    {inProgress.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 font-black border-blue-500/30">
                        {inProgress.length}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-4 space-y-3 flex-1 overflow-y-auto">
                  {inProgress.map((req) => (
                    <RequestMiniCard key={req.id} req={req} onClick={() => navigate(`/site-visit-fm-dashboard/${req.id}`)} />
                  ))}
                  {!isLoading && inProgress.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 opacity-30 grayscale">
                       <MapPin className="h-10 w-10 text-zinc-700 mb-3" />
                       <p className="text-[10px] uppercase font-bold text-zinc-600 tracking-tighter">No Active Boots</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Column 4: Awaiting Docs */}
              <Card className="glass-card border-zinc-800/50 flex flex-col min-w-[280px] lg:min-w-0 min-h-[400px] shadow-[0_0_20px_rgba(16,185,129,0.03)] border-t-emerald-500/20">
                <CardHeader className="pb-3 pt-5 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <FileText className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Reporting Phase</span>
                    </div>
                    {awaitingDocs.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 font-black border-emerald-500/30">
                        {awaitingDocs.length}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-4 space-y-3 flex-1 overflow-y-auto">
                  {awaitingDocs.map((req) => (
                    <RequestMiniCard key={req.id} req={req} onClick={() => navigate(`/site-visit-fm-dashboard/${req.id}`)} />
                  ))}
                  {!isLoading && awaitingDocs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 opacity-30 grayscale">
                       <FileText className="h-10 w-10 text-zinc-700 mb-3" />
                       <p className="text-[10px] uppercase font-bold text-zinc-600 tracking-tighter">Archives Current</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Column 5: Halted / Returned */}
              <Card className="glass-card border-zinc-800/50 flex flex-col min-w-[280px] lg:min-w-0 min-h-[400px] shadow-[0_0_20px_rgba(239,68,68,0.03)] border-t-red-500/20">
                <CardHeader className="pb-3 pt-5 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Halted / Returned</span>
                    </div>
                    {returnedRequests.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 font-black border-red-500/30">
                        {returnedRequests.length}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-4 space-y-3 flex-1 overflow-y-auto">
                  {returnedRequests.map((req) => (
                    <RequestMiniCard key={req.id} req={req} onClick={() => navigate(`/site-visit-fm-dashboard/${req.id}`)} />
                  ))}
                  {!isLoading && returnedRequests.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 opacity-30 grayscale">
                       <AlertTriangle className="h-10 w-10 text-zinc-700 mb-3" />
                       <p className="text-[10px] uppercase font-bold text-zinc-600 tracking-tighter">No Blockers</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Aggregate Intelligence Section */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Unreviewed Assets', value: pendingReview.length, color: 'text-purple-400', icon: Search },
                { label: 'Returned / Halted', value: returnedRequests.length, color: 'text-red-400', icon: RotateCcw },
                { label: 'Awaiting Allocation', value: pendingAssignment.length, color: 'text-amber-400', icon: UserCheck },
                { label: 'Live Operations', value: inProgress.length, color: 'text-blue-400', icon: Activity },
                { label: 'Reporting Backlog', value: awaitingDocs.length, color: 'text-emerald-400', icon: FileBarChart },
              ].map((stat) => (
                <Card key={stat.label} className="glass-card border-zinc-800/50 hover:bg-zinc-900/40 transition-all duration-300 group">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                          <p className={cn('text-3xl font-black italic tracking-tighter', stat.color)}>{stat.value}</p>
                          <p className="text-zinc-500 text-[9px] font-bold tracking-[0.1em] uppercase mt-1">{stat.label}</p>
                        </div>
                        <stat.icon className={cn("h-8 w-8 opacity-10 group-hover:opacity-30 transition-opacity", stat.color)} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          /* Simplified Farm Manager View */
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Active Missions */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-blue-400 uppercase italic tracking-widest flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Active Missions
                </h3>
                <div className="space-y-3">
                  {inProgress.length > 0 ? (
                    inProgress.map((req) => (
                      <RequestMiniCard key={req.id} req={req} onClick={() => navigate(`/site-visit-fm-dashboard/${req.id}`)} />
                    ))
                  ) : (
                    <Card className="bg-zinc-900/30 border-zinc-800/50 border-dashed p-10 flex flex-col items-center justify-center opacity-50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">No Mission Active</p>
                    </Card>
                  )}
                </div>
              </div>

              {/* Pending / Blocked */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-amber-500 uppercase italic tracking-widest flex items-center gap-2">
                   <AlertTriangle className="h-4 w-4" /> Attention Required
                </h3>
                <div className="space-y-3">
                  {[...returnedRequests, ...pendingReview].length > 0 ? (
                    [...returnedRequests, ...pendingReview].map((req) => (
                      <RequestMiniCard key={req.id} req={req} onClick={() => navigate(`/site-visit-fm-dashboard/${req.id}`)} />
                    ))
                  ) : (
                    <Card className="bg-zinc-900/30 border-zinc-800/50 border-dashed p-10 flex flex-col items-center justify-center opacity-50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">All Clear</p>
                    </Card>
                  )}
                </div>
              </div>
            </div>
            
            {/* Reporting Missions */}
            <div className="space-y-4">
               <h3 className="text-sm font-black text-emerald-500 uppercase italic tracking-widest flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Mission Reporting Phase
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {awaitingDocs.length > 0 ? (
                    awaitingDocs.map((req) => (
                      <RequestMiniCard key={req.id} req={req} onClick={() => navigate(`/site-visit-fm-dashboard/${req.id}`)} />
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-10 grayscale opacity-20">
                       <FileCheck className="h-10 w-10 mx-auto mb-2" />
                       <p className="text-[10px] font-black uppercase tracking-widest">Reports Finalized</p>
                    </div>
                  )}
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
