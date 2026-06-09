import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Eye, Users, Inbox, Lock, Loader2 } from 'lucide-react';
import {
  UniversalTicketGrid,
  transformEscalationToUniversal,
  transformCriticalToUniversal,
  type UniversalTicket
} from '@/components/UniversalTicketGrid';
import { TicketDetailsModal } from '@/components/TicketDetailsModal';
import { ResolveTicketModal, ResolveData } from '@/components/ResolveTicketModal';
import { useAuth } from '@/contexts/AuthContext';
import { useEscalationEngine } from '@/hooks/useEscalationEngine';
import { supabase } from '@/integrations/supabase/client';
import { WorkflowTimelineEntry } from '@/types/workflows';

export function GMOTicketsWidget() {
  const { user } = useAuth();
  const {
    tickets: unifiedTickets,
    isLoading,
    isSaving,
    acknowledge,
    resolve,
    addComment,
    refetch
  } = useEscalationEngine();

  const [selectedTicket, setSelectedTicket] = useState<UniversalTicket | null>(null);
  const [selectedRawTicket, setSelectedRawTicket] = useState<any>(null);
  const [ticketType, setTicketType] = useState<'escalation' | 'critical'>('escalation');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [timeline, setTimeline] = useState<WorkflowTimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'my-tickets' | 'all-tickets'>('my-tickets');

  // "My Tickets" - Filter to show ONLY tickets assigned to GMO (not resolved)
  const myAssignedTickets = useMemo(() => {
    return unifiedTickets
      .filter(t => {
        const raw = t.raw;
        return raw.status !== 'resolved' && raw.status !== 'closed' && raw.status !== 'pending_closure_approval' &&
          (raw.assigned_role?.toLowerCase() === 'gmo' || raw.current_owner?.toLowerCase() === 'gmo');
      })
      .map(t => {
        if (t.type === 'escalation') {
          return { ...transformEscalationToUniversal(t.raw), type: 'escalation' as const, raw: t.raw };
        } else {
          return { ...transformCriticalToUniversal(t.raw), type: 'critical' as const, raw: t.raw };
        }
      })
      .sort((a, b) => new Date(b.raw.created_at).getTime() - new Date(a.raw.created_at).getTime());
  }, [unifiedTickets]);

  // "All Tickets" - All active tickets (not resolved)
  const allActiveTickets = useMemo(() => {
    return unifiedTickets.filter(t => t.raw.status !== 'resolved' && t.raw.status !== 'closed' && t.raw.status !== 'pending_closure_approval');
  }, [unifiedTickets]);

  const allActiveEscalations = useMemo(() =>
    allActiveTickets.filter(t => t.type === 'escalation').map(t => transformEscalationToUniversal(t.raw)),
    [allActiveTickets]
  );

  const allActiveCriticals = useMemo(() =>
    allActiveTickets.filter(t => t.type === 'critical').map(t => transformCriticalToUniversal(t.raw)),
    [allActiveTickets]
  );

  const fetchTimeline = useCallback(async (ticketId: string, type: 'escalation' | 'critical') => {
    setTimelineLoading(true);
    try {
      let result;
      if (type === 'escalation') {
        result = await supabase.from('client_escalation_timeline').select('*').eq('escalation_id', ticketId).order('created_at', { ascending: true });
      } else {
        result = await supabase.from('hourly_critical_timeline').select('*').eq('critical_id', ticketId).order('created_at', { ascending: true });
      }
      setTimeline(result.data || []);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const handleViewDetails = (ticket: UniversalTicket, type: 'escalation' | 'critical') => {
    const unifiedTicket = unifiedTickets.find(t => t.id === ticket.id && t.type === type);
    setSelectedTicket(ticket);
    setSelectedRawTicket(unifiedTicket?.raw || null);
    setTicketType(type);
    fetchTimeline(ticket.id, type);
  };

  // GMO can ONLY resolve tickets assigned to them
  const canResolveTicket = selectedRawTicket &&
    (selectedRawTicket.assigned_role?.toLowerCase() === 'gmo' || selectedRawTicket.current_owner?.toLowerCase() === 'gmo');

  const handleResolveWithProof = async (data: ResolveData) => {
    if (!selectedTicket) return;
    await resolve(selectedTicket.id, ticketType, data);
    setShowResolveModal(false);
    setSelectedTicket(null);
  };

  const handleAddComment = async (comment: string, audioUrl?: string) => {
    if (!selectedTicket) return;
    await addComment(selectedTicket.id, ticketType, comment, audioUrl);
    fetchTimeline(selectedTicket.id, ticketType);
  };

  const handleAcknowledge = async () => {
    if (!selectedTicket) return;
    await acknowledge(selectedTicket.id, ticketType);
    fetchTimeline(selectedTicket.id, ticketType);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              GMO Ticket Management
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="secondary" className="gap-1 bg-green-500/20 text-green-600">
                <Users className="w-3 h-3" />
                {myAssignedTickets.length} Assigned to GMO
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Eye className="w-3 h-3" />
                {allActiveTickets.length} Total Active
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="my-tickets" className="gap-2">
                <Inbox className="w-4 h-4" />
                My Tickets
                {myAssignedTickets.length > 0 && (
                  <Badge variant="destructive" className="ml-1">{myAssignedTickets.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all-tickets" className="gap-2">
                <Eye className="w-4 h-4" />
                All Tickets (View Only)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="my-tickets">
              {myAssignedTickets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Inbox className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No tickets assigned to GMO</p>
                  <p className="text-sm">Tickets will appear here when BOI assigns them for resolution</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-green-600 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <strong>These tickets are assigned to you. Click to submit resolution proof.</strong>
                  </p>
                  <UniversalTicketGrid
                    tickets={myAssignedTickets}
                    ticketType="escalation"
                    onViewDetails={(t) => handleViewDetails(t, (t as any).type || 'escalation')}
                    isLoading={isLoading}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="all-tickets">
              <div className="mb-4 p-3 bg-muted/50 rounded-lg flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="w-4 h-4" />
                <span>View-only mode. You can only submit proof for tickets that are assigned to GMO.</span>
              </div>
              <Tabs defaultValue="escalations">
                <TabsList className="mb-4">
                  <TabsTrigger value="escalations">
                    Escalations ({allActiveEscalations.length})
                  </TabsTrigger>
                  <TabsTrigger value="criticals">
                    Criticals ({allActiveCriticals.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="escalations">
                  <UniversalTicketGrid
                    tickets={allActiveEscalations}
                    ticketType="escalation"
                    onViewDetails={(t) => handleViewDetails(t, 'escalation')}
                    isLoading={isLoading}
                  />
                </TabsContent>
                <TabsContent value="criticals">
                  <UniversalTicketGrid
                    tickets={allActiveCriticals}
                    ticketType="critical"
                    onViewDetails={(t) => handleViewDetails(t, 'critical')}
                    isLoading={isLoading}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <TicketDetailsModal
        open={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        ticket={selectedRawTicket}
        ticketType={ticketType}
        timeline={timeline}
        role="gmo"
        onOpenResolveModal={canResolveTicket ? () => setShowResolveModal(true) : undefined}
        onAcknowledge={handleAcknowledge}
        onAddComment={handleAddComment}
        isSaving={isSaving}
        timelineLoading={timelineLoading}
      />

      <ResolveTicketModal
        open={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        onResolve={handleResolveWithProof}
        ticketId={selectedTicket?.id || ''}
        ticketType={ticketType}
        isSaving={isSaving}
      />
    </div>
  );
}
