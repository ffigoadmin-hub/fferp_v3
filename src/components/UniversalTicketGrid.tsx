import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Clock, AlertTriangle, Eye, User, CheckCircle, UserPlus, Loader2
} from 'lucide-react';
import { DepartmentBadge } from '@/components/DepartmentBadge';
import { getTimeRemaining, formatTimeRemaining, getResolveSLAStatus } from '@/types/workflows';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type TicketSource = 'NSM' | 'DATA';
export type OwnerLevel = 'L1' | 'L2' | 'L3';

export interface UniversalTicket {
  id: string;
  ticket_number: number;
  issue_title: string;
  issue_description?: string;
  client_name?: string;
  department: string;
  source: TicketSource;
  current_owner: OwnerLevel;
  owner_name: string;
  owner_id?: string;
  status: string;
  resolve_deadline: string;
  ack_deadline?: string;
  created_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  blast_triggered_at?: string | null;
  proof_url?: string;
  has_followup?: boolean;
  priority_level?: 'P0' | 'P1' | 'P2' | 'P3';
}

interface UniversalTicketGridProps {
  tickets: UniversalTicket[];
  ticketType: 'escalation' | 'critical';
  onViewDetails: (ticket: UniversalTicket) => void;
  onAcknowledge?: (ticket: UniversalTicket) => void;
  onAssignResponder?: (ticket: UniversalTicket, responderId: string) => void;
  isLoading?: boolean;
  showActions?: boolean;
}

function LiveTimer({
  deadline,
  isBreached,
  hasFollowup = false,
  createdAt
}: {
  deadline: string;
  isBreached: boolean;
  hasFollowup?: boolean;
  createdAt?: string;
}) {
  const [remaining, setRemaining] = useState(getTimeRemaining(deadline));
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (isBreached && !hasFollowup) return;
    const interval = setInterval(() => {
      setRemaining(getTimeRemaining(deadline));
      if (createdAt) {
        setElapsed(Date.now() - new Date(createdAt).getTime());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline, isBreached, hasFollowup, createdAt]);

  const slaStatus = getResolveSLAStatus(deadline, true);

  // If breached BUT has followup, show "Time Taken" instead of "BREACHED"
  if (isBreached && hasFollowup && createdAt) {
    return (
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">Time Taken</span>
        <span className="font-mono text-sm font-bold text-orange-500">
          <Clock className="w-3 h-3 inline-block mr-1" />
          {formatTimeRemaining(elapsed)}
        </span>
      </div>
    );
  }

  if (isBreached || remaining === 0) {
    return (
      <span className="font-mono text-sm font-bold text-destructive animate-pulse">
        BREACHED
      </span>
    );
  }

  const statusColors = {
    ok: 'text-green-500',
    warning: 'text-yellow-500',
    critical: 'text-orange-500 animate-pulse',
    breached: 'text-destructive animate-pulse',
  };

  return (
    <span className={cn("font-mono text-sm font-bold", statusColors[slaStatus])}>
      <Clock className="w-3 h-3 inline-block mr-1" />
      {formatTimeRemaining(remaining)}
    </span>
  );
}

function OwnerLevelBadge({ level }: { level: OwnerLevel }) {
  const config = {
    L1: { label: 'L1 (Ops)', className: 'bg-blue-500/20 text-blue-600 border-blue-500/50' },
    L2: { label: 'L2 (GM)', className: 'bg-orange-500/20 text-orange-600 border-orange-500/50' },
    L3: { label: 'L3 (CEO)', className: 'bg-red-500/20 text-red-600 border-red-500/50' },
  };

  const { label, className } = config[level];

  return (
    <Badge variant="outline" className={cn("text-xs", className)}>
      {label}
    </Badge>
  );
}

export function UniversalTicketGrid({
  tickets,
  ticketType,
  onViewDetails,
  onAcknowledge,
  onAssignResponder,
  isLoading,
  showActions = true
}: UniversalTicketGridProps) {
  const { user } = useAuth();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<UniversalTicket | null>(null);
  const [selectedResponder, setSelectedResponder] = useState('');
  const [responders, setResponders] = useState<{ id: string; name: string; department: string }[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState<string | null>(null);

  // Fetch all active employees as responders
  useEffect(() => {
    const fetchResponders = async () => {
      const { data } = await (supabase
        .from('profiles') as any)
        .select('id, name, department, role')
        .eq('is_active', true)
        .order('name');
      setResponders((data || []).map(p => ({ id: p.id, name: p.name, department: p.department })));
    };
    fetchResponders();
  }, []);

  const handleAcknowledge = async (e: React.MouseEvent, ticket: UniversalTicket) => {
    e.stopPropagation();
    if (!user) return;

    setIsAcknowledging(ticket.id);
    if (ticketType === 'escalation') {
      const { error } = await (supabase
        .from('client_escalations') as any)
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user.id,
          status: 'acknowledged',
        })
        .eq('id', ticket.id);

      if (error) {
        toast.error('Failed to acknowledge ticket');
      } else {
        toast.success('Ticket acknowledged');
        if (onAcknowledge) onAcknowledge(ticket);
      }
    } else {
      const { error } = await (supabase
        .from('hourly_criticals') as any)
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user.id,
          status: 'acknowledged',
        })
        .eq('id', ticket.id);

      if (error) {
        toast.error('Failed to acknowledge ticket');
      } else {
        toast.success('Ticket acknowledged');
        if (onAcknowledge) onAcknowledge(ticket);
      }
    }
    setIsAcknowledging(null);
  };

  const handleOpenAssign = (e: React.MouseEvent, ticket: UniversalTicket) => {
    e.stopPropagation();
    setSelectedTicket(ticket);
    setSelectedResponder('');
    setAssignDialogOpen(true);
  };

  const handleAssignResponder = async () => {
    if (!selectedTicket || !selectedResponder) return;
    setIsAssigning(true);

    if (ticketType === 'escalation') {
      const { error } = await (supabase
        .from('client_escalations') as any)
        .update({
          acknowledged_by: selectedResponder,
          acknowledged_at: new Date().toISOString(),
          status: 'acknowledged',
        })
        .eq('id', selectedTicket.id);

      if (error) {
        toast.error('Failed to assign responder');
      } else {
        toast.success('Responder assigned');
        setAssignDialogOpen(false);
        if (onAssignResponder) onAssignResponder(selectedTicket, selectedResponder);
      }
    } else {
      const { error } = await (supabase
        .from('hourly_criticals') as any)
        .update({
          acknowledged_by: selectedResponder,
          acknowledged_at: new Date().toISOString(),
          status: 'acknowledged',
        })
        .eq('id', selectedTicket.id);

      if (error) {
        toast.error('Failed to assign responder');
      } else {
        toast.success('Responder assigned');
        setAssignDialogOpen(false);
        if (onAssignResponder) onAssignResponder(selectedTicket, selectedResponder);
      }
    }
    setIsAssigning(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertTriangle className="w-12 h-12 mb-4 opacity-50" />
        <p>No tickets found</p>
      </div>
    );
  }

  const prefix = ticketType === 'escalation' ? 'ESC' : 'CRIT';

  return (
    <>
      <ScrollArea className="h-[600px]">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">Ticket ID</TableHead>
              <TableHead className="w-[250px]">Issue Details</TableHead>
              <TableHead className="w-[80px]">Source</TableHead>
              <TableHead className="w-[100px]">Level</TableHead>
              <TableHead className="w-[80px]">Pri</TableHead>
              <TableHead className="w-[130px]">Responsible</TableHead>
              <TableHead className="w-[100px]">Timer</TableHead>
              <TableHead className="w-[200px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => {
              // Check if deadline has passed
              const deadlinePassed = new Date() > new Date(ticket.resolve_deadline);
              const isBreached = ticket.status === 'breached' || !!ticket.blast_triggered_at || deadlinePassed;
              const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
              const isAcknowledged = !!ticket.acknowledged_at;
              const canAcknowledge = !isAcknowledged && !isResolved && showActions;

              return (
                <TableRow
                  key={ticket.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    isBreached && "bg-destructive/5 hover:bg-destructive/10",
                    isResolved && "bg-muted/30 opacity-60"
                  )}
                  onClick={() => onViewDetails(ticket)}
                >
                  {/* Ticket ID */}
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {prefix}-{String(ticket.ticket_number).padStart(4, '0')}
                    </Badge>
                  </TableCell>

                  {/* Issue Details */}
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium text-sm line-clamp-1">{ticket.issue_title}</p>
                      {ticket.client_name && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {ticket.client_name}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          <DepartmentBadge department={ticket.department} size="sm" />
                        </Badge>
                      </div>
                    </div>
                  </TableCell>

                  {/* Source */}
                  <TableCell>
                    <Badge
                      variant={ticket.source === 'NSM' ? 'default' : 'secondary'}
                      className={cn(
                        "text-xs",
                        ticket.source === 'NSM' ? 'bg-primary' : 'bg-orange-500'
                      )}
                    >
                      {ticket.source}
                    </Badge>
                  </TableCell>

                  {/* Level */}
                   <TableCell>
                    <OwnerLevelBadge level={ticket.current_owner} />
                  </TableCell>
                  
                  <TableCell>
                    {ticket.priority_level && (
                      <Badge className={cn(
                        "text-[9px] font-black uppercase",
                        ticket.priority_level === 'P0' ? "bg-red-600 text-white" :
                        ticket.priority_level === 'P1' ? "bg-orange-600 text-white" :
                        ticket.priority_level === 'P2' ? "bg-blue-600 text-white" :
                        "bg-slate-600 text-white"
                      )}>
                        {ticket.priority_level}
                      </Badge>
                    )}
                  </TableCell>

                  {/* Responsible */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {ticket.owner_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs truncate max-w-[80px]">
                        {ticket.owner_name || 'Unassigned'}
                      </span>
                    </div>
                  </TableCell>

                  {/* Timer / Status */}
                  <TableCell>
                    {ticket.status === 'closed' ? (
                      <Badge className="bg-status-live hover:bg-status-live text-xs">CLOSED</Badge>
                    ) : ticket.status === 'resolved' ? (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-xs">
                        <Clock className="w-3 h-3 inline-block mr-1" /> WAITING AUDIT
                      </Badge>
                    ) : isBreached && ticket.has_followup ? (
                      <LiveTimer
                        deadline={ticket.resolve_deadline}
                        isBreached={true}
                        hasFollowup={true}
                        createdAt={ticket.created_at}
                      />
                    ) : isBreached ? (
                      <Badge variant="destructive" className="text-xs animate-pulse">BREACHED</Badge>
                    ) : isAcknowledged ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant="secondary" className="text-xs">Pending with SOLVER</Badge>
                        <LiveTimer deadline={ticket.resolve_deadline} isBreached={isBreached} createdAt={ticket.created_at} />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <Badge variant="secondary" className="text-xs">Pending with SOLVER</Badge>
                        <LiveTimer deadline={ticket.resolve_deadline} isBreached={isBreached} createdAt={ticket.created_at} />
                      </div>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {canAcknowledge && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs"
                          onClick={(e) => handleAcknowledge(e, ticket)}
                          disabled={isAcknowledging === ticket.id}
                        >
                          {isAcknowledging === ticket.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              ACK
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDetails(ticket);
                        }}
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Assign Responder Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Responder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ticket</Label>
              <p className="text-sm text-muted-foreground">
                {prefix}-{String(selectedTicket?.ticket_number || 0).padStart(4, '0')}: {selectedTicket?.issue_title}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Select Responder (L1 Solver)</Label>
              <Select value={selectedResponder} onValueChange={setSelectedResponder}>
                <SelectTrigger>
                  <SelectValue placeholder="Select responder..." />
                </SelectTrigger>
                <SelectContent>
                  {responders.map((resp) => (
                    <SelectItem key={resp.id} value={resp.id}>
                      {resp.name} ({resp.department})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select any active employee to assign
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignResponder} disabled={isAssigning || !selectedResponder}>
              {isAssigning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assign & Acknowledge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Helper function to transform escalation data to universal format
export function transformEscalationToUniversal(escalation: any): UniversalTicket {
  // Check if ticket has followup after breach:
  // - Resolution text exists (followup provided)
  // - OR ticket is past deadline but still being worked on (acknowledged or in progress)
  const deadlinePassed = new Date() > new Date(escalation.resolve_deadline);
  const isResolved = escalation.status === 'resolved' || escalation.status === 'closed';
  const hasResolutionText = !!(escalation.resolution_text || escalation.gm_resolution_text);
  const isBeingWorkedOn = escalation.acknowledged_at && !isResolved;
  const hasFollowup = hasResolutionText || (deadlinePassed && isBeingWorkedOn);

  let currentOwner: OwnerLevel = 'L1';
  let ownerName = escalation.creator?.name || 'Unassigned';

  if (escalation.pushed_to_ceo_at || escalation.status === 'escalated_ceo') {
    currentOwner = 'L3';
    ownerName = 'CEO';
  } else if (escalation.forwarded_to_gm_at || escalation.status === 'escalated_gm') {
    currentOwner = 'L2';
    ownerName = escalation.gm?.name || 'GM (Vignesh)';
  } else if (escalation.acknowledged_at) {
    ownerName = escalation.acknowledger?.name || ownerName;
  }

  return {
    id: escalation.id,
    ticket_number: escalation.ticket_number,
    issue_title: escalation.issue_title,
    issue_description: escalation.issue_description,
    client_name: escalation.client_name,
    department: escalation.department?.toLowerCase() === 'agri' ? 'agri' : 'engineering',
    source: 'NSM',
    current_owner: currentOwner,
    owner_name: ownerName,
    owner_id: escalation.acknowledged_by || escalation.created_by,
    status: escalation.status,
    resolve_deadline: escalation.resolve_deadline,
    ack_deadline: escalation.ack_deadline,
    created_at: escalation.created_at,
    acknowledged_at: escalation.acknowledged_at,
    resolved_at: escalation.resolved_at,
    proof_url: escalation.resolution_evidence_url,
    has_followup: hasFollowup,
    priority_level: escalation.priority_level,
  };
}

// Helper function to transform critical data to universal format
export function transformCriticalToUniversal(critical: any): UniversalTicket {
  // Check if ticket has followup after breach:
  // - Resolution text exists (followup provided)
  // - OR ticket is past deadline but still being worked on (acknowledged or in progress)
  const deadlinePassed = new Date() > new Date(critical.resolve_deadline);
  const isResolved = critical.status === 'resolved' || critical.status === 'closed';
  const hasResolutionText = !!critical.resolution_text;
  const isBeingWorkedOn = critical.acknowledged_at && !isResolved;
  const hasFollowup = hasResolutionText || (deadlinePassed && isBeingWorkedOn);

  return {
    id: critical.id,
    ticket_number: critical.ticket_number,
    issue_title: critical.issue_title,
    issue_description: critical.issue_description,
    department: critical.department?.toLowerCase() === 'agri' ? 'agri' : 'engineering',
    source: 'DATA',
    current_owner: 'L1', // Criticals stay at L1 until resolved
    owner_name: critical.acknowledger?.name || critical.creator?.name || 'Data Team',
    owner_id: critical.acknowledged_by || critical.created_by,
    status: critical.status,
    resolve_deadline: critical.resolve_deadline,
    ack_deadline: critical.ack_deadline,
    created_at: critical.created_at,
    acknowledged_at: critical.acknowledged_at,
    resolved_at: critical.resolved_at,
    blast_triggered_at: critical.blast_triggered_at,
    proof_url: critical.proof_url,
    has_followup: hasFollowup,
    priority_level: critical.priority_level,
  };
}
