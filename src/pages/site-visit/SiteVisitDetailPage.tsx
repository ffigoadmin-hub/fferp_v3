import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MapPin, User, FileText, Upload, Clock, ArrowLeft, CheckCircle, Lock, AlertTriangle, ExternalLink, Forward, RotateCcw, Shield, Compass, Play, LogOut, Sun, Sunset, Moon, FileDown } from 'lucide-react';
import { useAllSiteVisitRequests } from '@/hooks/useSiteVisitRequests';
import { useSiteVisitFarmManager } from '@/hooks/useSiteVisitFarmManager';
import { useSiteVisitSLA } from '@/hooks/useSiteVisitSLA';
import { useSiteVisitDailyReports } from '@/hooks/useSiteVisitDailyReport';
import { SLATimerBadge } from '@/components/site-visit/SLATimerBadge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { useSiteVisitSMO } from '@/hooks/useSiteVisitSMO';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSessionReports, type SessionType } from '@/hooks/useSiteVisitSessionReport';
import { generateSiteVisitDocx } from '@/utils/siteVisitDocxGenerator';


export function SiteVisitDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: allRequests = [] } = useAllSiteVisitRequests();
  const req = allRequests.find((r) => r.id === requestId);

  const { selfAssign, startVisit, uploadReport, uploadQuotation, uploadSoilWater,
    isSelfAssigning, isStartingVisit, isUploadingReport, isUploadingQuotation, isUploadingSoilWater } = useSiteVisitFarmManager();
  const { forwardRequest, returnRequest, triggerDeployment, stopDeployment, isForwarding, isReturning, isTriggering, isStopping } = useSiteVisitSMO();
  const { data: slas = [] } = useSiteVisitSLA(requestId);
  const assignment = (req as any)?.site_visit_assignments?.[0];
  const { data: dailyReports = [] } = useSiteVisitDailyReports(assignment?.id);
  const { data: sessionReports = [] } = useSessionReports(assignment?.id);
  const [stopOpen, setStopOpen] = useState(false);
  const [stopReason, setStopReason] = useState('');

  // Fetch timeline entries directly
  const { data: timelineEntries = [] } = useQuery({
    queryKey: ['site-visit-timeline', requestId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('site_visit_timeline')
        .select('*')
        .eq('request_id', requestId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!requestId,
  });

  const totalActivityCount = timelineEntries.length + dailyReports.length + sessionReports.length;

  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptForm, setAcceptForm] = useState({ visitInstructions: '', expectedVisitDate: '', remarks: '' });
  const [reportUrl, setReportUrl] = useState('');
  const [quotationUrl, setQuotationUrl] = useState('');
  const [soilWaterUrl, setSoilWaterUrl] = useState('');

  // SMO Actions State
  const [smoOpen, setSmoOpen] = useState(false);
  const [smoRemarks, setSmoRemarks] = useState('');
  const [selectedFM, setSelectedFM] = useState<string>('');
  const [farmManagers, setFarmManagers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const allowedRoles = ['smo', 'admin', 'ceo', 'site_visit_farm_manager', 'boi', 'employee'];
    if (currentUser?.role && allowedRoles.includes(currentUser.role.toLowerCase())) {
      const fetchFMs = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('id, name')
          .or('department.ilike.Farm Manager,department.ilike.Site Visit');
        if (data) setFarmManagers(data);
      };
      fetchFMs();
    }
  }, [currentUser]);

  if (!req) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { status } = req;
  const isSMO = ['smo', 'admin'].includes(currentUser?.role?.toLowerCase() || '') ||
                (currentUser?.role?.toLowerCase() === 'smo' && currentUser?.department?.toLowerCase()?.includes('site visit'));
  const isFM = currentUser?.role?.toLowerCase() === 'site_visit_farm_manager' || currentUser?.role?.toLowerCase() === 'farm_manager';
  const canAccept = req.status === 'smo_reviewed' && !isSMO;
  const canSMOReview = req.status === 'submitted' && isSMO;
  const canStartVisit = req.status === 'assigned';
  const canSubmitDailyReport = ['visit_in_progress', 'assigned'].includes(req.status);

  // Sequential Submissions logic
  const canUploadReport = status === 'visit_completed';
  const canUploadQuotation = status === 'report_submitted';
  const canUploadSoilWater = ['visit_completed', 'report_submitted', 'quotation_submitted', 'soil_water_submitted'].includes(status);

  const handleAccept = async () => {
    if (!requestId || !acceptForm.visitInstructions || !acceptForm.expectedVisitDate) {
      toast.error('Fill in all required accept fields');
      return;
    }
    try {
      await selfAssign({
        requestId: requestId!,
        visitInstructions: acceptForm.visitInstructions,
        expectedVisitDate: acceptForm.expectedVisitDate,
        assignmentRemarks: acceptForm.remarks,
        sla1StartedAt: req.smo_reviewed_at!,
      });
      setAcceptOpen(false);
    } catch {}
  };

  const handleSMOForward = async () => {
    if (!requestId) return;

    // Convert 'none_clear' to undefined for the hook logic
    const assignedFM = (selectedFM && selectedFM !== 'none_clear') ? selectedFM : undefined;

    try {
      await forwardRequest({
        id: requestId,
        remarks: smoRemarks,
        assignedTo: assignedFM
      });
      setSmoOpen(false);
      setSmoRemarks('');
      setSelectedFM('');

      // If directly assigned, we can notify the user specifically
      if (assignedFM) {
        toast.success(`Request deployed and assigned to Field Officer`);
      } else {
        toast.success('Request approved and moved to Assignment Queue');
      }

      // Navigate back to dashboard after a short delay for feedback
      setTimeout(() => navigate('/site-visit-fm-dashboard'), 1500);
    } catch (e) {
      console.error('Forwarding error:', e);
    }
  };

  const handleSMOReturn = async () => {
    if (!requestId || !smoRemarks) {
      toast.error('Please provide a reason for return');
      return;
    }
    try {
      await returnRequest({
        id: requestId,
        reason: smoRemarks
      });
      setSmoOpen(false);
      setSmoRemarks('');
    } catch {}
  };

  const handleMarkVisitComplete = async () => {
    if (!requestId) return;
    try {
      const now = new Date().toISOString();
      const sla2Deadline = addDays(new Date(), 2).toISOString();
      const sla4Deadline = addDays(new Date(), 10).toISOString();

      const { error } = await supabase
        .from('site_visit_requests')
        .update({
          status: 'visit_completed',
          visit_completed_at: now
        })
        .eq('id', requestId);

      if (error) throw error;

      // Start Reporting SLA (SLA-2 ONLY)
      await (supabase as any).from('site_visit_sla_tracking').insert([
        {
          request_id: requestId,
          sla_number: 2,
          sla_name: 'Site Visit Report',
          clock_start_at: now,
          deadline_at: sla2Deadline,
          status: 'pending',
        },
      ]);

      toast.success('Visit marked as complete. SLA for reporting has been started.');
      queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to mark visit as complete');
    }
  };

  const SESSION_CONFIG: Record<SessionType, { label: string; time: string; icon: any; color: string; bg: string; border: string }> = {
    morning: { label: 'Morning', time: '6:00 AM – 12:00 PM', icon: Sun, color: 'text-amber-400', bg: 'bg-amber-950/30', border: 'border-amber-800/30' },
    afternoon: { label: 'Afternoon', time: '12:00 PM – 5:00 PM', icon: Sunset, color: 'text-orange-400', bg: 'bg-orange-950/30', border: 'border-orange-800/30' },
    evening: { label: 'Evening', time: '5:00 PM – 9:00 PM', icon: Moon, color: 'text-blue-400', bg: 'bg-blue-950/30', border: 'border-blue-800/30' },
  };

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[100px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in fade-in slide-in-from-top duration-500">
           <div className="space-y-4">
              <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                className="text-zinc-500 hover:text-white px-0 hover:bg-transparent group"
              >
                <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Dashboard
              </Button>

              <div className="flex items-start gap-4">
                 <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl">
                    <MapPin className="h-6 w-6 text-blue-500" />
                 </div>
                 <div>
                    <div className="flex items-center gap-3">
                       <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase">{req.request_number}</h1>
                       <Badge variant="outline" className="bg-blue-500/5 text-blue-400 border-blue-500/20 text-[10px] font-black uppercase tracking-widest px-2 py-0.5">
                          {req.status.replace(/_/g, ' ')}
                       </Badge>
                    </div>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                       {req.location_title} <span className="text-zinc-700">|</span> {req.location_city}, {req.location_state}
                    </p>
                 </div>
              </div>
           </div>

           <div className="flex gap-3">
              {canSMOReview && (
                <div className="flex gap-2">
                   <Button onClick={() => setSmoOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-black italic rounded-xl px-6">
                      <Forward className="h-4 w-4 mr-2" /> APPROVE & ASSIGN
                   </Button>
                   <Button onClick={() => { setSmoOpen(true); }} variant="outline" className="border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-xl px-4">
                      <RotateCcw className="h-4 w-4" />
                   </Button>
                </div>
              )}

              {canAccept && (
                <Button onClick={() => setAcceptOpen(true)} disabled={isSelfAssigning}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black italic rounded-xl px-8 shadow-lg shadow-blue-500/20">
                  {isSelfAssigning ? 'PROCESSING...' : 'ACCEPT ASSIGNMENT'}
                </Button>
              )}

              {canStartVisit && (
                <Button onClick={() => startVisit(requestId!)} disabled={isStartingVisit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black italic rounded-xl px-8 shadow-lg shadow-emerald-500/20">
                  {isStartingVisit ? 'INITIALIZING...' : 'START ON-SITE VISIT'}
                </Button>
              )}

              {isSMO && status === 'visit_in_progress' && (
                <Button onClick={handleMarkVisitComplete}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-black italic rounded-xl px-8 shadow-lg shadow-primary/20">
                  MARK VISIT COMPLETE (SMO)
                </Button>
              )}

              {isFM && status === 'visit_completed' && (
                <Button onClick={() => navigate('/shift/login')}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black italic rounded-xl px-8 shadow-lg shadow-blue-500/20 uppercase tracking-widest text-[10px]">
                  <LogOut className="h-4 w-4 mr-2" /> PROCEED TO SHIFT LOGIN
                </Button>
              )}
            </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-transparent border-b border-zinc-800 w-full justify-start rounded-none h-12 p-0 gap-8 mb-6 overflow-x-auto">
            <TabsTrigger value="overview" className="tab-trigger">OVERVIEW</TabsTrigger>
            <TabsTrigger value="sla" className="tab-trigger uppercase">Compliance (SLA)</TabsTrigger>
            <TabsTrigger value="reports" className="tab-trigger uppercase">Activity Log ({totalActivityCount})</TabsTrigger>
            <TabsTrigger value="deliverables" className="tab-trigger uppercase">Deliverables</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               {/* Primary Details */}
               <Card className="lg:col-span-2 glass-card border-zinc-800/50">
                  <CardHeader className="border-b border-zinc-800/50">
                     <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Deployment Intelligence</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Requester Entity</label>
                        <div className="flex items-center gap-2">
                           <div className="h-8 w-8 bg-zinc-800 rounded-lg flex items-center justify-center border border-zinc-700">
                              <User className="h-4 w-4 text-zinc-400" />
                           </div>
                           <p className="text-sm font-bold text-white">{req.requester?.name || 'RSH Unit'}</p>
                        </div>
                     </div>

                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Assigned Client</label>
                        <p className="text-sm font-black text-white italic truncate">{req.client_name}</p>
                     </div>

                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Intelligence Source</label>
                        <p className="text-sm font-bold text-zinc-300">{(req as any).client_company || 'N/A'}</p>
                     </div>

                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Visit Category</label>
                        <Badge variant="outline" className="bg-zinc-800 text-zinc-400 border-zinc-700 uppercase italic font-bold text-[10px]">
                           {req.visit_category}
                        </Badge>
                     </div>

                     <div className="md:col-span-2 space-y-2 mt-4">
                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Operation Objective</label>
                        <div className="p-4 bg-zinc-950/50 border border-zinc-900 rounded-xl">
                           <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap italic">"{req.purpose_description}"</p>
                        </div>
                     </div>
                  </CardContent>
               </Card>

               {/* Logistics Sidebar */}
               <div className="space-y-6">
                  <Card className="glass-card border-zinc-800/50">
                     <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Timeline Params</CardTitle>
                     </CardHeader>
                     <CardContent className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] font-bold text-zinc-500 uppercase">Priority Index</span>
                           <span className={cn('text-xs font-black uppercase tracking-widest italic',
                             req.priority === 'emergency' ? 'text-red-500' :
                             req.priority === 'urgent' ? 'text-amber-500' : 'text-zinc-400'
                           )}>{req.priority}</span>
                        </div>
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] font-bold text-zinc-500 uppercase">Deadline</span>
                           <span className="text-xs font-bold text-white">{format(new Date(req.requested_visit_deadline), 'd MMM yyyy')}</span>
                        </div>
                        {req.location_google_maps_url && (
                           <a href={req.location_google_maps_url} target="_blank" rel="noopener noreferrer"
                             className="flex items-center justify-center gap-2 w-full py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-all border border-blue-500/20 text-xs font-black italic">
                             GPS COORDINATES <ExternalLink className="h-3 w-3" />
                           </a>
                        )}
                     </CardContent>
                  </Card>

               {/* Assigned Manager Card */}
               {assignment && (
                  <Card className="glass-card border-zinc-800/50 bg-cyan-950/10">
                    <CardHeader className="pb-2 border-b border-zinc-800/30">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500">Assigned Field Officer</CardTitle>
                        {isSMO && (
                          <div className="flex flex-wrap gap-2">
                            {(status === 'assigned' || status === 'returned_to_rsh' || status === 'on_hold') && assignment && (
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-primary hover:bg-primary/90 text-[10px] uppercase font-bold tracking-widest h-7 gap-1.5 px-4"
                                onClick={() => triggerDeployment({ id: req.id, fmId: assignment.assigned_person_user_id })}
                                disabled={isTriggering}
                              >
                                {status === 'assigned' ? (
                                  <><Play className="h-3 w-3 fill-current" /> START SITE VISIT</>
                                ) : (
                                  <><RotateCcw className="h-3 w-3" /> RE-TRIGGER VISIT</>
                                )}
                              </Button>
                            )}
                            {status === 'visit_in_progress' && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="text-[10px] uppercase font-bold tracking-widest h-7 gap-1.5 px-4"
                                onClick={() => setStopOpen(true)}
                                disabled={isStopping}
                              >
                                <AlertTriangle className="h-3 w-3" />
                                HALT MISSION
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-[10px] uppercase font-bold tracking-widest h-7 border-primary/20 hover:bg-primary/10 px-4"
                              onClick={() => setSmoOpen(true)}
                            >
                              {assignment ? 'Change Manager' : 'Assign Manager'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/20">
                          <User className="h-4 w-4 text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{assignment.assigned_person_name || 'Assigned Officer'}</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                            {assignment.assigned_person_phone || 'Phone not provided'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
               )}

               {/* Visit Action Button */}
               {canSubmitDailyReport && assignment && (
                 <div className="space-y-4">
                   {/* Field Work Mode Controls (FM Only) */}
                   {isFM && (status === 'assigned' || status === 'visit_in_progress') && (
                     <div className="space-y-4">
                       <Button
                         className={cn(
                           "w-full h-auto py-5 relative overflow-hidden group border-none transition-all duration-500",
                           req.status === 'assigned'
                             ? "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_0_30px_-10px_rgba(59,130,246,0.5)] hover:shadow-[0_0_40px_-5px_rgba(59,130,246,0.6)]"
                             : "bg-gradient-to-r from-purple-600 to-indigo-600 shadow-[0_0_30px_-10px_rgba(147,51,234,0.5)] hover:shadow-[0_0_40px_-5px_rgba(147,51,234,0.6)]"
                         )}
                         onClick={() => navigate(`/site-visit-daily-report/${assignment?.id}`)}
                       >
                         <div className="flex items-center justify-center gap-3">
                           <Compass className={cn("h-5 w-5", req.status === 'assigned' ? "animate-bounce" : "")} />
                           <div className="text-left">
                             <p className="text-[13px] leading-none uppercase tracking-tighter">
                               {req.status === 'assigned' ? 'Enter Field Work Mode' : 'Continue Daily Report'}
                             </p>
                             <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mt-1">
                               {req.status === 'assigned' ? 'Activate Start Site Visit' : 'Manage Travel & Sessions'}
                             </p>
                           </div>
                         </div>
                         <div className="absolute inset-0 rounded-2xl bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                       </Button>

                       {req.status === 'assigned' && (
                         <div className="bg-amber-950/30 border border-amber-800/30 rounded-xl p-3 flex items-start gap-3">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-amber-200/80 leading-relaxed font-medium">
                               Site visit is currently <span className="text-white font-bold">READY TO START</span>. Click the button above to activate the mobile dashboard and start your travel timer.
                            </p>
                         </div>
                       )}
                     </div>
                   )}
                 </div>
               )}
               </div>
            </div>
          </TabsContent>

          <TabsContent value="sla" className="mt-0 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {slas.length === 0 && (
                 <Card className="col-span-2 glass-card border-zinc-800/50 py-20">
                    <div className="text-center space-y-4">
                       <div className="h-16 w-16 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto shadow-inner">
                          <Lock className="h-8 w-8 text-zinc-700" />
                       </div>
                       <div>
                          <p className="text-white font-black italic uppercase tracking-tighter">Monitoring Offline</p>
                          <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest mt-1">SLA tracking initiates post-SMO verification</p>
                       </div>
                    </div>
                 </Card>
               )}
               {slas.sort((a,b) => a.sla_number - b.sla_number).map((sla) => <SLATimerBadge key={sla.id} sla={sla} />)}
            </div>
          </TabsContent>

          <TabsContent value="reports" className="mt-0 space-y-6">
            {/* Timeline Section */}
            {timelineEntries.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Workflow Timeline</p>
                <div className="relative pl-6 border-l-2 border-zinc-800/50 space-y-4">
                  {(timelineEntries as any[]).map((entry: any) => {
                    const actionConfig: Record<string, { color: string; label: string; icon: typeof CheckCircle }> = {
                      'SUBMITTED': { color: 'bg-blue-500', label: 'Request Submitted', icon: Forward },
                      'SMO_ASSIGNED': { color: 'bg-emerald-500', label: 'SMO Assigned to FM', icon: CheckCircle },
                      'SMO_FORWARDED': { color: 'bg-amber-500', label: 'Forwarded for Allocation', icon: Forward },
                      'SMO_RETURNED': { color: 'bg-red-500', label: 'Returned to RSH', icon: RotateCcw },
                      'VISIT_STARTED': { color: 'bg-blue-400', label: 'Visit Started', icon: MapPin },
                      'VISIT_COMPLETED': { color: 'bg-emerald-400', label: 'Visit Completed', icon: CheckCircle },
                      'REPORT_UPLOADED': { color: 'bg-indigo-500', label: 'Report Uploaded', icon: FileText },
                      'SELF_ASSIGNED': { color: 'bg-purple-500', label: 'Self-Assigned by FM', icon: User },
                    };
                    const cfg = actionConfig[entry.action] || { color: 'bg-zinc-600', label: entry.action?.replace(/_/g, ' '), icon: Clock };
                    const EntryIcon = cfg.icon;

                    return (
                      <div key={entry.id} className="relative group">
                        {/* Dot on timeline */}
                        <div className={cn('absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-zinc-950 shadow-lg', cfg.color)} />
                        <Card className="glass-card border-zinc-800/30 hover:border-zinc-700/50 transition-all">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className={cn('p-2 rounded-xl bg-zinc-900 border border-zinc-800')}>
                                  <EntryIcon className={cn('h-4 w-4', cfg.color.replace('bg-', 'text-'))} />
                                </div>
                                <div>
                                  <p className="text-sm font-black text-white italic uppercase tracking-tight">{cfg.label}</p>
                                  <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                                    by <span className="text-zinc-400 font-bold">{entry.performed_by_name}</span>
                                    <span className="text-zinc-700 mx-2">•</span>
                                    <span className="text-zinc-600">{entry.performed_by_role?.toUpperCase()}</span>
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono text-zinc-600 shrink-0">
                                {format(new Date(entry.created_at), 'd MMM yyyy, HH:mm')}
                              </span>
                            </div>
                            {entry.details?.remarks && (
                              <div className="mt-3 p-3 bg-zinc-950/50 border border-zinc-900/50 rounded-xl">
                                <p className="text-xs text-zinc-400 italic leading-relaxed">"{entry.details.remarks}"</p>
                              </div>
                            )}
                            {entry.details?.reason && (
                              <div className="mt-3 p-3 bg-red-950/20 border border-red-900/30 rounded-xl">
                                <p className="text-xs text-red-400 italic leading-relaxed">Return Reason: "{entry.details.reason}"</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Session Reports Section */}
            {sessionReports.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Daily Session Progress</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {['morning', 'afternoon', 'evening'].map((sType) => {
                    const session = sessionReports.find(s => s.session_type === sType);
                    const config = SESSION_CONFIG[sType as SessionType];
                    const Icon = config.icon;

                    return (
                      <Card key={sType} className={cn(
                        "glass-card border-zinc-800/30 transition-all overflow-hidden",
                        session ? "opacity-100" : "opacity-40 grayscale"
                      )}>
                        <div className={cn("p-4 border-b border-zinc-800/50 flex items-center justify-between", config.bg)}>
                          <div className="flex items-center gap-2">
                            <Icon className={cn("h-4 w-4", config.color)} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white">{config.label}</span>
                          </div>
                          <Badge variant="outline" className={cn(
                            "text-[8px] font-black uppercase px-1.5 py-0",
                            session ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-800/50 text-zinc-500 border-zinc-800"
                          )}>
                            {session ? "COMPLETED" : "PENDING"}
                          </Badge>
                        </div>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                             <Clock className="h-3 w-3 text-zinc-600" />
                             <span className="text-[9px] font-bold text-zinc-500 uppercase">{config.time}</span>
                          </div>
                          {session && (
                            <div className="space-y-2">
                              <p className="text-[11px] text-zinc-400 leading-relaxed italic line-clamp-2">"{session.work_summary}"</p>
                              <div className="flex items-center gap-1.5 opacity-60">
                                <MapPin className="h-3 w-3 text-blue-500" />
                                <span className="text-[9px] font-bold text-zinc-600 truncate">{session.site_location_title || 'At Site'}</span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Daily Reports Section */}
            {dailyReports.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Daily Field Reports</p>
                <div className="grid grid-cols-1 gap-4">
                  {(dailyReports as any[]).map((report) => (
                    <Card key={report.id} className="glass-card border-zinc-800/30 hover:bg-white/5 transition-all">
                      <CardContent className="p-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <span className="text-blue-400 font-black italic text-lg tracking-tighter uppercase">DAY {report.visit_day_number}</span>
                              <div className="h-1 w-1 bg-zinc-800 rounded-full" />
                              <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{format(new Date(report.report_date), 'd MMMM yyyy')}</span>
                            </div>
                            <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                              <Clock className="h-3 w-3" /> {report.login_time} — {report.logout_time} <span className="text-zinc-800 font-black">({report.total_hours_on_site}H TOTAL)</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {report.is_late_submission && <Badge variant="outline" className="border-amber-500/20 text-amber-500 bg-amber-500/5 italic font-black text-[9px] px-2 py-0.5 uppercase">Late Entry</Badge>}
                            {report.is_visit_complete && <Badge variant="outline" className="border-emerald-500/20 text-emerald-500 bg-emerald-500/5 italic font-black text-[9px] px-2 py-0.5 uppercase">Finalized</Badge>}
                          </div>
                        </div>
                        <div className="mt-4 p-4 bg-zinc-950/30 border border-zinc-900/50 rounded-xl">
                          <p className="text-zinc-300 text-sm leading-relaxed italic line-clamp-3">"{report.work_summary}"</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {totalActivityCount === 0 && (
              <div className="text-center py-20 opacity-20 scale-110">
                <Clock className="h-12 w-12 text-zinc-500 mx-auto mb-4" />
                <p className="text-sm font-black italic uppercase tracking-widest">No Activity Records</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="deliverables" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Deliverable Items - Refactored as Cards */}
               {[
                  {
                    title: 'Site Evaluation Report',
                    statusField: 'report_submitted_at',
                    urlField: 'site_visit_report_url',
                    canUpload: canUploadReport,
                    uploadFn: (url: string) => uploadReport({ requestId: requestId!, reportUrl: url }),
                    generateFn: () => generateSiteVisitDocx(req, dailyReports, sessionReports),
                    urlState: reportUrl,
                    setUrl: setReportUrl,
                    slaNo: 2,
                    lockDesc: 'Requires visit completion',
                    bucket: 'site_visit_reports',
                  },
                  {
                    title: 'Commercial Quotation',
                    statusField: 'quotation_submitted_at',
                    urlField: 'quotation_url',
                    canUpload: canUploadQuotation,
                    uploadFn: (url: string) => uploadQuotation({ requestId: requestId!, quotationUrl: url }),
                    urlState: quotationUrl,
                    setUrl: setQuotationUrl,
                    slaNo: 3,
                    lockDesc: 'Requires report submission',
                    showOnlyFor: ['rental', 'polyhouse']
                  },
                  {
                    title: 'Technical Soil & Water Analysis',
                    statusField: 'soil_water_submitted_at',
                    urlField: 'soil_water_report_url',
                    canUpload: canUploadSoilWater,
                    uploadFn: (url: string) => uploadSoilWater({ requestId: requestId!, reportUrl: url }),
                    urlState: soilWaterUrl,
                    setUrl: setSoilWaterUrl,
                    slaNo: 4,
                    lockDesc: 'Requires visit completion',
                    bucket: 'soil_water_reports'
                  }
                ].filter((item: any) => !item.showOnlyFor || item.showOnlyFor.includes(req.visit_category?.toLowerCase())).map((item) => (
                 <Card key={item.title} className={cn('glass-card border-zinc-800/50 relative overflow-hidden', !item.canUpload && !(req as any)[item.statusField] && 'opacity-60 grayscale')}>
                    {!item.canUpload && !(req as any)[item.statusField] && (
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] z-10 flex items-center justify-center">
                           <Lock className="h-6 w-6 text-zinc-700" />
                        </div>
                    )}
                    <CardHeader className="pb-4 border-b border-white/5 bg-white/[0.01]">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                               <p className="text-[10px] font-black italic tracking-widest text-zinc-500 uppercase leading-none mb-1">Deliverable Artifact</p>
                               <CardTitle className="text-sm font-black text-white uppercase tracking-tighter">{item.title}</CardTitle>
                            </div>
                            {item.generateFn && (
                               <Button 
                                 variant="ghost" 
                                 size="sm" 
                                 className="h-8 text-[10px] font-black text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 uppercase tracking-widest rounded-xl"
                                 onClick={() => item.generateFn()}
                               >
                                  <FileDown className="h-3 w-3 mr-1.5" /> GENERATE DOCX
                               </Button>
                            )}
                        </div>
                     </CardHeader>
                     <CardContent className="pt-6">
                         <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                               <div className="h-10 w-10 bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800 overflow-hidden">
                                  {(req as any)[item.statusField] ? (
                                     <div className="h-full w-full bg-emerald-500/20 flex items-center justify-center">
                                        <FileText className="h-5 w-5 text-emerald-500" />
                                     </div>
                                  ) : (
                                     <FileText className="h-5 w-5 text-zinc-700" />
                                  )}
                               </div>
                               <div>
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">SLA Requirement</p>
                                  <p className="text-xs font-black italic text-zinc-600 uppercase">Artifact SLA-{item.slaNo}</p>
                               </div>
                            </div>
                            {req[item.statusField as keyof typeof req] && <div className="h-8 w-8 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]"><CheckCircle className="h-4 w-4 text-emerald-500" /></div>}
                         </div>

                         {(req as any)[item.urlField] ? (
                           <div className="flex gap-2">
                             <Button asChild variant="outline" className="flex-1 bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold text-xs h-12 rounded-xl">
                                <a href={(req as any)[item.urlField]} target="_blank">
                                   <ExternalLink className="h-3 w-3 mr-2" /> VIEW MANIFEST
                                </a>
                             </Button>
                             {item.canUpload && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => item.setUrl('')}
                                  className="h-12 w-12 bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-red-400 rounded-xl"
                                >
                                   <RotateCcw className="h-4 w-4" />
                                </Button>
                             )}
                           </div>
                         ) : item.canUpload ? (
                           <div className="space-y-3 translate-y-2">
                             {item.bucket ? (
                                <div
                                  className="relative group cursor-pointer"
                                  onClick={() => document.getElementById(`file-upload-${item.title}`)?.click()}
                                >
                                  <input
                                    type="file"
                                    id={`file-upload-${item.title}`}
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;

                                      const toastId = toast.loading(`Vaulting ${file.name}...`);
                                      try {
                                        const filePath = `${requestId}/${Date.now()}_${file.name}`;
                                        const { data, error } = await supabase.storage
                                          .from(item.bucket)
                                          .upload(filePath, file);

                                        if (error) throw error;

                                        const { data: { publicUrl } } = supabase.storage
                                          .from(item.bucket)
                                          .getPublicUrl(data.path);

                                        await item.uploadFn(publicUrl);
                                        toast.success('Vault Acquisition Complete', { id: toastId });
                                      } catch (err: any) {
                                        toast.error(err.message, { id: toastId });
                                      }
                                    }}
                                  />
                                  <div className="h-24 w-full border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-2 group-hover:border-blue-500/50 group-hover:bg-blue-500/[0.02] transition-all">
                                     <Upload className="h-6 w-6 text-zinc-700 group-hover:text-blue-500 transition-colors" />
                                     <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 group-hover:text-zinc-400">Secure Direct Upload (DOCX/PDF)</p>
                                  </div>
                                </div>
                             ) : (
                               <div className="space-y-2">
                                <Input
                                  value={item.urlState}
                                  onChange={(e) => item.setUrl(e.target.value)}
                                  placeholder="Google Drive Transmission Link..."
                                  className="bg-zinc-950/50 border-zinc-800 text-white text-xs h-10 rounded-lg placeholder:text-zinc-700"
                                />
                                <Button
                                  onClick={() => item.uploadFn(item.urlState)}
                                  disabled={!item.urlState}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black italic h-10 rounded-lg shadow-lg shadow-blue-500/10"
                                >
                                  <Upload className="h-3.5 w-3.5 mr-2" /> TRANSMIT ARTIFACT
                                </Button>
                               </div>
                             )}
                           </div>
                         ) : (
                           <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest text-center mt-4 italic">{item.lockDesc}</p>
                         )}
                     </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* MODALS - Upgraded to match premium look */}
      <Dialog open={smoOpen} onOpenChange={setSmoOpen}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl p-8 max-w-md">
          <DialogHeader className="mb-6">
            <div className="h-12 w-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/10 mb-4 mx-auto">
               <Shield className="h-6 w-6 text-blue-500" />
            </div>
            <DialogTitle className="text-xl font-black italic text-white uppercase text-center tracking-tighter">Command Review</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Review Directives</label>
              <Textarea 
                value={smoRemarks}
                onChange={(e) => setSmoRemarks(e.target.value)}
                placeholder="Enter feedback or return reason..."
                className="bg-zinc-900 border-zinc-800 text-white rounded-xl placeholder:text-zinc-700 italic focus:ring-blue-500/20"
                rows={4} 
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Combat Unit Assignment (Optional)</label>
              <Select value={selectedFM} onValueChange={setSelectedFM}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white rounded-xl h-11 italic font-bold">
                  <SelectValue placeholder="Select Field Officer" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="none_clear" className="italic font-bold">No Direct Assignment</SelectItem>
                  {farmManagers.map(fm => (
                    <SelectItem key={fm.id} value={fm.id} className="font-bold">{fm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={handleSMOReturn} disabled={isReturning} className="flex-1 border-red-900/40 text-red-500 hover:bg-red-500/10 h-12 rounded-xl font-black italic">
              {isReturning ? 'PENDING...' : 'RETURN TO RSH'}
            </Button>
            <Button onClick={handleSMOForward} disabled={isForwarding} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl font-black italic">
              {isForwarding ? 'PENDING...' : 'FORWARD TO OPS'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept Dialog */}
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl p-8 max-w-md">
          <DialogHeader className="mb-6 text-center">
            <DialogTitle className="text-xl font-black italic text-white uppercase tracking-tighter">Accept Assignment</DialogTitle>
            <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest mt-1 italic">Confirming deployment for {req.request_number}</p>
          </DialogHeader>
          
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Target Engagement Date</label>
              <Input 
                 type="date" 
                 value={acceptForm.expectedVisitDate}
                 onChange={(e) => setAcceptForm(p => ({ ...p, expectedVisitDate: e.target.value }))}
                 className="bg-zinc-900 border-zinc-800 text-white rounded-xl h-11 font-bold" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Deployment Strategy</label>
              <Textarea 
                value={acceptForm.visitInstructions}
                onChange={(e) => setAcceptForm(p => ({ ...p, visitInstructions: e.target.value }))}
                placeholder="Methodology for this specific site..."
                className="bg-zinc-900 border-zinc-800 text-white rounded-xl placeholder:text-zinc-700 italic"
                rows={3} 
              />
            </div>
          </div>

          <DialogFooter className="mt-8 gap-3">
             <Button variant="ghost" onClick={() => setAcceptOpen(false)} className="text-zinc-500 hover:text-white font-bold uppercase tracking-widest text-[10px]">ABORT</Button>
             <Button onClick={handleAccept} disabled={isSelfAssigning} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl font-black italic">
               {isSelfAssigning ? 'COMMITTING...' : 'COMMIT TO OPERATION'}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Halt Mission Dialog */}
      <Dialog open={stopOpen} onOpenChange={setStopOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500 font-black italic uppercase tracking-wider">
              <AlertTriangle className="h-5 w-5" /> Halt Field Mission
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
              Are you sure you want to halt this mission? The request will be placed <span className="text-white font-bold uppercase">On Hold</span> and the Farm Manager will be notified of the deviation.
            </p>
            <textarea
              className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder:text-zinc-700 resize-none"
              placeholder="Reason for halting mission (deviation details)..."
              value={stopReason}
              onChange={(e) => setStopReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStopOpen(false)} className="text-xs font-bold uppercase">Cancel</Button>
            <Button 
              disabled={!stopReason || isStopping}
              onClick={async () => {
                await stopDeployment({ 
                  id: requestId!, 
                  reason: stopReason,
                  fmId: assignment?.assigned_person_user_id 
                });
                setStopOpen(false);
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-black italic uppercase px-6"
            >
              Halt Mission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
