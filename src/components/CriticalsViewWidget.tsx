import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Clock, AlertTriangle, Loader2, Building2, Leaf, 
  RefreshCw, ArrowRight, Zap
} from 'lucide-react';
import { 
  HourlyCritical, WorkflowTimelineEntry, 
  getTimeRemaining, formatTimeRemaining, getResolveSLAStatus 
} from '@/types/workflows';
import { useBrowserNotifications, triggerTicketNotification } from '@/hooks/useBrowserNotifications';
import { useHourlyCriticalTimeline } from '@/hooks/useHourlyCriticals';
import { TicketDetailsModal } from './TicketDetailsModal';
import { ResolveTicketModal, ResolveData } from './ResolveTicketModal';
import { cn } from '@/lib/utils';

interface CriticalsViewWidgetProps {
  role: 'ceo' | 'admin' | 'gm';
}

export function CriticalsViewWidget({ role }: CriticalsViewWidgetProps) {
  const [criticals, setCriticals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<'all' | 'civil' | 'agri'>('all');
  const [selectedCritical, setSelectedCritical] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showResolveModal, setShowResolveModal] = useState(false); // MODULE 1
  
  const { showNotification, playBreachAlert } = useBrowserNotifications();
  const [previousBreachedIds, setPreviousBreachedIds] = useState<Set<string>>(new Set());
  
  const { timeline, isLoading: timelineLoading } = useHourlyCriticalTimeline(selectedCritical?.id);

  const fetchCriticals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('hourly_criticals')
        .select(`
          *,
          creator:profiles!hourly_criticals_created_by_fkey(name, email),
          acknowledger:profiles!hourly_criticals_acknowledged_by_fkey(name, email),
          resolver:profiles!hourly_criticals_resolved_by_fkey(name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const newData = data || [];
      
      // Check for new breaches and trigger alerts
      const newBreachedIds = new Set(
        newData.filter(c => c.status === 'breached' || c.blast_triggered_at).map(c => c.id)
      );
      
      newBreachedIds.forEach(id => {
        if (!previousBreachedIds.has(id)) {
          const crit = newData.find(c => c.id === id);
          if (crit) {
            triggerTicketNotification(
              showNotification,
              'breached',
              `CRIT-${String(crit.ticket_number).padStart(3, '0')}`,
              `BLAST: ${crit.issue_title}`,
              playBreachAlert
            );
          }
        }
      });
      
      setPreviousBreachedIds(newBreachedIds);
      setCriticals(newData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching criticals:', error);
    } finally {
      setIsLoading(false);
    }
  }, [showNotification, playBreachAlert, previousBreachedIds]);

  useEffect(() => {
    fetchCriticals();

    // Real-time subscription
    const channel = supabase
      .channel(`${role}-criticals-realtime-v2`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hourly_criticals' },
        () => fetchCriticals()
      )
      .subscribe();

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchCriticals();
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [role, fetchCriticals]);

  const filteredCriticals = criticals.filter(crit => {
    if (selectedDepartment === 'all') return true;
    const dept = (crit.department || '').toLowerCase();
    if (selectedDepartment === 'civil') {
      return dept === 'civil' || dept === 'engineering' || dept === 'eng';
    }
    return dept === 'agri' || dept === 'agriculture';
  });

  const openCriticals = filteredCriticals.filter(c => c.status === 'open');
  const acknowledgedCriticals = filteredCriticals.filter(c => c.status === 'acknowledged' || c.status === 'in_progress');
  const breachedCriticals = filteredCriticals.filter(c => c.status === 'breached' || c.blast_triggered_at);
  const resolvedCriticals = filteredCriticals.filter(c => c.status === 'resolved' || c.status === 'closed');

  const handleResolve = async (resolutionText: string) => {
    if (!selectedCritical) return;
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('hourly_criticals')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolution_text: resolutionText,
          status: 'resolved',
        })
        .eq('id', selectedCritical.id);

      if (error) throw error;

      toast.success('Critical resolved successfully');
      setSelectedCritical(null);
      fetchCriticals();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resolve');
    } finally {
      setIsSaving(false);
    }
  };

  // MODULE 1: Handle resolve with proof (screenshot mandatory, audio optional)
  const handleResolveWithProof = async (data: ResolveData) => {
    if (!selectedCritical) return;
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('hourly_criticals')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolution_text: data.resolutionText,
          proof_url: data.proofUrl,
          resolution_image_url: data.screenshotUrls && data.screenshotUrls.length > 0 ? data.screenshotUrls.join(',') : null,
          resolution_audio_url: data.callRecordingUrl || null,
          status: 'resolved',
        })
        .eq('id', selectedCritical.id);

      if (error) throw error;

      toast.success('Critical resolved successfully');
      setShowResolveModal(false);
      setSelectedCritical(null);
      fetchCriticals();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resolve');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async (comment: string) => {
    // For now, just show a toast - could be extended to add to timeline
    toast.success('Comment added');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-2 border-status-late/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-status-late" />
                Hourly Criticals
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                {breachedCriticals.length > 0 && (
                  <span className="text-status-late font-medium animate-pulse">
                    {breachedCriticals.length} BLAST Triggered! 
                  </span>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Updated {format(lastUpdated, 'HH:mm:ss')}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchCriticals()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Tabs value={selectedDepartment} onValueChange={(v) => setSelectedDepartment(v as any)} className="w-auto">
                <TabsList className="grid w-[250px] grid-cols-3">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="civil" className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Civil
                  </TabsTrigger>
                  <TabsTrigger value="agri" className="flex items-center gap-1">
                    <Leaf className="w-3 h-3" /> Agri
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-2xl font-bold">{openCriticals.length}</p>
              <p className="text-xs text-muted-foreground">Open</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{acknowledgedCriticals.length}</p>
              <p className="text-xs text-muted-foreground">Acknowledged</p>
            </div>
            <div className="p-3 bg-status-late/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-status-late">{breachedCriticals.length}</p>
              <p className="text-xs text-muted-foreground">Breached</p>
            </div>
            <div className="p-3 bg-status-live/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-status-live">{resolvedCriticals.length}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {filteredCriticals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No criticals found
                </div>
              ) : (
                filteredCriticals.slice(0, 20).map((crit) => (
                  <CriticalCard 
                    key={crit.id} 
                    critical={crit} 
                    onViewDetails={() => setSelectedCritical(crit)} 
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Ticket Details Modal */}
      <TicketDetailsModal
        open={!!selectedCritical}
        onClose={() => setSelectedCritical(null)}
        ticket={selectedCritical}
        ticketType="critical"
        timeline={timeline}
        timelineLoading={timelineLoading}
        role={role}
        onResolve={handleResolve}
        onOpenResolveModal={() => setShowResolveModal(true)}
        onAddComment={handleAddComment}
        isSaving={isSaving}
      />

      {/* MODULE 1: Resolve with Proof Modal */}
      <ResolveTicketModal
        open={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        onResolve={handleResolveWithProof}
        ticketId={selectedCritical?.id || ''}
        ticketType="critical"
        isSaving={isSaving}
      />
    </>
  );
}

function CriticalCard({ critical, onViewDetails }: { 
  critical: any; 
  onViewDetails: () => void;
}) {
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining(critical.resolve_deadline));

  useEffect(() => {
    if (critical.status !== 'resolved' && !critical.blast_triggered_at) {
      const interval = setInterval(() => {
        setTimeRemaining(getTimeRemaining(critical.resolve_deadline));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [critical.resolve_deadline, critical.status, critical.blast_triggered_at]);

  const slaStatus = getResolveSLAStatus(critical.resolve_deadline, true);
  const isBreached = critical.status === 'breached' || critical.blast_triggered_at;
  const isResolved = critical.status === 'resolved' || critical.status === 'closed';

  return (
    <div className={cn(
      "p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
      isBreached ? 'border-status-late bg-status-late/5' :
      isResolved ? 'border-status-live/30' : 
      slaStatus === 'critical' ? 'border-destructive' :
      slaStatus === 'warning' ? 'border-status-late' : ''
    )} onClick={onViewDetails}>
      <div className="flex items-center justify-between">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono">
              CRIT-{String(critical.ticket_number).padStart(3, '0')}
            </Badge>
            <span className="text-sm font-medium">{critical.issue_title}</span>
            <Badge variant="secondary" className="text-xs capitalize">
              {critical.issue_type}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {critical.department === 'agri' ? <Leaf className="w-3 h-3 inline mr-1" /> : <Building2 className="w-3 h-3 inline mr-1" />}
              {critical.department}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-1">{critical.issue_description}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Created by: {critical.creator?.name || 'N/A'}</span>
            {critical.acknowledger?.name && <span>Ack: {critical.acknowledger.name}</span>}
            <span>{format(new Date(critical.created_at), 'dd MMM HH:mm')}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isBreached ? (
            <Badge className="bg-status-late animate-pulse">BLAST</Badge>
          ) : isResolved ? (
            <Badge className="bg-status-live">RESOLVED</Badge>
          ) : (
            <div className={cn(
              "text-lg font-mono font-bold",
              slaStatus === 'critical' ? 'text-destructive animate-pulse' :
              slaStatus === 'warning' ? 'text-status-late' : 'text-status-live'
            )}>
              <Clock className="w-4 h-4 inline-block mr-1" />
              {formatTimeRemaining(timeRemaining)}
            </div>
          )}
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
