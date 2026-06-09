import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MapPin, Clock, Plus, ChevronRight, AlertTriangle, CheckCircle, FileText, Calendar, User, Shield, Send, Loader2, UserCheck, Phone } from 'lucide-react';
import { useSiteVisitRequests, useAllSiteVisitRequests } from '@/hooks/useSiteVisitRequests';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteVisitSLA, enrichSLA } from '@/hooks/useSiteVisitSLA';
import { SLASummaryRow } from '@/components/site-visit/SLATimerBadge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-zinc-800 text-zinc-400' },
  submitted: { label: 'Submitted', color: 'bg-blue-900/50 text-blue-300' },
  returned_to_rsh: { label: 'Returned', color: 'bg-amber-900/50 text-amber-300' },
  smo_reviewed: { label: 'SMO Reviewed', color: 'bg-purple-900/50 text-purple-300' },
  assigned: { label: 'Assigned', color: 'bg-cyan-900/50 text-cyan-300' },
  visit_in_progress: { label: 'In Progress', color: 'bg-yellow-900/50 text-yellow-300' },
  visit_completed: { label: 'Visit Done', color: 'bg-emerald-900/50 text-emerald-300' },
  report_submitted: { label: 'Report Ready', color: 'bg-emerald-900/50 text-emerald-300' },
  quotation_submitted: { label: 'Quotation ✓', color: 'bg-emerald-900/50 text-emerald-300' },
  soil_water_submitted: { label: 'Soil/Water ✓', color: 'bg-emerald-900/50 text-emerald-300' },
  closed: { label: 'Closed', color: 'bg-zinc-700 text-zinc-300' },
  cancelled: { label: 'Cancelled', color: 'bg-red-900/50 text-red-400' },
};

const PRIORITY_COLOR: Record<string, string> = {
  standard: 'text-zinc-400',
  urgent: 'text-amber-400',
  emergency: 'text-red-400',
};

function RequestCard({ req, onSubmit, isSubmitting }: { req: any; onSubmit?: (id: string) => void; isSubmitting?: boolean }) {
  const [open, setOpen] = useState(false);
  const slasQuery = useSiteVisitSLA(open ? req.id : undefined);
  const cfg = STATUS_LABEL[req.status] || { label: req.status, color: 'bg-zinc-800 text-zinc-400' };
  const canSubmit = ['draft', 'returned_to_rsh'].includes(req.status);

  return (
    <>
      <Card
        className="glass-card border-zinc-800/50 hover:border-zinc-500/50 cursor-pointer transition-all duration-300 group hover:scale-[1.01]"
        onClick={() => setOpen(true)}
      >
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-950/50 px-1.5 py-0.5 rounded border border-zinc-800/50">
                  {req.request_number}
                </span>
                <Badge className={cn('text-[10px] font-bold px-2 py-0 border-transparent', cfg.color)}>
                  {cfg.label}
                </Badge>
                {req.priority !== 'standard' && (
                  <span className={cn('text-[10px] font-black uppercase tracking-wider flex items-center gap-1', PRIORITY_COLOR[req.priority])}>
                    {req.priority === 'emergency' && <AlertTriangle className="h-3 w-3 animate-pulse" />}
                    {req.priority}
                  </span>
                )}
              </div>
              <h3 className="text-white font-bold text-base truncate tracking-tight">{req.location_title}</h3>
              <p className="text-zinc-500 text-xs font-medium flex items-center gap-1.5 mt-1">
                <MapPin className="h-3.5 w-3.5 text-blue-500/70" /> {req.location_city}, {req.location_state}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
              <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0" />
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-4 pt-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
              <Calendar className="h-3.5 w-3.5" />
              {format(new Date(req.created_at), 'd MMM yyyy')}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
              <User className="h-3.5 w-3.5" />
              {req.client_name}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-600">
              <Plus className="h-3.5 w-3.5" />
              {req.visit_category}
            </div>
          </div>

          {/* SLA compact row */}
          {req.site_visit_sla_tracking?.length > 0 && (
            <div className="pt-2 border-t border-zinc-800/50">
              <SLASummaryRow slas={req.site_visit_sla_tracking.map(enrichSLA)} />
            </div>
          )}

          {/* Rejection reason if returned */}
          {req.status === 'returned_to_rsh' && req.smo_rejection_reason && (
            <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-3 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-0.5">SMO REMARKS</p>
                  <p className="text-xs text-amber-300 leading-relaxed font-medium">
                    {req.smo_rejection_reason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Report available */}
          {req.site_visit_report_url && (
            <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg w-fit">
              <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Official Report Ready
            </div>
          )}

          {/* Submit to SMO button for draft / returned requests */}
          {canSubmit && onSubmit && (
            <div className="pt-3 border-t border-zinc-800/50">
              <Button
                onClick={(e) => { e.stopPropagation(); onSubmit(req.id); }}
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black italic h-11 rounded-xl shadow-lg shadow-blue-500/10 transition-all active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> SUBMITTING...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" /> {req.status === 'returned_to_rsh' ? 'RE-SUBMIT TO SMO' : 'SUBMIT TO SMO'}</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800/50 max-w-lg max-h-[85vh] overflow-y-auto p-0 rounded-2xl">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 border-b border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono text-zinc-500">{req.request_number}</span>
              <Badge className={cn('text-[10px] font-bold border-transparent', cfg.color)}>{cfg.label}</Badge>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{req.location_title}</h2>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Status</span>
                <p className="text-sm text-white font-bold capitalize tracking-tight flex items-center gap-2">
                  <div className={cn("h-1.5 w-1.5 rounded-full", cfg.color.split(' ')[0])} />
                  {req.status.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Priority</span>
                <p className={cn('text-sm font-black capitalize tracking-tight', PRIORITY_COLOR[req.priority])}>{req.priority}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Requester / Client</span>
                <p className="text-sm text-white font-medium tracking-tight h-5 overflow-hidden text-ellipsis">{req.client_name}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Visit Deadline</span>
                <p className="text-sm text-blue-400 font-bold tracking-tight">{format(new Date(req.requested_visit_deadline), 'd MMM yyyy')}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-zinc-900">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Purpose Description</p>
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
                <p className="text-sm text-zinc-300 leading-relaxed font-medium">{req.purpose_description || 'No description provided.'}</p>
              </div>
            </div>

            {/* SLA Timers full */}
            {slasQuery.data?.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-zinc-900">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">SLA Performance</p>
                <div className="bg-zinc-900/30 p-2 rounded-xl">
                  <SLASummaryRow slas={slasQuery.data} />
                </div>
              </div>
            )}

            {/* Assigned Farm Manager */}
            {req.site_visit_assignments?.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-zinc-900">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Assigned Field Manager</p>
                {req.site_visit_assignments.map((assignment: any) => {
                  const fm = assignment.assigned_user;
                  if (!fm) return null;
                  return (
                    <div key={assignment.id} className="bg-gradient-to-br from-cyan-950/30 to-zinc-900/50 border border-cyan-800/30 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                          <UserCheck className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm tracking-tight">{fm.name}</p>
                          <p className="text-cyan-400/70 text-[11px] font-semibold uppercase tracking-wider">
                            {fm.role?.replace(/_/g, ' ')} {fm.department ? `• ${fm.department}` : ''}
                          </p>
                        </div>
                        <Badge className={cn(
                          'text-[9px] font-black uppercase tracking-widest border-transparent',
                          assignment.sla1_status === 'completed' ? 'bg-emerald-900/50 text-emerald-300' :
                          assignment.sla1_status === 'overdue' ? 'bg-red-900/50 text-red-300' :
                          'bg-cyan-900/50 text-cyan-300'
                        )}>
                          {assignment.sla1_status || 'assigned'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-[11px]">
                        {fm.phone && (
                          <a href={`tel:${fm.phone}`} className="flex items-center gap-1.5 text-zinc-400 hover:text-cyan-300 transition-colors font-medium">
                            <Phone className="h-3 w-3" /> {fm.phone}
                          </a>
                        )}
                        {fm.email && (
                          <span className="flex items-center gap-1.5 text-zinc-500 font-medium truncate">
                            <User className="h-3 w-3" /> {fm.email}
                          </span>
                        )}
                      </div>
                      {assignment.assigned_at && (
                        <p className="text-[10px] text-zinc-600 font-medium">
                          Assigned on {format(new Date(assignment.assigned_at), 'd MMM yyyy, h:mm a')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-3 pt-2 border-t border-zinc-900">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Available Deliverables</p>
              <div className="grid gap-2">
                {[
                  { label: 'Site Visit Report', url: req.site_visit_report_url, date: req.report_submitted_at, icon: <FileText className="h-3.5 w-3.5" /> },
                  { label: 'Official Quotation', url: req.quotation_url, date: req.quotation_submitted_at, icon: <Shield className="h-3.5 w-3.5" /> },
                  { label: 'Material Analysis', url: req.soil_water_report_url, date: req.soil_water_submitted_at, icon: <MapPin className="h-3.5 w-3.5" /> },
                ].map((d) => (
                  <div key={d.label} className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-4 py-3 group hover:border-blue-500/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-zinc-950 rounded-lg text-zinc-500 group-hover:text-blue-400 transition-colors">
                        {d.icon}
                      </div>
                      <span className="text-zinc-400 text-xs font-semibold">{d.label}</span>
                    </div>
                    {d.url ? (
                      <a href={d.url} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                        <CheckCircle className="h-3.5 w-3.5" /> VIEW
                      </a>
                    ) : (
                      <span className="text-[10px] font-black text-zinc-600 tracking-tighter uppercase px-3 py-1">AWAITING</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4 bg-zinc-950/50 border-t border-zinc-800/50 flex justify-end">
             <Button variant="ghost" onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white px-6">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MySiteVisitsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [viewScope, setViewScope] = useState<'my' | 'all'>('all'); // Default to all for privileged roles
  
  const userRole = user?.role?.toLowerCase() || '';
  const isPrivileged = ['rsh', 'smo', 'admin', 'ceo', 'gm', 'gmo', 'director', 'farmmanager'].includes(userRole);

  const { requests: myRequests = [], isLoading: isLoadingMy, submitRequest, isSubmitting } = useSiteVisitRequests();
  const { data: allRequests = [], isLoading: isLoadingAll } = useAllSiteVisitRequests();

  const requests = (isPrivileged && viewScope === 'all') ? (allRequests || []) : (myRequests || []);
  const isLoading = (isPrivileged && viewScope === 'all') ? isLoadingAll : isLoadingMy;

  const handleSubmitToSMO = async (id: string) => {
    try {
      await submitRequest(id);
    } catch {}
  };

  const activeRequests = requests.filter((r) => !['closed', 'cancelled'].includes(r.status));
  const closedRequests = requests.filter((r) => ['closed', 'cancelled'].includes(r.status));

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
        <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] bg-blue-950/30 blur-[80px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-zinc-900/20 blur-[100px] rounded-full" />
      </div>

      <div className="max-w-2xl mx-auto space-y-8 p-4 md:p-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between pb-2">
          <div className="animate-in fade-in slide-in-from-left duration-500">
            <h1 className="text-2xl font-black text-white tracking-widest uppercase italic">Site Operations</h1>
            <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
               <Shield className="h-3 w-3 text-blue-500" /> Site Visit Control Center
            </p>
          </div>
          <Button
            onClick={() => navigate('/site-visit-request/new')}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6 h-11 rounded-xl shadow-xl shadow-primary/5 flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" /> NEW REQUISITION
          </Button>
        </div>

        {/* View Scope Toggle for privileged roles */}
        {isPrivileged && (
          <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50 w-fit">
            <Button
              variant={viewScope === 'my' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewScope('my')}
              className={cn(
                "rounded-lg px-6 h-9 font-bold text-[10px] uppercase tracking-widest transition-all",
                viewScope === 'my' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              My Requests
            </Button>
            <Button
              variant={viewScope === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewScope('all')}
              className={cn(
                "rounded-lg px-6 h-9 font-bold text-[10px] uppercase tracking-widest transition-all",
                viewScope === 'all' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-600" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              All Pool
            </Button>
          </div>
        )}

        {/* Main List */}
        <div className="space-y-8">
          {/* Active Section */}
          <div className="space-y-4">
            <h2 className="text-[10px] font-black text-blue-500/70 uppercase tracking-[0.2em] flex items-center gap-3">
               ACTIVE REQUISITIONS
               <div className="h-px flex-1 bg-gradient-to-r from-blue-500/20 to-transparent" />
            </h2>
            
            {isLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-zinc-900/40 border border-zinc-800 rounded-2xl animate-pulse" />
                ))}
              </div>
            )}

            {!isLoading && activeRequests.length > 0 && (
              <div className="space-y-4">
                {activeRequests.map((req) => <RequestCard key={req.id} req={req} onSubmit={handleSubmitToSMO} isSubmitting={isSubmitting} />)}
              </div>
            )}

            {!isLoading && activeRequests.length === 0 && (
              <div className="bg-zinc-900/20 border border-dashed border-zinc-800 rounded-2xl p-10 text-center animate-in fade-in zoom-in duration-500">
                <Shield className="h-10 w-10 text-zinc-800 mx-auto mb-4 opacity-50" />
                <p className="text-zinc-600 font-bold text-xs uppercase tracking-widest">No active deployments found</p>
              </div>
            )}
          </div>

          {/* Closed Section */}
          {!isLoading && closedRequests.length > 0 && (
            <div className="space-y-4 pt-4">
              <h2 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] flex items-center gap-3">
                 ARCHIVE / COMPLETED
                 <div className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
              </h2>
              <div className="space-y-3 opacity-60">
                {closedRequests.map((req) => <RequestCard key={req.id} req={req} />)}
              </div>
            </div>
          )}
        </div>

        {!isLoading && requests.length === 0 && (
          <div className="text-center py-24 animate-in fade-in duration-1000">
            <div className="h-20 w-20 bg-zinc-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-zinc-800">
              <MapPin className="h-8 w-8 text-zinc-700" />
            </div>
            <h2 className="text-white font-black text-xl mb-2 tracking-tight uppercase">No Data Records</h2>
            <p className="text-zinc-600 text-xs font-medium max-w-[240px] mx-auto leading-relaxed">
              Your site visit history is currently empty. Initialize your first requisition to begin tracking.
            </p>
            <Button
              onClick={() => navigate('/site-visit-request/new')}
              className="mt-8 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 h-12 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/20"
            >
              INITIALIZE REQUISITION
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
