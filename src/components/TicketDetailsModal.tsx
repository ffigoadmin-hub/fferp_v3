import { useState, useEffect, Fragment, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Clock, AlertTriangle, Loader2, Building2, Leaf, ExternalLink,
  User, Phone, FileText, CheckCircle, XCircle, ArrowUpRight,
  Circle, Image as ImageIcon, Timer, Mic, MessageSquare, Forward, Users, MapPin,
  Play, Pause, Download, History, Shield, Zap, ShieldAlert, Check, Send, Bot, Copy, Brain
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

import { SLAPulseBadge } from './shared/SLAPulseBadge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { WorkflowTimelineEntry, getTimeRemaining, getTimeOverdue, formatTimeRemaining } from '@/types/workflows';
import { AudioRecorder } from './AudioRecorder';
import { AudioWaveform, InlineVoiceRecorder } from './AudioWaveform';
import { MentionInput } from './MentionInput';
import { supabase } from '@/integrations/supabase/client';
import { AssignEscalationModal } from './AssignEscalationModal';
import { toast } from 'sonner';
import { TicketViewers } from './TicketViewers';
import { EvidenceMediaGallery } from './EvidenceMediaGallery';
import { IntelligenceHub } from './nsm/IntelligenceHub';

interface ResolverUser {
  id: string;
  name: string;
  role: string;
  department: string;
}

// Helper to render clickable links in text
const renderClickableText = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80 inline-flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {part.length > 40 ? part.slice(0, 40) + '...' : part}
          <ExternalLink className="w-3 h-3" />
        </a>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
};

// Helper to extract meaningful content from timeline entry details
const getTimelineContent = (entry: WorkflowTimelineEntry): string => {
  const details = entry.details || {};
  const action = entry.action?.toLowerCase() || '';

  // Priority order for text content
  if (details.resolution_text) return details.resolution_text;
  if (details.note && details.note.trim()) return details.note;
  if (details.comment && details.comment.trim()) return details.comment;
  if (details.message && details.message.trim()) return details.message;
  if (details.rejection_reason) return `Reason: ${details.rejection_reason}`;

  // Generate descriptive text for specific actions
  if (action === 'assigned' && details.assigned_to) {
    return `Assigned to ${details.assigned_to}${details.assigned_role ? ` (${details.assigned_role})` : ''}`;
  }

  // Skip redundant "status_" prefix actions - these are captured by the main action
  if (action.startsWith('status_')) {
    return ''; // Will be filtered out
  }

  if (action === 'created') {
    return 'Ticket logged';
  }

  if (action === 'acknowledged') {
    return 'Ticket acknowledged - SLA timer started';
  }

  if (action === 'resolved_with_proof' || action === 'resolved_proof_submitted' || action === 'resolved') {
    const imgCount = details.image_count ? `${details.image_count} image(s)` : '';
    const hasAudio = details.has_audio ? 'voice note' : '';
    const attachments = [imgCount, hasAudio].filter(Boolean).join(' and ');
    return attachments ? `Resolution submitted with ${attachments}` : 'Resolution proof submitted';
  }

  if (action === 'admin_verified_and_closed' || action === 'closed') {
    return 'Ticket verified and closed';
  }

  if (action === 'pushed_to_gm' || action === 'escalated_gm') {
    return 'Escalated to GM for review';
  }

  if (action === 'pushed_to_ceo' || action === 'escalated_ceo') {
    return 'Escalated to CEO for review';
  }

  if (action === 'reopened') {
    return 'Ticket reopened';
  }

  if (action === 'updated') {
    return 'Ticket updated';
  }

  if (action === 'comment_added' || action === 'comment') {
    return details.comment || details.note || 'Comment added';
  }

  // Fallback: humanize action name
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
};

// Filter out duplicate/redundant timeline entries
const filterTimelineEntries = (entries: WorkflowTimelineEntry[]): WorkflowTimelineEntry[] => {
  const seen = new Set<string>();
  const filtered: WorkflowTimelineEntry[] = [];

  // Sort by created_at to process in order
  const sorted = [...entries].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  for (const entry of sorted) {
    const action = entry.action?.toLowerCase() || '';
    const content = getTimelineContent(entry);

    // Skip empty content (status_ prefix entries)
    if (!content || content.trim() === '') continue;

    // Create a unique key based on action type and approximate time (within 2 seconds)
    const timeKey = Math.floor(new Date(entry.created_at).getTime() / 2000);

    // Skip redundant status_* entries that duplicate the main action
    if (action.startsWith('status_')) continue;

    // Deduplicate entries that happen at the same time with similar actions
    const actionGroup = action.replace(/status_/g, '').replace(/_/g, '');
    const dedupeKey = `${actionGroup}-${timeKey}`;

    // Skip if we've seen a similar entry in the same time window
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    filtered.push(entry);
  }

  return filtered;
};

// Role-based access helper
const getRolePermissions = (role: string, currentLevel: string, ticketStatus: string, isAcknowledged: boolean, ticket?: any) => {
  const normalizedRole = (typeof role === 'string' ? role : '').toLowerCase();
  const isResolved = ticketStatus === 'resolved' || ticketStatus === 'closed';

  // Check if ticket has been assigned to SMO/GMO or any user
  const hasAssignedUsers = ticket?.assigned_smo_id || ticket?.assigned_gmo_id || ticket?.assigned_user_id || (ticket?.assigned_user_ids && ticket?.assigned_user_ids.length > 0);

  // L1 - BOI: Can acknowledge, assign, and resolve (after assignment)
  // BOI can resolve ONLY after they've assigned the ticket to someone
  // Adding datateam to have similar permissions as admin for escalations
  if (normalizedRole === 'boi' || normalizedRole === 'admin' || normalizedRole === 'datateam' || normalizedRole === 'data_team' || normalizedRole === 'data') {
    return {
      canAcknowledge: !isResolved && !isAcknowledged,
      canResolve: (normalizedRole === 'admin' || normalizedRole === 'datateam' || normalizedRole === 'data_team') ? !isResolved : (!isResolved && hasAssignedUsers),
      canComment: true,
      canPushToGM: !isResolved,
      canPushToCEO: false,
      canFollowup: !isResolved,
      canAssignResolver: !isResolved && isAcknowledged && !hasAssignedUsers, // Hide if already assigned
      canAssignTeam: !isResolved && !hasAssignedUsers, // Add this
      canVerifyAndClose: (normalizedRole === 'admin' || normalizedRole === 'datateam' || normalizedRole === 'data_team') && 
        (ticketStatus === 'resolved' || ticketStatus === 'pending_closure_approval' || ticketStatus === 'waiting_audit'),
      canRejectProof: (normalizedRole === 'admin' || normalizedRole === 'datateam' || normalizedRole === 'data_team') && 
        (ticketStatus === 'resolved' || ticketStatus === 'pending_closure_approval' || ticketStatus === 'waiting_audit'),
      canDelete: normalizedRole === 'admin', // Admin only
    };
  }

  // NSM, SMO, GMO: Can resolve if assigned to them OR if they are the current owner
  if (['nsm', 'smo', 'gmo'].includes(normalizedRole)) {
    const isAssignedToMe = currentLevel === normalizedRole ||
      currentLevel.toLowerCase().includes(normalizedRole);
    return {
      canAcknowledge: false,
      canResolve: !isResolved && isAssignedToMe,
      canComment: true,
      canPushToGM: false,
      canPushToCEO: false,
      canFollowup: !isResolved && isAssignedToMe,
      canAssignResolver: false,
    };
  }

  // L2 - GM: Can resolve at GM level, can push to CEO
  if (normalizedRole === 'gm') {
    const isGMAcknowledged = !!ticket?.gm_ack_at;
    return {
      canAcknowledge: !isResolved && !isGMAcknowledged && (currentLevel === 'gm' || currentLevel === 'l2'),
      canResolve: !isResolved && (currentLevel === 'gm' || currentLevel === 'l2'),
      canComment: true,
      canPushToGM: false,
      canPushToCEO: !isResolved && (currentLevel === 'gm' || currentLevel === 'l2'),
      canFollowup: !isResolved,
      canAssignResolver: false,
    };
  }

  // L3 - CEO: Full access
  if (normalizedRole === 'ceo') {
    return {
      canAcknowledge: false,
      canResolve: !isResolved,
      canComment: true,
      canPushToGM: false,
      canPushToCEO: false,
      canFollowup: !isResolved,
      canAssignResolver: false,
    };
  }

  // Auditor: Strict view-only, but can see timeline and comments
  if (normalizedRole === 'auditor') {
    return {
      canAcknowledge: false,
      canResolve: false,
      canComment: false, // Strict read-only as per "Strict Read-Only" requirement
      canPushToGM: false,
      canPushToCEO: false,
      canFollowup: false,
      canAssignResolver: false,
    };
  }

  // Default: view only
  return {
    canAcknowledge: false,
    canResolve: false,
    canComment: false,
    canPushToGM: false,
    canPushToCEO: false,
    canFollowup: false,
    canAssignResolver: false,
  };
};

export type TicketType = 'escalation' | 'critical' | 'site_visit';

interface TicketDetailsModalProps {
  open: boolean;
  onClose: () => void;
  ticket: any;
  ticketType: TicketType;
  timeline: WorkflowTimelineEntry[];
  timelineLoading: boolean;
  role: string;
  onResolve?: (resolutionText: string, screenshotUrls?: string[], audioUrl?: string) => Promise<void>;
  onOpenResolveModal?: () => void; // MODULE 1: Open the ResolveTicketModal instead of inline form
  onAcknowledge?: () => Promise<void>; // BOI acknowledge ticket
  onPushToGM?: () => Promise<void>;
  onPushToCEO?: () => Promise<void>;
  onFollowup?: (note: string) => Promise<void>;
  onAddComment?: (comment: string, audioUrl?: string) => Promise<void>;
  onAssignToResolver?: (selectedUsers: Array<{ id: string; name: string; role: string }>) => Promise<void>;
  onVerifyAndClose?: () => Promise<void>;
  onRejectProof?: (reason: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  onStartWarRoom?: (meetingLink: string) => Promise<void>;
  isSaving?: boolean;
}

export function TicketDetailsModal({
  open,
  onClose,
  ticket,
  ticketType,
  timeline: initialTimeline,
  timelineLoading: initialTimelineLoading,
  role,
  onResolve,
  onOpenResolveModal,
  onAcknowledge,
  onPushToGM,
  onPushToCEO,
  onFollowup,
  onAddComment,
  onAssignToResolver,
  onVerifyAndClose,
  onRejectProof,
  onDelete,
  onStartWarRoom,
  isSaving = false,
}: TicketDetailsModalProps) {
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [followupNote, setFollowupNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [showFollowupForm, setShowFollowupForm] = useState(false);
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [selectedAssignRole, setSelectedAssignRole] = useState<'smo' | 'gmo' | 'both' | null>('both'); // Default to show all
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [resolverUsers, setResolverUsers] = useState<ResolverUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [slaRemaining, setSlaRemaining] = useState(0);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showIntelligenceHub, setShowIntelligenceHub] = useState(false);

  // New state for assigned users and BOI acknowledgment
  const [assignedUsers, setAssignedUsers] = useState<Array<{
    id: string;
    name: string;
    role: string;
    department: string;
  }>>([]);
  const [boiAcknowledgment, setBoiAcknowledgment] = useState<{
    acknowledgedBy: string;
    acknowledgedAt: string;
  } | null>(null);

  // Fetch SMO/GMO users when role filter changes or menu opens
  useEffect(() => {
    if (!showAssignMenu || !selectedAssignRole) {
      return;
    }

    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        // Handle 'both' selection - fetch both SMO and GMO users
        const rolesToFetch = selectedAssignRole === 'both'
          ? ['SMO', 'GMO']
          : [selectedAssignRole.toUpperCase()];

        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, role, department')
          .in('role', rolesToFetch)
          .eq('is_active', true)
          .order('name');


        if (error) throw error;
        setResolverUsers(data || []);
      } catch (error) {
        console.error('Error fetching users:', error);
        setResolverUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [selectedAssignRole, showAssignMenu]);

  // Fetch assigned users (SMO/GMO) and proof submitter when ticket changes
  useEffect(() => {
    const fetchAssignedUsers = async () => {
      const userIds = [
        ticket?.assigned_smo_id,
        ticket?.assigned_gmo_id,
        ticket?.assigned_to,
        (ticket as any)?.assigned_user_id,
        ticket?.proof_submitted_by,
        ticket?.resolved_by
      ].filter(Boolean);

      if (userIds.length === 0) {
        setAssignedUsers([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, role, department')
          .in('id', userIds);

        if (error) throw error;
        setAssignedUsers(data || []);
      } catch (error) {
        console.error('Error fetching assigned users:', error);
        setAssignedUsers([]);
      }
    };

    fetchAssignedUsers();
  }, [ticket?.assigned_smo_id, ticket?.assigned_gmo_id, ticket?.assigned_to, (ticket as any)?.assigned_user_id, ticket?.proof_submitted_by, ticket?.resolved_by]);

  // Real-time timeline state
  const [timeline, setTimeline] = useState<WorkflowTimelineEntry[]>(initialTimeline);
  const [timelineLoading, setTimelineLoading] = useState(initialTimelineLoading);

  // Extract BOI acknowledgment from timeline
  useEffect(() => {
    if (!timeline || timeline.length === 0) {
      setBoiAcknowledgment(null);
      return;
    }

    const ackEvent = timeline.find(entry =>
      entry.action.includes('acknowledged') ||
      entry.action.includes('status_acknowledged')
    );

    if (ackEvent && ackEvent.performed_by_name) {
      setBoiAcknowledgment({
        acknowledgedBy: ackEvent.performed_by_name,
        acknowledgedAt: ackEvent.created_at
      });
    } else {
      setBoiAcknowledgment(null);
    }
  }, [timeline]);

  // Initial timeline loading
  useEffect(() => {
    if (initialTimeline && initialTimeline.length > 0) {
      setTimeline(initialTimeline);
      setTimelineLoading(false);
    }
  }, [initialTimeline, initialTimelineLoading]);

  // Real-time subscription for timeline updates
  useEffect(() => {
    if (!ticket?.id || !open) return;

    const fetchTimeline = async () => {
      try {
        let data: WorkflowTimelineEntry[] | null = null;

        if (ticketType === 'escalation') {
          const { data: escData, error } = await supabase
            .from('client_escalation_timeline')
            .select('*')
            .eq('escalation_id', ticket.id)
            .order('created_at', { ascending: true });
          if (!error) data = escData as unknown as WorkflowTimelineEntry[];
        } else if (ticketType === 'site_visit') {
          // Use client_escalation_timeline for unified site visits
          const { data: svData, error } = await supabase
            .from('client_escalation_timeline')
            .select('*')
            .eq('escalation_id', ticket.id)
            .order('created_at', { ascending: true });
          if (!error) data = svData as unknown as WorkflowTimelineEntry[];
        } else {
          const { data: critData, error } = await (supabase as any)
            .from('hourly_critical_timeline')
            .select('*')
            .eq('critical_id', ticket.id)
            .order('created_at', { ascending: true });
          if (!error) data = critData as unknown as WorkflowTimelineEntry[];
        }

        if (data) {
          setTimeline(data);
        }
      } catch (err) {
        console.error('Error fetching timeline:', err);
      }
    };

    // Fetch timeline immediately when modal opens
    fetchTimeline();

    // Subscribe to real-time changes for new entries
    let tableName = 'client_escalation_timeline';
    let idColumn = 'escalation_id';

    if (ticketType === 'critical') {
      tableName = 'hourly_critical_timeline';
      idColumn = 'critical_id';
    } else if (ticketType === 'site_visit') {
      tableName = 'client_escalation_timeline';
      idColumn = 'escalation_id';
    }

    const channel = supabase
      .channel(`timeline-realtime-${ticket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: tableName,
          filter: `${idColumn}=eq.${ticket.id}`,
        },
        () => {
          fetchTimeline();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket?.id, ticketType, open]);

  // Get the resolve deadline based on ticket type
  const resolveDeadline = ticketType === 'escalation'
    ? (ticket?.resolve_deadline || ticket?.sla_deadline)
    : ticket?.resolve_deadline;

  // Update SLA timer every second
  useEffect(() => {
    if (!ticket || ticket.status === 'resolved') return;

    const updateTimers = () => {
      const createdAt = new Date(ticket.created_at).getTime();
      setTimeElapsed(Date.now() - createdAt);
      setSlaRemaining(getTimeRemaining(resolveDeadline));
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [ticket, resolveDeadline]);

  if (!ticket) return null;

  // Determine current level based on ticket status and assignment
  const getCurrentLevel = () => {
    if (ticket.pushed_to_ceo_at || ticket.status === 'escalated_ceo') return 'ceo';
    if (ticket.forwarded_to_gm_at || ticket.status === 'escalated_gm') return 'gm';
    // Check if assigned to SMO/GMO for resolution
    if (ticket.assigned_role?.toLowerCase() === 'smo' || ticket.current_owner === 'smo' || ticket.assigned_smo_id) return 'smo';
    if (ticket.assigned_role?.toLowerCase() === 'gmo' || ticket.current_owner === 'gmo' || ticket.assigned_gmo_id) return 'gmo';
    return 'l1';
  };

  const currentLevel = getCurrentLevel();

  // Get role-based permissions
  const isAcknowledged = !!ticket.acknowledged_at;
  const permissions = getRolePermissions(role, currentLevel, ticket.status, isAcknowledged, ticket);

  // Determine ticket status for display
  const isBreached = ticketType === 'escalation'
    ? ticket.sla_breached
    : (ticket.status === 'breached' || ticket.blast_triggered_at);
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed' || ticket.status === 'pending_closure_approval' || ticket.status === 'waiting_audit';
  const isEscalated = ticket.status === 'escalated_gm' || ticket.status === 'escalated_ceo';
  const isOverdue = slaRemaining === 0 && !isResolved;

  // Check if ticket has a followup (after breach, show "Time Taken" instead of "BREACHED")
  const hasFollowup = timeline.some(entry => entry.action.includes('followup'));

  // Ticket ID formatting
  let ticketId = '';
  if (ticketType === 'escalation') {
    ticketId = `ESC-${String(ticket.ticket_number || ticket.escalation_number).padStart(3, '0')}`;
  } else if (ticketType === 'site_visit') {
    ticketId = `SITE-${String(ticket.ticket_number || ticket.id?.substring(0, 4)).padStart(3, '0')}`;
  } else {
    ticketId = `CRIT-${String(ticket.ticket_number).padStart(3, '0')}`;
  }

  // Current owner display
  const currentOwner = ticket.current_owner || 'solver';
  const ownerName = ticket.acknowledger?.name || ticket.creator?.name || 'Unassigned';

  // Get department display
  const department = ticket.department || ticket.project?.vertical || 'N/A';

  // SLA display
  const slaLimit = ticketType === 'escalation' ? '3 hours' : (ticketType === 'site_visit' ? '24 hours' : '45 min');
  const elapsedFormatted = formatTimeRemaining(timeElapsed);
  const overdueAmount = getTimeOverdue(resolveDeadline);

  const handleResolve = async () => {
    if (!resolutionText.trim() || !onResolve) return;
    await onResolve(resolutionText);
    setResolutionText('');
    setShowResolveForm(false);
  };

  const handleFollowup = async () => {
    if (!followupNote.trim() || !onFollowup) return;
    await onFollowup(followupNote);
    setFollowupNote('');
    setShowFollowupForm(false);
    toast.success('Followup note added');
  };

  const handleAddComment = async (audioUrl?: string) => {
    if ((!comment.trim() && !audioUrl) || !onAddComment) return;
    await onAddComment(comment || '🎤 Voice Comment', audioUrl);
    setComment('');
  };

  const handleAudioRecorded = async (audioBlob: Blob, duration: number) => {
    if (!onAddComment) return;

    setIsUploadingAudio(true);
    try {
      // Upload audio to Supabase storage
      const fileName = `voice-comment-${Date.now()}.webm`;
      const filePath = `comments/${ticket.id}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('voice-comments')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
          cacheControl: '3600',
        });

      if (error) {
        if (error.message.includes('not found')) {
          toast.error('Voice comments storage not configured');
          return;
        }
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('voice-comments')
        .getPublicUrl(filePath);

      // Add comment with audio URL
      await handleAddComment(publicUrl);
      toast.success('Voice comment added');
    } catch (error: any) {
      console.error('Error uploading audio:', error);
      toast.error('Failed to upload voice comment');
    } finally {
      setIsUploadingAudio(false);
    }
  };

  // Get status badge color and text
  const getStatusBadge = () => {
    if (ticket.status === 'closed') return { text: 'CLOSED', className: 'bg-status-live text-white font-black' };
    if (ticket.status === 'resolved' || ticket.status === 'pending_closure_approval')
      return { text: 'WAITING AUDIT', className: 'bg-status-pending text-black font-black' };

    // If breached but has followup, show "TIME TAKEN" instead of "BREACHED"
    if (isBreached && hasFollowup) {
      return { text: `TIME TAKEN: ${elapsedFormatted}`, className: 'bg-orange-500 text-white' };
    }
    if (isBreached) return { text: 'BREACHED', className: 'bg-destructive animate-pulse text-white' };
    if (isEscalated) {
      return ticket.status === 'escalated_ceo'
        ? { text: 'ESCALATED', className: 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.3)] text-white' }
        : { text: 'GM DESK', className: 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)] text-white' };
    }
    if (isOverdue) return { text: 'OVERDUE', className: 'bg-status-missed text-white' };
    return { text: 'OPEN', className: 'bg-muted text-foreground' };
  };

  const statusBadge = getStatusBadge();

  // Get timeline node color based on action
  const getTimelineNodeColor = (action: string, details: any) => {
    if (action.includes('resolved') || action.includes('closed')) return 'bg-status-live';
    if (action.includes('late') || details?.ack_late) return 'bg-destructive';
    if (action.includes('escalat') || action.includes('pushed') || action.includes('forward')) return 'bg-orange-500';
    if (action.includes('acknowledged') || action.includes('status_acknowledged')) return 'bg-status-live';
    if (action.includes('created')) return 'bg-primary';
    if (action.includes('breached') || action.includes('blast')) return 'bg-destructive';
    if (action.includes('followup')) return 'bg-blue-500';
    if (action.includes('comment') || action.includes('voice')) return 'bg-muted-foreground';
    return 'bg-muted-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl h-[85vh] overflow-hidden flex flex-col p-0 border-white/10 bg-[#0A0A0B] text-white">
        {/* Header Section */}
        <DialogHeader className="p-0 border-b border-white/5 overflow-hidden rounded-t-lg bg-[#111114]">
          <div className="bg-gradient-to-r from-primary/10 via-transparent to-transparent p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-[10px] tracking-widest border-primary/30 text-primary bg-primary/5">
                    {ticketId}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                    {ticketType === 'escalation' ? 'Client Intelligence' : 'System Critical'}
                  </span>
                  {ticket.priority_level && (
                    <Badge className={cn(
                      "text-[10px] font-black px-2",
                      ticket.priority_level === 'P0' ? "bg-red-600 text-white animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]" :
                      ticket.priority_level === 'P1' ? "bg-orange-600 text-white" :
                      ticket.priority_level === 'P2' ? "bg-blue-600 text-white" :
                      "bg-slate-600 text-white"
                    )}>
                      {ticket.priority_level}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-2xl font-black tracking-tight leading-tight text-white">
                  {ticket.issue_title || ticket.complaint_text?.slice(0, 60) + '...' || 'Intelligence Brief'}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                    {department === 'agri' ? <Leaf className="w-3.5 h-3.5 text-status-live" /> : <Building2 className="w-3.5 h-3.5 text-primary" />}
                    {department.toUpperCase()} UNIT
                  </span>
                  <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    {format(new Date(ticket.created_at), 'dd MMM yyyy, HH:mm')}
                  </span>
                  {ticket.project && (
                    <>
                      {ticket.project.location_city && (
                        <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                          <MapPin className="w-3.5 h-3.5 text-blue-500" />
                          {ticket.project.location_city.toUpperCase()}
                        </span>
                      )}
                      {ticket.project.onboarded_date && (
                        <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                          <Timer className="w-3.5 h-3.5 text-orange-500" />
                          AGE: {(() => {
                            const onboardDate = new Date(ticket.project.onboarded_date);
                            const days = Math.floor((Date.now() - onboardDate.getTime()) / (1000 * 60 * 60 * 24));
                            return days < 30 ? `${days}D` : `${Math.floor(days / 30)}M`;
                          })()}
                        </span>
                      )}
                    </>
                  )}
                  {/* Show assigned users if BOI has assigned */}
                  {assignedUsers.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-black uppercase text-muted-foreground/50">
                        ASSIGNED TO:
                      </span>
                      {assignedUsers.map(user => (
                        <span
                          key={user.id}
                          className="flex items-center gap-1.5 bg-[#A855F7]/10 px-2 py-1 rounded-md border border-[#A855F7]/30 text-[#A855F7] text-[10px] font-bold"
                        >
                          <Users className="w-3 h-3" />
                          {user.name.toUpperCase()}
                          {user.department ? ` | ${user.department.toUpperCase()}` : ''}
                          {(!user.role || user.role.toLowerCase() === 'employee') ? '' : ` (${user.role.toUpperCase()})`}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* BOI Acknowledgment */}
                  {boiAcknowledgment && (
                    <span className="flex items-center gap-1.5 bg-status-live/10 px-2 py-1 rounded-md border border-status-live/20 text-status-live text-[10px] font-bold">
                      <Shield className="w-3.5 h-3.5" />
                      ACKNOWLEDGED BY: {boiAcknowledgment.acknowledgedBy.toUpperCase()}
                    </span>
                  )}

                  <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5 whitespace-nowrap">
                    <User className="w-3.5 h-3.5 text-status-live" />
                    RAISED BY: {ticket.creator?.name?.toUpperCase() || 'UNKNOWN'}
                    {ticket.creator?.role && <span className="text-[8px] opacity-60 ml-1">({ticket.creator.role.toUpperCase()})</span>}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <TicketViewers
                  ticketId={ticket.id}
                  ticketType={ticketType}
                  compact
                  className="mb-1"
                />
                <SLAPulseBadge
                  deadline={resolveDeadline}
                  status={ticket.status}
                  createdAt={ticket.created_at}
                  resolvedAt={ticket.resolved_at || ticket.proof_submitted_at || undefined}
                  className="scale-110"
                />
                <Badge className={cn("text-[10px] font-bold tracking-tighter uppercase px-3 border-0", statusBadge.className)}>
                  {statusBadge.text}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Main Content: Investigation Studio */}
        <div className="flex-1 overflow-hidden flex bg-[#0D0D0F]">
          {/* Left Column: Intelligence Brief (Evidence + Metadata) */}
          <div className="w-[55%] border-r border-white/5 overflow-auto custom-scrollbar">
            <div className="p-6 space-y-8">

              {/* Intelligence Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Intelligence Brief</h3>
                </div>

                <div className="glass-card bg-white/[0.03] border-white/5 p-4 rounded-xl space-y-4">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2 block">Issue Statement</label>
                    <div className="text-sm leading-relaxed text-white/90 font-medium italic border-l-2 border-primary/30 pl-3 py-1 bg-white/[0.02] rounded-r-md">
                      {ticket.issue_description || ticket.complaint_text || 'No description provided'}
                    </div>
                  </div>

                  {ticketType === 'site_visit' && ticket.site_visit_target && (
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Site Visit Target</label>
                        <p className="text-xs font-bold flex items-center gap-2 text-white/80">
                          <User className="w-3 h-3 text-orange-500/70" />
                          {ticket.site_visit_target.name || ticket.site_visit_target.email || 'Unknown Subject'}
                        </p>
                      </div>
                    </div>
                  )}

                  {ticketType === 'escalation' && (ticket.customer_name || ticket.client_name) && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t border-white/5">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Client Subject</label>
                        <p className="text-xs font-bold flex items-center gap-2 text-white/80">
                          <User className="w-3 h-3 text-primary/70" />
                          {ticket.customer_name || ticket.client_name}
                        </p>
                      </div>
                      {(ticket.customer_phone || ticket.client_phone) && (
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Contact info</label>
                          <p className="text-xs font-bold flex items-center gap-2 text-white/80">
                            <Phone className="w-3 h-3 text-emerald-500/70" />
                            {ticket.customer_phone || ticket.client_phone}
                          </p>
                        </div>
                      )}
                      {(ticket.project?.location_city || ticket.raw?.project?.location_city) && (
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Unit Location</label>
                          <p className="text-xs font-bold flex items-center gap-2 text-white/80">
                            <MapPin className="w-3 h-3 text-blue-400/70" />
                            {ticket.project?.location_city || ticket.raw?.project?.location_city}
                            {(ticket.project?.location_state || ticket.raw?.project?.location_state) && `, ${ticket.project?.location_state || ticket.raw?.project?.location_state}`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {ticket.tags && ticket.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                      {ticket.tags.map((tag: string, i: number) => (
                        <Badge key={i} variant="secondary" className="bg-white/5 text-[9px] text-white/60 border-white/10">
                          #{tag.toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {ticket.reminder_count > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                      <Clock className="w-3 h-3 text-orange-400" />
                      <span className="text-[10px] text-orange-400 font-bold uppercase tracking-widest">
                        {ticket.reminder_count} AUTO-REMINDERS SENT
                      </span>
                    </div>
                  )}
                </div>

                {/* Call Recording Section (Mandatory Intelligence) */}
                {ticket.call_record_url && (
                  <div className="p-4 rounded-xl border shadow-lg bg-blue-500/[0.03] border-blue-500/20 shadow-blue-500/10">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2 text-blue-400/70">
                        <Mic className="w-3 h-3" />
                        Intelligence Call Record
                      </label>
                      <Badge variant="outline" className="text-[8px] h-4 border-blue-400/20 text-blue-400 bg-blue-400/5">
                        MANDATORY PROOF
                      </Badge>
                    </div>
                    <AudioWaveform src={ticket.call_record_url} className="bg-black/40 border-white/5" />
                  </div>
                )}
              </section>

              {/* Evidence Portfolio */}
              <section className="space-y-6">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-orange-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500">Evidence Portfolio</h3>
                </div>

                <div className="space-y-8">
                  {/* Unified Evidence Portfolio */}
                  <div className="space-y-6">
                    {/* Part A: Initial Escalation Evidence (Always show if exists) */}
                    {(ticket.proof_url || ticket.site_evidence_url || ticket.evidence_url || ticket.escalation_proof_url || (ticket.proof_screenshot_urls && ticket.proof_screenshot_urls.length > 0) || ticket.issue_proof_url) && (
                      <div id="proof-section" className="p-4 rounded-xl bg-orange-500/[0.02] border border-orange-500/10 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60 flex items-center gap-2">
                              <AlertTriangle className="w-3 h-3 text-orange-500" />
                              INITIAL ESCALATION EVIDENCE
                            </label>
                            <Badge variant="outline" className="text-[8px] h-4 border-orange-500/20 text-orange-500 bg-orange-500/5">
                              {(() => {
                                const imageCount = [
                                  ticket.proof_url,
                                  ticket.site_evidence_url,
                                  ticket.evidence_url,
                                  ticket.escalation_proof_url,
                                  ...(ticket.proof_screenshot_urls || [])
                                ].filter(Boolean).length;
                                return `${imageCount} FILE${imageCount > 1 ? 'S' : ''}`;
                              })()}
                            </Badge>
                          </div>

                          {/* Raised By Info */}
                          <div className="flex items-center gap-2 px-1">
                            <div className="w-6 h-6 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[8px] font-bold text-orange-500">
                              {ticket.creator?.name?.charAt(0) || 'U'}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] font-bold text-orange-500/80 uppercase leading-tight">
                                Raised By: {ticket.creator?.name || 'Unknown'}
                              </span>
                              <span className="text-[8px] text-muted-foreground/40 font-medium uppercase tracking-tighter">
                                {ticket.creator?.role || 'User'} {ticket.creator?.department ? `• ${ticket.creator.department}` : ''}
                              </span>
                            </div>
                            {ticket.created_at && (
                              <div className="ml-auto text-right">
                                <span className="text-[8px] text-muted-foreground/40 font-mono block leading-tight">
                                  {format(new Date(ticket.created_at), 'dd MMM, HH:mm')}
                                </span>
                                <span className="text-[7px] text-muted-foreground/30 uppercase tracking-tighter">Initial Log</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <EvidenceMediaGallery
                          images={[
                            ...new Set([
                              ...(ticket.proof_url ? [ticket.proof_url] : []),
                              ...(ticket.site_evidence_url ? [ticket.site_evidence_url] : []),
                              ...(ticket.evidence_url ? [ticket.evidence_url] : []),
                              ...(ticket.escalation_proof_url ? [ticket.escalation_proof_url] : []),
                              ...(ticket.issue_proof_url ? [ticket.issue_proof_url] : []),
                              ...(ticket.proof_screenshot_urls || [])
                            ])
                          ]}
                        />
                      </div>
                    )}

                    {/* Part B: Resolution Proof (Show if exists) */}
                    {(ticket.resolution_evidence_url || ticket.resolution_image_url || ticket.resolution_audio_url) && (
                      <div className="space-y-4 pt-4">
                        <div className="p-4 rounded-xl bg-[#A855F7]/[0.02] border border-[#A855F7]/10 space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                              <label className="text-[10px] font-black uppercase tracking-tighter text-[#A855F7] flex items-center gap-2">
                                <CheckCircle className="w-3 h-3" />
                                RESOLUTION & CLOSURE PROOF
                              </label>
                              <Badge variant="outline" className="text-[8px] h-4 border-[#A855F7]/20 text-[#A855F7] bg-[#A855F7]/5">
                                {(() => {
                                  const imageCount = [
                                    ticket.resolution_evidence_url,
                                    ticket.resolution_image_url,
                                    ...(ticket.resolution_proof_screenshot_urls || [])
                                  ].filter(Boolean).length;
                                  return `${imageCount} PROOF${imageCount > 1 ? 'S' : ''}`;
                                })()}
                              </Badge>
                            </div>

                            {/* Resolved By Info */}
                            {(() => {
                              if (ticket.resolved_by || ticket.proof_submitted_by) {
                                // Find resolver name if possible
                                const resolverId = ticket.resolved_by || ticket.proof_submitted_by;
                                const resolver = assignedUsers.find(u => u.id === resolverId);
                                const resolverName = resolver ? resolver.name : 'Resolver'; // Fallback

                                return (
                                  <div className="flex items-center gap-2 px-1">
                                    <Users className="w-3 h-3 text-[#A855F7]/60" />
                                    <span className="text-[9px] font-bold text-[#A855F7]/80 uppercase">
                                      Resolved By: {resolverName}
                                    </span>
                                    {(ticket.resolved_at || ticket.proof_submitted_at) && (
                                      <span className="text-[8px] text-muted-foreground/40 font-mono">
                                        {format(new Date(ticket.resolved_at || ticket.proof_submitted_at), 'dd MMM, hh:mm a')}
                                      </span>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>

                          {ticket.resolution_audio_url && (
                            <div className="p-4 rounded-2xl border shadow-lg bg-[#A855F7]/[0.03] border-[#A855F7]/20 shadow-[#A855F7]/10">
                              <div className="flex items-center justify-between mb-3">
                                <label className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2 text-[#A855F7]/70">
                                  <Mic className="w-3 h-3" />
                                  Audio Verification
                                </label>
                                <span className="text-[8px] font-mono uppercase text-[#A855F7]/40">Playable Proof</span>
                              </div>
                              <AudioWaveform src={ticket.resolution_audio_url} className="bg-black/40 border-white/5" />
                            </div>
                          )}

                          {(ticket.resolution_evidence_url || ticket.resolution_image_url || (ticket.resolution_proof_screenshot_urls && ticket.resolution_proof_screenshot_urls.length > 0)) && (
                            <div className="space-y-3">
                              <label className="text-[9px] font-black uppercase tracking-widest text-[#A855F7]/40 italic px-1">Visual Verification Stream</label>
                              <EvidenceMediaGallery
                                images={(() => {
                                  const resImages = [];
                                  if (ticket.resolution_evidence_url) resImages.push(ticket.resolution_evidence_url);
                                  if (ticket.resolution_image_url) {
                                    if (Array.isArray(ticket.resolution_image_url)) {
                                      resImages.push(...ticket.resolution_image_url);
                                    } else {
                                      resImages.push(...ticket.resolution_image_url.split(',').map((u: string) => u.trim()));
                                    }
                                  }
                                  if (ticket.resolution_proof_screenshot_urls && Array.isArray(ticket.resolution_proof_screenshot_urls)) {
                                    resImages.push(...ticket.resolution_proof_screenshot_urls);
                                  }
                                  return resImages;
                                })()}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Zero Evidence Placeholder - Only if absolutely nothing is found */}
                  {!ticket.proof_url &&
                    !ticket.site_evidence_url &&
                    !ticket.evidence_url &&
                    !ticket.escalation_proof_url &&
                    (!ticket.proof_screenshot_urls || ticket.proof_screenshot_urls.length === 0) &&
                    !ticket.issue_proof_url &&
                    !ticket.resolution_evidence_url &&
                    !ticket.resolution_image_url &&
                    !ticket.resolution_audio_url &&
                    (!ticket.resolution_proof_screenshot_urls || ticket.resolution_proof_screenshot_urls.length === 0) && (
                      <div className="h-32 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-2xl opacity-30 bg-white/[0.01]">
                        <Shield className="w-8 h-8 mb-3 text-muted-foreground" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Zero Evidence Signals Detected</p>
                      </div>
                    )}
                </div>
              </section>

            </div>
          </div>

          {/* Right Column: Activity Stream (Timeline + Actions) */}
          <div className="w-[45%] flex flex-col overflow-hidden bg-black/20">
            {/* Action Bar (Top of column) */}
            <div className="p-4 bg-white/[0.02] border-b border-white/5 flex flex-wrap gap-2">

              {permissions.canAcknowledge && (
                <Button onClick={onAcknowledge} disabled={isSaving} className="flex-1 neon-border-primary bg-primary/20 hover:bg-primary/30 text-primary h-9 text-[10px] font-black tracking-widest">
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Shield className="w-3 h-3 mr-2" />}
                  ACKNOWLEDGE
                </Button>
              )}
              {(permissions.canAssignTeam || permissions.canAssignResolver) && (
                <Button onClick={() => setShowAssignModal(true)} disabled={isSaving} className="flex-1 bg-purple-600 text-white hover:bg-purple-700 h-9 text-[10px] font-black tracking-widest">
                  <Users className="w-3 h-3 mr-2" /> ASSIGN TEAM
                </Button>
              )}
              {permissions.canResolve && (
                <Button onClick={onOpenResolveModal} disabled={isSaving} className="flex-1 bg-status-live text-white hover:bg-status-live/90 h-9 text-[10px] font-black tracking-widest">
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <CheckCircle className="w-3 h-3 mr-2" />}
                  SUBMIT PROOF
                </Button>
              )}
              {permissions.canPushToGM && onPushToGM && (
                <Button 
                  onClick={onPushToGM} 
                  disabled={isSaving} 
                  className="flex-1 neon-border-orange bg-orange-500/20 hover:bg-orange-500/30 text-orange-500 h-9 text-[10px] font-black tracking-widest"
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <ArrowUpRight className="w-3 h-3 mr-2" />}
                  ESCALATE TO L2
                </Button>
              )}
              {permissions.canPushToCEO && onPushToCEO && (
                <Button 
                  onClick={onPushToCEO} 
                  disabled={isSaving} 
                  className="flex-1 neon-border-red bg-red-500/20 hover:bg-red-500/30 text-red-500 h-9 text-[10px] font-black tracking-widest"
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Zap className="w-3 h-3 mr-2" />}
                  ESCALATE TO CEO
                </Button>
              )}
              {permissions.canVerifyAndClose && (
                <Button onClick={onVerifyAndClose} disabled={isSaving} className="flex-1 bg-status-live text-white h-9 text-[10px] font-black tracking-widest">
                  VERIFY & CLOSE
                </Button>
              )}
              {permissions.canRejectProof && (
                <Button onClick={() => setShowRejectionForm(true)} disabled={isSaving} variant="destructive" className="flex-1 h-9 text-[10px] font-black tracking-widest">
                  REJECT PROOF
                </Button>
              )}
              {ticketType === 'escalation' && (ticket.priority_level === 'P0' || ticket.priority_level === 'P1') && !ticket.is_war_room && (
                <Button 
                  onClick={() => {
                    const url = window.prompt('Enter Google Meet / Zoom link for War Room:');
                    if (url && (ticket as any).startWarRoom) {
                       (ticket as any).startWarRoom(ticket.id, url);
                    }
                  }} 
                  disabled={isSaving} 
                  className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 text-white hover:opacity-90 h-9 text-[10px] font-black tracking-widest shadow-lg shadow-red-500/20"
                >
                  <Users className="w-3 h-3 mr-2" /> START WAR ROOM
                </Button>
              )}
              {ticket.is_war_room && ticket.war_room_url && (
                <Button 
                  asChild
                  className="flex-1 bg-green-600 text-white hover:bg-green-700 h-9 text-[10px] font-black tracking-widest animate-pulse"
                >
                  <a href={ticket.war_room_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-3 h-3 mr-2" /> JOIN WAR ROOM
                  </a>
                </Button>
              )}
              {/* @ts-ignore */}
              {permissions.canDelete && onDelete && (
                <Button
                  onClick={() => {
                    if (window.confirm('ARE YOU SURE? This will permanently delete this ticket.')) {
                      onDelete();
                    }
                  }}
                  disabled={isSaving}
                  variant="destructive"
                  className="flex-none w-9 h-9 p-0 bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800"
                  title="Delete Ticket (Admin Only)"
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Timeline Stream - Chat Style */}
            <ScrollArea className="flex-1 p-4 relative bg-[#0D0D0F]">
              <div className="space-y-6 pb-4">
                {filterTimelineEntries(timeline).map((entry, idx) => {
                  const isMe = user?.id === entry.performed_by;
                  const initials = entry.performed_by_name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || '??';

                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={cn("flex gap-4 group", isMe ? "flex-row-reverse" : "flex-row")}
                    >
                      {/* Avatar - Premium Style */}
                      <div className="flex-shrink-0 mt-2">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black border tracking-tighter transition-all",
                          isMe
                            ? "bg-gradient-to-br from-primary to-primary/80 text-black border-primary shadow-lg shadow-primary/20"
                            : "bg-gradient-to-br from-[#27272A] to-[#1A1A1D] text-white border-white/10 shadow-lg"
                        )}>
                          {initials}
                        </div>
                      </div>

                      {/* Bubble - Premium Glassmorphism */}
                      <div className={cn("flex flex-col max-w-[82%]", isMe ? "items-end" : "items-start")}>
                        {/* Name and Action (merged into a cleaner header) */}
                        <div className={cn(
                          "flex items-center gap-2 mb-1.5 px-1",
                          isMe ? "flex-row-reverse" : "flex-row"
                        )}>
                          {!isMe && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#FFF]/40">
                              {entry.performed_by_name}
                            </span>
                          )}
                          <Badge variant="outline" className={cn(
                            "text-[8px] font-black uppercase tracking-[0.1em] py-0 h-4 border-white/5",
                            isMe ? "bg-black/20 text-primary-foreground/60" : "bg-white/5 text-white/40"
                          )}>
                            {entry.action.replace(/_/g, ' ')}
                          </Badge>
                        </div>

                        <div className={cn(
                          "px-5 py-4 text-sm leading-relaxed shadow-2xl relative group/bubble overflow-hidden",
                          isMe
                            ? "bg-primary text-black rounded-3xl rounded-tr-sm"
                            : "bg-[#1A1A1D]/80 backdrop-blur-xl border border-white/10 text-white rounded-3xl rounded-tl-sm"
                        )}>
                          {/* Content with Markdown support */}
                          <div className="prose prose-sm dark:prose-invert max-w-none text-current font-medium">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{renderClickableText(children as string)}</p>,
                                strong: ({ children }) => <strong className="font-extrabold">{children}</strong>,
                                code: ({ children }) => <code className="bg-black/20 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                              }}
                            >
                              {getTimelineContent(entry)}
                            </ReactMarkdown>
                          </div>

                          {/* Audio component integrated cleanly */}
                          {(entry.details?.audio_url || entry.details?.audioUrl) && (
                            <div className={cn("mt-3 p-3 rounded-2xl border transition-all", isMe ? "bg-black/10 border-black/5" : "bg-white/5 border-white/5")}>
                              <AudioWaveform src={entry.details.audio_url || entry.details.audioUrl} compact />
                            </div>
                          )}

                          {/* Time and Copy Action */}
                          <div className={cn(
                            "flex items-center gap-2 mt-2 pt-2 border-t text-[8px] font-mono font-bold uppercase tracking-tighter transition-opacity",
                            isMe ? "border-black/5 text-black/40" : "border-white/5 text-white/30"
                          )}>
                            <span>{format(new Date(entry.created_at), 'dd MMM, hh:mm a')}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 opacity-0 group-hover/bubble:opacity-100 transition-opacity p-0"
                              onClick={() => {
                                navigator.clipboard.writeText(getTimelineContent(entry));
                                toast.success('Copied to clipboard');
                              }}
                            >
                              <Copy className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="p-4 bg-black/40 border-t border-white/5">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <MentionInput
                    value={comment}
                    onChange={setComment}
                    onEnter={() => handleAddComment()}
                    placeholder="Intelligence note... (@name to tag)"
                    className="bg-white/[0.02] border-white/10 text-xs text-white focus-visible:ring-primary/30"
                    rows={1}
                  />
                </div>
                <InlineVoiceRecorder onAudioRecorded={handleAudioRecorded} />
                <Button
                  size="icon"
                  className="w-9 h-9 bg-primary text-black hover:bg-primary/90 flex-shrink-0"
                  onClick={() => handleAddComment()}
                  disabled={isSaving || (!comment.trim())}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Rejection Slider (Conditional) */}
        {showRejectionForm && (
          <div className="absolute inset-x-0 bottom-0 bg-destructive p-6 z-50 animate-in slide-in-from-bottom border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <h4 className="text-white font-black mb-4 flex items-center gap-2 tracking-widest text-xs">
              <ShieldAlert className="w-5 h-5" /> REJECTION PROTOCOL
            </h4>
            <Textarea
              placeholder="State clear reason for verification failure..."
              className="bg-black/40 border-white/20 text-white mb-4 min-h-[100px]"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={() => onRejectProof?.(rejectionReason)} className="flex-1 bg-white text-destructive font-black h-11 tracking-widest text-xs">CONFIRM REJECTION</Button>
              <Button variant="ghost" onClick={() => setShowRejectionForm(false)} className="text-white/60 hover:text-white h-11">CANCEL</Button>
            </div>
          </div>
        )}

        {/* Footer actions for basic view */}
        {!permissions.canAcknowledge && !permissions.canResolve && !permissions.canVerifyAndClose && !permissions.canRejectProof && (
          <DialogFooter className="p-4 border-t border-white/5 bg-[#111114]">
            <Button variant="ghost" onClick={onClose} className="text-muted-foreground">Close Intelligence Hub</Button>
          </DialogFooter>
        )}
      </DialogContent>

      <AssignEscalationModal
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
        escalationId={ticket?.id}
        ticketNumber={ticket?.ticket_number}
        issueTitle={ticket?.issue_title}
        ticketType={ticketType}
      />

      <IntelligenceHub
        isOpen={showIntelligenceHub}
        onClose={() => setShowIntelligenceHub(false)}
        ticketId={ticket?.id}
        ticketTitle={ticket?.issue_title}
        ticketDescription={ticket?.issue_description}
        timeline={timeline}
      />
    </Dialog>
  );
}
