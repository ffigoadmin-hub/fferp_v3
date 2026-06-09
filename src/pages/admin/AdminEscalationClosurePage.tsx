import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    CheckCircle2,
    Loader2,
    Clock,
    Phone,
    Image as ImageIcon,
    Play,
    ExternalLink,
    XCircle,
    Mic,
    AlertCircle,
    FileText,
    History,
    Search,
    Filter,
    ArrowRight,
    Hammer,
    Camera,
    ShieldCheck,
    AlertTriangle,
    Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useEscalationEngine } from '@/hooks/useEscalationEngine';
import { useAuth } from '@/contexts/AuthContext';
import { AudioWaveform } from '@/components/AudioWaveform';
import { EvidenceMediaGallery } from '@/components/EvidenceMediaGallery';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function AdminEscalationClosurePage() {
    const { user } = useAuth();
    const {
        tickets: unifiedTickets,
        counts,
        isLoading,
        isSaving,
        verifyAndClose,
        rejectProof,
    } = useEscalationEngine({ bypassFiltering: true });

    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectionForm, setShowRejectionForm] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [closureFilter, setClosureFilter] = useState<'all' | 'closedByMe' | 'closedByOthers'>('all');

    const pendingEscalations = useMemo(() =>
        unifiedTickets.filter(t => {
            const matchesSearch = t.raw.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.raw.ticket_number?.toString().includes(searchQuery);

            let matchesStatus;
            let matchesClosureFilter = true;

            if (closureFilter === 'all') {
                // Show proof-submitted tickets (pending audit)
                matchesStatus = t.type !== 'critical' &&
                    ['pending_closure_approval', 'proof_submitted', 'resolved'].includes(t.raw.status);
            } else {
                // Show closed tickets (audit history) when filter is active
                matchesStatus = t.type !== 'critical' && t.raw.status === 'closed';

                if (closureFilter === 'closedByMe') {
                    matchesClosureFilter = t.raw.closed_by_admin_id === user?.id || t.raw.resolved_by === user?.id;
                } else if (closureFilter === 'closedByOthers') {
                    matchesClosureFilter = t.raw.closed_by_admin_id && t.raw.closed_by_admin_id !== user?.id;
                }
            }

            return matchesStatus && matchesSearch && matchesClosureFilter;
        }),
        [unifiedTickets, searchQuery, closureFilter, user?.id]
    );

    // Calculate closure breakdown for closed tickets (audit history)
    const closureBreakdown = useMemo(() => {
        const closedTickets = unifiedTickets.filter(t =>
            t.type !== 'critical' && t.raw.status === 'closed'
        );

        const closedByMe = closedTickets.filter(t =>
            t.raw.closed_by_admin_id === user?.id || t.raw.resolved_by === user?.id
        ).length;

        const closedByOthers = closedTickets.filter(t =>
            t.raw.closed_by_admin_id && t.raw.closed_by_admin_id !== user?.id
        ).length;

        const closedByResolverOthers = closedTickets.filter(t =>
            t.raw.resolved_by && t.raw.resolved_by !== user?.id
        ).length;

        return {
            closedByMe,
            closedByOthers: closedByOthers + closedByResolverOthers
        };
    }, [unifiedTickets, user?.id]);

    const selectedTicket = useMemo(() =>
        unifiedTickets.find(t => t.id === selectedTicketId),
        [unifiedTickets, selectedTicketId]
    );

    const handleVerify = async () => {
        if (!selectedTicketId) return;
        try {
            // Call verifyAndClose and wait for it to complete
            await verifyAndClose(selectedTicketId, selectedTicket?.type || 'escalation');

            // Wait additional time to ensure refetch has completed
            await new Promise(resolve => setTimeout(resolve, 600));

            // Only clear after everything is done
            setSelectedTicketId(null);

            toast.success('Ticket closed successfully');
        } catch (error) {
            console.error('Verification error:', error);
            toast.error('Failed to close ticket');
        }
    };

    const handleReject = async () => {
        if (!selectedTicketId || !rejectionReason.trim()) {
            toast.error('Please provide a rejection reason');
            return;
        }
        try {
            await rejectProof(selectedTicketId, selectedTicket?.type || 'escalation', rejectionReason);
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
                    <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <Shield className="absolute inset-0 m-auto w-6 h-6 text-primary animate-pulse" />
                </div>
                <p className="text-sm font-bold tracking-widest text-muted-foreground uppercase animate-pulse">Initializing Audit Protocol...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20">
            {/* High-Fidelity Header */}
            <div className="relative overflow-hidden rounded-3xl bg-[#0A0A0B] border border-white/5 p-8 shadow-2xl">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.1)]">
                            <ShieldCheck className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">Escalation Closure</h1>
                            <div className="flex items-center gap-3 mt-1 text-xs font-bold text-muted-foreground tracking-widest uppercase">
                                <span className="text-primary italic">Audit Level 01</span>
                                <span className="opacity-20">|</span>
                                <span>{pendingEscalations.length} Pending Closures</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder="Search by Client or Ticket ID..."
                                className="pl-10 h-11 w-72 bg-white/[0.03] border-white/10 rounded-xl focus:ring-primary/20 text-xs font-medium"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" className="h-11 rounded-xl border-white/10 bg-white/[0.02] hover:bg-white/[0.05] relative overflow-hidden group">
                            <Filter className="w-4 h-4 mr-2" />
                            <span className="text-xs font-bold uppercase tracking-widest">Filters</span>
                        </Button>
                    </div>
                </div>

                {/* High-Fidelity Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-white/5">
                    <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/5 p-5 group hover:bg-white/[0.04] transition-all">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-10 translate-x-10 blur-xl decoration-clone group-hover:bg-primary/10 transition-colors" />
                        <div className="relative">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 italic mb-2 block">Total Escalations</span>
                            <div className="flex items-center justify-between">
                                <h3 className="text-3xl font-black text-white italic">{unifiedTickets.length}</h3>
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                    <Shield className="w-5 h-5 text-primary" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/5 p-5 group hover:bg-white/[0.04] transition-all cursor-help">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/5 rounded-full -translate-y-10 translate-x-10 blur-xl decoration-clone group-hover:bg-green-500/10 transition-colors" />
                                    <div className="relative">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-green-500/40 italic mb-2 block">Proof Submitted</span>
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-3xl font-black text-white italic">{(counts as any).pending_audit || 0}</h3>
                                            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
                                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs font-medium">
                                Escalations closed with proof submitted, awaiting audit verification
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/5 p-5 group hover:bg-white/[0.04] transition-all cursor-help">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-full -translate-y-10 translate-x-10 blur-xl decoration-clone group-hover:bg-amber-500/10 transition-colors" />
                                    <div className="relative">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/40 italic mb-2 block">Pending to Submitted</span>
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-3xl font-black text-white italic">{(counts as any).active || 0}</h3>
                                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                                <Clock className="w-5 h-5 text-amber-500" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs font-medium">
                                Active escalations pending resolution proof submission
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                {/* Closure Breakdown Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    onClick={() => setClosureFilter(closureFilter === 'closedByMe' ? 'all' : 'closedByMe')}
                                    className={`relative overflow-hidden rounded-2xl border p-5 group transition-all cursor-pointer ${
                                        closureFilter === 'closedByMe'
                                            ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                                            : 'bg-blue-500/[0.02] border-blue-500/10 hover:bg-blue-500/[0.04]'
                                    }`}
                                >
                                    <div className={`absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-10 translate-x-10 blur-xl decoration-clone transition-colors ${
                                        closureFilter === 'closedByMe' ? 'bg-blue-500/20' : 'bg-blue-500/5 group-hover:bg-blue-500/10'
                                    }`} />
                                    <div className="relative">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500/40 italic mb-2 block">Closed by Me</span>
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-3xl font-black text-white italic">{closureBreakdown.closedByMe}</h3>
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                                                closureFilter === 'closedByMe'
                                                    ? 'bg-blue-500/20 border-blue-500/50'
                                                    : 'bg-blue-500/10 border-blue-500/20'
                                            }`}>
                                                <ShieldCheck className="w-5 h-5 text-blue-500" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs font-medium">
                                Click to filter escalations closed by you
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    onClick={() => setClosureFilter(closureFilter === 'closedByOthers' ? 'all' : 'closedByOthers')}
                                    className={`relative overflow-hidden rounded-2xl border p-5 group transition-all cursor-pointer ${
                                        closureFilter === 'closedByOthers'
                                            ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                                            : 'bg-purple-500/[0.02] border-purple-500/10 hover:bg-purple-500/[0.04]'
                                    }`}
                                >
                                    <div className={`absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-10 translate-x-10 blur-xl decoration-clone transition-colors ${
                                        closureFilter === 'closedByOthers' ? 'bg-purple-500/20' : 'bg-purple-500/5 group-hover:bg-purple-500/10'
                                    }`} />
                                    <div className="relative">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500/40 italic mb-2 block">Closed by Others</span>
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-3xl font-black text-white italic">{closureBreakdown.closedByOthers}</h3>
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                                                closureFilter === 'closedByOthers'
                                                    ? 'bg-purple-500/20 border-purple-500/50'
                                                    : 'bg-purple-500/10 border-purple-500/20'
                                            }`}>
                                                <Users className="w-5 h-5 text-purple-500" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs font-medium">
                                Click to filter escalations closed by other admins
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-16rem)] min-h-[500px]">
                {/* Left: Queue (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                                {closureFilter === 'all' ? 'Escalation Queue' : 'Audit History'}
                            </h3>
                            {closureFilter !== 'all' && (
                                <Badge variant="outline" className={`rounded-full px-2 py-0 text-[10px] ${
                                    closureFilter === 'closedByMe' ? 'border-blue-500/30 text-blue-400 bg-blue-500/5' : 'border-purple-500/30 text-purple-400 bg-purple-500/5'
                                }`}>
                                    {closureFilter === 'closedByMe' ? 'Closed by Me' : 'Closed by Others'}
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {closureFilter !== 'all' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setClosureFilter('all')}
                                    className="h-6 px-2 text-[9px] font-bold uppercase text-muted-foreground hover:text-white"
                                >
                                    Clear Filter
                                </Button>
                            )}
                            <Badge variant="outline" className="rounded-full px-2 py-0 border-primary/30 text-primary text-[10px] bg-primary/5">{pendingEscalations.length}</Badge>
                        </div>
                    </div>

                    <ScrollArea className="flex-1 -mr-4 pr-4">
                        <div className="space-y-3">
                            {pendingEscalations.length === 0 ? (
                                <div className="h-40 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl opacity-40">
                                    <ShieldCheck className="w-8 h-8 mb-2" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest italic">All Cleared</p>
                                </div>
                            ) : (
                                pendingEscalations.map((e) => (
                                    <motion.button
                                        key={e.id}
                                        layoutId={e.id}
                                        onClick={() => setSelectedTicketId(e.id)}
                                        className={cn(
                                            "w-full text-left p-4 rounded-2xl transition-all duration-300 border group box-border",
                                            selectedTicketId === e.id
                                                ? "bg-primary/10 border-primary/40 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                                                : "bg-[#0A0A0B] border-white/5 hover:border-white/10"
                                        )}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <span className="text-[10px] font-mono text-muted-foreground tracking-tighter">
                                                ID: {String(e.raw.ticket_number).padStart(3, '0')}
                                            </span>
                                            <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                {e.raw.resolution_audio_url && <Mic className="w-3 h-3 text-primary" />}
                                                {e.raw.resolution_image_url && <ImageIcon className="w-3 h-3 text-status-live" />}
                                                {e.raw.resolution_evidence_url && <FileText className="w-3 h-3 text-blue-500" />}
                                                {e.issue_proof_url && <Camera className="w-3 h-3 text-red-500/60" />}
                                            </div>
                                        </div>
                                        <h4 className="font-bold text-sm text-white mb-1 truncate">{e.raw.client_name}</h4>
                                        <p className="text-xs text-muted-foreground line-clamp-1 mb-3 opacity-60 italic">"{e.raw.issue_title}"</p>

                                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-[9px] uppercase border-white/10 text-white/40">
                                                    {e.raw.current_owner?.toUpperCase()}
                                                </Badge>
                                                {closureFilter !== 'all' && (
                                                    <Badge variant="outline" className={`text-[9px] uppercase border ${
                                                        closureFilter === 'closedByMe' ? 'border-blue-500/30 text-blue-400 bg-blue-500/5' : 'border-purple-500/30 text-purple-400 bg-purple-500/5'
                                                    }`}>
                                                        {closureFilter === 'closedByMe' ? 'Closed by You' : `Closed by: ${e.raw.closed_by_admin_name || e.raw.resolver?.name || 'Unknown'}`}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/30">Created</span>
                                                <span className="text-[9px] font-mono text-muted-foreground font-bold italic tracking-tighter">
                                                    {format(new Date(e.raw.created_at), 'MMM dd, hh:mm a')}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.button>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Right: Studio (8 cols) */}
                <div className="lg:col-span-8 bg-[#0A0A0B] border border-white/5 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative">
                    <AnimatePresence mode="wait">
                        {selectedTicket ? (
                            <motion.div
                                key={selectedTicket.id}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.02 }}
                                className="h-full flex flex-col"
                            >
                                {/* Studio Toolbar */}
                                <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-white/[0.01]">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-sm font-black tracking-widest uppercase italic">Closure Workspace</h2>
                                        <Badge className="bg-amber-500/20 text-amber-500 border-0 text-[10px] font-black px-3 py-0.5 tracking-tighter">
                                            CLOSURE PENDING
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-9 px-4 text-[10px] font-black uppercase text-white hover:bg-white/5"
                                            onClick={() => setSelectedTicketId(null)}
                                        >
                                            CLOSE WORKSPACE
                                        </Button>
                                    </div>
                                </div>

                                {/* Studio Scroll Content */}
                                <ScrollArea className="flex-1">
                                    <div className="p-8 space-y-10">
                                        <div className="grid grid-cols-2 gap-10">
                                            {/* Original Intelligence Container */}
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-4 bg-red-500 rounded-full" />
                                                        <h3 className="text-xs font-black uppercase tracking-widest text-red-500 italic">Incident Details</h3>
                                                    </div>
                                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-red-500/20 text-red-500 bg-red-500/5 px-2 py-0">Initial Log</Badge>
                                                </div>

                                                <div className="glass-card bg-white/[0.02] border border-white/10 p-6 rounded-2xl space-y-6 shadow-2xl relative overflow-hidden group/inc">
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/[0.02] rounded-full blur-3xl -translate-y-16 translate-x-16" />
                                                    <div>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500/60 italic">Issue Statement</label>
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[8px] font-bold uppercase text-muted-foreground/30 tracking-widest">Escalation Created</span>
                                                                <span className="text-[10px] font-mono text-white/50">{format(new Date(selectedTicket.raw.created_at), 'MMM dd, hh:mm a')}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm font-black text-white italic leading-relaxed border-l-2 border-red-500/30 pl-4 py-1 tracking-tight">
                                                            {selectedTicket.issue_description || "No detailed description logged."}
                                                        </p>
                                                    </div>

                                                    {/* Fallback Proof Image */}
                                                    {(() => {
                                                        const proofUrl = selectedTicket.issue_proof_url || 
                                                                       selectedTicket.raw.proof_url || 
                                                                       selectedTicket.raw.evidence_url || 
                                                                       selectedTicket.raw.escalation_proof_url;
                                                        
                                                        if (!proofUrl) return null;

                                                        return (
                                                            <div className="pt-6 border-t border-white/10">
                                                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/60 mb-3 block italic">Initial Proof Intelligence</label>
                                                                <div className="rounded-2xl overflow-hidden border border-white/10 group/img relative bg-black/40 shadow-2xl">
                                                                    <div className="aspect-[16/10]">
                                                                        <img 
                                                                            src={proofUrl} 
                                                                            alt="Escalation Proof" 
                                                                            className="w-full h-full object-cover transition-transform duration-1000 group-hover/img:scale-110" 
                                                                        />
                                                                    </div>
                                                                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover/img:opacity-100 transition-all flex flex-col items-center justify-center backdrop-blur-md">
                                                                        <Button 
                                                                            variant="outline" 
                                                                            size="sm" 
                                                                            className="h-12 px-8 text-[11px] font-black uppercase text-white border-primary/50 bg-primary/20 hover:bg-primary/30 rounded-2xl shadow-[0_0_20px_rgba(var(--primary),0.2)]"
                                                                            onClick={() => window.open(proofUrl || '', '_blank')}
                                                                        >
                                                                            <ExternalLink className="w-4 h-4 mr-2 text-primary" />
                                                                            DEEP ANALYSIS
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    <div className="pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
                                                        <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl hover:bg-white/[0.04] transition-all">
                                                            <label className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] mb-1.5 block italic">Comms Channel</label>
                                                            <p className="text-[11px] font-black text-white italic tracking-tighter">{selectedTicket.raw.client_phone || 'Internal Direct'}</p>
                                                        </div>
                                                        <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl hover:bg-white/[0.04] transition-all">
                                                            <label className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] mb-1.5 block italic">Logged Via</label>
                                                            <p className="text-[11px] font-black text-primary italic tracking-tighter uppercase">{selectedTicket.raw.current_level || 'System Engine'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Resolution Proof Container */}
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-4 bg-[#A855F7] rounded-full" />
                                                        <h3 className="text-xs font-black uppercase tracking-widest text-[#A855F7] italic">Resolution Proof</h3>
                                                    </div>
                                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-[#A855F7]/20 text-[#A855F7] bg-[#A855F7]/5 px-2 py-0">Submitted</Badge>
                                                </div>

                                                <div className="glass-card bg-[#A855F7]/[0.03] border border-[#A855F7]/10 p-6 rounded-2xl space-y-6 shadow-2xl relative overflow-hidden group/res">
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#A855F7]/[0.02] rounded-full blur-3xl -translate-y-16 translate-x-16" />
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="text-[9px] font-black italic text-[#A855F7]/40 uppercase block tracking-[0.2em]">Resolution Summary</label>
                                                        {selectedTicket.raw.resolved_at && (
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[8px] font-bold uppercase text-[#A855F7]/30 tracking-widest">Proof Submitted</span>
                                                                <span className="text-[10px] font-mono text-[#A855F7]/60 font-bold">{format(new Date(selectedTicket.raw.resolved_at), 'MMM dd, hh:mm a')}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-black leading-relaxed text-green-50/90 pl-1 italic">
                                                        {selectedTicket.raw.resolution_text || "No resolution details provided."}
                                                    </p>

                                                    {/* Multimedia Verification */}
                                                    <div className="space-y-6 pt-6 border-t border-white/10">
                                                        {selectedTicket.raw.resolution_audio_url && (
                                                            <div className="p-5 bg-black/40 border border-white/5 rounded-2xl shadow-xl transition-all hover:border-[#A855F7]/30">
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#A855F7] flex items-center gap-2 italic">
                                                                        <Mic className="w-3.5 h-3.5" />
                                                                        Audio Signature (Playable Proof)
                                                                    </label>
                                                                    <Badge variant="outline" className="text-[8px] h-4 border-[#A855F7]/30 text-[#A855F7] bg-[#A855F7]/5 font-black">AUDIO VALIDATION</Badge>
                                                                </div>
                                                                <AudioWaveform src={selectedTicket.raw.resolution_audio_url} className="bg-transparent" />
                                                            </div>
                                                        )}

                                                        {(selectedTicket.raw.resolution_image_url || selectedTicket.raw.resolution_evidence_url) && (
                                                            <div className="space-y-4">
                                                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#A855F7]/60 px-1 italic">Visual Evidence Portfolio</label>
                                                                <div className="p-1 rounded-2xl bg-white/[0.01] border border-white/5">
                                                                    <EvidenceMediaGallery
                                                                        images={selectedTicket.raw.resolution_image_url ? selectedTicket.raw.resolution_image_url.split(',') : []}
                                                                        documents={selectedTicket.raw.resolution_evidence_url ? [selectedTicket.raw.resolution_evidence_url] : []}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </ScrollArea>

                                {/* Studio Footer Actions */}
                                <div className="p-6 border-t border-white/5 bg-white/[0.02] flex items-center gap-4">
                                    <Button
                                        onClick={handleVerify}
                                        disabled={isSaving}
                                        className="h-16 flex-1 bg-green-600 hover:bg-green-700 text-white font-black tracking-[0.2em] italic text-xs shadow-[0_0_40px_rgba(22,163,74,0.3)] rounded-2xl group transition-all hover:scale-[1.01]"
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ShieldCheck className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />}
                                        AUTHORIZE CLOSURE
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowRejectionForm(true)}
                                        className="h-16 px-10 border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/50 font-black tracking-widest text-xs rounded-2xl transition-all"
                                    >
                                        REJECT PROOF
                                    </Button>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="w-24 h-24 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6 shadow-2xl"
                                >
                                    <Hammer className="w-10 h-10 text-muted-foreground opacity-20" />
                                </motion.div>
                                <h3 className="text-sm font-black tracking-widest text-muted-foreground uppercase mb-2 italic">Workspace Inactive</h3>
                                <p className="text-[10px] text-muted-foreground/50 max-w-xs leading-relaxed uppercase tracking-tighter">Select a ticket from the queue to initialize verification and audit sequence.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Rejection Modal */}
            <Dialog open={showRejectionForm} onOpenChange={setShowRejectionForm}>
                <DialogContent className="bg-[#0D0D0F] border-white/10 text-white max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1 background-gradient-red opacity-50" />
                    <DialogHeader className="pt-6">
                        <DialogTitle className="text-2xl font-black italic tracking-tighter flex items-center gap-3 text-red-500">
                            <AlertTriangle className="w-8 h-8" />
                            REJECTION PROTOCOL
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-6 font-bold tracking-tighter">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1 mb-2 block">Reason for Auditor Rejection</Label>
                            <Textarea
                                placeholder="Detail why the resolution fails audit verification..."
                                className="bg-white/[0.02] border-white/10 rounded-2xl min-h-[140px] text-xs font-bold italic focus:ring-red-500/20 focus:border-red-500/50 transition-all resize-none shadow-inner"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                            />
                        </div>
                        <div className="p-5 bg-red-500/5 border border-red-500/10 rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -translate-y-12 translate-x-12" />
                            <p className="text-[9px] text-red-500 font-black uppercase tracking-[0.2em] italic mb-1.5 flex items-center gap-2">
                                <XCircle className="w-3 h-3" />
                                Action Impact Analysis:
                            </p>
                            <p className="text-[10px] text-red-400/70 font-bold leading-relaxed uppercase">Ticket will be returned to the SMO/GMO queue for immediate re-intervention. Audit score will be impacted.</p>
                        </div>
                    </div>
                    <DialogFooter className="pb-6 gap-3">
                        <Button variant="ghost" onClick={() => setShowRejectionForm(false)} className="text-white/40 hover:text-white hover:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest">Cancel</Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white font-black tracking-widest text-xs h-14 px-8 rounded-2xl shadow-[0_10px_30px_rgba(220,38,38,0.2)] transition-all hover:scale-[1.02]"
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
