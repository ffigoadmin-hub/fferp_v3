import { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Clock, AlertTriangle, ExternalLink, CheckCircle, Loader2,
  Building2, Leaf, RefreshCw, Phone, CalendarIcon, Eye
} from 'lucide-react';
import { TicketDetailsModal } from './TicketDetailsModal';
import { ResolveTicketModal, ResolveData } from './ResolveTicketModal';
import { cn } from '@/lib/utils';
import { useEscalationEngine } from '@/hooks/useEscalationEngine';
import { transformEscalationToUniversal, transformCriticalToUniversal } from './UniversalTicketGrid';
import { WorkflowTimelineEntry } from '@/types/workflows';

interface SLATimerCellProps {
  deadline: string;
  status: string;
}

function SLATimerCell({ deadline, status }: SLATimerCellProps) {
  const [remaining, setRemaining] = useState('');
  const [timerStatus, setTimerStatus] = useState<'green' | 'yellow' | 'red' | 'breached'>('green');

  useEffect(() => {
    if (!deadline || isNaN(new Date(deadline).getTime())) {
      setRemaining('--:--:--');
      setTimerStatus('green');
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const deadlineMs = new Date(deadline).getTime();
      const diff = deadlineMs - now;

      if (status === 'resolved' || status === 'closed') {
        setRemaining('Resolved');
        setTimerStatus('green');
        return;
      }

      if (diff <= 0) {
        const negativeMins = Math.abs(Math.floor(diff / 60000));
        if (negativeMins >= 60) {
          const hours = Math.floor(negativeMins / 60);
          const mins = negativeMins % 60;
          setRemaining(`-${hours}h ${mins}m`);
        } else {
          setRemaining(`-${negativeMins}m`);
        }
        setTimerStatus('breached');
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (hours > 0) {
        setRemaining(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }

      if (minutes < 10 && hours === 0) setTimerStatus('red');
      else if (minutes < 30 && hours === 0) setTimerStatus('yellow');
      else setTimerStatus('green');
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [deadline, status]);

  const colors = {
    green: 'text-status-live font-mono',
    yellow: 'text-status-late font-mono',
    red: 'text-status-missed font-mono animate-pulse font-bold',
    breached: 'text-destructive font-mono font-bold',
  };

  return (
    <div className={cn('flex items-center gap-1', colors[timerStatus])}>
      {timerStatus === 'breached' ? <span className="uppercase">BREACHED {remaining}</span> : <><Clock className="w-3 h-3" /><span>{remaining}</span></>}
    </div>
  );
}

interface ExecutiveTicketTableProps {
  role: 'ceo' | 'admin' | 'gm';
  showEscalations?: boolean;
  showCriticals?: boolean;
  hideHeader?: boolean;
}

export function ExecutiveTicketTable({ role, showEscalations = true, showCriticals = true, hideHeader = false }: ExecutiveTicketTableProps) {
  const {
    tickets: unifiedTickets,
    counts,
    isLoading,
    isSaving,
    lastUpdated,
    acknowledge,
    resolve,
    escalateToGM,
    escalateToCEO,
    verifyAndClose,
    rejectProof,
    addComment,
    startWarRoom,
    refetch
  } = useEscalationEngine();

  const [selectedDept, setSelectedDept] = useState<'all' | 'civil' | 'agri'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'open' | 'breached' | 'resolved'>('all');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [timeline, setTimeline] = useState<WorkflowTimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const fetchTimeline = useCallback(async (ticketId: string, type: 'escalation' | 'critical') => {
    setTimelineLoading(true);
    try {
      let result;
      if (type === 'escalation') {
        result = await supabase.from('client_escalation_timeline').select('*').eq('escalation_id', ticketId).order('created_at', { ascending: true });
      } else {
        result = await supabase.from('hourly_critical_timeline').select('*').eq('critical_id', ticketId).order('created_at', { ascending: true });
      }
      if (result.error) throw result.error;
      setTimeline(result.data || []);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const selectedTicket = useMemo(() => unifiedTickets.find(t => t.id === selectedTicketId), [unifiedTickets, selectedTicketId]);

  const applyFilters = (items: any[]) => {
    return items.filter(item => {
      const raw = item.raw;
      // Dept filter
      if (selectedDept !== 'all') {
        const dept = (raw.department || '').toLowerCase();
        const matches = selectedDept === 'civil'
          ? (dept === 'civil' || dept === 'engineering' || dept === 'eng')
          : (dept === 'agri' || dept === 'agriculture');
        if (!matches) return false;
      }
      // Status filter
      if (selectedStatus !== 'all') {
        const isBreached = item.type === 'escalation' ? (raw.status === 'breached' || raw.ack_late) : (raw.status === 'breached' || raw.blast_triggered_at);
        const isResolved = raw.status === 'resolved' || raw.status === 'closed';
        if (selectedStatus === 'breached' && !isBreached) return false;
        if (selectedStatus === 'resolved' && !isResolved) return false;
        if (selectedStatus === 'open' && (isBreached || isResolved)) return false;
      }
      // Date filter
      if (selectedDate) {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        if (!raw.created_at.startsWith(dateStr)) return false;
      }
      return true;
    });
  };

  const filteredEscalations = applyFilters(unifiedTickets.filter(t => t.type === 'escalation'));
  const filteredCriticals = applyFilters(unifiedTickets.filter(t => t.type === 'critical'));

  const openDetails = (id: string, type: 'escalation' | 'critical') => {
    setSelectedTicketId(id);
    fetchTimeline(id, type);
  };

  const StatusBadge = ({ status, ticket }: { status: string, ticket: any }) => {
    const isBreached = ticket.type === 'escalation' ? (ticket.raw.status === 'breached' || ticket.raw.ack_late) : (ticket.raw.status === 'breached' || ticket.raw.blast_triggered_at);
    const isAssigned = !!(ticket.raw.assigned_user_id || ticket.raw.assigned_user_ids?.length > 0 || ticket.raw.assigned_role);

    let displayStatus = status;
    let label = status;

    if (status === 'resolved' || status === 'pending_closure_approval') {
      displayStatus = 'resolved';
      label = 'Waiting for Audit';
    } else if (status === 'closed') {
      displayStatus = 'closed';
      label = 'Closed';
    } else if (isAssigned) {
      displayStatus = 'assigned';
      label = 'Assigned';
    } else if (isBreached) {
      displayStatus = 'breached';
      label = 'Breached';
    }

    return (
      <Badge className={cn(
        'capitalize text-xs',
        displayStatus === 'resolved' && 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200', // Warning/Pending color
        displayStatus === 'closed' && 'bg-status-live hover:bg-status-live',
        displayStatus === 'breached' && 'bg-destructive hover:bg-destructive animate-pulse',
        displayStatus === 'assigned' && 'bg-primary hover:bg-primary',
        displayStatus === 'acknowledged' && 'bg-primary hover:bg-primary',
        displayStatus === 'open' && 'bg-status-late hover:bg-status-late',
      )}>
        {label === 'Waiting for Audit' ? (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> Waiting for Audit
          </span>
        ) : label}
      </Badge>
    );
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const content = (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2 px-2">
        <Popover>
          <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-8 gap-2"><CalendarIcon className="w-3 h-3" />{selectedDate ? format(selectedDate, 'dd MMM yyyy') : 'All Dates'}</Button></PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />{selectedDate && <div className="p-2 border-t"><Button variant="ghost" size="sm" className="w-full" onClick={() => setSelectedDate(undefined)}>Clear</Button></div>}</PopoverContent>
        </Popover>
        <Select value={selectedDept} onValueChange={(v) => setSelectedDept(v as any)}><SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Depts</SelectItem><SelectItem value="civil">Civil</SelectItem><SelectItem value="agri">Agri</SelectItem></SelectContent></Select>
        <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}><SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="breached">Breached</SelectItem><SelectItem value="resolved">Resolved</SelectItem></SelectContent></Select>
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-4 text-sm font-bold">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" />ESC: {counts.escalationActive}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" />CRT: {counts.criticalActive}</span>
        </div>
      </div>
      <Tabs defaultValue="escalations" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-4">
          <TabsTrigger value="escalations" className="text-xs gap-1 font-bold">CLIENT BRIEFS ({filteredEscalations.length})</TabsTrigger>
          <TabsTrigger value="criticals" className="text-xs gap-1 font-bold">CRITICAL DEVIATIONS ({filteredCriticals.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="escalations">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader><TableRow className="text-xs uppercase font-bold"><TableHead>Ref</TableHead><TableHead>Client / Intelligence</TableHead><TableHead>Dept</TableHead><TableHead>Pri</TableHead><TableHead>SLA</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredEscalations.map((t) => (
                  <TableRow key={t.id} onClick={() => openDetails(t.id, 'escalation')} className="cursor-pointer hover:bg-muted/50 text-[11px]">
                    <TableCell className="font-mono font-bold">ESC-{String(t.raw.ticket_number).padStart(4, '0')}</TableCell>
                    <TableCell><div><p className="font-bold">{t.raw.client_name}</p><p className="text-muted-foreground line-clamp-1">{t.raw.issue_title}</p></div></TableCell>
                    <TableCell><Badge variant="outline" className="text-[9px] uppercase font-bold">{t.raw.department}</Badge></TableCell>
                    <TableCell>
                      {t.priority_level && (
                        <Badge className={cn(
                          "text-[9px] font-black",
                          t.priority_level === 'P0' ? "bg-red-600 text-white" :
                          t.priority_level === 'P1' ? "bg-orange-600 text-white" :
                          t.priority_level === 'P2' ? "bg-blue-600 text-white" :
                          "bg-slate-600 text-white"
                        )}>
                          {t.priority_level}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell><SLATimerCell deadline={t.raw.resolve_deadline || t.raw.ack_deadline} status={t.raw.status} /></TableCell>
                    <TableCell><StatusBadge status={t.raw.status} ticket={t} /></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-6 w-6"><Eye className="w-3 h-3" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="criticals">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader><TableRow className="text-xs uppercase font-bold"><TableHead>Ref</TableHead><TableHead>Operational Intelligence</TableHead><TableHead>Dept</TableHead><TableHead>Pri</TableHead><TableHead>SLA</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredCriticals.map((t) => (
                  <TableRow key={t.id} onClick={() => openDetails(t.id, 'critical')} className="cursor-pointer hover:bg-muted/50 text-[11px]">
                    <TableCell className="font-mono font-bold">CRT-{String(t.raw.ticket_number).padStart(4, '0')}</TableCell>
                    <TableCell><div><p className="font-bold">{t.raw.issue_title}</p><p className="text-muted-foreground line-clamp-1">{t.raw.issue_description}</p></div></TableCell>
                    <TableCell><Badge variant="outline" className="text-[9px] uppercase font-bold">{t.raw.department}</Badge></TableCell>
                    <TableCell>
                      {t.priority_level && (
                        <Badge className={cn(
                          "text-[9px] font-black uppercase",
                          t.priority_level === 'P0' ? "bg-red-600 text-white" :
                          t.priority_level === 'P1' ? "bg-orange-600 text-white" :
                          t.priority_level === 'P2' ? "bg-blue-600 text-white" :
                          "bg-slate-600 text-white"
                        )}>
                          {t.priority_level}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell><SLATimerCell deadline={t.raw.resolve_deadline} status={t.raw.status} /></TableCell>
                    <TableCell><StatusBadge status={t.raw.status} ticket={t} /></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-6 w-6"><Eye className="w-3 h-3" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <div className="space-y-4">
      {hideHeader ? (
        <div className="p-4">{content}</div>
      ) : (
        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-widest font-black italic">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Operational Fire-deck
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <RefreshCw className="w-3 h-3" />
                SYNC: {format(lastUpdated, 'HH:mm:ss')}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refetch}>
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {content}
          </CardContent>
        </Card>
      )}

      {selectedTicket && (
        <TicketDetailsModal
          open={!!selectedTicketId && !showResolveModal}
          onClose={() => setSelectedTicketId(null)}
          ticket={selectedTicket.raw}
          ticketType={selectedTicket.type}
          timeline={timeline}
          timelineLoading={timelineLoading}
          role={role}
          onAcknowledge={() => acknowledge(selectedTicket.id, selectedTicket.type)}
          onOpenResolveModal={() => setShowResolveModal(true)}
          onPushToGM={() => escalateToGM(selectedTicket.id)}
          onPushToCEO={() => escalateToCEO(selectedTicket.id)}
          onAddComment={(comment, audio) => addComment(selectedTicket.id, selectedTicket.type, comment, audio)}
          onVerifyAndClose={() => verifyAndClose(selectedTicket.id, selectedTicket.type)}
          onRejectProof={(reason) => rejectProof(selectedTicket.id, selectedTicket.type, reason)}
          onStartWarRoom={async (link) => {
            await startWarRoom(selectedTicket.id, link);
            refetch();
          }}
          isSaving={isSaving}
        />
      )}

      {selectedTicket && (
        <ResolveTicketModal
          open={showResolveModal}
          onClose={() => setShowResolveModal(false)}
          onResolve={(data) => resolve(selectedTicket.id, selectedTicket.type, data)}
          ticketId={selectedTicketId || ''}
          ticketType={selectedTicket.type}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
