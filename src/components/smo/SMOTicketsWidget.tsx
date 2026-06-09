import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Inbox, Loader2 } from 'lucide-react';
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

export function SMOTicketsWidget() {
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

  // Filter to show ONLY tickets assigned to SMO (not resolved)
  const allAssignedTickets = useMemo(() => {
    return unifiedTickets
      .filter(t => {
        const raw = t.raw;
        return raw.status !== 'resolved' && raw.status !== 'closed' && raw.status !== 'pending_closure_approval' &&
          (raw.assigned_role?.toLowerCase().includes('smo') || raw.current_owner?.toLowerCase() === 'smo');
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

  const handleViewDetails = (ticket: UniversalTicket & { type?: 'escalation' | 'critical' }) => {
    const type = ticket.type || (ticket.id.startsWith('crit') ? 'critical' : 'escalation');
    const unifiedTicket = unifiedTickets.find(t => t.id === ticket.id && t.type === type);

    setSelectedTicket(ticket);
    setSelectedRawTicket(unifiedTicket?.raw || null);
    setTicketType(type);
    fetchTimeline(ticket.id, type);
  };

  // SMO can ONLY resolve tickets assigned to them
  const canResolveTicket = selectedRawTicket &&
    (selectedRawTicket.assigned_role?.toLowerCase().includes('smo') || selectedRawTicket.current_owner?.toLowerCase() === 'smo');

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
              <Inbox className="w-5 h-5 text-primary" />
              My Assigned Tickets
            </CardTitle>
            <Badge variant="secondary" className="gap-1">
              <Users className="w-3 h-3" />
              {allAssignedTickets.length} Assigned to SMO
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            These tickets are assigned to SMO team for resolution. Click to view and submit proof.
          </p>
        </CardHeader>
        <CardContent>
          {allAssignedTickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Inbox className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No tickets assigned to SMO</p>
              <p className="text-sm">Tickets will appear here when BOI assigns them for resolution</p>
            </div>
          ) : (
            <UniversalTicketGrid
              tickets={allAssignedTickets}
              ticketType="escalation"
              onViewDetails={(t) => handleViewDetails(t as any)}
              isLoading={isLoading}
            />
          )}
        </CardContent>
      </Card>

      <TicketDetailsModal
        open={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        ticket={selectedRawTicket}
        ticketType={ticketType}
        timeline={timeline}
        role="smo"
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
