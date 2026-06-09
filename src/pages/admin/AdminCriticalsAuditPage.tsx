import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    CheckCircle2,
    Loader2,
    Clock,
    ImageIcon,
    Play,
    Zap,
    ExternalLink,
    XCircle,
    Mic,
    AlertCircle,
    FileText,
    Search,
    Filter,
    Hammer,
    ShieldCheck,
    AlertTriangle,
    Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useEscalationEngine } from '@/hooks/useEscalationEngine';
import { AudioWaveform } from '@/components/AudioWaveform';
import { EvidenceMediaGallery } from '@/components/EvidenceMediaGallery';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const CRITICAL_BUCKETS = [
    { value: 'eng_jv', label: 'Engineering - JV' },
    { value: 'eng_direct', label: 'Engineering - Direct' },
    { value: 'agri_jv', label: 'Agri - JV' },
    { value: 'agri_direct', label: 'Agri - Direct' },
    { value: 'farm_manager', label: 'Farm Manager' },
];

export default function AdminCriticalsAuditPage() {
    const {
        tickets: unifiedTickets,
        isLoading,
        isSaving,
        verifyAndClose,
        rejectProof,
    } = useEscalationEngine({ bypassFiltering: true });

    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectionForm, setShowRejectionForm] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const pendingCriticals = useMemo(() =>
        unifiedTickets.filter(t => {
            const matchesSearch = t.raw.issue_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.raw.ticket_number?.toString().includes(searchQuery);
            return t.type === 'critical' &&
                ['pending_closure_approval', 'proof_submitted', 'resolved'].includes(t.raw.status) &&
                matchesSearch;
        }),
        [unifiedTickets, searchQuery]
    );

    const selectedTicket = useMemo(() =>
        unifiedTickets.find(t => t.id === selectedTicketId),
        [unifiedTickets, selectedTicketId]
    );

    const handleVerify = async () => {
        if (!selectedTicketId) return;
        try {
            await verifyAndClose(selectedTicketId, 'critical');
            setSelectedTicketId(null);
            toast.success('Critical ticket verified and closed.');
        } catch (error) {
            toast.error('Failed to verify ticket');
        }
    };

    const handleReject = async () => {
        if (!selectedTicketId || !rejectionReason.trim()) {
            toast.error('Please provide a rejection reason');
            return;
        }
        try {
            await rejectProof(selectedTicketId, 'critical', rejectionReason);
            // Clear UI only after confirmed success
            setShowRejectionForm(false);
            setRejectionReason('');
            setSelectedTicketId(null);
        } catch (error) {
            // Error toast already shown by rejectProof — keep form open so user can retry
        }
    };

    if (isLoading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                    <Zap className="absolute inset-0 m-auto w-6 h-6 text-amber-500 animate-pulse" />
                </div>
                <p className="text-sm font-bold tracking-widest text-muted-foreground uppercase animate-pulse text-amber-500/60">Loading Critical Payloads...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="relative overflow-hidden rounded-3xl bg-[#0A0A0B] border border-white/5 p-8 shadow-2xl">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-amber-500/5 to-transparent pointer-events-none" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                            <Zap className="w-8 h-8 text-amber-500" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">Criticals Closure</h1>
                            <div className="flex items-center gap-3 mt-1 text-xs font-bold text-muted-foreground tracking-widest uppercase">
                                <span className="text-amber-500 italic">Integrity Verification</span>
                                <span className="opacity-20">|</span>
                                <span>{pendingCriticals.length} Criticals Awaiting Closure</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-amber-500 transition-colors" />
                            <Input
                                placeholder="Search by Ticket ID..."
                                className="pl-10 h-11 w-64 bg-white/[0.03] border-white/10 rounded-xl focus:ring-amber-500/20 text-xs font-medium"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" className="h-11 rounded-xl border-white/10 bg-white/[0.02] hover:bg-white/[0.05]">
                            <Filter className="w-4 h-4 mr-2" />
                            <span className="text-xs font-bold uppercase tracking-widest">Filters</span>
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-16rem)] min-h-[500px]">
                {/* Left: Queue */}
                <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Closure Pipeline</h3>
                        <Badge variant="outline" className="rounded-full px-2 py-0 border-amber-500/30 text-amber-500 text-[10px] bg-amber-500/5">{pendingCriticals.length}</Badge>
                    </div>

                    <ScrollArea className="flex-1 -mr-4 pr-4">
                        <div className="space-y-3">
                            {pendingCriticals.length === 0 ? (
                                <div className="h-40 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl opacity-40">
                                    <ShieldCheck className="w-8 h-8 mb-2" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest italic">All Criticals Verified</p>
                                </div>
                            ) : (
                                pendingCriticals.map((e) => (
                                    <motion.button
                                        key={e.id}
                                        layoutId={e.id}
                                        onClick={() => setSelectedTicketId(e.id)}
                                        className={cn(
                                            "w-full text-left p-4 rounded-2xl transition-all duration-300 border group box-border relative overflow-hidden",
                                            selectedTicketId === e.id
                                                ? "bg-amber-500/10 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.05)]"
                                                : "bg-[#0A0A0B] border-white/5 hover:border-white/10"
                                        )}
                                    >
                                        {selectedTicketId === e.id && (
                                            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                                        )}
                                        <div className="flex items-start justify-between mb-2">
                                            <span className="text-[10px] font-mono text-muted-foreground tracking-tighter">
                                                TKT-CR-{String(e.raw.ticket_number).padStart(3, '0')}
                                            </span>
                                            <Badge variant="outline" className="text-[8px] border-amber-500/30 text-amber-500 bg-amber-500/5 uppercase font-black">
                                                {e.raw.issue_type}
                                            </Badge>
                                        </div>
                                        <h4 className="font-bold text-sm text-white mb-1 truncate">{e.raw.issue_title}</h4>
                                        <p className="text-[10px] text-muted-foreground italic mb-4 opacity-70">
                                            {CRITICAL_BUCKETS.find(b => b.value === e.raw.bucket)?.label || 'System Wide'}
                                        </p>

                                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black uppercase text-white/30">{e.raw.current_owner?.toUpperCase() || 'SMO'}</span>
                                            </div>
                                            <span className="text-[9px] font-mono text-muted-foreground">
                                                {format(new Date(e.raw.created_at), 'HH:mm')} Today
                                            </span>
                                        </div>
                                    </motion.button>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Right: Detail View */}
                <div className="lg:col-span-8 bg-[#0A0A0B] border border-white/5 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative">
                    <AnimatePresence mode="wait">
                        {selectedTicket ? (
                            <motion.div
                                key={selectedTicket.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="h-full flex flex-col"
                            >
                                <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-white/[0.01]">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-sm font-black tracking-widest uppercase italic text-amber-500">Critical Closure</h2>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase opacity-50">
                                            <Activity className="w-3 h-3" />
                                            Live Session
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedTicketId(null)} className="h-9 text-[10px] font-black uppercase hover:bg-white/5">Exit Portal</Button>
                                </div>

                                <div className="flex-1 overflow-auto p-8">
                                    <div className="grid grid-cols-2 gap-12">
                                        {/* Original Report */}
                                        <div className="space-y-8">
                                            <div>
                                                <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 text-muted-foreground/40">Initial Report Payload</h3>
                                                <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl relative">
                                                    <div className="absolute top-0 right-0 p-4 opacity-5"><Zap className="w-12 h-12" /></div>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="text-[9px] font-bold text-muted-foreground/30 uppercase block mb-1">Issue Category</label>
                                                            <p className="text-xs font-black uppercase text-amber-500/80 tracking-widest">{selectedTicket.raw.issue_type}</p>
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-bold text-muted-foreground/30 uppercase block mb-1">Problem Statement</label>
                                                            <p className="text-sm font-medium leading-relaxed italic border-l-2 border-amber-500/20 pl-4">
                                                                {selectedTicket.raw.issue_description}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {selectedTicket.raw.proof_url && (
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/40 flex items-center gap-2">
                                                        <AlertTriangle className="w-3 h-3 text-orange-500" />
                                                        ESCALATION PROOF
                                                    </label>
                                                    <EvidenceMediaGallery
                                                        images={[selectedTicket.raw.proof_url]}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Resolution Proof */}
                                        <div className="space-y-8">
                                            <div>
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="w-1 h-3 bg-[#A855F7] rounded-full" />
                                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-[#A855F7]">SUBMITTED PROOF</h3>
                                                </div>
                                                <div className="p-6 bg-[#A855F7]/[0.03] border border-[#A855F7]/10 rounded-2xl shadow-[0_0_25px_rgba(168,85,247,0.02)]">
                                                    <label className="text-[9px] font-black italic text-[#A855F7]/40 uppercase mb-3 block">Deployment / Fix Summary</label>
                                                    <p className="text-sm font-black text-green-50 leading-relaxed italic pl-1">
                                                        {selectedTicket.raw.resolution_text || "No summary provided."}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                {selectedTicket.raw.resolution_audio_url && (
                                                    <div className="p-5 bg-[#A855F7]/[0.05] border border-[#A855F7]/20 rounded-2xl shadow-[0_4px_30px_rgba(168,85,247,0.05)]">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <label className="text-[9px] font-black uppercase tracking-widest text-[#A855F7] flex items-center gap-2">
                                                                <Mic className="w-3 h-3" />
                                                                Audio Signature (Playable Proof)
                                                            </label>
                                                            <Badge variant="outline" className="text-[8px] h-4 border-[#A855F7]/30 text-[#A855F7] bg-[#A855F7]/5">AUDIO VALIDATION</Badge>
                                                        </div>
                                                        <AudioWaveform src={selectedTicket.raw.resolution_audio_url} className="bg-black/40 border-white/5" />
                                                    </div>
                                                )}

                                                {(selectedTicket.raw.resolution_image_url || selectedTicket.raw.resolution_evidence_url) && (
                                                    <div className="space-y-3">
                                                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 px-1 italic">Visual Evidence Portfolio</label>
                                                        <EvidenceMediaGallery
                                                            images={selectedTicket.raw.resolution_image_url ? selectedTicket.raw.resolution_image_url.split(',') : []}
                                                            documents={selectedTicket.raw.resolution_evidence_url ? [selectedTicket.raw.resolution_evidence_url] : []}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 border-t border-white/5 bg-white/[0.01] flex items-center gap-6">
                                    <Button
                                        onClick={handleVerify}
                                        disabled={isSaving}
                                        className="h-16 flex-1 bg-green-600 hover:bg-green-700 text-white font-black tracking-[0.2em] italic text-xs shadow-[0_0_40px_rgba(22,163,74,0.1)] rounded-2xl"
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5 mr-3" />}
                                        AUTHORIZE CLOSURE
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowRejectionForm(true)}
                                        className="h-16 px-10 border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/50 font-black tracking-widest text-xs rounded-2xl"
                                    >
                                        REJECT
                                    </Button>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                                <Activity className="w-12 h-12 text-white/5 mb-6 animate-pulse" />
                                <h3 className="text-[10px] font-black tracking-[0.3em] text-muted-foreground uppercase opacity-40">Awaiting Signal Selection</h3>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <Dialog open={showRejectionForm} onOpenChange={setShowRejectionForm}>
                <DialogContent className="bg-[#0D0D0F] border-white/5 text-white max-w-sm rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black italic tracking-tighter text-red-500 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> REJECTION PROTOCOL
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Reason for Rejection *</Label>
                        <Textarea
                            className="bg-white/[0.02] border-white/10 rounded-xl min-h-[100px]"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[10px] rounded-xl"
                            onClick={handleReject}
                            disabled={isSaving || !rejectionReason.trim()}
                        >
                            CONFIRM REJECTION
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
