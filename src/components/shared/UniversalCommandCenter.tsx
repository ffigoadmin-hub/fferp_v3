import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import {
    AlertTriangle, Zap, RefreshCw,
    Search, LayoutGrid, List, Building2,
    ShieldAlert, Loader2, ChevronRight, ChevronDown, MapPin, Download, Plus
} from 'lucide-react';
import { EscalationWizard } from '../nsm/EscalationWizard';
import { useEscalationEngine } from '@/hooks/useEscalationEngine';
import { CommandStripRow } from './CommandStripRow';
import { SLAPulseBadge } from './SLAPulseBadge';
import { TicketDetailsModal } from '../TicketDetailsModal';
import { ResolveTicketModal } from '../ResolveTicketModal';
import { WorkflowTimelineEntry } from '@/types/workflows';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { exportToCSV } from '@/lib/exportUtils';
import { format } from 'date-fns';

interface UCCProps {
    roleOverride?: 'ceo' | 'admin' | 'gm' | 'boi' | 'smo' | 'gmo' | string;
    defaultTab?: 'escalations' | 'criticals' | 'site-visits';
    showFilters?: boolean;
    hideTabs?: boolean;
}

export function UniversalCommandCenter({ roleOverride, defaultTab = 'escalations', hideTabs = false }: UCCProps) {
    const { user } = useAuth();
    const effectiveRole = (roleOverride || user?.role || 'smo').toLowerCase();

    const {
        tickets: unifiedTickets,
        isLoading,
        isSaving,
        acknowledge,
        resolve,
        escalateToGM,
        escalateToCEO,
        verifyAndClose,
        rejectProof,
        addComment,
        deleteTicket, 
        createEscalation,
        startWarRoom,
        refetch
    } = useEscalationEngine();

    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [searchQuery, setSearchQuery] = useState('');
    const [deptFilter, setDeptFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending_ack' | 'assigned' | 'active' | 'escalated' | 'pending_closure' | 'closed'>('all');
    const [dateCreatedFilter, setDateCreatedFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
    const [dateResolvedFilter, setDateResolvedFilter] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');
    const [projectScope, setProjectScope] = useState<'all' | 'project' | 'internal'>('all');
    const [viewMode, setViewMode] = useState<'flat' | 'project'>('flat');
    const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
    const [isCreateEscalationDialogOpen, setIsCreateEscalationDialogOpen] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);

    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(searchParams.get('ticketId'));
    const projectFilter = searchParams.get('project');
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [timeline, setTimeline] = useState<WorkflowTimelineEntry[]>([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Timeline fetcher
    const fetchTimeline = useCallback(async (ticketId: string, type: 'escalation' | 'critical' | 'site_visit') => {
        setTimelineLoading(true);
        try {
            let table = 'client_escalation_timeline';
            let idField = 'escalation_id';

            if (type === 'critical') {
                table = 'hourly_critical_timeline';
                idField = 'critical_id';
            }
            // For site_visit, we use client_escalation_timeline now as per useEscalationEngine logic
            // but the ID is the ticket ID.

            const { data, error } = await (supabase.from(table as any) as any).select('*').eq(idField, ticketId).order('created_at', { ascending: true });
            if (error) throw error;
            setTimeline(data || []);
        } catch (error) {
            console.error('Error fetching timeline:', error);
        } finally {
            setTimelineLoading(false);
        }
    }, []);

    const selectedTicket = useMemo(() => unifiedTickets.find(t => t.id === selectedTicketId), [unifiedTickets, selectedTicketId]);

    useEffect(() => {
        if (selectedTicketId && selectedTicket) {
            fetchTimeline(selectedTicketId, selectedTicket.type);
        }
    }, [selectedTicketId, selectedTicket, fetchTimeline]);

    // Fetch projects for EscalationWizard if management role
    useEffect(() => {
        const fetchProjects = async () => {
            const mgmtRoles = ['gm', 'admin', 'boi', 'ceo', 'director'];
            if (!mgmtRoles.includes((effectiveRole || '').toLowerCase())) return;

            setIsLoadingProjects(true);
            try {
                const { data, error } = await supabase
                    .from('projects')
                    .select('id, project_name, client_name, client_contact, location_city, location_state, onboarded_date, project_type, project_vertical, department')
                    .order('project_name')
                    .limit(100);
                if (error) throw error;
                setProjects(data || []);
            } catch (error) {
                console.error('Error fetching projects:', error);
            } finally {
                setIsLoadingProjects(false);
            }
        };

        fetchProjects();
    }, [effectiveRole]);

    const handleCreateEscalation = async (data: any) => {
        const result = await createEscalation({
            department: data.department,
            client_name: data.client_name || 'N/A',
            client_phone: data.client_phone,
            issue_title: data.issue_title,
            issue_description: data.issue_description,
            priority: data.priority,
            evidence_url: data.evidence_url,
            project_id: data.project_id,
            escalation_proof_url: data.evidence_url,
            bucket: data.bucket,
        });

        if (result) {
            setIsCreateEscalationDialogOpen(false);
            refetch();
        }
        return result;
    };

    // Filtering Logic
    const filteredTickets = useMemo(() => {
        return unifiedTickets.filter(t => {
            let requiredType = 'escalation';
            if (activeTab === 'criticals') requiredType = 'critical';
            if (activeTab === 'site-visits') requiredType = 'site_visit';

            if (t.type !== requiredType) return false;

            // Project ID from query param
            const projectQuery = searchParams.get('project');
            if (projectQuery && t.project_id !== projectQuery) return false;

            // Department Filter
            if (deptFilter !== 'all') {
                const ticketDept = (t.department || 'unknown').toLowerCase().replace(/[\s-]+/g, '_');
                // Group matching for department card clicks
                const DEPT_GROUPS: Record<string, string[]> = {
                    engineering: ['engineering', 'civil'],
                    agri: ['agri', 'agri_operations', 'agri_mart', 'farmers_factory', 'farm_manager'],
                };
                const groupKeys = DEPT_GROUPS[deptFilter];
                if (groupKeys) {
                    if (!groupKeys.includes(ticketDept)) return false;
                } else {
                    if (ticketDept !== deptFilter) return false;
                }
            }

            // Search
            if (searchQuery) {
                const searchLower = searchQuery.toLowerCase();
                const matchesSearch =
                    t.id.toLowerCase().includes(searchLower) ||
                    (t.type === 'escalation' ? t.raw.client_name : t.raw.issue_title)?.toLowerCase().includes(searchLower) ||
                    (t.type === 'escalation' ? t.raw.issue_title : t.raw.issue_description)?.toLowerCase().includes(searchLower) ||
                    (t.department || '').toLowerCase().includes(searchLower);
                if (!matchesSearch) return false;
            }

            // Status - Lifecycle Stage Filtering
            if (statusFilter !== 'all') {
                const isOpen = t.raw.status === 'open' && !t.raw.assigned_to && !t.raw.assigned_role;
                const isAssigned = t.raw.status === 'open' && (t.raw.assigned_to || t.raw.assigned_role);
                const isInProgress = t.raw.status === 'acknowledged' || t.raw.status === 'in_progress';
                const isEscalated = t.raw.status === 'escalated_gm' || t.raw.status === 'escalated_ceo';
                const isPendingClosure = t.raw.status === 'resolved' || t.raw.status === 'pending_closure_approval' || t.raw.status === 'waiting_audit';
                const isClosed = t.raw.status === 'closed';

                if (statusFilter === 'pending_ack' && !isOpen) return false;
                if (statusFilter === 'assigned' && !isAssigned) return false;
                if (statusFilter === 'active' && !isInProgress) return false;
                if (statusFilter === 'escalated' && !isEscalated) return false;
                if (statusFilter === 'pending_closure' && !isPendingClosure) return false;
                if (statusFilter === 'closed' && !isClosed) return false;
            }

            // Date Created Filter
            if (dateCreatedFilter !== 'all') {
                const createdDate = new Date(t.raw.created_at);
                const now = new Date();
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
                const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
                const startOfMonth = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);

                if (dateCreatedFilter === 'today' && createdDate < startOfToday) return false;
                if (dateCreatedFilter === 'yesterday' && (createdDate < startOfYesterday || createdDate >= startOfToday)) return false;
                if (dateCreatedFilter === 'week' && createdDate < startOfWeek) return false;
                if (dateCreatedFilter === 'month' && createdDate < startOfMonth) return false;
            }

            // Date Resolved Filter
            if (dateResolvedFilter !== 'all' && t.resolved_at) {
                const resolvedDate = new Date(t.resolved_at);
                const now = new Date();
                const diffDays = Math.floor((now.getTime() - resolvedDate.getTime()) / (1000 * 60 * 60 * 24));

                if (dateResolvedFilter === 'today' && diffDays > 0) return false;
                if (dateResolvedFilter === 'yesterday' && (diffDays < 1 || diffDays > 1)) return false;
                if (dateResolvedFilter === 'week' && diffDays > 7) return false;
            } else if (dateResolvedFilter !== 'all' && !t.resolved_at) {
                return false;
            }

            // Project Scope Filter
            if (projectScope !== 'all') {
                const hasProject = !!t.project_id;
                if (projectScope === 'project' && !hasProject) return false;
                if (projectScope === 'internal' && hasProject) return false;
            }

            return true;
        }).sort((a, b) => {
            const getBreached = (ticket: any) => {
                if (ticket.raw.acknowledged_at) return false;
                if (ticket.type === 'escalation') return ticket.raw.status === 'breached' || new Date() > new Date(ticket.raw.ack_deadline);
                if (ticket.type === 'critical') return ticket.raw.status === 'breached' || ticket.raw.blast_triggered_at;
                if (ticket.type === 'site_visit') return false; // Basic for now
                return false;
            };

            const aBreached = getBreached(a);
            const bBreached = getBreached(b);
            if (aBreached && !bBreached) return -1;
            if (!aBreached && bBreached) return 1;
            return new Date(b.raw.created_at).getTime() - new Date(a.raw.created_at).getTime();
        });
    }, [unifiedTickets, activeTab, searchQuery, statusFilter, dateCreatedFilter, dateResolvedFilter, projectScope, deptFilter, searchParams]);

    // Compute unique departments for filter dropdown
    const availableDepartments = useMemo(() => {
        const currentTabTickets = unifiedTickets.filter(t => {
            if (activeTab === 'escalations') return t.type === 'escalation';
            if (activeTab === 'criticals') return t.type === 'critical';
            if (activeTab === 'site-visits') return t.type === 'site_visit';
            return false;
        });
        const deptSet = new Set<string>();
        currentTabTickets.forEach(t => {
            if (t.department && t.department !== 'unknown') {
                deptSet.add(t.department.toLowerCase().replace(/[\s-]+/g, '_'));
            }
        });
        return Array.from(deptSet).sort();
    }, [unifiedTickets, activeTab]);

    const ticketStats = useMemo(() => {
        const currentTabTickets = unifiedTickets.filter(t => {
            if (activeTab === 'escalations') return t.type === 'escalation';
            if (activeTab === 'criticals') return t.type === 'critical';
            if (activeTab === 'site-visits') return t.type === 'site_visit';
            return false;
        });
        return {
            all: currentTabTickets.length,
            unack: currentTabTickets.filter(t => !t.raw.acknowledged_at && t.raw.status === 'open' && !t.raw.assigned_to && !t.raw.assigned_role).length,
            assigned: currentTabTickets.filter(t => (t.raw.assigned_to || t.raw.assigned_role) && t.raw.status === 'open').length,
            active: currentTabTickets.filter(t => t.raw.status === 'acknowledged' || t.raw.status === 'in_progress').length,
            escalated: currentTabTickets.filter(t => t.raw.status === 'escalated_gm' || t.raw.status === 'escalated_ceo').length,
            breached: currentTabTickets.filter(t => !t.raw.acknowledged_at && (
                t.type === 'escalation'
                    ? (t.raw.status === 'breached' || new Date() > new Date(t.raw.ack_deadline))
                    : (t.raw.status === 'breached' || t.raw.blast_triggered_at)
            )).length,
            pending_closure: currentTabTickets.filter(t => t.raw.status === 'resolved' || t.raw.status === 'pending_closure_approval' || t.raw.status === 'waiting_audit').length,
            closed: currentTabTickets.filter(t => t.raw.status === 'closed').length
        };
    }, [unifiedTickets, activeTab]);

    // Daily department stats for Engineering and Agri
    const dailyDeptStats = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const getDeptDailyStats = (deptKeys: string[]) => {
            const deptTickets = unifiedTickets.filter(t => {
                const dept = t.department?.toLowerCase().replace(/[\s-]+/g, '_') || '';
                return deptKeys.includes(dept);
            });
            const todayTickets = deptTickets.filter(t => new Date(t.created_at) >= today);

            return {
                total: deptTickets.length,
                todayTotal: todayTickets.length,
                open: todayTickets.filter(t => t.raw.status === 'open' && !t.raw.assigned_to && !t.raw.assigned_role).length,
                assigned: todayTickets.filter(t => (t.raw.assigned_to || t.raw.assigned_role) && t.raw.status === 'open').length,
                proofSubmitted: todayTickets.filter(t => ['resolved', 'pending_closure_approval', 'waiting_audit', 'proof_submitted'].includes(t.raw.status)).length,
                closed: todayTickets.filter(t => t.raw.status === 'closed').length,
            };
        };

        return {
            engineering: getDeptDailyStats(['engineering', 'civil']),
            agri: getDeptDailyStats(['agri', 'agri_operations', 'agri_mart', 'farmers_factory', 'farm_manager']),
        };
    }, [unifiedTickets]);

    const groupedTickets = useMemo(() => {
        if (viewMode === 'flat') return null;
        const groups: Record<string, typeof filteredTickets> = {};
        const internal: typeof filteredTickets = [];

        filteredTickets.forEach(t => {
            if (t.project_id && t.project) {
                if (!groups[t.project_id]) groups[t.project_id] = [];
                groups[t.project_id].push(t);
            } else {
                internal.push(t);
            }
        });

        const projectGroups = Object.entries(groups).map(([id, tickets]) => ({
            id,
            name: (tickets[0].project as any)?.project_name || 'Unknown Project',
            client_name: (tickets[0].project as any)?.client_name || tickets[0].raw.client_name,
            tickets,
            stats: {
                active: tickets.filter(t => !t.resolved_at).length,
                breached: tickets.filter(t => !t.acknowledged_at && (t.status === 'breached' || (t.type === 'escalation' && new Date() > new Date(t.ack_deadline)))).length
            }
        })).sort((a, b) => b.stats.breached - a.stats.breached || b.stats.active - a.stats.active);

        return { projects: projectGroups, internal };
    }, [filteredTickets, viewMode]);

    const handleExportDetailedCSV = useCallback(() => {
        if (filteredTickets.length === 0) {
            toast.error('No tickets to export');
            return;
        }

        const headers = [
            { key: 'ticket_id', label: 'Ticket ID' },
            { key: 'type', label: 'Type' },
            { key: 'title', label: 'Title' },
            { key: 'description', label: 'Description' },
            { key: 'client_name', label: 'Client Name' },
            { key: 'department', label: 'Department' },
            { key: 'status', label: 'Status' },
            { key: 'priority', label: 'Priority' },
            { key: 'urgency', label: 'Urgency' },
            { key: 'current_level', label: 'Current Level' },
            { key: 'current_owner', label: 'Current Owner' },
            { key: 'project_name', label: 'Project Name' },
            { key: 'created_at', label: 'Created At' },
            { key: 'ack_deadline', label: 'Ack Deadline' },
            { key: 'resolve_deadline', label: 'Resolve Deadline' },
            { key: 'acknowledged_at', label: 'Acknowledged At' },
            { key: 'resolved_at', label: 'Resolved At' },
            { key: 'forwarded_to_gm_at', label: 'Forwarded to GM' },
            { key: 'pushed_to_ceo_at', label: 'Pushed to CEO' },
            { key: 'creator_name', label: 'Creator' },
            { key: 'acknowledger_name', label: 'Acknowledged By' },
            { key: 'resolver_name', label: 'Resolved By' },
            { key: 'gm_name', label: 'GM' },
            { key: 'assigned_user', label: 'Assigned To' },
            { key: 'assigned_role', label: 'Assigned Role' },
            { key: 'initial_proof', label: 'Initial Proof' },
            { key: 'escalation_proof', label: 'Escalation Proof' },
            { key: 'resolution_evidence', label: 'Resolution Evidence' },
            { key: 'resolution_text', label: 'Resolution Notes' }
        ];

        const exportData = filteredTickets.map(t => ({
            ticket_id: (t.type === 'escalation' ? 'ESC-' : 'CRT-') + String(t.raw.ticket_number).padStart(4, '0'),
            type: t.type.toUpperCase(),
            title: t.issue_title,
            description: t.issue_description,
            client_name: t.client_name || 'N/A',
            department: t.department || 'N/A',
            status: t.status.toUpperCase(),
            priority: t.priority_level || t.priority || 'N/A',
            urgency: t.urgency || 'N/A',
            current_level: t.current_level || 'N/A',
            current_owner: t.current_owner || 'N/A',
            project_name: t.project?.project_name || 'Internal',
            created_at: t.created_at ? format(new Date(t.created_at), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
            ack_deadline: t.ack_deadline ? format(new Date(t.ack_deadline), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
            resolve_deadline: t.resolve_deadline ? format(new Date(t.resolve_deadline), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
            acknowledged_at: t.acknowledged_at ? format(new Date(t.acknowledged_at), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
            resolved_at: t.resolved_at ? format(new Date(t.resolved_at), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
            forwarded_to_gm_at: t.forwarded_to_gm_at ? format(new Date(t.forwarded_to_gm_at), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
            pushed_to_ceo_at: t.pushed_to_ceo_at ? format(new Date(t.pushed_to_ceo_at), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
            creator_name: t.creator?.name || 'N/A',
            acknowledger_name: t.acknowledger?.name || 'N/A',
            resolver_name: t.resolver?.name || 'N/A',
            gm_name: t.gm?.name || 'N/A',
            assigned_user: t.assigned_user?.name || 'N/A',
            assigned_role: t.assigned_role || 'N/A',
            initial_proof: t.issue_proof_url || t.proof_url || t.raw.issue_proof_url || 'N/A',
            escalation_proof: t.escalation_proof_url || t.raw.escalation_proof_url || 'N/A',
            resolution_evidence: t.resolution_evidence_url || t.raw.resolution_evidence_url || t.raw.resolution_proof_screenshot_urls?.[0] || 'N/A',
            resolution_text: t.raw.resolution_text || 'N/A'
        }));

        exportToCSV(exportData as any, `detailed_escalations_${format(new Date(), 'yyyyMMdd_HHmm')}`, headers as any);
        toast.success('Detailed export generated');
    }, [filteredTickets]);

    if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    return (
        <div className="space-y-4 cyber-grid p-2">
            {/* Integrated Command Header - Title & Global Stats */}
            <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
                <div className="flex-shrink-0">
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-primary animate-pulse" />
                        <span className="command-label text-primary text-[9px] tracking-[0.2em]">{effectiveRole.toUpperCase()} COMMAND AUTHORITY</span>
                    </div>
                    <h1 className="text-xl font-black tracking-tighter scanned-text bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                        Intelligence Oversight Center
                    </h1>
                    <div className="flex items-center gap-3 mt-1">
                        <p className="text-[10px] text-muted-foreground font-mono opacity-50">SEC-LVL-4 // SIGINT-ACTIVE</p>
                        <div className="flex items-center gap-1.5 h-4 px-2 rounded-full bg-status-live/10 border border-status-live/20">
                            <span className="w-1 h-1 rounded-full bg-status-live animate-pulse" />
                            <span className="text-[9px] font-mono font-bold text-status-live uppercase tracking-widest">Live</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 w-full max-w-3xl">
                    <div className="stat-card border-l-primary/50 !py-1.5 !px-3 bg-white/5 backdrop-blur-md">
                        <p className="command-label text-[8px] mb-0.5 opacity-70">Client Escalations</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-black">{unifiedTickets.filter(t => t.type === 'escalation' && !t.resolved_at && t.status !== 'closed').length}</p>
                            <span className="text-[9px] text-muted-foreground">Act</span>
                            <span className="text-primary font-bold text-xs">+{unifiedTickets.filter(t => t.type === 'escalation' && t.status === 'resolved').length}</span>
                            <span className="text-[9px] text-muted-foreground">Ref</span>
                        </div>
                    </div>
                    <div className="stat-card border-l-status-late/50 !py-1.5 !px-3 bg-white/5 backdrop-blur-md">
                        <p className="command-label text-[8px] text-status-late mb-0.5 opacity-70">Hourly Criticals</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-black text-status-late">{unifiedTickets.filter(t => t.type === 'critical' && !t.resolved_at && t.status !== 'closed').length}</p>
                            <span className="text-[9px] text-muted-foreground">Act</span>
                            <span className="text-status-late font-bold text-xs">+{unifiedTickets.filter(t => t.type === 'critical' && t.status === 'resolved').length}</span>
                            <span className="text-[9px] text-muted-foreground">Ref</span>
                        </div>
                    </div>
                    <div className="stat-card border-l-orange-500/50 !py-1.5 !px-3 bg-white/5 backdrop-blur-md">
                        <p className="command-label text-[8px] text-orange-500 mb-0.5 opacity-70">Site Visits</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-black text-orange-500">{unifiedTickets.filter(t => t.type === 'site_visit' && !t.resolved_at && t.status !== 'closed').length}</p>
                            <span className="text-[9px] text-muted-foreground">Act</span>
                            <span className="text-orange-500 font-bold text-xs">+{unifiedTickets.filter(t => t.type === 'site_visit' && t.status === 'resolved').length}</span>
                            <span className="text-[9px] text-muted-foreground">Ref</span>
                        </div>
                    </div>
                </div>

                <Button variant="outline" size="icon" className="h-8 w-8 border-white/10 hover:bg-white/5 hidden xl:flex" onClick={refetch}>
                    <RefreshCw className="w-3.5 h-3.5" />
                </Button>
            </div>

            {/* Department Quick Stats - Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Engineering Card */}
                <div className={cn(
                    "stat-card border-l-blue-500/50 !py-1.5 !px-3 cursor-pointer transition-all hover:bg-white/10 group",
                    deptFilter === 'engineering' ? "bg-blue-500/5 ring-1 ring-blue-500/30" : "bg-white/5"
                )} onClick={() => setDeptFilter(deptFilter === 'engineering' ? 'all' : 'engineering')}>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <Building2 className="w-3 h-3 text-blue-400" />
                            <span className="text-[10px] font-bold text-white tracking-tight uppercase">Engineering Operations</span>
                        </div>
                        <span className="text-[8px] text-muted-foreground/60 uppercase font-black tracking-widest">Today Pulse</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-red-500/10 rounded px-1.5 py-0.5 border border-red-500/20">
                            <span className="text-[8px] text-red-400 font-bold uppercase">Open</span>
                            <span className="text-xs font-black text-red-400">{dailyDeptStats.engineering.open}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-blue-500/10 rounded px-1.5 py-0.5 border border-blue-500/20">
                            <span className="text-[8px] text-blue-400 font-bold uppercase">Asg</span>
                            <span className="text-xs font-black text-blue-400">{dailyDeptStats.engineering.assigned}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-yellow-500/10 rounded px-1.5 py-0.5 border border-yellow-500/20">
                            <span className="text-[8px] text-yellow-400 font-bold uppercase">Proof</span>
                            <span className="text-xs font-black text-yellow-400">{dailyDeptStats.engineering.proofSubmitted}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-green-500/10 rounded px-1.5 py-0.5 border border-green-500/20">
                            <span className="text-[8px] text-green-400 font-bold uppercase">Done</span>
                            <span className="text-xs font-black text-green-400">{dailyDeptStats.engineering.closed}</span>
                        </div>
                        <div className="ml-auto flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground font-mono">Total: {dailyDeptStats.engineering.total}</span>
                            <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                    </div>
                </div>

                {/* Agri Card */}
                <div className={cn(
                    "stat-card border-l-emerald-500/50 !py-1.5 !px-3 cursor-pointer transition-all hover:bg-white/10 group",
                    deptFilter === 'agri' ? "bg-emerald-500/5 ring-1 ring-emerald-500/30" : "bg-white/5"
                )} onClick={() => setDeptFilter(deptFilter === 'agri' ? 'all' : 'agri')}>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <Building2 className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] font-bold text-white tracking-tight uppercase">Agri Operations Pulse</span>
                        </div>
                        <span className="text-[8px] text-muted-foreground/60 uppercase font-black tracking-widest">Today Pulse</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-red-500/10 rounded px-1.5 py-0.5 border border-red-500/20">
                            <span className="text-[8px] text-red-400 font-bold uppercase">Open</span>
                            <span className="text-xs font-black text-red-400">{dailyDeptStats.agri.open}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-blue-500/10 rounded px-1.5 py-0.5 border border-blue-500/20">
                            <span className="text-[8px] text-blue-400 font-bold uppercase">Asg</span>
                            <span className="text-xs font-black text-blue-400">{dailyDeptStats.agri.assigned}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-yellow-500/10 rounded px-1.5 py-0.5 border border-yellow-500/20">
                            <span className="text-[8px] text-yellow-400 font-bold uppercase">Proof</span>
                            <span className="text-xs font-black text-yellow-400">{dailyDeptStats.agri.proofSubmitted}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-green-500/10 rounded px-1.5 py-0.5 border border-green-500/20">
                            <span className="text-[8px] text-green-400 font-bold uppercase">Done</span>
                            <span className="text-xs font-black text-green-400">{dailyDeptStats.agri.closed}</span>
                        </div>
                        <div className="ml-auto flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground font-mono">Total: {dailyDeptStats.agri.total}</span>
                            <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                    </div>
                </div>
            </div>


            <div className="grid grid-cols-1 gap-3">
                <div className="col-span-1 space-y-2">
                    <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
                        <div className="flex flex-col gap-2 mb-2">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                                {!hideTabs && (
                                    <TabsList className="premium-tabs h-8 w-fit">
                                        <TabsTrigger value="escalations" className="text-[11px] px-4 data-[state=active]:premium-tab-active">
                                            <AlertTriangle className="w-3 h-3 mr-1.5" />
                                            Escalations
                                        </TabsTrigger>
                                        <TabsTrigger value="criticals" className="text-[11px] px-4 data-[state=active]:premium-tab-active">
                                            <Zap className="w-3 h-3 mr-1.5 text-status-late" />
                                            Criticals
                                        </TabsTrigger>
                                        <TabsTrigger value="site-visits" className="text-[11px] px-4 data-[state=active]:premium-tab-active">
                                            <MapPin className="w-3 h-3 mr-1.5 text-orange-500" />
                                            Site Visits
                                        </TabsTrigger>
                                    </TabsList>
                                )}
                                <div className={`flex flex-wrap items-center gap-1 ${hideTabs ? 'w-full justify-end' : ''}`}>
                                    {[
                                        { id: 'all', label: 'All', count: ticketStats.all },
                                        { id: 'pending_ack', label: 'Open', count: ticketStats.unack, color: 'text-red-500' },
                                        { id: 'assigned', label: 'Assigned', count: ticketStats.assigned || 0, color: 'text-blue-500' },
                                        { id: 'active', label: 'In Progress', count: ticketStats.active, color: 'text-primary' },
                                        ...(activeTab === 'escalations' ? [{ id: 'escalated', label: 'Escalated', count: ticketStats.escalated || 0, color: 'text-orange-500' }] : []),
                                        { id: 'pending_closure', label: 'Proof Submitted', count: ticketStats.pending_closure, color: 'text-yellow-500' },
                                        { id: 'closed', label: 'Closed', count: ticketStats.closed || 0, color: 'text-green-500' },
                                    ].map(filter => (
                                        <button
                                            key={filter.id}
                                            onClick={() => setStatusFilter(filter.id as any)}
                                            className={cn(
                                                "px-2 py-1 rounded-md text-[10px] font-bold transition-all border",
                                                statusFilter === filter.id
                                                    ? "bg-white/10 border-white/20 text-white shadow-sm"
                                                    : "bg-transparent border-transparent text-muted-foreground hover:bg-white/5 hover:text-white"
                                            )}
                                        >
                                            <span className={filter.color}>{filter.label}</span>
                                            <span className="ml-1.5 opacity-60 bg-black/20 px-1.5 py-0.5 rounded-md">{filter.count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex bg-black/30 border border-white/10 rounded-xl p-1">
                                    <button onClick={() => setViewMode('flat')} className={cn("p-1.5 rounded-lg transition-all", viewMode === 'flat' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white")} title="Flat View"><List className="w-4 h-4" /></button>
                                    <button onClick={() => setViewMode('project')} className={cn("p-1.5 rounded-lg transition-all", viewMode === 'project' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white")} title="Project Hierarchical View"><LayoutGrid className="w-4 h-4" /></button>
                                </div>

                                <div className="relative flex-1 min-w-[140px] max-w-[200px]">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                    <input
                                        className="w-full h-8 bg-black/20 border border-white/10 rounded-lg pl-8 pr-3 text-[11px] focus:ring-1 focus:ring-primary/40 outline-none"
                                        placeholder="Search..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                {['gm', 'admin', 'boi', 'ceo', 'director'].includes((effectiveRole || 'employee').toLowerCase()) && (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 border-white/10 bg-black/20 hover:bg-white/5 text-[10px] font-bold"
                                            onClick={handleExportDetailedCSV}
                                        >
                                            <Download className="w-3.5 h-3.5 mr-1.5" />
                                            EXPORT CSV
                                        </Button>

                                        <Button
                                            size="sm"
                                            className="h-8 bg-primary hover:bg-primary/90 text-black text-[10px] font-bold"
                                            onClick={() => setIsCreateEscalationDialogOpen(true)}
                                        >
                                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                                            RAISE ESCALATION
                                        </Button>
                                    </div>
                                )}

                                <div className="flex items-center p-0.5 bg-black/30 border border-white/10 rounded-lg">
                                    {[{ id: 'all', label: 'All' }, { id: 'project', label: 'Projects' }, { id: 'internal', label: 'Internal' }].map(scope => (
                                        <button key={scope.id} onClick={() => setProjectScope(scope.id as any)} className={cn("px-2 py-1 rounded-md text-[10px] font-bold transition-all", projectScope === scope.id ? "bg-primary text-black" : "text-muted-foreground hover:text-white")}>{scope.label.toUpperCase()}</button>
                                    ))}
                                </div>


                                <Select value={dateCreatedFilter} onValueChange={(v: any) => setDateCreatedFilter(v)}>
                                    <SelectTrigger className="w-[100px] h-8 bg-black/20 border-white/10 text-[11px] rounded-lg">
                                        <SelectValue placeholder="Created Date" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#0a0f18] border-white/10 text-white">
                                        <SelectItem value="all">All Dates</SelectItem>
                                        <SelectItem value="today">Today</SelectItem>
                                        <SelectItem value="yesterday">Yesterday</SelectItem>
                                        <SelectItem value="week">Past 7 Days</SelectItem>
                                        <SelectItem value="month">Past 30 Days</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={dateResolvedFilter} onValueChange={(v: any) => setDateResolvedFilter(v)}>
                                    <SelectTrigger className="w-[110px] h-8 bg-black/20 border-white/10 text-[11px] rounded-lg">
                                        <SelectValue placeholder="Resolved Date" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#0a0f18] border-white/10 text-white">
                                        <SelectItem value="all">Any Resolution</SelectItem>
                                        <SelectItem value="today">Resolved Today</SelectItem>
                                        <SelectItem value="yesterday">Resolved Yesterday</SelectItem>
                                        <SelectItem value="week">Past 7 Days</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={deptFilter} onValueChange={(v: any) => setDeptFilter(v)}>
                                    <SelectTrigger className="w-[120px] h-8 bg-black/20 border-white/10 text-[11px] rounded-lg">
                                        <SelectValue placeholder="Department" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#0a0f18] border-white/10 text-white max-h-[300px]">
                                        <SelectItem value="all">All Departments</SelectItem>
                                        {availableDepartments.map(dept => (
                                            <SelectItem key={dept} value={dept}>
                                                {dept.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                            <TabsContent value={activeTab} className="mt-0 outline-none">
                                <Card className="glass-card p-0 border-white/5 overflow-hidden">
                                    <div>
                                        {filteredTickets.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                                <LayoutGrid className="w-12 h-12 mb-4 opacity-20" />
                                                <p className="text-sm font-medium">{ticketStats.all > 0 ? "No tickets match selected filters" : "Intelligence Stream Clear"}</p>
                                                <p className="text-xs opacity-60">{ticketStats.all > 0 ? "Try switching to 'All' or 'Active' view" : "No active operations in this sector"}</p>
                                                {ticketStats.all > 0 && statusFilter !== 'all' && (
                                                    <Button variant="link" size="sm" onClick={() => setStatusFilter('all')} className="mt-2 text-primary">Reset Filters</Button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                {viewMode === 'project' && groupedTickets ? (
                                                    <div className="space-y-2 p-1">
                                                        {groupedTickets.projects.map((group) => (
                                                            <div key={group.id} className="border border-white/10 rounded-lg overflow-hidden bg-black/20">
                                                                <button onClick={() => setExpandedProjects(prev => ({ ...prev, [group.id]: !prev[group.id] }))} className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors">
                                                                    <div className="flex items-center gap-3">
                                                                        {expandedProjects[group.id] ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                                                        <div className="flex flex-col items-start text-left">
                                                                            <span className="font-bold text-sm tracking-tight">{group.name}</span>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-[10px] text-muted-foreground">{group.client_name}</span>
                                                                                {group.tickets[0]?.project?.onboarded_date && (
                                                                                    <span className="text-[10px] text-primary/70 font-bold bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
                                                                                        {Math.floor((Date.now() - new Date(group.tickets[0].project.onboarded_date).getTime()) / (1000 * 60 * 60 * 24))} DAYS ACTIVE
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        {group.stats.breached > 0 && <Badge variant="destructive" className="h-5 px-1.5 text-[10px] flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{group.stats.breached} Breach</Badge>}
                                                                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-white/5 text-muted-foreground border-white/10">{group.stats.active} Active</Badge>
                                                                    </div>
                                                                </button>
                                                                <AnimatePresence>
                                                                    {expandedProjects[group.id] && (
                                                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                                            <div className="border-t border-white/5">
                                                                                {group.tickets.map((ticket, idx) => (
                                                                                    <CommandStripRow
                                                                                        key={ticket.id}
                                                                                        id={(ticket.type === 'escalation' ? 'ESC-' : 'CRT-') + String(ticket.raw.ticket_number).padStart(4, '0')}
                                                                                        title={ticket.type === 'escalation' ? ticket.raw.issue_title : ticket.raw.issue_title}
                                                                                        subtitle={ticket.type === 'escalation' ? ticket.raw.issue_description : ticket.raw.issue_description}
                                                                                        department={ticket.department}
                                                                                        status={ticket.raw.status}
                                                                                        rawStatus={ticket.raw.status}
                                                                                        isAssigned={!!(ticket.raw.assigned_to || ticket.raw.assigned_role || ticket.raw.assigned_user_id)}
                                                                                        hasProofSubmitted={!!(ticket.raw.proof_submitted_at || ticket.raw.resolution_evidence_url || ticket.raw.resolution_text)}
                                                                                        isPriority={ticket.priority_level === 'P0' || ticket.priority_level === 'P1' || ticket.type === 'critical'}
                                                                                        priorityLevel={ticket.priority_level as any}
                                                                                        isWarRoom={ticket.is_war_room}
                                                                                        isSelected={selectedTicketId === ticket.id}
                                                                                        createdAt={ticket.created_at}
                                                                                        onClick={() => { setSelectedIndex(idx); setSelectedTicketId(ticket.id); }}
                                                                                        leftElement={<div className={cn("p-2 rounded-lg bg-white/5 border border-white/5", ticket.type === 'critical' ? "text-status-late" : (ticket.type === 'site_visit' ? "text-orange-500" : "text-primary"))}>{ticket.type === 'critical' ? <Zap className="w-4 h-4" /> : (ticket.type === 'site_visit' ? <MapPin className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />)}</div>}
                                                                                        rightElement={<SLAPulseBadge deadline={ticket.type === 'critical' ? ticket.raw.resolve_deadline : (ticket.raw.resolve_deadline || ticket.raw.ack_deadline)} status={ticket.raw.status} acknowledgedAt={ticket.raw.acknowledged_at || undefined} />}
                                                                                    />
                                                                                ))}
                                                                            </div>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        ))}
                                                        {groupedTickets.internal.length > 0 && (
                                                            <div className="border border-white/10 rounded-lg overflow-hidden bg-black/20 mt-6">
                                                                <div className="w-full flex items-center justify-between p-3 bg-white/5">
                                                                    <div className="flex items-center gap-3"><ShieldAlert className="w-4 h-4 text-primary" /><span className="font-bold text-sm tracking-tight">Internal Operations / Unassigned</span></div>
                                                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-white/5 text-muted-foreground border-white/10">{groupedTickets.internal.length} Operations</Badge>
                                                                </div>
                                                                <div>
                                                                    {groupedTickets.internal.map((ticket, idx) => (
                                                                        <CommandStripRow
                                                                            key={ticket.id}
                                                                            id={(ticket.type === 'escalation' ? 'ESC-' : 'CRT-') + String(ticket.raw.ticket_number).padStart(4, '0')}
                                                                            title={ticket.type === 'escalation' ? ticket.raw.issue_title : ticket.raw.issue_title}
                                                                            subtitle={ticket.type === 'escalation' ? ticket.raw.issue_description : ticket.raw.issue_description}
                                                                            department={ticket.department}
                                                                            status={ticket.raw.status}
                                                                            rawStatus={ticket.raw.status}
                                                                            isAssigned={!!(ticket.raw.assigned_to || ticket.raw.assigned_role || ticket.raw.assigned_user_id)}
                                                                            hasProofSubmitted={!!(ticket.raw.proof_submitted_at || ticket.raw.resolution_evidence_url || ticket.raw.resolution_text)}
                                                                            isPriority={ticket.priority_level === 'P0' || ticket.priority_level === 'P1' || ticket.type === 'critical'}
                                                                            priorityLevel={ticket.priority_level as any}
                                                                            isWarRoom={ticket.is_war_room}
                                                                            isSelected={selectedTicketId === ticket.id}
                                                                            createdAt={ticket.created_at}
                                                                            onClick={() => { setSelectedIndex(idx); setSelectedTicketId(ticket.id); }}
                                                                            leftElement={<div className={cn("p-2 rounded-lg bg-white/5 border border-white/5", ticket.type === 'critical' ? "text-status-late" : (ticket.type === 'site_visit' ? "text-orange-500" : "text-primary"))}>{ticket.type === 'critical' ? <Zap className="w-4 h-4" /> : (ticket.type === 'site_visit' ? <MapPin className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />)}</div>}
                                                                            rightElement={<SLAPulseBadge deadline={ticket.type === 'critical' ? ticket.raw.resolve_deadline : (ticket.raw.resolve_deadline || ticket.raw.ack_deadline)} status={ticket.raw.status} acknowledgedAt={ticket.raw.acknowledged_at || undefined} />}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    filteredTickets.map((ticket, idx) => (
                                                        <motion.div key={ticket.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}>
                                                            <CommandStripRow
                                                                id={(ticket.type === 'escalation' ? 'ESC-' : 'CRT-') + String(ticket.raw.ticket_number).padStart(4, '0')}
                                                                title={ticket.type === 'escalation' ? ticket.raw.client_name : ticket.raw.issue_title}
                                                                subtitle={ticket.type === 'escalation' ? ticket.raw.issue_title : ticket.raw.issue_description}
                                                                department={ticket.department}
                                                                status={ticket.raw.status}
                                                                rawStatus={ticket.raw.status}
                                                                isAssigned={!!(ticket.raw.assigned_to || ticket.raw.assigned_role || ticket.raw.assigned_user_id)}
                                                                hasProofSubmitted={!!(ticket.raw.proof_submitted_at || ticket.raw.resolution_evidence_url || ticket.raw.resolution_text)}
                                                                isPriority={ticket.priority_level === 'P0' || ticket.priority_level === 'P1' || ticket.type === 'critical'}
                                                                priorityLevel={ticket.priority_level as any}
                                                                isWarRoom={ticket.is_war_room}
                                                                isSelected={idx === selectedIndex}
                                                                createdAt={ticket.created_at}
                                                                onClick={() => { setSelectedIndex(idx); setSelectedTicketId(ticket.id); }}
                                                                leftElement={<div className={cn("p-2 rounded-lg bg-white/5 border border-white/5", ticket.type === 'critical' ? "text-status-late" : (ticket.type === 'site_visit' ? "text-orange-500" : "text-primary"))}>{ticket.type === 'critical' ? <Zap className="w-4 h-4" /> : (ticket.type === 'site_visit' ? <MapPin className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />)}</div>}
                                                                rightElement={
                                                                    <SLAPulseBadge
                                                                        deadline={ticket.type === 'critical' ? ticket.raw.resolve_deadline : (ticket.raw.resolve_deadline || ticket.raw.ack_deadline)}
                                                                        status={ticket.raw.status}
                                                                        createdAt={ticket.created_at}
                                                                        resolvedAt={ticket.resolved_at || ticket.raw.proof_submitted_at || undefined}
                                                                        acknowledgedAt={ticket.raw.acknowledged_at || undefined}
                                                                    />
                                                                }
                                                            />
                                                        </motion.div>
                                                    )))}
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            </TabsContent>
                        </AnimatePresence>
                    </Tabs>
                </div>
            </div>

            {/* Creation Dialogs */}
            <Dialog open={isCreateEscalationDialogOpen} onOpenChange={setIsCreateEscalationDialogOpen}>
                <EscalationWizard
                    onClose={() => setIsCreateEscalationDialogOpen(false)}
                    onSubmit={handleCreateEscalation}
                    isSaving={isSaving}
                    projects={projects}
                />
            </Dialog>

            <AnimatePresence>
                {selectedTicket && (
                    <>
                        <TicketDetailsModal
                                open={!!selectedTicketId && !showResolveModal}
                                onClose={() => {
                                    setSelectedTicketId(null);
                                    const newParams = new URLSearchParams(searchParams);
                                    newParams.delete('ticketId');
                                    setSearchParams(newParams);
                                }}
                                ticket={selectedTicket.raw}
                                ticketType={selectedTicket.type}
                                timeline={timeline}
                                timelineLoading={timelineLoading}
                                role={effectiveRole}
                                onOpenResolveModal={() => setShowResolveModal(true)}
                                onAcknowledge={() => acknowledge(selectedTicket.id, selectedTicket.type)}
                                onAddComment={(comment, audio) => addComment(selectedTicket.id, selectedTicket.type, comment, audio)}
                                onVerifyAndClose={() => verifyAndClose(selectedTicket.id, selectedTicket.type)}
                                onRejectProof={(reason) => rejectProof(selectedTicket.id, selectedTicket.type, reason)}
                                onPushToGM={(effectiveRole === 'admin' || effectiveRole === 'boi') ? () => escalateToGM(selectedTicket.id) : undefined}
                                onPushToCEO={effectiveRole === 'gm' ? () => escalateToCEO(selectedTicket.id) : undefined}
                                onDelete={effectiveRole === 'admin' ? async () => {
                                    await deleteTicket(selectedTicket.id, selectedTicket.type);
                                    setSelectedTicketId(null);
                                } : undefined}
                                onStartWarRoom={async (meetingLink) => {
                                    await startWarRoom(selectedTicket.id, meetingLink);
                                    refetch();
                                }}
                                isSaving={isSaving}
                            />
                            <ResolveTicketModal
                                open={showResolveModal}
                                onClose={() => setShowResolveModal(false)}
                                onResolve={async (data) => {
                                    await resolve(selectedTicket.id, selectedTicket.type, data);
                                    setShowResolveModal(false);
                                    setSelectedTicketId(null);
                                }}
                                ticketId={selectedTicketId || ''}
                                ticketType={selectedTicket.type}
                                isSaving={isSaving}
                            />
                        </>
                    )}
            </AnimatePresence>
        </div>
    );
}
