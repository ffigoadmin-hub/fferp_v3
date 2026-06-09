import { useState, useEffect } from 'react';
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
    ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ClientEscalation, ESCALATION_BUCKETS } from '@/types/workflows';
import { TicketDetailsModal } from '@/components/TicketDetailsModal';
import { ResolveTicketModal } from '@/components/ResolveTicketModal';
import { useAuth } from '@/contexts/AuthContext';

export function SMOAssignedEscalationsSection() {
    const [escalations, setEscalations] = useState<ClientEscalation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const { user } = useAuth();

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
            setIsLoading(true);
            try {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                if (!currentUser) return;

                // @ts-ignore - Supabase deep type instantiation issue
                const result = await (supabase as any)
                    .from('client_escalations')
                    .select('*, creator:created_by(name, email), acknowledger:acknowledged_by(name, email)')
                    .eq('assigned_smo_id', currentUser.id)
                    .not('status', 'in', '("closed","resolved","pending_closure_approval")')
                    .order('created_at', { ascending: false });

                if (result.error) throw result.error;
                setEscalations((result.data || []) as ClientEscalation[]);
            } catch (error) {
                console.error('Error fetching assigned escalations:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssignedEscalations();

        // Realtime subscription
        const channel = supabase
            .channel('smo-escalations')
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
    }, []);

    const openDetailsModal = (escalation: ClientEscalation) => {
        setSelectedEscalation(escalation);
        setIsTicketModalOpen(true);
    };

    const handleResolveComplete = async (data: any) => {
        if (!selectedEscalation) return;
        setIsSubmitting(true);
        try {
            const audioUrl = data.audioUrl || data.callRecordingUrl;
            const updateData: any = {
                status: 'pending_closure_approval', // SMO submits proof for admin approval
                resolution_text: data.resolutionText,
                resolution_image_url: data.screenshotUrls?.join(','),
                resolution_proof_screenshot_urls: data.screenshotUrls || null,
                resolution_audio_url: audioUrl || null,
                resolution_proof_audio_url: audioUrl || null,
                call_record_url: audioUrl || null,
                resolved_at: new Date().toISOString(),
                resolved_by: user?.id,
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
                performed_by: user?.id,
                performed_by_name: user?.name || 'SMO',
                performed_by_role: 'smo',
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
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-orange-500/20">
                                <AlertTriangle className="w-5 h-5 text-orange-500" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Assigned Escalations</CardTitle>
                                <CardDescription>Client escalations assigned to you for resolution</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {escalations.length > 0 && (
                                <Badge variant="destructive">{escalations.length}</Badge>
                            )}
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                    </div>
                </CardHeader>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                        >
                            <CardContent className="pt-0">
                                {escalations.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>No escalations assigned to you</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {escalations.map((escalation) => (
                                            <motion.div
                                                key={escalation.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="p-4 border rounded-lg hover:border-primary/50 transition-colors bg-card"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 space-y-2 cursor-pointer" onClick={() => openDetailsModal(escalation)}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-sm">#{escalation.ticket_number}</span>
                                                            <Badge variant="outline">
                                                                {ESCALATION_BUCKETS.find(b => b.value === escalation.bucket)?.label || escalation.bucket || 'Unassigned'}
                                                            </Badge>
                                                            <Badge className={
                                                                escalation.status === 'open' ? 'bg-blue-500' :
                                                                    escalation.status === 'acknowledged' ? 'bg-yellow-500' :
                                                                        escalation.status === 'in_progress' ? 'bg-purple-500' :
                                                                            'bg-gray-500'
                                                            }>
                                                                {escalation.status}
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

                                                        <h4 className="font-medium hover:text-primary transition-colors">{escalation.issue_title}</h4>
                                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                                            {escalation.issue_description}
                                                        </p>

                                                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                                            <span className="flex items-center gap-1">
                                                                <User className="w-3 h-3" />
                                                                {escalation.client_name}
                                                            </span>
                                                            {escalation.client_phone && (
                                                                <span className="flex items-center gap-1">
                                                                    <Phone className="w-3 h-3" />
                                                                    {escalation.client_phone}
                                                                </span>
                                                            )}
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {format(new Date(escalation.created_at), 'dd MMM, HH:mm')}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-2 pt-1">
                                                            <Button
                                                                variant="link"
                                                                className="h-auto p-0 text-xs text-blue-500 hover:text-blue-400"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openDetailsModal(escalation);
                                                                }}
                                                            >
                                                                <ExternalLink className="w-3 h-3 mr-1" />
                                                                View Full Intelligence Brief
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <Button onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedEscalation(escalation);
                                                        setIsResolveModalOpen(true);
                                                    }}>
                                                        Submit Proof
                                                    </Button>
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
                        onClose={() => setIsTicketModalOpen(false)}
                        ticket={selectedEscalation}
                        ticketType="escalation"
                        role={user?.role || 'smo'}
                        timeline={timeline}
                        timelineLoading={isTimelineLoading}
                        onOpenResolveModal={() => {
                            setIsTicketModalOpen(false);
                            setIsResolveModalOpen(true);
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
