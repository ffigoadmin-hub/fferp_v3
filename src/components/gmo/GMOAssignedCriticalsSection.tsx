import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap,
    Loader2,
    Clock,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { HourlyCritical } from '@/types/workflows';
import { TicketDetailsModal } from '@/components/TicketDetailsModal';
import { ResolveTicketModal } from '@/components/ResolveTicketModal';
import { useAuth } from '@/contexts/AuthContext';

const CRITICAL_BUCKETS = [
    { value: 'eng_jv', label: 'Engineering - JV' },
    { value: 'eng_direct', label: 'Engineering - Direct' },
    { value: 'agri_jv', label: 'Agri - JV' },
    { value: 'agri_direct', label: 'Agri - Direct' },
    { value: 'farm_manager', label: 'Farm Manager' },
];

export function GMOAssignedCriticalsSection() {
    const [criticals, setCriticals] = useState<HourlyCritical[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const [selectedCritical, setSelectedCritical] = useState<HourlyCritical | null>(null);
    const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
    const { user } = useAuth();

    // Ticket Details Modal state
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [timeline, setTimeline] = useState<any[]>([]);
    const [isTimelineLoading, setIsTimelineLoading] = useState(false);

    // Fetch timeline when a ticket is selected
    useEffect(() => {
        const fetchTimeline = async () => {
            if (!selectedCritical) return;

            setIsTimelineLoading(true);
            try {
                const { data, error } = await supabase
                    .from('hourly_critical_timeline')
                    .select('*')
                    .eq('critical_id', selectedCritical.id)
                    .order('created_at', { ascending: true });

                if (error) throw error;
                setTimeline(data || []);
            } catch (error) {
                console.error('Error fetching timeline:', error);
            } finally {
                setIsTimelineLoading(false);
            }
        };

        if (isTicketModalOpen && selectedCritical) {
            fetchTimeline();
        }
    }, [selectedCritical, isTicketModalOpen]);

    const fetchAssignedCriticals = async () => {
        setIsLoading(true);
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) return;

            // @ts-ignore - Supabase deep type instantiation issue
            const result = await (supabase as any)
                .from('hourly_criticals')
                .select('*, creator:created_by(name, email), acknowledger:acknowledged_by(name, email)')
                .eq('assigned_gmo_id', currentUser.id)
                .not('status', 'in', '("closed","resolved","pending_closure_approval")')
                .order('created_at', { ascending: false });

            if (result.error) throw result.error;
            setCriticals((result.data || []) as HourlyCritical[]);
        } catch (error) {
            console.error('Error fetching assigned criticals:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAssignedCriticals();

        const channel = supabase
            .channel('gmo-criticals')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'hourly_criticals',
            }, () => {
                fetchAssignedCriticals();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleResolveComplete = async (data: any) => {
        if (!selectedCritical) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('hourly_criticals')
                .update({
                    resolution_text: data.resolutionText,
                    resolution_proof_url: data.proofUrl || null,
                    resolution_proof_audio_url: data.callRecordingUrl || null,
                    resolution_audio_url: data.callRecordingUrl || null,
                    call_record_url: data.callRecordingUrl || null,
                    resolution_proof_screenshot_urls: data.screenshotUrls?.length > 0 ? data.screenshotUrls : null,
                    resolution_image_url: data.screenshotUrls?.join(',') || null,
                    status: 'pending_closure_approval',
                    resolved_at: new Date().toISOString(),
                    resolved_by: user?.id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedCritical.id);

            if (error) throw error;

            // Add timeline entry
            await supabase.from('hourly_critical_timeline').insert({
                critical_id: selectedCritical.id,
                action: 'resolved_proof_submitted',
                performed_by: user?.id,
                performed_by_name: user?.name || 'GMO',
                performed_by_role: 'gmo',
                details: {
                    note: 'Resolution submitted with proof',
                    comment: data.resolutionText
                }
            });

            toast.success(`Resolution submitted for critical #${selectedCritical.ticket_number}`);
            setIsResolveModalOpen(false);
            setCriticals(prev => prev.filter(c => c.id !== selectedCritical.id));
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit resolution');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openResolveDialog = (critical: HourlyCritical) => {
        setSelectedCritical(critical);
        setIsResolveModalOpen(true);
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
                            <div className="p-2 rounded-lg bg-red-500/20">
                                <Zap className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Assigned Criticals</CardTitle>
                                <CardDescription>Hourly criticals assigned to you for resolution</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {criticals.length > 0 && (
                                <Badge variant="destructive" className="animate-pulse">{criticals.length}</Badge>
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
                                {criticals.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>No criticals assigned to you</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {criticals.map((critical) => (
                                            <motion.div
                                                key={critical.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`p-4 border rounded-lg transition-colors ${critical.status === 'breached'
                                                    ? 'border-red-500 bg-red-500/10'
                                                    : 'hover:border-primary/50'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div
                                                        className="flex-1 space-y-2 cursor-pointer"
                                                        onClick={() => {
                                                            setSelectedCritical(critical);
                                                            setIsTicketModalOpen(true);
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-sm">#{critical.ticket_number}</span>
                                                            <Badge variant="outline">{critical.issue_type}</Badge>
                                                            {critical.bucket && (
                                                                <Badge variant="secondary">
                                                                    {CRITICAL_BUCKETS.find(b => b.value === critical.bucket)?.label || critical.bucket}
                                                                </Badge>
                                                            )}
                                                            {critical.status === 'breached' && (
                                                                <Badge variant="destructive" className="animate-pulse">BREACHED</Badge>
                                                            )}
                                                        </div>

                                                        <h4 className="font-medium hover:text-primary transition-colors">{critical.issue_title}</h4>
                                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                                            {critical.issue_description}
                                                        </p>

                                                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {format(new Date(critical.created_at), 'dd MMM, HH:mm')}
                                                            </span>
                                                        </div>

                                                        {critical.proof_url && (
                                                            <div className="inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-400">
                                                                <ExternalLink className="w-3 h-3 mr-1" />
                                                                View Full Intelligence Brief
                                                            </div>
                                                        )}
                                                    </div>

                                                    <Button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openResolveDialog(critical);
                                                        }}
                                                        variant={critical.status === 'breached' ? 'destructive' : 'default'}
                                                    >
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

            {/* Resolution Modal */}
            {selectedCritical && (
                <ResolveTicketModal
                    open={isResolveModalOpen}
                    onClose={() => setIsResolveModalOpen(false)}
                    onResolve={handleResolveComplete}
                    ticketId={selectedCritical.id}
                    ticketType="critical"
                    isSaving={isSubmitting}
                />
            )}

            {/* Ticket Details Modal (Intelligence Hub) */}
            {selectedCritical && (
                <TicketDetailsModal
                    open={isTicketModalOpen && !isResolveModalOpen}
                    onClose={() => setIsTicketModalOpen(false)}
                    ticket={selectedCritical}
                    ticketType="critical"
                    timeline={timeline}
                    timelineLoading={isTimelineLoading}
                    role={user?.role || 'gmo'}
                    onOpenResolveModal={() => {
                        setIsTicketModalOpen(false);
                        setIsResolveModalOpen(true);
                    }}
                />
            )}
        </>
    );
}
