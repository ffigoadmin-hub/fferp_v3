import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle,
    Loader2,
    Clock,
    User,
    Phone,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ClientEscalation, ESCALATION_BUCKETS } from '@/types/workflows';
import { TicketDetailsModal } from '@/components/TicketDetailsModal';
import { ResolveTicketModal } from '@/components/ResolveTicketModal';
import { useAuth } from '@/contexts/AuthContext';
import { useEscalationEngine } from '@/hooks/useEscalationEngine';
import { cn } from '@/lib/utils';

export function AssignedEscalationsSection() {
    const [escalations, setEscalations] = useState<ClientEscalation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const { addComment, escalateToGM, escalateToCEO, startWarRoom } = useEscalationEngine();

    // Modals
    const [selectedEscalation, setSelectedEscalation] = useState<ClientEscalation | null>(null);
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

    // Timeline fetch state
    const [timeline, setTimeline] = useState<any[]>([]);
    const [isTimelineLoading, setIsTimelineLoading] = useState(false);

    // Fetch timeline when a ticket is selected for details
    useEffect(() => {
        const fetchTimeline = async () => {
            if (!selectedEscalation) return;

            setIsTimelineLoading(true);
            try {
                const { data, error } = await supabase
                    .from('client_escalation_timeline')
                    .select('*')
                    .eq('escalation_id', selectedEscalation.id)
                    .order('created_at', { ascending: true });

                if (error) throw error;
                setTimeline(data || []);
            } catch (error) {
                console.error('Error fetching timeline:', error);
            } finally {
                setIsTimelineLoading(false);
            }
        };

        if (isTicketModalOpen && selectedEscalation) {
            fetchTimeline();
        }
    }, [selectedEscalation, isTicketModalOpen]);

    useEffect(() => {
        const fetchAssignedEscalations = async () => {
            if (!user) return;
            setIsLoading(true);
            try {
                // @ts-ignore - Supabase deep type instantiation issue
                const result = await (supabase as any)
                    .from('client_escalations')
                    .select('*, creator:created_by(name, email), acknowledger:acknowledged_by(name, email)')
                    .or(`assigned_user_id.eq.${user.id},assigned_smo_id.eq.${user.id},assigned_gmo_id.eq.${user.id},assigned_user_ids.cs.{${user.id}}`)
                    .not('status', 'in', '("closed","resolved","pending_closure_approval")')
                    .order('created_at', { ascending: false });

                if (result.error) throw result.error;
                const data = (result.data || []) as ClientEscalation[];
                setEscalations(data);

                // Check for ticketId in URL to auto-open
                const urlTicketId = searchParams.get('ticketId');
                if (urlTicketId && !selectedEscalation) {
                    const ticket = data.find(e => e.id === urlTicketId);
                    if (ticket) {
                        setSelectedEscalation(ticket);
                        setIsTicketModalOpen(true);
                    }
                }
            } catch (error) {
                console.error('Error fetching assigned escalations:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssignedEscalations();

        // Realtime subscription
        const channel = supabase
            .channel('assigned-escalations-' + user?.id)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'client_escalations',
            }, () => {
                fetchAssignedEscalations();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const openDetailsModal = (escalation: ClientEscalation) => {
        setSelectedEscalation(escalation);
        setIsTicketModalOpen(true);
    };

    const handleResolveComplete = async (data: any) => {
        if (!selectedEscalation || !user) return;
        setIsSubmitting(true);
        try {
            const audioUrl = data.audioUrl || data.callRecordingUrl;
            const updateData: any = {
                status: 'pending_closure_approval',
                resolution_text: data.resolutionText,
                resolution_image_url: data.screenshotUrls?.join(','),
                resolution_proof_screenshot_urls: data.screenshotUrls || null,
                resolution_audio_url: audioUrl || null,
                resolution_proof_audio_url: audioUrl || null,
                call_record_url: audioUrl || null,
                resolved_at: new Date().toISOString(),
                resolved_by: user.id,
                updated_at: new Date().toISOString()
            };

            if (data.proofUrl) {
                updateData.resolution_evidence_url = data.proofUrl;
            }

            const { error } = await supabase
                .from('client_escalations')
                .update(updateData)
                .eq('id', selectedEscalation.id);

            if (error) throw error;

            // Add timeline entry
            await supabase.from('client_escalation_timeline').insert({
                escalation_id: selectedEscalation.id,
                action: 'resolved_proof_submitted',
                performed_by: user.id,
                performed_by_name: user.name || 'User',
                performed_by_role: user.role,
                details: {
                    note: 'Resolution submitted with proof',
                    comment: data.resolutionText
                }
            });

            toast.success(`Resolution proof submitted for ticket #${selectedEscalation.ticket_number}`);
            setIsResolveModalOpen(false);
            setIsTicketModalOpen(false);
            setEscalations(prev => prev.filter(e => e.id !== selectedEscalation.id));

        } catch (error: any) {
            console.error('Resolve error:', error);
            toast.error(error.message || 'Failed to submit resolution');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-6">
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card className="border-primary/20 bg-background/50 backdrop-blur-sm shadow-xl overflow-hidden">
                <CardHeader className="cursor-pointer hover:bg-white/5 transition-colors border-b border-primary/10" onClick={() => setIsExpanded(!isExpanded)}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-primary/20 shadow-inner">
                                <Zap className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold tracking-tight">My Assigned Escalations</CardTitle>
                                <CardDescription>Directly assigned client issues requiring resolution</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {escalations.length > 0 && (
                                <Badge variant="destructive" className="px-3 py-1 text-sm font-bold animate-pulse shadow-lg bg-orange-600">
                                    {escalations.length} ACTIVE
                                </Badge>
                            )}
                            <div className="p-2 rounded-full hover:bg-white/10 transition-colors">
                                {isExpanded ? <ChevronUp className="w-6 h-6 text-muted-foreground" /> : <ChevronDown className="w-6 h-6 text-muted-foreground" />}
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                        >
                            <CardContent className="p-6">
                                {escalations.length === 0 ? (
                                    <div className="text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/10">
                                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
                                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                                        </div>
                                        <p className="text-lg font-medium">All caught up!</p>
                                        <p className="text-muted-foreground mt-1 text-sm">No escalations are currently assigned to you.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {escalations.map((escalation) => (
                                            <motion.div
                                                key={escalation.id}
                                                layout
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="group relative p-5 border border-white/10 rounded-2xl bg-white/5 hover:bg-white/[0.08] hover:border-primary/40 transition-all duration-300 shadow-sm"
                                            >
                                                <div className="flex items-start justify-between gap-6">
                                                    <div className="flex-1 space-y-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                                                                <span className="font-mono text-xs font-bold text-primary tracking-wider">#{escalation.ticket_number}</span>
                                                            </div>
                                                            <Badge variant="secondary" className="bg-white/5 text-xs text-muted-foreground border-white/10">
                                                                {ESCALATION_BUCKETS.find(b => b.value === escalation.bucket)?.label || escalation.bucket || 'General'}
                                                            </Badge>
                                                            <Badge className={
                                                                escalation.status === 'open' ? 'bg-blue-500/90 shadow-lg shadow-blue-500/20' :
                                                                    (escalation.status === 'acknowledged' || escalation.status === 'in_progress' || escalation.status === 'grace_period') ? 'bg-amber-500/90 shadow-lg shadow-amber-500/20' :
                                                                        (escalation.status === 'proof_submitted' || escalation.status === 'waiting_audit') ? 'bg-purple-500/90 shadow-lg shadow-purple-500/20' :
                                                                            'bg-zinc-600'
                                                            }>
                                                                        {escalation.status.toUpperCase()}
                                                                    </Badge>
                                                                    {escalation.priority_level && (
                                                                        <Badge className={cn(
                                                                            "text-[9px] font-black uppercase",
                                                                            escalation.priority_level === 'P0' ? "bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.5)]" :
                                                                            escalation.priority_level === 'P1' ? "bg-orange-600 text-white" :
                                                                            escalation.priority_level === 'P2' ? "bg-blue-600 text-white" :
                                                                            "bg-slate-600 text-white"
                                                                        )}>
                                                                            {escalation.priority_level}
                                                                        </Badge>
                                                                    )}
                                                                </div>

                                                        <div>
                                                            <h4 className="text-lg font-bold leading-tight group-hover:text-primary transition-colors cursor-pointer" onClick={() => openDetailsModal(escalation)}>
                                                                {escalation.issue_title}
                                                            </h4>
                                                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                                                                {escalation.issue_description}
                                                            </p>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-4 pt-2">
                                                            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 text-xs font-medium">
                                                                <User className="w-3.5 h-3.5 text-primary/70" />
                                                                <span className="text-foreground/80">{escalation.client_name}</span>
                                                            </div>
                                                            {escalation.client_phone && (
                                                                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 text-xs font-medium">
                                                                    <Phone className="w-3.5 h-3.5 text-green-500/70" />
                                                                    <span className="text-foreground/80">{escalation.client_phone}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 text-xs font-medium">
                                                                <Clock className="w-3.5 h-3.5 text-amber-500/70" />
                                                                <span className="text-foreground/80">{format(new Date(escalation.created_at), 'dd MMM, hh:mm a')}</span>
                                                            </div>
                                                        </div>

                                                        <div className="pt-2 border-t border-white/5">
                                                            <Button
                                                                variant="link"
                                                                className="h-auto p-0 text-xs font-semibold text-primary hover:text-primary/80 transition-all flex items-center gap-1.5"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openDetailsModal(escalation);
                                                                }}
                                                            >
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                                VIEW SMART INTELLIGENCE BRIEF
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="shrink-0 flex flex-col gap-3">
                                                        <Button
                                                            className="shadow-lg shadow-primary/20 font-bold bg-primary hover:bg-primary/90 rounded-xl px-6"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedEscalation(escalation);
                                                                setIsResolveModalOpen(true);
                                                            }}
                                                        >
                                                            SUBMIT PROOF
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            className="rounded-xl border-white/10 hover:bg-white/10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openDetailsModal(escalation);
                                                            }}
                                                        >
                                                            DETAILS
                                                        </Button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>

            {selectedEscalation && (
                <>
                    <TicketDetailsModal
                        open={isTicketModalOpen && !isResolveModalOpen}
                        onClose={() => {
                            setIsTicketModalOpen(false);
                            // Clear ticketId from URL
                            const newParams = new URLSearchParams(searchParams);
                            newParams.delete('ticketId');
                            setSearchParams(newParams);
                        }}
                        ticket={selectedEscalation}
                        ticketType="escalation"
                        role={user?.role || 'solver'}
                        timeline={timeline}
                        timelineLoading={isTimelineLoading}
                        onAddComment={(comment, audio) => addComment(selectedEscalation.id, 'escalation', comment, audio)}
                        onPushToGM={() => escalateToGM(selectedEscalation.id)}
                        onPushToCEO={() => escalateToCEO(selectedEscalation.id)}
                        onOpenResolveModal={() => {
                            setIsTicketModalOpen(false);
                            setIsResolveModalOpen(true);
                        }}
                        onStartWarRoom={async (link) => {
                            await startWarRoom(selectedEscalation.id, link);
                            // Refresh logic here if needed
                        }}
                    />
                    <ResolveTicketModal
                        open={isResolveModalOpen}
                        onClose={() => setIsResolveModalOpen(false)}
                        onResolve={handleResolveComplete}
                        ticketId={selectedEscalation.id}
                        ticketType="escalation"
                        isSaving={isSubmitting}
                    />
                </>
            )}
        </>
    );
}
