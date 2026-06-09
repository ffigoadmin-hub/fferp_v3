import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  AlertTriangle, Flag, Clock, User, CheckCircle2, XCircle,
  MessageSquare, ChevronDown, ChevronUp, Send, Eye,
  ArrowRight, Shield, Zap, Calendar, FileText, Users,
  UserCheck, Bell, Target, Building2, CalendarDays
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useRealtimeEscalations, UnifiedTicket } from '@/hooks/useRealtimeEscalations';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

type DatePreset = 'today' | 'yesterday' | '7days' | '30days' | 'custom';

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

interface TimelineEvent {
  label: string;
  time: string | null;
  actor: string | null;
  icon: React.ReactNode;
  status: 'completed' | 'pending' | 'failed' | 'current';
  color: string;
}

function TicketTimeline({ ticket }: { ticket: UnifiedTicket }) {
  const events: TimelineEvent[] = [
    {
      label: 'Ticket Raised',
      time: ticket.created_at,
      actor: ticket.creator?.name || 'System',
      icon: <Flag className="w-3 h-3" />,
      status: 'completed',
      color: 'bg-blue-500'
    },
    {
      label: 'Acknowledged',
      time: ticket.acknowledged_at || null,
      actor: ticket.acknowledger?.name || null,
      icon: <Eye className="w-3 h-3" />,
      status: ticket.acknowledged_at ? 'completed' : (ticket.ack_late ? 'failed' : 'pending'),
      color: ticket.acknowledged_at ? 'bg-emerald-500' : (ticket.ack_late ? 'bg-red-500' : 'bg-muted')
    },
    {
      label: 'Assigned',
      time: ticket.raw?.assigned_at || null,
      actor: ticket.assigned_user?.name || ticket.assigned_role || null,
      icon: <UserCheck className="w-3 h-3" />,
      status: ticket.assigned_user?.name || ticket.assigned_role ? 'completed' : 'pending',
      color: ticket.assigned_user?.name || ticket.assigned_role ? 'bg-violet-500' : 'bg-muted'
    },
    {
      label: 'Resolution Submitted',
      time: ticket.resolved_at || null,
      actor: ticket.resolver?.name || null,
      icon: <FileText className="w-3 h-3" />,
      status: ticket.resolved_at ? 'completed' : 'pending',
      color: ticket.resolved_at ? 'bg-amber-500' : 'bg-muted'
    },
    {
      label: 'Closed',
      time: ticket.status === 'closed' ? ticket.raw?.closure_approved_at || ticket.resolved_at : null,
      actor: ticket.status === 'closed' ? (ticket.raw?.closure_approved_by_name || 'Admin') : null,
      icon: <CheckCircle2 className="w-3 h-3" />,
      status: ticket.status === 'closed' ? 'completed' : 'pending',
      color: ticket.status === 'closed' ? 'bg-emerald-500' : 'bg-muted'
    }
  ];

  return (
    <div className="relative space-y-0">
      {events.map((event, idx) => {
        const isLast = idx === events.length - 1;
        const showEvent = event.status !== 'pending' || event.label === 'Closed';
        
        if (!showEvent) return null;

        return (
          <div key={idx} className="relative flex gap-3">
            {/* Vertical Line */}
            {!isLast && event.status === 'completed' && (
              <div className="absolute left-[11px] top-6 w-0.5 h-[calc(100%-8px)] bg-border" />
            )}
            
            {/* Icon Circle */}
            <div className={cn(
              "relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white",
              event.color,
              event.status === 'pending' && "bg-muted text-muted-foreground"
            )}>
              {event.icon}
            </div>
            
            {/* Content */}
            <div className="flex-1 pb-4 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  "text-sm font-medium",
                  event.status === 'pending' && "text-muted-foreground"
                )}>
                  {event.label}
                </span>
                {event.status === 'failed' && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                    LATE
                  </Badge>
                )}
              </div>
              {event.time ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(event.time), 'dd MMM yyyy, hh:mm a')}
                  {event.actor && <span className="font-medium text-foreground/70"> • by {event.actor}</span>}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/50 italic mt-0.5">Pending</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TicketCard({ ticket, onViewDetails }: { ticket: UnifiedTicket; onViewDetails: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState('');

  const isBreached = ticket.ack_late || ticket.blast_triggered_at || new Date() > new Date(ticket.resolve_deadline);
  const isUrgent = ticket.current_level === 'L3_CEO' || ticket.urgency === 'critical';

  const getLevelBadge = () => {
    if (!ticket.current_level || ticket.status === 'closed') return null;
    const levelMap: Record<string, { label: string; className: string }> = {
      'L1_OPS': { label: 'L1 OPS', className: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
      'L2_GM': { label: 'L2 GM', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
      'L3_CEO': { label: 'L3 CEO', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    };
    return levelMap[ticket.current_level] || null;
  };

  const getStatusBadge = () => {
    if (ticket.status === 'closed') return { label: 'Closed', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    if (ticket.status === 'resolved' || ticket.status === 'pending_closure_approval') return { label: 'Audit Pending', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    if (isBreached) return { label: 'Breached', className: 'bg-red-500/20 text-red-400 border-red-500/30' };
    return { label: 'Active', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  };

  const levelBadge = getLevelBadge();
  const statusBadge = getStatusBadge();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl overflow-hidden transition-all hover:border-border",
        isUrgent && ticket.status !== 'closed' && "border-destructive/40 hover:border-destructive/60"
      )}
    >
      {/* Compact Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left: Icon + Info */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              ticket.source === 'NSM' 
                ? "bg-gradient-to-br from-primary/20 to-primary/5 text-primary" 
                : "bg-gradient-to-br from-destructive/20 to-destructive/5 text-destructive"
            )}>
              {ticket.source === 'NSM' ? (
                <Flag className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            
            <div className="min-w-0 flex-1">
              {/* Badges Row */}
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className="text-xs font-mono text-muted-foreground">#{ticket.ticket_number}</span>
                {levelBadge && (
                  <Badge variant="outline" className={cn("text-[10px] font-semibold px-1.5 py-0 h-4", levelBadge.className)}>
                    {levelBadge.label}
                  </Badge>
                )}
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4", statusBadge.className)}>
                  {statusBadge.label}
                </Badge>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {ticket.source === 'NSM' ? 'Escalation' : 'Critical'}
                </Badge>
              </div>
              
              {/* Title */}
              <h4 className="font-medium text-sm leading-snug line-clamp-2">
                {ticket.issue_title}
              </h4>
            </div>
          </div>

          {/* Right: Time + Department */}
          <div className="text-right shrink-0 space-y-1">
            <p className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
            </p>
            {ticket.department && (
              <Badge variant="outline" className="text-[10px] font-medium">
                {ticket.department}
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Info Grid */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="bg-muted/40 rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Raised By</p>
            <p className="text-xs font-medium truncate mt-0.5">{ticket.creator?.name || 'Unknown'}</p>
          </div>
          <div className="bg-muted/40 rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Assigned To</p>
            <p className="text-xs font-medium truncate mt-0.5">{ticket.assigned_user?.name || ticket.assigned_role || 'Unassigned'}</p>
          </div>
          <div className="bg-muted/40 rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Deadline</p>
            <p className={cn(
              "text-xs font-medium mt-0.5",
              new Date() > new Date(ticket.resolve_deadline) && ticket.status !== 'closed' && "text-destructive"
            )}>
              {format(new Date(ticket.resolve_deadline), 'dd MMM, hh:mm a')}
            </p>
          </div>
        </div>
      </div>

      {/* Expandable Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Separator />
            <div className="p-4 space-y-4 bg-muted/10">
              {/* Description */}
              <div>
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Description
                </h5>
                <p className="text-sm leading-relaxed">{ticket.issue_description}</p>
              </div>

              {/* Timeline */}
              <div>
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Timeline
                </h5>
                <div className="bg-card/50 rounded-lg p-4 border border-border/40">
                  <TicketTimeline ticket={ticket} />
                </div>
              </div>

              {/* Client Info */}
              {ticket.client_name && (
                <div className="bg-card/50 rounded-lg p-4 border border-border/40">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Client
                    </h5>
                  </div>
                  <p className="text-sm font-medium">{ticket.client_name}</p>
                  {ticket.project?.project_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Project: {ticket.project.project_name}
                    </p>
                  )}
                </div>
              )}

              {/* CEO Remarks */}
              <div>
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  CEO Remarks
                </h5>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add your remarks or instructions..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="text-sm min-h-[70px] resize-none bg-card/50"
                  />
                  <Button size="icon" variant="secondary" className="shrink-0 h-[70px] w-10">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Actions */}
      <Separator />
      <div className="px-4 py-2.5 flex items-center justify-between bg-muted/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-xs h-7 px-2 gap-1 text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Collapse
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              View Details
            </>
          )}
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onViewDetails} 
          className="text-xs h-7 px-3 gap-1"
        >
          <Eye className="w-3.5 h-3.5" />
          Full View
        </Button>
      </div>
    </motion.div>
  );
}

export function CEOEscalationOverview() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'active' | 'audit' | 'closed'>('active');
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Calculate date range based on preset
  const dateRange = useMemo((): DateRange => {
    const today = new Date();
    switch (datePreset) {
      case 'today':
        return { start: startOfDay(today), end: endOfDay(today), label: 'Today' };
      case 'yesterday':
        const yesterday = subDays(today, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday), label: 'Yesterday' };
      case '7days':
        return { start: startOfDay(subDays(today, 6)), end: endOfDay(today), label: 'Past 7 Days' };
      case '30days':
        return { start: startOfDay(subDays(today, 29)), end: endOfDay(today), label: 'Past 30 Days' };
      case 'custom':
        if (customRange.from && customRange.to) {
          return { 
            start: startOfDay(customRange.from), 
            end: endOfDay(customRange.to), 
            label: `${format(customRange.from, 'dd MMM')} - ${format(customRange.to, 'dd MMM')}` 
          };
        }
        return { start: startOfDay(today), end: endOfDay(today), label: 'Custom' };
      default:
        return { start: startOfDay(today), end: endOfDay(today), label: 'Today' };
    }
  }, [datePreset, customRange]);

  const { unifiedTickets, counts, isLoading } = useRealtimeEscalations({
    startDate: format(dateRange.start, 'yyyy-MM-dd'),
    endDate: format(dateRange.end, 'yyyy-MM-dd'),
  });

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      setIsCalendarOpen(false);
    }
  };

  const handleCustomRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      setCustomRange(range);
      setDatePreset('custom');
      setIsCalendarOpen(false);
    } else if (range?.from) {
      setCustomRange({ from: range.from, to: undefined });
    }
  };

  // Filter only escalations (NSM source), exclude criticals (DATA source)
  const escalationsOnly = unifiedTickets.filter(t => t.source === 'NSM');
  
  // Calculate escalation-specific counts
  const escalationCounts = {
    total: escalationsOnly.length,
    active: escalationsOnly.filter(t => t.status !== 'closed' && t.status !== 'resolved' && t.status !== 'pending_closure_approval').length,
    audit: escalationsOnly.filter(t => t.status === 'resolved' || t.status === 'pending_closure_approval').length,
    closed: escalationsOnly.filter(t => t.status === 'closed').length,
  };

  const filteredTickets = escalationsOnly.filter(t => {
    if (filter === 'active') return t.status !== 'closed' && t.status !== 'resolved' && t.status !== 'pending_closure_approval';
    if (filter === 'audit') return t.status === 'resolved' || t.status === 'pending_closure_approval';
    if (filter === 'closed') return t.status === 'closed';
    return true;
  });

  const handleViewDetails = (ticket: UnifiedTicket) => {
    navigate(`/dashboard/escalations?tab=${ticket.source === 'NSM' ? 'escalations' : 'criticals'}`);
  };

  if (isLoading) {
    return (
      <Card className="bg-card/60 backdrop-blur-sm border-border/50">
        <CardContent className="p-8 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground text-sm">Loading escalations...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/50 overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 via-primary/20 to-transparent flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Escalation Command Center</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {escalationCounts.active} Active • {escalationCounts.audit} Awaiting Audit • {escalationCounts.closed} Closed
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Date Filter */}
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 min-w-[120px]"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  {dateRange.label}
                  <ChevronDown className="w-3 h-3 ml-auto opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-2 border-b border-border/50 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground px-2 pb-1">Quick Select</p>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { key: 'today', label: 'Today' },
                      { key: 'yesterday', label: 'Yesterday' },
                      { key: '7days', label: 'Past 7 Days' },
                      { key: '30days', label: 'Past 30 Days' },
                    ].map((preset) => (
                      <Button
                        key={preset.key}
                        variant={datePreset === preset.key ? 'default' : 'ghost'}
                        size="sm"
                        className="text-xs h-7 justify-start"
                        onClick={() => handlePresetChange(preset.key as DatePreset)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium text-muted-foreground px-2 pb-2">Custom Range</p>
                  <CalendarComponent
                    mode="range"
                    selected={customRange as { from: Date; to?: Date }}
                    onSelect={handleCustomRangeSelect}
                    numberOfMonths={1}
                    disabled={{ after: new Date() }}
                    className="pointer-events-auto"
                  />
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard/escalations?tab=escalations')}
              className="text-xs gap-1.5"
            >
              View All
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-10 p-1 bg-muted/50">
            <TabsTrigger value="all" className="text-xs gap-1.5 data-[state=active]:bg-background">
              All
              <Badge variant="secondary" className="text-[10px] px-1.5 h-4 ml-0.5">{escalationCounts.total}</Badge>
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs gap-1.5 data-[state=active]:bg-background">
              Active
              <Badge variant="secondary" className="text-[10px] px-1.5 h-4 ml-0.5">{escalationCounts.active}</Badge>
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs gap-1.5 data-[state=active]:bg-background">
              Audit
              <Badge variant="secondary" className="text-[10px] px-1.5 h-4 ml-0.5">{escalationCounts.audit}</Badge>
            </TabsTrigger>
            <TabsTrigger value="closed" className="text-xs gap-1.5 data-[state=active]:bg-background">
              Closed
              <Badge variant="secondary" className="text-[10px] px-1.5 h-4 ml-0.5">{escalationCounts.closed}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Tickets List */}
        <ScrollArea className="h-[520px]">
          <div className="space-y-3 pr-3">
            {filteredTickets.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">No tickets in this category</p>
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onViewDetails={() => handleViewDetails(ticket)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
