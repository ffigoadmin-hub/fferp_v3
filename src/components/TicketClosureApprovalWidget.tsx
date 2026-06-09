import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, CheckCircle2, XCircle, Clock, Image, Mic, AlertTriangle, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { DepartmentBadge } from '@/components/DepartmentBadge';

interface PendingProofTicket {
  id: string;
  ticket_number: number;
  issue_title: string;
  issue_description: string;
  department: string;
  client_name: string;
  proof_submitted_at: string;
  proof_submitted_by: string;
  proof_screenshot_urls: string[] | null;
  proof_audio_url: string | null;
  resolution_text: string | null;
  type: 'escalation' | 'critical';
  submitter?: { name: string; role: string };
  business_unit?: string;
  vertical?: string;
  escalation_type?: string;
}

export function TicketClosureApprovalWidget() {
  const { user } = useAuth();
  const [pendingTickets, setPendingTickets] = useState<PendingProofTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<PendingProofTicket | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const fetchPendingTickets = useCallback(async () => {
    try {
      // Fetch escalations with proof_submitted status
      const { data: escalations } = await supabase
        .from('client_escalations')
        .select(`
          id,
          ticket_number,
          issue_title,
          issue_description,
          department,
          client_name,
          proof_submitted_at,
          proof_submitted_by,
          proof_screenshot_urls,
          proof_audio_url,
          resolution_text,
          business_unit,
          vertical,
          escalation_type,
          submitter:profiles!client_escalations_proof_submitted_by_fkey(name, role)
        `)
        .eq('status', 'proof_submitted')
        .order('proof_submitted_at', { ascending: true });

      // Fetch criticals with proof_submitted status
      const { data: criticals } = await supabase
        .from('hourly_criticals')
        .select(`
          id,
          ticket_number,
          issue_title,
          issue_description,
          department,
          proof_submitted_at,
          proof_submitted_by,
          proof_screenshot_urls,
          proof_audio_url,
          resolution_text,
          business_unit,
          vertical,
          submitter:profiles!hourly_criticals_proof_submitted_by_fkey(name, role)
        `)
        .eq('status', 'proof_submitted')
        .order('proof_submitted_at', { ascending: true });

      const allTickets: PendingProofTicket[] = [
        ...(escalations || []).map(e => ({ 
          ...e, 
          type: 'escalation' as const,
          client_name: e.client_name || 'N/A',
          submitter: e.submitter as { name: string; role: string } | undefined
        })),
        ...(criticals || []).map(c => ({ 
          ...c, 
          type: 'critical' as const,
          client_name: 'N/A', // Criticals don't have client_name
          submitter: c.submitter as { name: string; role: string } | undefined
        })),
      ].sort((a, b) => 
        new Date(a.proof_submitted_at).getTime() - new Date(b.proof_submitted_at).getTime()
      );

      setPendingTickets(allTickets);
    } catch (error) {
      console.error('Error fetching pending tickets:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingTickets();

    // Set up real-time listeners
    const escalationChannel = supabase
      .channel('closure-approval-escalations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_escalations' }, fetchPendingTickets)
      .subscribe();

    const criticalChannel = supabase
      .channel('closure-approval-criticals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hourly_criticals' }, fetchPendingTickets)
      .subscribe();

    return () => {
      supabase.removeChannel(escalationChannel);
      supabase.removeChannel(criticalChannel);
    };
  }, [fetchPendingTickets]);

  const handleApproveClosure = async (ticket: PendingProofTicket) => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const tableName = ticket.type === 'escalation' ? 'client_escalations' : 'hourly_criticals';
      
      const { error } = await supabase
        .from(tableName)
        .update({
          status: 'resolved',
          closure_approved_at: new Date().toISOString(),
          closure_approved_by: user.id,
          closure_approval_status: 'closure_approved',
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', ticket.id);

      if (error) throw error;

      // Add timeline entry
      const timelineTable = ticket.type === 'escalation' ? 'client_escalation_timeline' : 'hourly_critical_timeline';
      const idField = ticket.type === 'escalation' ? 'escalation_id' : 'critical_id';
      
      await supabase.from(timelineTable).insert({
        [idField]: ticket.id,
        action: 'closure_approved',
        performed_by: user.id,
        performed_by_name: user.name,
        performed_by_role: user.role,
        details: { message: 'Closure approved by CEO/Admin' },
      } as any);

      toast.success('Ticket closure approved');
      setSelectedTicket(null);
      fetchPendingTickets();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve closure');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectClosure = async () => {
    if (!user?.id || !selectedTicket) return;
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setIsSaving(true);
    try {
      const tableName = selectedTicket.type === 'escalation' ? 'client_escalations' : 'hourly_criticals';
      
      // Revert to acknowledged status so they can submit again
      const { error } = await supabase
        .from(tableName)
        .update({
          status: 'acknowledged',
          closure_approval_status: 'rejected',
          proof_submitted_at: null,
          proof_submitted_by: null,
        })
        .eq('id', selectedTicket.id);

      if (error) throw error;

      // Add timeline entry
      const timelineTable = selectedTicket.type === 'escalation' ? 'client_escalation_timeline' : 'hourly_critical_timeline';
      const idField = selectedTicket.type === 'escalation' ? 'escalation_id' : 'critical_id';
      
      await supabase.from(timelineTable).insert({
        [idField]: selectedTicket.id,
        action: 'closure_rejected',
        performed_by: user.id,
        performed_by_name: user.name,
        performed_by_role: user.role,
        details: { reason: rejectionReason, message: 'Proof rejected - more information needed' },
      } as any);

      toast.success('Closure rejected - ticket returned for more info');
      setShowRejectDialog(false);
      setSelectedTicket(null);
      setRejectionReason('');
      fetchPendingTickets();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject closure');
    } finally {
      setIsSaving(false);
    }
  };

  const getTypeTag = (ticket: PendingProofTicket) => {
    if (!ticket.business_unit && !ticket.vertical && !ticket.escalation_type) return null;
    const parts = [ticket.business_unit, ticket.vertical, ticket.escalation_type].filter(Boolean);
    return parts.join(' ').toUpperCase();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Pending Closure Approval
            </CardTitle>
            <Badge variant={pendingTickets.length > 0 ? 'destructive' : 'secondary'}>
              {pendingTickets.length} Pending
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {pendingTickets.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p className="text-lg font-medium">All Clear</p>
              <p className="text-muted-foreground text-sm">No tickets pending closure approval</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTickets.map((ticket) => (
                <div 
                  key={`${ticket.type}-${ticket.id}`} 
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-muted-foreground">
                        #{ticket.ticket_number}
                      </span>
                      <Badge variant={ticket.type === 'escalation' ? 'destructive' : 'secondary'}>
                        {ticket.type === 'escalation' ? 'Escalation' : 'Critical'}
                      </Badge>
                      <DepartmentBadge department={ticket.department} size="sm" />
                      {getTypeTag(ticket) && (
                        <Badge variant="outline" className="text-xs">{getTypeTag(ticket)}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {format(new Date(ticket.proof_submitted_at), 'dd MMM, HH:mm')}
                    </div>
                  </div>
                  
                  <h4 className="font-medium mb-1">{ticket.issue_title}</h4>
                  {ticket.client_name !== 'N/A' && (
                    <p className="text-sm text-muted-foreground">Client: {ticket.client_name}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Submitted by: {ticket.submitter?.name || 'Unknown'} ({ticket.submitter?.role || 'N/A'})
                  </p>

                  <div className="flex items-center gap-3 mt-3">
                    {ticket.proof_screenshot_urls && ticket.proof_screenshot_urls.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <Image className="w-3 h-3" />
                        {ticket.proof_screenshot_urls.length} Screenshot(s)
                      </div>
                    )}
                    {ticket.proof_audio_url && (
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <Mic className="w-3 h-3" />
                        Audio
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket && !showRejectDialog} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Review Proof - #{selectedTicket?.ticket_number}
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4">
              {/* Ticket Info */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <Badge variant={selectedTicket.type === 'escalation' ? 'destructive' : 'secondary'}>
                    {selectedTicket.type === 'escalation' ? 'Escalation' : 'Critical'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Department</p>
                  <DepartmentBadge department={selectedTicket.department} size="sm" />
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Issue</p>
                  <p className="font-medium">{selectedTicket.issue_title}</p>
                </div>
                {selectedTicket.client_name !== 'N/A' && (
                  <div>
                    <p className="text-xs text-muted-foreground">Client</p>
                    <p className="font-medium">{selectedTicket.client_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Submitted By</p>
                  <p className="font-medium">
                    {selectedTicket.submitter?.name} ({selectedTicket.submitter?.role})
                  </p>
                </div>
              </div>

              {/* Resolution Text */}
              {selectedTicket.resolution_text && (
                <div>
                  <p className="text-sm font-medium mb-2">Resolution Details</p>
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    {selectedTicket.resolution_text}
                  </div>
                </div>
              )}

              {/* Screenshots */}
              {selectedTicket.proof_screenshot_urls && selectedTicket.proof_screenshot_urls.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Proof Screenshots</p>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTicket.proof_screenshot_urls.map((url, index) => (
                      <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={url} 
                          alt={`Proof ${index + 1}`} 
                          className="w-full h-32 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Audio */}
              {selectedTicket.proof_audio_url && (
                <div>
                  <p className="text-sm font-medium mb-2">Call Recording</p>
                  <audio controls src={selectedTicket.proof_audio_url} className="w-full" />
                </div>
              )}

              <DialogFooter className="gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowRejectDialog(true);
                  }}
                  disabled={isSaving}
                  className="gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Request More Info
                </Button>
                <Button 
                  onClick={() => handleApproveClosure(selectedTicket)}
                  disabled={isSaving}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Approve Closure
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejection Reason Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              Request More Information
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The ticket will be returned to the resolver for more information. Please provide details.
            </p>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="What additional information is needed?"
              rows={4}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRejectClosure}
              disabled={isSaving || !rejectionReason.trim()}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Return for More Info'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
