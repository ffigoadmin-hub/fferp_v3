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
  ArrowRight, RefreshCw
} from 'lucide-react';
import { getSLAStatus, formatSLATime, getSLATimeRemaining } from '@/types/escalations';
import { useBrowserNotifications, triggerTicketNotification } from '@/hooks/useBrowserNotifications';
import { TicketDetailsModal } from './TicketDetailsModal';
import { ResolveTicketModal, ResolveData } from './ResolveTicketModal';
import { cn } from '@/lib/utils';

import { WorkflowTimelineEntry } from '@/types/workflows';

interface EscalationViewWidgetProps {
  role: 'ceo' | 'admin' | 'gm';
}

export function EscalationViewWidget({ role }: EscalationViewWidgetProps) {
  const [escalations, setEscalations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVertical, setSelectedVertical] = useState<'all' | 'civil' | 'agri'>('all');
  const [selectedEscalation, setSelectedEscalation] = useState<any>(null);
  const [timeline, setTimeline] = useState<WorkflowTimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showResolveModal, setShowResolveModal] = useState(false); // MODULE 1
  
  const { showNotification, playBreachAlert } = useBrowserNotifications();
  const [previousBreachedIds, setPreviousBreachedIds] = useState<Set<string>>(new Set());

  const fetchEscalations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('client_escalations')
        .select(`
          *,
          creator:profiles!client_escalations_created_by_fkey(name, email, department),
          acknowledger:profiles!client_escalations_acknowledged_by_fkey(name, email),
          resolver:profiles!client_escalations_resolved_by_fkey(name, email),
          gm:profiles!client_escalations_gm_id_fkey(name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const newData = data || [];
      
      // Check for new breaches and trigger alerts
      const newBreachedIds = new Set(
        newData.filter(e => e.status === 'breached' || e.ack_late).map(e => e.id)
      );
      
      newBreachedIds.forEach(id => {
        if (!previousBreachedIds.has(id)) {
          const esc = newData.find(e => e.id === id);
          if (esc) {
            triggerTicketNotification(
              showNotification,
              'breached',
              `ESC-${String(esc.ticket_number).padStart(3, '0')}`,
              `SLA Breached: ${esc.client_name}`,
              playBreachAlert
            );
          }
        }
      });
      
      setPreviousBreachedIds(newBreachedIds);
      setEscalations(newData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching escalations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [showNotification, playBreachAlert, previousBreachedIds]);

  const fetchTimeline = useCallback(async (escalationId: string) => {
    setTimelineLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_escalation_timeline')
        .select('*')
        .eq('escalation_id', escalationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTimeline(data || []);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEscalations();

    // Real-time subscription
    const channel = supabase
      .channel(`${role}-client-escalations-realtime`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_escalations' },
        () => fetchEscalations()
      )
      .subscribe();

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchEscalations();
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [role, fetchEscalations]);

  // Subscribe to timeline updates when viewing details
  useEffect(() => {
    if (!selectedEscalation) return;

    const channel = supabase
      .channel(`client-escalation-timeline-${selectedEscalation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_escalation_timeline',
          filter: `escalation_id=eq.${selectedEscalation.id}`,
        },
        () => fetchTimeline(selectedEscalation.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEscalation, fetchTimeline]);

  const filteredEscalations = escalations.filter(esc => {
    if (selectedVertical === 'all') return true;
    const dept = (esc.department || '').toLowerCase();
    if (selectedVertical === 'civil') {
      return dept === 'civil' || dept === 'engineering' || dept === 'eng' || !dept;
    }
    return dept === 'agri' || dept === 'agriculture';
  });

  const pendingEscalations = filteredEscalations.filter(e => e.status === 'open' || e.status === 'acknowledged');
  const breachedEscalations = filteredEscalations.filter(e => e.status === 'breached' || e.ack_late);
  const resolvedEscalations = filteredEscalations.filter(e => e.status === 'resolved');

  const openEscalationDetails = async (escalation: any) => {
    setSelectedEscalation(escalation);
    await fetchTimeline(escalation.id);
  };

  const handleResolve = async (resolutionText: string) => {
    if (!selectedEscalation) return;
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('client_escalations')
        .update({
          status: 'resolved',
          resolution_text: resolutionText,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', selectedEscalation.id);

      if (error) throw error;

      toast.success('Escalation resolved successfully');
      setSelectedEscalation(null);
      fetchEscalations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resolve');
    } finally {
      setIsSaving(false);
    }
  };

  // MODULE 1: Handle resolve with proof (screenshot mandatory, audio optional)
  const handleResolveWithProof = async (data: ResolveData) => {
    if (!selectedEscalation) return;
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('client_escalations')
        .update({
          status: 'resolved',
          resolution_text: data.resolutionText,
          resolution_evidence_url: data.proofUrl,
          resolution_image_url: data.screenshotUrls && data.screenshotUrls.length > 0 ? data.screenshotUrls.join(',') : null,
          resolution_audio_url: data.callRecordingUrl || null,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', selectedEscalation.id);

      if (error) throw error;

      toast.success('Escalation resolved successfully');
      setShowResolveModal(false);
      setSelectedEscalation(null);
      fetchEscalations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resolve');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePushToCEO = async () => {
    if (!selectedEscalation) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('client_escalations')
        .update({
          status: 'escalated_ceo',
          pushed_to_ceo_at: new Date().toISOString(),
        })
        .eq('id', selectedEscalation.id);

      if (error) throw error;

      toast.success('Escalated to CEO');
      setSelectedEscalation(null);
      fetchEscalations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to escalate');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async (comment: string) => {
    if (!selectedEscalation) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', user?.id).single();
      
      await supabase.from('client_escalation_timeline').insert({
        escalation_id: selectedEscalation.id,
        action: `${role}_comment`,
        performed_by: user?.id,
        performed_by_name: profile?.name,
        performed_by_role: profile?.role,
        details: { comment },
      });
      
      toast.success('Comment added');
      await fetchTimeline(selectedEscalation.id);
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
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
      <Card className="border-2 border-destructive/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Customer Escalations
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                {breachedEscalations.length > 0 && (
                  <span className="text-destructive font-medium animate-pulse">
                    {breachedEscalations.length} SLA Breached! 
                  </span>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Updated {format(lastUpdated, 'HH:mm:ss')}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchEscalations()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Tabs value={selectedVertical} onValueChange={(v) => setSelectedVertical(v as any)} className="w-auto">
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
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-3 bg-destructive/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-destructive">{pendingEscalations.length}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="p-3 bg-status-missed/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-status-missed">{breachedEscalations.length}</p>
              <p className="text-xs text-muted-foreground">SLA Breached</p>
            </div>
            <div className="p-3 bg-status-live/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-status-live">{resolvedEscalations.length}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {filteredEscalations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No escalations found
                </div>
              ) : (
                filteredEscalations.slice(0, 20).map((esc) => (
                  <EscalationCard 
                    key={esc.id} 
                    escalation={esc} 
                    role={role}
                    onViewDetails={() => openEscalationDetails(esc)} 
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Ticket Details Modal */}
      <TicketDetailsModal
        open={!!selectedEscalation}
        onClose={() => setSelectedEscalation(null)}
        ticket={selectedEscalation}
        ticketType="escalation"
        timeline={timeline}
        timelineLoading={timelineLoading}
        role={role}
        onResolve={handleResolve}
        onOpenResolveModal={() => setShowResolveModal(true)}
        onPushToCEO={role === 'gm' ? handlePushToCEO : undefined}
        onAddComment={handleAddComment}
        isSaving={isSaving}
      />

      {/* MODULE 1: Resolve with Proof Modal */}
      <ResolveTicketModal
        open={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        onResolve={handleResolveWithProof}
        ticketId={selectedEscalation?.id || ''}
        ticketType="escalation"
        isSaving={isSaving}
      />
    </>
  );
}

function EscalationCard({ escalation, role, onViewDetails }: { 
  escalation: any; 
  role: 'ceo' | 'admin' | 'gm'; 
  onViewDetails: () => void 
}) {
  const [timeRemaining, setTimeRemaining] = useState(getSLATimeRemaining(escalation.resolve_deadline || escalation.ack_deadline));
  const isBreached = escalation.status === 'breached' || escalation.ack_late;
  const isResolved = escalation.status === 'resolved';

  useEffect(() => {
    if (!isResolved && !isBreached) {
      const interval = setInterval(() => {
        setTimeRemaining(getSLATimeRemaining(escalation.resolve_deadline || escalation.ack_deadline));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [escalation.resolve_deadline, escalation.ack_deadline, isResolved, isBreached]);

  // Color-coded SLA status: Green >4hrs, Yellow 2-4hrs, Red <2hrs, Black Breached
  const getSLAColorStatus = () => {
    if (isBreached || timeRemaining === 0) return 'breached';
    const hours = timeRemaining / (1000 * 60 * 60);
    if (hours < 2) return 'red';
    if (hours < 4) return 'yellow';
    return 'green';
  };

  const slaColorStatus = getSLAColorStatus();
  
  const slaStyles = {
    green: {
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-500/50',
      bg: 'bg-green-500/10',
    },
    yellow: {
      text: 'text-yellow-600 dark:text-yellow-400',
      border: 'border-yellow-500/50',
      bg: 'bg-yellow-500/10',
    },
    red: {
      text: 'text-red-600 dark:text-red-400 animate-pulse',
      border: 'border-red-500/50',
      bg: 'bg-red-500/10',
    },
    breached: {
      text: 'text-black dark:text-white animate-pulse font-bold',
      border: 'border-black dark:border-white',
      bg: 'bg-black/10 dark:bg-white/10',
    },
  };

  const currentStyle = slaStyles[slaColorStatus];

  return (
    <div className={cn(
      "p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
      isResolved ? 'border-status-live/30' : currentStyle.border,
      !isResolved && currentStyle.bg
    )} onClick={onViewDetails}>
      <div className="flex items-center justify-between">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">ESC-{String(escalation.ticket_number).padStart(3, '0')}</Badge>
            <span className="text-sm font-medium">{escalation.client_name}</span>
            <Badge variant="secondary" className="text-xs capitalize">
              {escalation.department}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">
              {escalation.priority}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-1">{escalation.issue_title}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>By: {escalation.creator?.name || 'N/A'}</span>
            {escalation.client_phone && <span>📞 {escalation.client_phone}</span>}
            <span>{format(new Date(escalation.created_at), 'dd MMM HH:mm')}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isResolved ? (
            <Badge className="bg-status-live">RESOLVED</Badge>
          ) : slaColorStatus === 'breached' ? (
            <div className="flex flex-col items-end gap-1">
              <Badge className="bg-black text-white dark:bg-white dark:text-black animate-pulse">BREACHED</Badge>
              <span className="text-xs text-muted-foreground">SLA Exceeded</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className={cn("text-lg font-mono font-bold flex items-center", currentStyle.text)}>
                <Clock className="w-4 h-4 mr-1" />
                {formatSLATime(timeRemaining)}
              </div>
              <span className={cn("text-xs font-medium", currentStyle.text)}>
                {slaColorStatus === 'green' ? 'Safe' : slaColorStatus === 'yellow' ? 'Warning' : 'Critical'}
              </span>
            </div>
          )}
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
