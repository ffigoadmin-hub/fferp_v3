import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertTriangle, MapPin, Camera, ArrowLeft, Clock, CheckCircle, Navigation,
  Car, Play, Square, Timer, Milestone, Sun, Sunset, Moon, Loader2, MapPinned,
  Route, Send, FileText, LogOut, Home, Plus, Trash2, FileBarChart, RotateCcw,
  FileCheck, Activity
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteVisitDailyReport } from '@/hooks/useSiteVisitDailyReport';
import { useSiteVisitTravel, useActiveTravelLog, useTravelLogs, haversineDistance } from '@/hooks/useSiteVisitTravel';
import { useSiteVisitSessionReport, useSessionReports, type SessionType } from '@/hooks/useSiteVisitSessionReport';
import { useAllSiteVisitRequests } from '@/hooks/useSiteVisitRequests';
import { SiteVisitPhotoUpload } from '@/components/site-visit/SiteVisitPhotoUpload';
import { cn } from '@/lib/utils';
import { format, differenceInSeconds } from 'date-fns';
import { toast } from 'sonner';

// ─── GPS Helper ──────────────────────────────────────────────
function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 30000, maximumAge: 0,
    });
  });
}

// ─── Timer display helper ────────────────────────────────────
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const TRAVEL_MODES = [
  { value: 'own_vehicle', label: 'Own Vehicle', icon: '🏍️' },
  { value: 'company_vehicle', label: 'Company Vehicle', icon: '🚗' },
  { value: 'public_transport', label: 'Public Transport', icon: '🚌' },
  { value: 'cab', label: 'Cab / Taxi', icon: '🚕' },
  { value: 'train', label: 'Train', icon: '🚆' },
];

const SESSION_CONFIG: Record<SessionType, { label: string; time: string; icon: typeof Sun; color: string; bg: string; border: string }> = {
  morning: { label: 'Morning', time: '6:00 AM – 12:00 PM', icon: Sun, color: 'text-amber-400', bg: 'bg-amber-950/30', border: 'border-amber-800/30' },
  afternoon: { label: 'Afternoon', time: '12:00 PM – 5:00 PM', icon: Sunset, color: 'text-orange-400', bg: 'bg-orange-950/30', border: 'border-orange-800/30' },
  evening: { label: 'Evening', time: '5:00 PM – 9:00 PM', icon: Moon, color: 'text-blue-400', bg: 'bg-blue-950/30', border: 'border-blue-800/30' },
};

// ─── TABS ────────────────────────────────────────────────────
type TabKey = 'transport' | 'report' | 'sessions';
const GLOBAL_TODAY = format(new Date(), 'yyyy-MM-dd');

export function SiteVisitDailyReportPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('transport');

  // Data hooks
  const { data: allRequests = [] } = useAllSiteVisitRequests();
  const req = allRequests.find((r) =>
    (r as any).site_visit_assignments?.some((a: any) => a.id === assignmentId)
  );
  const assignment = (req as any)?.site_visit_assignments?.find((a: any) => a.id === assignmentId);

  const TABS: { key: TabKey; label: string; icon: typeof Car }[] = [
    { key: 'transport', label: 'Transport', icon: Route },
    { key: 'report', label: 'Site Report', icon: FileText },
    { key: 'sessions', label: 'Sessions', icon: Sun },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[80px] rounded-full" />
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5 relative z-10">
        {/* Header Section */}
        <div className="flex items-center justify-between gap-4 p-4 bg-card/80 backdrop-blur-xl border border-border rounded-2xl shadow-2xl">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-black text-foreground uppercase italic tracking-[0.1em] flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Active Site Visit Dashboard
            </h1>
            <p className="text-muted-foreground text-[10px] font-black tracking-[0.2em] uppercase truncate pl-3.5 mt-0.5">
              {req?.request_number || 'SVR-....'} — {req?.location_title || 'Location Loading...'}
            </p>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/login');
              }}
              className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 gap-2 h-8 px-3 uppercase text-[9px] font-black tracking-widest border border-border/50 rounded-lg transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </Button>
          </div>
        </div>

        {/* Tab Navigation Controller */}
        <div className="flex p-1 bg-card/60 backdrop-blur-xl border border-border rounded-xl shadow-inner">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all duration-300 relative group",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="active_tab_glimmer"
                    className="absolute inset-0 bg-primary/10 rounded-lg border border-primary/20"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={cn("h-4 w-4 relative z-10", isActive ? "animate-pulse" : "group-hover:scale-110 transition-transform")} />
                <span className="text-[10px] uppercase tracking-[0.15em] font-black relative z-10 hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'transport' && (
          <TransportTab assignmentId={assignmentId!} requestId={req?.id} />
        )}
        {activeTab === 'report' && (
          <DailyReportTab
            assignmentId={assignmentId!}
            req={req}
            assignment={assignment}
          />
        )}
        {activeTab === 'sessions' && (
          <SessionsTab assignmentId={assignmentId!} requestId={req?.id} />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: Transport Tracker
// ═══════════════════════════════════════════════════════════════
function TransportTab({ assignmentId, requestId }: { assignmentId: string; requestId?: string }) {
  const { startTravel, stopTravel, isStarting, isStopping } = useSiteVisitTravel();
  const { data: activeLog } = useActiveTravelLog(assignmentId);
  const { data: allLogs = [] } = useTravelLogs(assignmentId);
  const [selectedMode, setSelectedMode] = useState('own_vehicle');
  const [elapsed, setElapsed] = useState(0);

  // Live timer
  useEffect(() => {
    if (!activeLog) { setElapsed(0); return; }
    const tick = () => setElapsed(differenceInSeconds(new Date(), new Date(activeLog.started_at)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeLog]);

  const handleStart = async () => {
    if (!requestId) { toast.error('Request not found'); return; }
    await startTravel({ assignmentId, requestId, travelingMode: selectedMode });
  };

  const handleStop = async () => {
    if (!activeLog) return;
    await stopTravel({ logId: activeLog.id });
  };

  const totalMinutes = allLogs
    .filter((l) => l.duration_minutes)
    .reduce((sum, l) => sum + (l.duration_minutes || 0), 0);

  const totalDistance = allLogs.reduce((sum, l) => {
    if (l.distance_km) return sum + l.distance_km;
    if (l.start_lat && l.start_lng && l.end_lat && l.end_lng) {
      return sum + haversineDistance(l.start_lat, l.start_lng, l.end_lat, l.end_lng);
    }
    return sum;
  }, 0);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Control Card */}
      <Card className="bg-card/60 border-border/50 overflow-hidden">
        <CardContent className="p-0">
          {/* Timer display */}
          <div className={cn(
            'p-10 text-center transition-all duration-700 relative overflow-hidden',
            activeLog ? 'bg-gradient-to-b from-primary/10 via-primary/5 to-transparent' : 'bg-gradient-to-b from-card/40 to-transparent'
          )}>
            {/* Dynamic Glow Effect */}
            {activeLog && (
              <div className="absolute inset-0 bg-primary/5 animate-pulse" />
            )}
            
            <div className={cn(
              'text-6xl font-mono font-black tracking-[-0.05em] tabular-nums mb-3 transition-all duration-500 relative z-10',
              activeLog ? 'text-primary drop-shadow-[0_0_15px_hsl(var(--primary)/0.3)] scale-110' : 'text-muted-foreground/30'
            )}>
              {activeLog ? formatDuration(elapsed) : "00:00:00"}
            </div>
            
            <div className="flex flex-col items-center gap-1.5 relative z-10">
              <p className={cn(
                "text-[10px] font-black uppercase tracking-[0.4em] transition-colors duration-500",
                activeLog ? "text-primary" : "text-muted-foreground"
              )}>
                {activeLog ? '• DEPLOYMENT IN PROGRESS •' : 'READY FOR DEPLOYMENT'}
              </p>
              
              {activeLog && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">
                    {TRAVEL_MODES.find((m) => m.value === activeLog.traveling_mode)?.label}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-5 space-y-4 border-t border-border/30">
            {!activeLog ? (
              <>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                    Select Travel Mode
                  </label>
                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-2">
                    {TRAVEL_MODES.map((mode) => {
                      const isSelected = selectedMode === mode.value;
                      return (
                        <button
                          key={mode.value}
                          onClick={() => setSelectedMode(mode.value)}
                          className={cn(
                            "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-300 relative group overflow-hidden",
                            isSelected 
                              ? "bg-primary/10 border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.1)]" 
                              : "bg-background border-border hover:border-muted-foreground/30"
                          )}
                        >
                          <span className={cn(
                            "text-xl transition-transform group-hover:scale-125 duration-300",
                            isSelected ? "scale-110" : "grayscale opacity-50"
                          )}>
                            {mode.icon}
                          </span>
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-widest text-center leading-tight",
                            isSelected ? "text-primary" : "text-muted-foreground"
                          )}>
                            {mode.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Start Deployment */}
                <Button 
                  size="lg" 
                  className="w-full h-14 uppercase font-black tracking-[0.2em] text-xs gap-3 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 border-t border-white/10 group active:scale-95 transition-all"
                  onClick={handleStart}
                  disabled={isStarting}
                >
                  {isStarting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-current group-hover:translate-x-1 transition-transform" />
                      INITIATE TRAVEL PHASE
                    </>
                  )}
                </Button>
              </>
            ) : (
              /* Stop Deployment */
              <Button 
                size="lg" 
                variant="destructive"
                className="w-full h-14 uppercase font-black tracking-[0.2em] text-xs gap-3 bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-xl shadow-destructive/20 border-t border-white/10 group active:scale-95 transition-all"
                onClick={handleStop}
                disabled={isStopping}
              >
                {isStopping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Square className="h-4 w-4 fill-current group-hover:scale-110 transition-transform" />
                    TERMINATE TRAVEL LOG
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="bg-card/40 border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Travel</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-lg font-mono font-black text-foreground">
                  {Math.floor(totalMinutes / 60)}h {Math.round(totalMinutes % 60)}m
                </span>
                <p className="text-[9px] text-muted-foreground uppercase">Duration</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-mono font-black text-primary">
                  {totalDistance.toFixed(1)} km
                </span>
                <p className="text-[9px] text-muted-foreground uppercase">Distance</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Travel History */}
      {allLogs.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Milestone className="h-3 w-3" /> Travel Log
          </p>
          {allLogs.map((log) => {
            const mode = TRAVEL_MODES.find((m) => m.value === log.traveling_mode);
            // Calculate distance client-side as fallback
            let dist: number | null = log.distance_km ?? null;
            if (!dist && log.start_lat && log.start_lng && log.end_lat && log.end_lng) {
              dist = parseFloat(haversineDistance(log.start_lat, log.start_lng, log.end_lat, log.end_lng).toFixed(2));
            }
            return (
              <div key={log.id} className="bg-card/30 border border-border/30 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{mode?.icon || '🚗'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground font-bold">{mode?.label || log.traveling_mode}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(log.started_at), 'h:mm a')}
                      {log.ended_at ? ` → ${format(new Date(log.ended_at), 'h:mm a')}` : ' → In Progress'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {dist !== null && (
                      <span className="text-xs font-mono font-black text-primary tabular-nums">
                        {dist} km
                      </span>
                    )}
                    <span className="text-xs font-mono font-bold text-muted-foreground tabular-nums">
                      {log.duration_minutes ? `${Math.round(log.duration_minutes)}m` : '—'}
                    </span>
                  </div>
                </div>
                {/* GPS Details Row */}
                {(log.start_lat || log.end_lat) && (
                  <div className="flex items-center gap-4 pl-8 text-[9px] font-mono text-muted-foreground/70">
                    {log.start_lat && (
                      <span className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {log.start_lat.toFixed(5)}, {log.start_lng?.toFixed(5)}
                      </span>
                    )}
                    {log.end_lat && (
                      <span className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        {log.end_lat.toFixed(5)}, {log.end_lng?.toFixed(5)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: Enhanced Daily Report
// ═══════════════════════════════════════════════════════════════
function DailyReportTab({ assignmentId, req, assignment }: { assignmentId: string; req: any; assignment: any }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { submitReport, isSubmitting } = useSiteVisitDailyReport();
  const isSMOorCEO = user?.role === 'smo' || user?.role === 'ceo';

  const [form, setForm] = useState({
    report_date: GLOBAL_TODAY,
    visit_day_number: 1,
    login_time: '',
    logout_time: '',
    site_location_title: req?.location_title || '',
    site_location_address: req?.address || '',
    location_lat: '',
    location_lng: '',
    location_accuracy_meters: '',
    additional_sites: [] as {
      title: string;
      address: string;
      lat: string;
      lng: string;
      accuracy: string;
    }[],
    geotagged_image_urls: [] as string[],
    work_summary: '',
    site_observations: '',
    challenges_faced: '',
    next_day_plan: '',
    is_visit_complete: false,
    traveling_mode: '',
    itc_data_available: false,
    itc_remarks: '',
    itc_document_url: '',
    itc_data_reference: '',
    is_rental_polyhouse_visit: false,
    report_docx_url: '',
    soil_water_test_report_url: '',
  });
  const [isFetchingGPS, setIsFetchingGPS] = useState(false);
  const [isFetchingSitesGPS, setIsFetchingSitesGPS] = useState<Record<number, boolean>>({});
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Load Draft
  useEffect(() => {
    const saved = localStorage.getItem(`site_report_draft_${assignmentId}`);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setForm(prev => ({ ...prev, ...draft }));
        toast.info("Draft restored from previous session");
      } catch (e) {
        console.error("Failed to restore draft", e);
      }
    }
  }, [assignmentId]);

  // Save Draft
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(`site_report_draft_${assignmentId}`, JSON.stringify(form));
      setLastSaved(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearTimeout(timer);
  }, [form, assignmentId]);

  const wordCount = form.work_summary.trim().length;
  const hasTimes = form.login_time && form.logout_time;
  const timesValid = hasTimes && form.login_time < form.logout_time;
  const hasLocation = form.site_location_title && form.site_location_address;
  const hasGPS = form.location_lat && form.location_lng;
  const hasPhotos = form.geotagged_image_urls.length >= 2;
  const hasSummary = wordCount >= 100;

  const isValid = timesValid && hasLocation && hasPhotos && hasSummary;

  const getMissingReqs = () => {
    const reqs = [];
    if (!hasTimes) reqs.push("Enter login & logout times");
    else if (!timesValid) reqs.push("Logout time must be after login");
    if (!hasLocation) reqs.push("Site Title & Address required");
    if (!hasGPS) reqs.push("Fetch GPS for Site 1");
    if (!hasPhotos) reqs.push(`Photo requirement: ${form.geotagged_image_urls.length}/2`);
    if (!hasSummary) reqs.push(`Summary: ${wordCount}/100 characters`);
    return reqs;
  };

  const fetchGPS = useCallback(async () => {
    setIsFetchingGPS(true);
    try {
      const pos = await getCurrentPosition();
      setForm((p) => ({
        ...p,
        location_lat: pos.coords.latitude.toFixed(7),
        location_lng: pos.coords.longitude.toFixed(7),
        location_accuracy_meters: pos.coords.accuracy.toFixed(1),
      }));
      toast.success(`Site 1 GPS acquired (±${pos.coords.accuracy.toFixed(0)}m)`);
    } catch (err: any) {
      toast.error('GPS failed: ' + (err?.message || 'Permission denied'));
    } finally {
      setIsFetchingGPS(false);
    }
  }, []);

  const addSite = () => {
    setForm(prev => ({
      ...prev,
      additional_sites: [
        ...prev.additional_sites,
        { title: '', address: '', lat: '', lng: '', accuracy: '' }
      ]
    }));
  };

  const removeSite = (index: number) => {
    setForm(prev => ({
      ...prev,
      additional_sites: prev.additional_sites.filter((_, i) => i !== index)
    }));
  };

  const updateSite = (index: number, field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      additional_sites: prev.additional_sites.map((site, i) =>
        i === index ? { ...site, [field]: value } : site
      )
    }));
  };

  const fetchGPSForSite = async (index: number) => {
    setIsFetchingSitesGPS(prev => ({ ...prev, [index]: true }));
    try {
      const pos = await getCurrentPosition();
      setForm(prev => ({
        ...prev,
        additional_sites: prev.additional_sites.map((site, i) =>
          i === index ? {
            ...site,
            lat: pos.coords.latitude.toFixed(7),
            lng: pos.coords.longitude.toFixed(7),
            accuracy: pos.coords.accuracy.toFixed(1)
          } : site
        )
      }));
      toast.success(`Site ${index + 2} GPS acquired`);
    } catch (err: any) {
      toast.error('GPS failed: ' + (err?.message || 'Permission denied'));
    } finally {
      setIsFetchingSitesGPS(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleSubmit = async (markComplete: boolean = false) => {
    if (!req || !assignment) { toast.error('Assignment not found'); return; }
    try {
      // Build site observations with all additional sites data
      let siteObservations = form.site_observations || '';
      if (form.additional_sites.length > 0) {
        form.additional_sites.forEach((site, index) => {
          if (site.title) {
            const siteData = `\n\n--- Site ${index + 2} ---\nTitle: ${site.title}\nAddress: ${site.address}\nGPS: ${site.lat || 'N/A'}, ${site.lng || 'N/A'} (±${site.accuracy || 'N/A'}m)`;
            siteObservations += siteData;
          }
        });
      }

      await submitReport({
        request_id: req.id,
        assignment_id: assignmentId,
        report_date: form.report_date,
        visit_day_number: form.visit_day_number,
        login_time: form.login_time,
        logout_time: form.logout_time,
        site_location_title: form.site_location_title,
        site_location_address: form.site_location_address,
        location_lat: form.location_lat ? parseFloat(form.location_lat) : undefined,
        location_lng: form.location_lng ? parseFloat(form.location_lng) : undefined,
        location_accuracy_meters: form.location_accuracy_meters ? parseFloat(form.location_accuracy_meters) : undefined,
        geotagged_image_urls: form.geotagged_image_urls,
        work_summary: form.work_summary,
        site_observations: siteObservations || undefined,
        challenges_faced: form.challenges_faced || undefined,
        next_day_plan: form.next_day_plan || undefined,
        is_visit_complete: markComplete,
        traveling_mode: form.traveling_mode || undefined,
        itc_data_available: form.itc_data_available,
        itc_remarks: form.itc_remarks || undefined,
        itc_document_url: form.itc_document_url || undefined,
        itc_data_reference: form.itc_data_reference || undefined,
        is_rental_polyhouse_visit: form.is_rental_polyhouse_visit,
        report_docx_url: form.report_docx_url || undefined,
        soil_water_test_report_url: form.soil_water_test_report_url || undefined,
      });
      localStorage.removeItem(`site_report_draft_${assignmentId}`);
      setCompleteConfirmOpen(false);
    } catch {}
  };

  const { data: sessionReports = [] } = useSessionReports(assignmentId);
  const todaySessions = sessionReports.filter(r => r.report_date === GLOBAL_TODAY);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* SMO Session Review Panel */}
      {isSMOorCEO && todaySessions.length > 0 && (
        <Card className="bg-emerald-950/20 border-emerald-800/30 animate-in fade-in duration-500 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16 rounded-full" />
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" /> Operations Review: {format(new Date(), 'dd MMM yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['morning', 'afternoon', 'evening'] as SessionType[]).map((type) => {
                const session = todaySessions.find(s => s.session_type === type);
                const config = SESSION_CONFIG[type];
                return (
                  <div key={type} className={cn(
                    "p-3 rounded-xl border transition-all duration-300",
                    session ? "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]" : "bg-zinc-900/30 border-zinc-800/50 opacity-40 grayscale-[0.5]"
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {config.icon && <config.icon className={cn("h-3.5 w-3.5", session ? "text-emerald-400" : "text-zinc-600")} />}
                        <span className={cn("text-[9px] font-black uppercase tracking-wider", session ? "text-white" : "text-zinc-500")}>
                          {type}
                        </span>
                      </div>
                      {session && <Badge className="bg-emerald-500/20 text-emerald-400 text-[8px] font-black border-none px-1.5 py-0 h-4">LIVE</Badge>}
                    </div>
                    {session ? (
                      <div className="space-y-2">
                        <p className="text-[10px] text-zinc-300 line-clamp-2 leading-relaxed italic font-medium">"{session.work_summary}"</p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[8px] border-emerald-500/30 text-emerald-500/70 font-black tracking-tight">
                            {session.photo_urls?.length || 0} ASSETS
                          </Badge>
                          <span className="text-[8px] text-zinc-600 font-mono font-bold">{session.session_start_time} - {session.session_end_time}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-center">
                        <p className="text-[8px] text-zinc-700 font-black uppercase tracking-[0.2em]">Pending Deployment</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Report Details */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Report Details
            </div>
            {lastSaved && (
              <span className="text-[9px] text-emerald-500 font-mono flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                Draft Saved: {lastSaved}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block font-bold uppercase tracking-widest">Date *</label>
              <Input type="date" value={form.report_date}
                onChange={(e) => setForm((p) => ({ ...p, report_date: e.target.value }))}
                className="bg-input border-border text-foreground" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block font-bold uppercase tracking-widest">Login *</label>
              <Input type="time" value={form.login_time}
                onChange={(e) => setForm((p) => ({ ...p, login_time: e.target.value }))}
                className="bg-input border-border text-foreground" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block font-bold uppercase tracking-widest">Logout *</label>
              <Input type="time" value={form.logout_time}
                onChange={(e) => setForm((p) => ({ ...p, logout_time: e.target.value }))}
                className="bg-input border-border text-foreground" />
            </div>
          </div>
          {form.login_time && form.logout_time && form.logout_time <= form.login_time && (
            <p className="text-red-400 text-xs flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Logout must be after login
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block font-bold uppercase tracking-widest">Day #</label>
              <Input type="number" min="1" value={form.visit_day_number}
                onChange={(e) => setForm((p) => ({ ...p, visit_day_number: parseInt(e.target.value) || 1 }))}
                className="bg-input border-border text-foreground w-24" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block font-bold uppercase tracking-widest">Travel Mode</label>
              <Select value={form.traveling_mode} onValueChange={(v) => setForm((p) => ({ ...p, traveling_mode: v }))}>
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {TRAVEL_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.icon} {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Site 1 Location with GPS */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Site 1 Location
            </span>
            <Button
              onClick={fetchGPS}
              disabled={isFetchingGPS}
              size="sm"
              className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20 text-[10px] font-bold h-7 px-3"
            >
              {isFetchingGPS ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Fetching...</>
              ) : (
                <><Navigation className="h-3 w-3 mr-1" /> Fetch GPS</>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-bold uppercase tracking-widest">Title *</label>
            <Input value={form.site_location_title}
              onChange={(e) => setForm((p) => ({ ...p, site_location_title: e.target.value }))}
              placeholder="Site / plot name" className="bg-input border-border text-foreground" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-bold uppercase tracking-widest">Address *</label>
            <Textarea value={form.site_location_address}
              onChange={(e) => setForm((p) => ({ ...p, site_location_address: e.target.value }))}
              rows={2} placeholder="Street, landmark..." className="bg-input border-border text-foreground" />
          </div>
          {form.location_lat && (
            <div className="bg-emerald-950/20 border border-emerald-800/20 rounded-xl px-3 py-2 flex items-center gap-3">
              <MapPinned className="h-4 w-4 text-emerald-400 shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-emerald-300 font-mono font-bold">
                  {form.location_lat}, {form.location_lng}
                </p>
                <p className="text-[9px] text-emerald-500/70">Accuracy: ±{form.location_accuracy_meters}m</p>
              </div>
              <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Sites */}
      {form.additional_sites.map((site, index) => (
        <Card key={index} className="bg-card/60 border-border/50 animate-in slide-in-from-left duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-amber-400" /> Site {index + 2} Location
              </span>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => fetchGPSForSite(index)}
                  disabled={isFetchingSitesGPS[index]}
                  size="sm"
                  className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/20 text-[10px] font-bold h-7 px-3"
                >
                  {isFetchingSitesGPS[index] ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Fetching...</>
                  ) : (
                    <><Navigation className="h-3 w-3 mr-1" /> Fetch GPS</>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeSite(index)}
                  className="h-7 w-7 p-0 rounded-full"
                >
                  <Trash2 className="h-3.3 w-3.5" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block font-bold uppercase tracking-widest">Title</label>
              <Input
                value={site.title}
                onChange={(e) => updateSite(index, 'title', e.target.value)}
                placeholder={`Site ${index + 2} name`}
                className="bg-input border-border text-foreground"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block font-bold uppercase tracking-widest">Address</label>
              <Textarea
                value={site.address}
                onChange={(e) => updateSite(index, 'address', e.target.value)}
                rows={2}
                placeholder="Street, landmark..."
                className="bg-input border-border text-foreground"
              />
            </div>
            {site.lat && (
              <div className="bg-amber-950/20 border border-amber-800/20 rounded-xl px-3 py-2 flex items-center gap-3">
                <MapPinned className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-amber-300 font-mono font-bold">
                    {site.lat}, {site.lng}
                  </p>
                  <p className="text-[9px] text-amber-500/70">Accuracy: ±{site.accuracy}m</p>
                </div>
                <CheckCircle className="h-4 w-4 text-amber-500 shrink-0" />
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Add Site Button */}
      <Button
        onClick={addSite}
        variant="outline"
        className="w-full border-dashed border-primary/30 text-primary hover:bg-primary/5 h-12 rounded-xl flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" /> Add Another Site
      </Button>

      {/* Geotagged Photos */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" /> Site Photos
            <span className="text-muted-foreground font-normal">(min 2)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SiteVisitPhotoUpload
            photos={form.geotagged_image_urls}
            onPhotosChange={(urls) => setForm((p) => ({ ...p, geotagged_image_urls: urls }))}
          />
        </CardContent>
      </Card>

      {/* Work Summary */}
      {/* Work Summary */}
      <Card className="bg-card/60 border-border/50 transition-all duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Work Summary *
            </div>
            <span className={cn(
              "text-[10px] font-mono font-bold",
              hasSummary ? "text-emerald-500" : "text-amber-500"
            )}>
              {wordCount}/100+ chars
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative group">
            <Textarea 
              value={form.work_summary}
              required
              onChange={(e) => setForm((p) => ({ ...p, work_summary: e.target.value }))}
              placeholder="Provide a detailed report of today's progress..."
              className="min-h-[140px] bg-input border-border text-foreground text-sm leading-relaxed"
            />
            <div className="absolute bottom-2 right-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div 
                  key={i} 
                  className={cn(
                    "h-1 w-4 rounded-full",
                    wordCount >= (i * 20) ? "bg-emerald-500" : "bg-zinc-800"
                  )} 
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-[10px] text-zinc-400 mb-1 block font-bold uppercase">Observations</label>
              <Textarea 
                value={form.site_observations}
                onChange={(e) => setForm((p) => ({ ...p, site_observations: e.target.value }))}
                rows={2} placeholder="Scientific / technical notes..." className="bg-input border-border text-foreground" 
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-zinc-400 mb-1 block font-bold uppercase">Challenges</label>
                <Input value={form.challenges_faced} onChange={(e) => setForm((p) => ({ ...p, challenges_faced: e.target.value }))} placeholder="Blockers..." className="bg-input border-border text-foreground" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 mb-1 block font-bold uppercase">Next Day</label>
                <Input value={form.next_day_plan} onChange={(e) => setForm((p) => ({ ...p, next_day_plan: e.target.value }))} placeholder="Plan..." className="bg-input border-border text-foreground" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Documents & Reports */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileBarChart className="h-4 w-4 text-primary" /> Technical Documents
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] font-bold border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => {
                const template = `SITE VISIT REPORT TEMPLATE\nLocation: ${form.site_location_title}\nDate: ${form.report_date}\n\nTECHNICAL REPORT:\n[Add detailed technical findings here...]`;
                const blob = new Blob([template], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Site_Visit_Template.doc`;
                a.click();
              }}
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Download Template
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-border/30">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                  form.is_rental_polyhouse_visit ? "bg-amber-500/20 text-amber-500" : "bg-zinc-800 text-zinc-500"
                )}>
                  <Home className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Rental Polyhouse Site Visit</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={form.is_rental_polyhouse_visit}
                onChange={(e) => setForm(p => ({ ...p, is_rental_polyhouse_visit: e.target.checked }))}
                className="w-5 h-5 rounded border-zinc-800 bg-zinc-950 text-amber-500"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block font-bold uppercase tracking-widest flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-emerald-500" /> Upload Final Report (DOCX)
              </label>
              <SiteVisitPhotoUpload
                photos={form.report_docx_url ? [form.report_docx_url] : []}
                onPhotosChange={(urls) => setForm(p => ({ ...p, report_docx_url: urls[0] || '' }))}
                maxPhotos={1}
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block font-bold uppercase tracking-widest flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" /> Soil & Water Test (Quotation Only)
              </label>
              <SiteVisitPhotoUpload
                photos={form.soil_water_test_report_url ? [form.soil_water_test_report_url] : []}
                onPhotosChange={(urls) => setForm(p => ({ ...p, soil_water_test_report_url: urls[0] || '' }))}
                maxPhotos={1}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ITC Section */}
      {isSMOorCEO && (
        <Card className="bg-blue-950/30 border-blue-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-300 flex items-center gap-2">
              🔒 ITC Data <Badge className="bg-blue-900/50 text-blue-300 text-[10px]">SMO / CEO only</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.itc_data_available}
                onChange={(e) => setForm((p) => ({ ...p, itc_data_available: e.target.checked }))} className="w-4 h-4" />
              <span className="text-zinc-300 text-sm">ITC data available at this site</span>
            </label>
            {form.itc_data_available && (
              <>
                <Input value={form.itc_remarks} onChange={(e) => setForm((p) => ({ ...p, itc_remarks: e.target.value }))}
                  placeholder="ITC remarks..." className="bg-input border-border text-foreground text-sm" />
                <Input value={form.itc_document_url} onChange={(e) => setForm((p) => ({ ...p, itc_document_url: e.target.value }))}
                  placeholder="ITC document URL..." className="bg-input border-border text-foreground text-sm" />
                <Input value={form.itc_data_reference} onChange={(e) => setForm((p) => ({ ...p, itc_data_reference: e.target.value }))}
                  placeholder="Reference number..." className="bg-input border-border text-foreground text-sm" />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit Controls */}
      <div className="space-y-3 pt-2 pb-8">
        {!isValid && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-2 animate-in zoom-in-95 duration-200">
            <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" /> Missing Requirements to Submit
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 grayscale opacity-70">
              {getMissingReqs().map((req, i) => (
                <li key={i} className="text-[10px] text-amber-500 font-bold flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-amber-500 animate-pulse" />
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button
          onClick={() => handleSubmit(false)}
          disabled={!isValid || isSubmitting || req?.status === 'visit_completed'}
          className={cn(
            "w-full h-12 text-sm font-black tracking-widest uppercase transition-all duration-300 rounded-xl",
            isValid && req?.status !== 'visit_completed'
              ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:scale-[1.01] hover:shadow-primary/40 active:scale-[0.98]" 
              : "bg-zinc-900 border border-zinc-800 text-zinc-600 grayscale cursor-not-allowed"
          )}
        >
          {isSubmitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> UPLOADING REPORT...</>
          ) : (
            <><Send className="h-4 w-4 mr-2" /> SUBMIT SITE REPORT</>
          )}
        </Button>

        {isSMOorCEO && req?.status !== 'visit_completed' && (
          <Button
            onClick={() => setCompleteConfirmOpen(true)}
            disabled={!isValid || isSubmitting}
            variant="outline"
            className={cn(
              "w-full h-12 text-sm font-black tracking-widest uppercase border-2 transition-all duration-300 rounded-xl",
              isValid 
                ? "border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 shadow-lg shadow-emerald-500/5 active:scale-[0.98]" 
                : "border-zinc-800 text-zinc-700 opacity-30 cursor-not-allowed"
            )}
          >
            <CheckCircle className="h-4 w-4 mr-2" /> SUBMIT & MARK VISIT COMPLETE
          </Button>
        )}

        {req?.status === 'visit_completed' && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-500">
            <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-2xl p-6 text-center space-y-3">
              <div className="h-12 w-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                <FileCheck className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-white font-black italic uppercase tracking-tighter text-lg">Mission Finalized</p>
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">This site visit has been completed and verified by SMO.</p>
              </div>
            </div>
            
            <Button 
              onClick={() => navigate('/shift/login')}
              className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black italic uppercase tracking-[0.2em] text-xs shadow-[0_0_30px_-5px_rgba(37,99,235,0.4)] rounded-2xl border-t border-white/10 group active:scale-95 transition-all"
            >
              <LogOut className="h-4 w-4 mr-2 group-hover:translate-x-1 transition-transform" />
              PROCEED TO SHIFT LOGIN
            </Button>
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      <Dialog open={completeConfirmOpen} onOpenChange={setCompleteConfirmOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Mark Visit as Complete?</DialogTitle></DialogHeader>
          <div className="py-3">
            <div className="bg-amber-950/40 border border-amber-800/40 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 inline mr-2" />
              <span className="text-amber-300 text-sm">
                This starts SLA-2 and SLA-4 clocks. This cannot be undone.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteConfirmOpen(false)} className="border-border text-muted-foreground">Cancel</Button>
            <Button onClick={() => handleSubmit(true)} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Confirm & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: Session Reports (Morning / Afternoon / Evening)
// ═══════════════════════════════════════════════════════════════
function SessionsTab({ assignmentId, requestId }: { assignmentId: string; requestId?: string }) {
  const [activeSession, setActiveSession] = useState<SessionType | null>(null);
  const { data: existingReports = [] } = useSessionReports(assignmentId);
  const { submitSession, isSubmitting } = useSiteVisitSessionReport();

  // Find today's reports
  const todayReports = existingReports.filter((r) => r.report_date === GLOBAL_TODAY);
  const completedSessions = new Set(todayReports.map((r) => r.session_type));

  // Session form state
  const [sessionForm, setSessionForm] = useState({
    work_summary: '',
    observations: '',
    challenges: '',
    photo_urls: [] as string[],
    start_time: '',
    end_time: '',
  });
  const [isFetchingGPS, setIsFetchingGPS] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);

  const resetForm = () => {
    setSessionForm({ work_summary: '', observations: '', challenges: '', photo_urls: [], start_time: '', end_time: '' });
    setGps(null);
  };

  const fetchGPS = useCallback(async () => {
    setIsFetchingGPS(true);
    try {
      const pos = await getCurrentPosition();
      setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
      toast.success(`GPS acquired (±${pos.coords.accuracy.toFixed(0)}m)`);
    } catch { toast.error('GPS failed'); }
    finally { setIsFetchingGPS(false); }
  }, []);

  const handleSubmitSession = async () => {
    if (!activeSession || !requestId) return;
    if (sessionForm.work_summary.length < 50) { toast.error('Work summary must be at least 50 characters'); return; }

    await submitSession({
      assignment_id: assignmentId,
      request_id: requestId,
      report_date: GLOBAL_TODAY,
      session_type: activeSession,
      session_start_time: sessionForm.start_time || undefined,
      session_end_time: sessionForm.end_time || undefined,
      site_location_title: undefined,
      location_lat: gps?.lat,
      location_lng: gps?.lng,
      location_accuracy_meters: gps?.acc,
      work_summary: sessionForm.work_summary,
      observations: sessionForm.observations || undefined,
      challenges: sessionForm.challenges || undefined,
      photo_urls: sessionForm.photo_urls,
    });
    resetForm();
    setActiveSession(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Session selector cards */}
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        Today's Sessions — {format(new Date(), 'd MMM yyyy')}
      </p>

      <div className="grid gap-3">
        {(Object.entries(SESSION_CONFIG) as [SessionType, typeof SESSION_CONFIG[SessionType]][]).map(([key, cfg]) => {
          const completed = completedSessions.has(key);
          const report = todayReports.find((r) => r.session_type === key);
          const Icon = cfg.icon;

          return (
            <div key={key}>
              <button
                onClick={() => { if (!completed) { setActiveSession(activeSession === key ? null : key); resetForm(); } }}
                disabled={completed}
                className={cn(
                  'w-full text-left rounded-xl border p-4 transition-all',
                  completed
                    ? 'bg-emerald-950/20 border-emerald-800/20 opacity-80'
                    : activeSession === key
                    ? `${cfg.bg} ${cfg.border} ring-1 ring-offset-0 ring-offset-zinc-950 ring-${cfg.color.replace('text-', '')}/30`
                    : 'bg-card/40 border-border/50 hover:border-muted-foreground/30'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center',
                    completed ? 'bg-emerald-500/10' : `${cfg.bg}`
                  )}>
                    {completed ? (
                      <CheckCircle className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <Icon className={cn('h-5 w-5', cfg.color)} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={cn('text-sm font-black uppercase tracking-wider', completed ? 'text-emerald-400' : 'text-foreground')}>
                      {cfg.label} Session
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium">{cfg.time}</p>
                  </div>
                  {completed ? (
                    <Badge className="bg-emerald-900/50 text-emerald-300 text-[9px] font-black border-transparent">SUBMITTED</Badge>
                  ) : (
                    <Badge className={cn('text-[9px] font-black border-transparent', cfg.bg, cfg.color)}>PENDING</Badge>
                  )}
                </div>

                {/* Show submitted report preview */}
                {completed && report && (
                  <div className="mt-3 pt-3 border-t border-emerald-800/20">
                    <p className="text-xs text-zinc-400 line-clamp-2">{report.work_summary}</p>
                    {report.photo_urls?.length > 0 && (
                      <p className="text-[10px] text-emerald-500 mt-1 font-bold">{report.photo_urls.length} photos attached</p>
                    )}
                  </div>
                )}
              </button>

              {/* Session form (expanded inline) */}
              {activeSession === key && !completed && (
                <div className={cn('mt-2 rounded-xl border p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300', cfg.bg, cfg.border)}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-zinc-400 mb-1 block font-bold">Start Time</label>
                      <Input type="time" value={sessionForm.start_time}
                        onChange={(e) => setSessionForm((p) => ({ ...p, start_time: e.target.value }))}
                        className="bg-input border-border text-foreground" />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 mb-1 block font-bold">End Time</label>
                      <Input type="time" value={sessionForm.end_time}
                        onChange={(e) => setSessionForm((p) => ({ ...p, end_time: e.target.value }))}
                        className="bg-input border-border text-foreground" />
                    </div>
                  </div>

                  {/* GPS */}
                  <div className="flex items-center gap-2">
                    <Button onClick={fetchGPS} disabled={isFetchingGPS} size="sm"
                      className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20 text-[10px] font-bold h-7 px-3">
                      {isFetchingGPS ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Navigation className="h-3 w-3 mr-1" />}
                      Fetch GPS
                    </Button>
                    {gps && (
                      <span className="text-[10px] text-emerald-400 font-mono">
                        {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} (±{gps.acc.toFixed(0)}m)
                      </span>
                    )}
                  </div>

                  {/* Work Summary */}
                  <div>
                    <label className="text-[10px] text-zinc-400 mb-1 block font-bold">
                      Work Summary * <span className={cn('font-mono', sessionForm.work_summary.length >= 50 ? 'text-emerald-400' : 'text-amber-400')}>
                        ({sessionForm.work_summary.length}/50+)
                      </span>
                    </label>
                    <Textarea value={sessionForm.work_summary}
                      onChange={(e) => setSessionForm((p) => ({ ...p, work_summary: e.target.value }))}
                      rows={3} placeholder="What was done during this session..."
                      className="bg-input border-border text-foreground" />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 mb-1 block font-bold">Observations</label>
                    <Textarea value={sessionForm.observations}
                      onChange={(e) => setSessionForm((p) => ({ ...p, observations: e.target.value }))}
                      rows={2} placeholder="Optional..." className="bg-input border-border text-foreground" />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 mb-1 block font-bold">Challenges</label>
                    <Input value={sessionForm.challenges}
                      onChange={(e) => setSessionForm((p) => ({ ...p, challenges: e.target.value }))}
                      placeholder="Optional..." className="bg-input border-border text-foreground" />
                  </div>

                  {/* Photos */}
                  <div>
                    <label className="text-[10px] text-zinc-400 mb-2 block font-bold">Session Photos</label>
                    <SiteVisitPhotoUpload
                      photos={sessionForm.photo_urls}
                      onPhotosChange={(urls) => setSessionForm((p) => ({ ...p, photo_urls: urls }))}
                      minPhotos={1}
                      maxPhotos={5}
                    />
                  </div>

                  {/* Submit */}
                  <Button
                    onClick={handleSubmitSession}
                    disabled={isSubmitting || sessionForm.work_summary.length < 50}
                    className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase tracking-wider rounded-xl shadow-lg"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    SUBMIT {cfg.label.toUpperCase()} REPORT
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Historical reports */}
      {existingReports.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-border/50">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Session History</p>
          {existingReports.filter((r) => r.report_date !== GLOBAL_TODAY).slice(0, 10).map((r) => {
            const cfg = SESSION_CONFIG[r.session_type as SessionType];
            return (
              <div key={r.id} className="bg-card/30 border border-border/30 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <Badge className={cn('text-[9px] font-black border-transparent px-2', cfg?.bg, cfg?.color)}>
                    {r.session_type}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-medium">{format(new Date(r.report_date), 'd MMM yyyy')}</span>
                  {r.photo_urls?.length > 0 && (
                    <span className="text-[10px] text-zinc-600 font-bold ml-auto">{r.photo_urls.length} 📷</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{r.work_summary}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
