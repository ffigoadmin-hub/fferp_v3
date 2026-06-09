import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap,
    Loader2,
    Clock,
    User,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    AlertCircle
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
import { useEscalationEngine } from '@/hooks/useEscalationEngine';

const CRITICAL_BUCKETS = [
    { value: 'eng_jv', label: 'Engineering - JV' },
    { value: 'eng_direct', label: 'Engineering - Direct' },
    { value: 'agri_jv', label: 'Agri - JV' },
    { value: 'agri_direct', label: 'Agri - Direct' },
    { value: 'farm_manager', label: 'Farm Manager' },
    { value: 'hr', label: 'HR' },
    { value: 'business_development', label: 'Business Development' },
    { value: 'buy_back', label: 'Buy Back' },
    { value: 'site_visit', label: 'Site Visit' },
    { value: 'rental_sourcing', label: 'Rental Sourcing' },
    { value: 'tnskill', label: 'TNSkill' },
    { value: 'nursery_landscaping', label: 'Nursery & Landscaping' },
    { value: 'head_office', label: 'Head Office' },
];

export function AssignedCriticalsSection() {
    const [criticals, setCriticals] = useState<HourlyCritical[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const { addComment } = useEscalationEngine();

    // Modals
    const [selectedCritical, setSelectedCritical] = useState<HourlyCritical | null>(null);
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
    const [timeline, setTimeline] = useState<any[]>([]);
    const [isTimelineLoading, setIsTimelineLoading] = useState(false);

    // Fetch timeline when a ticket is selected for details
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

    // Fetch assigned criticals
    useEffect(() => {
        const fetchAssignedCriticals = async () => {
            if (!user) return;
            setIsLoading(true);
            try {
                // @ts-ignore - Supabase deep type instantiation issue
                const result = await (supabase as any)
                    .from('hourly_criticals')
                    .select('*, creator:created_by(name, email)')
                    .or(`assigned_user_id.eq.${user.id},assigned_smo_id.eq.${user.id},assigned_gmo_id.eq.${user.id},assigned_user_ids.cs.{${user.id}}`)
                    .not('status', 'in', '("closed","resolved","pending_closure_approval")')
                    .order('created_at', { ascending: false });

                if (result.error) throw result.error;
                const data = (result.data || []) as HourlyCritical[];
                setCriticals(data);

                // Check for ticketId in URL to auto-open
                const urlTicketId = searchParams.get('ticketId');
                if (urlTicketId && !selectedCritical) {
                    const ticket = data.find(c => c.id === urlTicketId);
                    if (ticket) {
                        setSelectedCritical(ticket);
                        setIsTicketModalOpen(true);
                    }
                }
            } catch (error) {
                console.error('Error fetching assigned criticals:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssignedCriticals();

        // Realtime subscription
        const channel = supabase
            .channel('assigned-criticals-' + user?.id)
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
    }, [user?.id]);

    const openDetailsModal = (critical: HourlyCritical) => {
        setSelectedCritical(critical);
        setIsTicketModalOpen(true);
    };

    const handleResolveComplete = async (data: any) => {
        if (!selectedCritical || !user) return;
        setIsSubmitting(true);
        try {
            const audioUrl = data.audioUrl || data.callRecordingUrl;
            const updateData: any = {
                status: 'pending_closure_approval',
                resolution_text: data.resolutionText,
                resolution_image_url: data.screenshotUrls?.join(',') || null,
                resolution_proof_screenshot_urls: data.screenshotUrls || null,
                resolution_audio_url: audioUrl || null,
                resolution_proof_audio_url: audioUrl || null,
                call_record_url: audioUrl || null,
                resolved_at: new Date().toISOString(),
                resolved_by: user.id,
                updated_at: new Date().toISOString()
            };

            if (data.proofUrl) {
                updateData.resolution_proof_url = data.proofUrl;
            }

            const { error } = await supabase
                .from('hourly_criticals')
                .update(updateData)
                .eq('id', selectedCritical.id);

            if (error) throw error;

            toast.success(`Resolution proof submitted for critical ticket #${selectedCritical.ticket_number}`);
            setIsResolveModalOpen(false);
            setIsTicketModalOpen(false);
            setCriticals(prev => prev.filter(c => c.id !== selectedCritical.id));

        } catch (error: any) {
            console.error('Resolve error:', error);
            toast.error(error.message || 'Failed to submit resolution');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <Card className="border-red-500/20 bg-red-500/5">
                <CardContent className="p-6">
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card className="border-red-500/20 bg-background/50 backdrop-blur-sm shadow-xl overflow-hidden mt-6">
                <CardHeader className="cursor-pointer hover:bg-white/5 transition-colors border-b border-red-500/10" onClick={() => setIsExpanded(!isExpanded)}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-red-500/20 shadow-inner">
                                <AlertCircle className="w-6 h-6 text-red-500" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold tracking-tight text-red-500">My Assigned Criticals</CardTitle>
                                <CardDescription>Hourly high-priority critical issues requiring immediate action</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {criticals.length > 0 && (
                                <Badge variant="destructive" className="px-3 py-1 text-sm font-bold animate-pulse shadow-lg bg-red-600">
                                    {criticals.length} URGENT
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
                                {criticals.length === 0 ? (
                                    <div className="text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/10">
                                        <div className="w-16 h-16 bg-zinc-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-500/30">
                                            <CheckCircle2 className="w-8 h-8 text-zinc-500" />
                                        </div>
                                        <p className="text-lg font-medium">Clear Sky</p>
                                        <p className="text-muted-foreground mt-1 text-sm">No critical issues are assigned to you.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {criticals.map((critical) => (
                                            <motion.div
                                                key={critical.id}
                                                layout
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className={`group relative p-5 border rounded-2xl transition-all duration-300 shadow-sm ${critical.status === 'breached'
                                                    ? 'border-red-500/50 bg-red-500/10 hover:bg-red-500/[0.15]'
                                                    : 'border-white/10 bg-white/5 hover:bg-white/[0.08] hover:border-red-500/40'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-6">
                                                    <div className="flex-1 space-y-4">
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <div className="bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                                                                <span className="font-mono text-xs font-bold text-red-500 tracking-wider">#{critical.ticket_number}</span>
                                                            </div>
                                                            <Badge variant="outline" className="border-red-500/30 text-red-400">
                                                                {critical.issue_type}
                                                            </Badge>
                                                            {critical.bucket && (
                                                                <Badge variant="secondary" className="bg-white/5 text-xs text-muted-foreground border-white/10">
                                                                    {CRITICAL_BUCKETS.find(b => b.value === critical.bucket)?.label || critical.bucket}
                                                                </Badge>
                                                            )}
                                                            {critical.status === 'breached' && (
                                                                <Badge variant="destructive" className="bg-red-600 animate-pulse font-bold shadow-lg shadow-red-600/20">
                                                                    BREACHED
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        <div>
                                                            <h4 className="text-lg font-bold leading-tight group-hover:text-red-500 transition-colors cursor-pointer" onClick={() => openDetailsModal(critical)}>
                                                                {critical.issue_title}
                                                            </h4>
                                                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                                                                {critical.issue_description}
                                                            </p>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-4 pt-2">
                                                            {(critical as any).creator && (
                                                                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 text-xs font-medium">
                                                                    <User className="w-3.5 h-3.5 text-red-500/70" />
                                                                    <span className="text-foreground/80">{(critical as any).creator.name}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 text-xs font-medium">
                                                                <Clock className="w-3.5 h-3.5 text-red-500/70" />
                                                                <span className="text-foreground/80 font-bold">{format(new Date(critical.created_at), 'dd MMM, hh:mm a')}</span>
                                                            </div>
                                                        </div>

                                                        <div className="pt-2 border-t border-white/5">
                                                            <Button
                                                                variant="link"
                                                                className="h-auto p-0 text-xs font-semibold text-red-400 hover:text-red-300 transition-all flex items-center gap-1.5"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openDetailsModal(critical);
                                                                }}
                                                            >
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                                VIEW CRITICAL INTELLIGENCE BRIEF
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="shrink-0 flex flex-col gap-3">
                                                        <Button
                                                            className={`shadow-lg font-bold rounded-xl px-6 ${critical.status === 'breached'
                                                                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/30'
                                                                : 'bg-red-500 hover:bg-red-600 shadow-red-500/30'}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedCritical(critical);
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
                                                                openDetailsModal(critical);
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

            {selectedCritical && (
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
                        ticket={selectedCritical}
                        ticketType="critical"
                        role={user?.role || 'solver'}
                        timeline={timeline}
                        timelineLoading={isTimelineLoading}
                        onAddComment={(comment, audio) => addComment(selectedCritical.id, 'critical', comment, audio)}
                        onOpenResolveModal={() => {
                            setIsTicketModalOpen(false);
                            setIsResolveModalOpen(true);
                        }}
                    />
                    <ResolveTicketModal
                        open={isResolveModalOpen}
                        onClose={() => setIsResolveModalOpen(false)}
                        onResolve={handleResolveComplete}
                        ticketId={selectedCritical.id}
                        ticketType="critical"
                        isSaving={isSubmitting}
                    />
                </>
            )}
        </>
    );
}
