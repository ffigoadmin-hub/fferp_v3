import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useRealtimeEscalations, UnifiedTicket, UseRealtimeEscalationsOptions } from './useRealtimeEscalations';

export interface EscalationEngine {
    tickets: UnifiedTicket[];
    counts: any;
    isLoading: boolean;
    isSaving: boolean;
    lastUpdated: Date;

    // Actions
    acknowledge: (id: string, type: 'escalation' | 'critical' | 'site_visit') => Promise<void>;
    resolve: (id: string, type: 'escalation' | 'critical' | 'site_visit', data: any) => Promise<void>;
    assign: (id: string, type: 'escalation' | 'critical' | 'site_visit', selectedUsers: any[]) => Promise<void>;
    escalateToGM: (id: string) => Promise<void>;
    escalateToCEO: (id: string) => Promise<void>;
    verifyAndClose: (id: string, type: 'escalation' | 'critical' | 'site_visit') => Promise<void>;
    rejectProof: (id: string, type: 'escalation' | 'critical' | 'site_visit', reason: string) => Promise<void>;
    createEscalation: (data: any) => Promise<{ success: boolean; data?: any }>;
    createCritical: (data: any) => Promise<{ success: boolean; data?: any }>;
    dispatch: (id: string, type: 'escalation' | 'critical' | 'site_visit', data: {
        userId?: string;
        userIds?: string[];
        smoId?: string;
        smoIds?: string[];
        gmoId?: string;
        bucket?: string;
        assigneeNames?: string[]
    }) => Promise<void>;
    addComment: (id: string, type: 'escalation' | 'critical' | 'site_visit', comment: string, audioUrl?: string) => Promise<void>;
    startWarRoom: (id: string, url: string) => Promise<void>;
    deleteTicket: (id: string, type: 'escalation' | 'critical' | 'site_visit') => Promise<void>;

    refetch: () => void;
}

export function useEscalationEngine(options?: UseRealtimeEscalationsOptions): EscalationEngine {
    const { user } = useAuth();
    const { unifiedTickets, counts, isLoading, lastUpdated, refetch } = useRealtimeEscalations(options);
    const [isSaving, setIsSaving] = useState(false);

    const logTimeline = async (id: string, type: 'escalation' | 'critical' | 'site_visit', action: string, details: any) => {
        if (!user) return;
        let table = 'client_escalation_timeline';
        if (type === 'critical') table = 'hourly_critical_timeline';

        // For unified system, site_visit is just a type of client_escalation
        // So we log to client_escalation_timeline

        const timelineEntry: any = {
            action,
            performed_by: user.id,
            performed_by_name: user.name,
            performed_by_role: user.role,
            details
        };

        if (type === 'escalation' || type === 'site_visit') {
            timelineEntry.escalation_id = id;
        } else {
            timelineEntry.critical_id = id;
        }

        await supabase.from(table as any).insert(timelineEntry);
    };

    const acknowledge = useCallback(async (id: string, type: 'escalation' | 'critical' | 'site_visit') => {
        if (!user) return;
        setIsSaving(true);
        try {
            const ticket = unifiedTickets.find(t => t.id === id);
            const isLate = ticket ? new Date() > new Date(ticket.ack_deadline) : false;

            let result;
            if (type === 'escalation' || type === 'site_visit') {
                const updateData: any = {
                    status: 'acknowledged',
                    acknowledged_at: new Date().toISOString(),
                    acknowledged_by: user.id,
                    ack_late: isLate
                };

                // GM-specific acknowledgment (L2)
                if (user.role.toLowerCase() === 'gm') {
                    updateData.gm_id = user.id;
                    updateData.gm_ack_at = new Date().toISOString();
                    updateData.gm_ack_late = isLate;
                }

                result = await supabase.from('client_escalations').update(updateData).eq('id', id);
            } else {
                result = await supabase.from('hourly_criticals').update({
                    status: 'acknowledged',
                    acknowledged_at: new Date().toISOString(),
                    acknowledged_by: user.id,
                    ack_late: isLate,
                    current_owner: 'solver' // Explicitly keep as solver (L1 ops)
                }).eq('id', id);
            }

            if (result.error) throw result.error;

            await logTimeline(id, type, 'acknowledged', { message: `Ticket acknowledged by ${user.role.toUpperCase()}`, isLate });
            toast.success(isLate ? 'Acknowledged (LATE)' : 'Acknowledged successfully');
        } catch (error: any) {
            toast.error(error.message || 'Failed to acknowledge');
        } finally {
            setIsSaving(false);
        }
    }, [user, unifiedTickets, refetch]);

    const resolve = useCallback(async (id: string, type: 'escalation' | 'critical' | 'site_visit', data: any) => {
        if (!user) return;
        setIsSaving(true);
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

            if ((type === 'escalation' || type === 'site_visit') && (data.proofUrl || data.evidence_url)) {
                updateData.resolution_evidence_url = data.proofUrl || data.evidence_url;
                updateData.issue_proof_url = data.proofUrl || data.evidence_url; // Unify proof URL
            }

            let result;
            if (type === 'escalation' || type === 'site_visit') {
                // GM-specific resolution (L2)
                if (user.role.toLowerCase() === 'gm') {
                    updateData.gm_id = user.id;
                    updateData.gm_resolved_at = new Date().toISOString();
                    updateData.gm_resolution_text = data.resolutionText;
                }
                result = await supabase.from('client_escalations').update(updateData).eq('id', id);
            } else {
                result = await supabase.from('hourly_criticals').update(updateData).eq('id', id);
            }
            if (result.error) throw result.error;

            await logTimeline(id, type, 'resolved_with_proof', {
                resolution_text: data.resolutionText,
                has_audio: !!(data.audioUrl || data.callRecordingUrl),
                image_count: data.screenshotUrls?.length || 0
            });

            // Notify Admin/BOI about resolution proof submission
            if (type === 'escalation' || type === 'site_visit') {
                try {
                    const { data: adminUsers } = await supabase.from('profiles').select('id').in('role', ['Admin', 'BOI']);
                    if (adminUsers && adminUsers.length > 0) {
                        const notifications = adminUsers.map(admin => ({
                            user_id: admin.id,
                            type: 'escalation_resolved',
                            title: 'Client Escalation Resolved - Pending Approval',
                            content: 'Resolution proof has been submitted and requires verification',
                            metadata: { escalation_id: id },
                            is_read: false
                        }));
                        await (supabase.from('notifications') as any).insert(notifications);
                    }
                } catch (err) {
                    console.error('Error creating notifications:', err);
                }
            }

            toast.success('Resolution proof submitted for approval');
        } catch (error: any) {
            toast.error(error.message || 'Failed to resolve');
        } finally {
            setIsSaving(false);
        }
    }, [user, refetch]);

    const assign = useCallback(async (id: string, type: 'escalation' | 'critical' | 'site_visit', selectedUsers: any[]) => {
        if (!user || selectedUsers.length === 0) return;
        setIsSaving(true);
        try {
            const roles = [...new Set(selectedUsers.map(u => u.role.toUpperCase()))];
            const assignedRoleStr = roles.join('+');

            const updateData: any = {
                assigned_user_id: selectedUsers[0]?.id || null, // Primary assignee
                assigned_user_ids: selectedUsers.map(u => u.id), // All assignees
                assigned_user_names: selectedUsers.map(u => u.name), // All names
                assigned_role: assignedRoleStr,
                current_owner: roles[0]?.toLowerCase() || 'smo',
                updated_at: new Date().toISOString(),
                assigned_at: new Date().toISOString(),
                assigned_by: user.id,
                status: 'acknowledged' // Auto-acknowledge on assignment? Or keep open? Usually assigned implies open/acknowledged.
            };

            let result;
            if (type === 'escalation' || type === 'site_visit') {
                if (type === 'site_visit') {
                    // For site visit, ALSO populate assigned_layer_1_id for backward compatibility/clarity
                    updateData.assigned_layer_1_id = selectedUsers[0]?.id;
                    updateData.assigned_by_boi_id = user.id;
                }
                result = await supabase.from('client_escalations').update(updateData).eq('id', id);
            } else {
                result = await supabase.from('hourly_criticals').update(updateData).eq('id', id);
            }

            if (result.error) throw result.error;

            await logTimeline(id, type, 'assigned_to_group', {
                assigned_roles: roles,
                assigned_users: selectedUsers.map(u => ({ id: u.id, name: u.name, role: u.role })),
                message: `Assigned to ${selectedUsers.map(u => u.name).join(', ')} (${assignedRoleStr})`
            });

            // Notify all assigned users
            try {
                const notifications = selectedUsers.map(u => ({
                    user_id: u.id,
                    type: type === 'escalation' ? 'escalation_assigned' : (type === 'site_visit' ? 'site_visit_assigned' : 'critical_assigned'),
                    title: `New ${type === 'escalation' ? 'Escalation' : (type === 'site_visit' ? 'Site Visit Escalation' : 'Critical')} Assigned`,
                    content: `You have been assigned to ${type} ticket.`,
                    metadata: { [type === 'escalation' || type === 'site_visit' ? 'escalation_id' : 'critical_id']: id },
                    is_read: false
                }));

                await (supabase.from('notifications') as any).insert(notifications);
            } catch (err) {
                console.error("Error creating notifications:", err);
            }

            toast.success(`Assigned to ${selectedUsers.length} user(s)`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to assign');
        } finally {
            setIsSaving(false);
        }
    }, [user, refetch]);

    const escalateToGM = useCallback(async (id: string) => {
        if (!user) return;
        setIsSaving(true);
        try {
            const { error } = await supabase.from('client_escalations').update({
                status: 'escalated_gm',
                current_owner: 'gm',
                current_level: 'L2_GM',
                forwarded_to_gm_at: new Date().toISOString()
            }).eq('id', id);

            if (error) throw error;

            await logTimeline(id, 'escalation', 'escalated_to_gm', { message: 'Escalated to GM for L2 resolution' });
            toast.success('Escalated to GM');
        } catch (error: any) {
            toast.error(error.message || 'Failed to escalate');
        } finally {
            setIsSaving(false);
        }
    }, [user, refetch]);

    const escalateToCEO = useCallback(async (id: string) => {
        if (!user) return;
        setIsSaving(true);
        try {
            const { error } = await supabase.from('client_escalations').update({
                status: 'escalated_ceo',
                current_owner: 'ceo',
                current_level: 'L3_CEO',
                pushed_to_ceo_at: new Date().toISOString()
            }).eq('id', id);

            if (error) throw error;

            await logTimeline(id, 'escalation', 'escalated_to_ceo', { message: 'Escalated to CEO for L3 resolution' });
            toast.success('Escalated to CEO');
        } catch (error: any) {
            toast.error(error.message || 'Failed to escalate');
        } finally {
            setIsSaving(false);
        }
    }, [user, refetch]);

    const verifyAndClose = useCallback(async (id: string, type: 'escalation' | 'critical' | 'site_visit') => {
        if (!user) return;
        setIsSaving(true);
        try {
            let result;
            if (type === 'escalation' || type === 'site_visit') {
                const updateData: any = {
                    status: 'closed',
                    updated_at: new Date().toISOString(),
                    closed_by_admin_id: user.id, // Set for all escalations
                    closure_verified_at: new Date().toISOString(),
                };
                result = await supabase.from('client_escalations').update(updateData).eq('id', id);
            } else {
                result = await supabase.from('hourly_criticals').update({
                    status: 'closed',
                    updated_at: new Date().toISOString(),
                    closed_by_admin_id: user.id,
                }).eq('id', id);
            }

            if (result.error) {
                console.error('Database closure update error:', result.error);
                throw result.error;
            }

            await logTimeline(id, type, 'admin_verified_and_closed', { message: 'Admin verified proof and closed ticket' });

            // Notify assigned users about closure
            if (type === 'escalation' || type === 'site_visit') {
                try {
                    const { data: ticketData } = await supabase.from('client_escalations').select('assigned_user_ids').eq('id', id).single();
                    if (ticketData?.assigned_user_ids && ticketData.assigned_user_ids.length > 0) {
                        const notifications = ticketData.assigned_user_ids.map((userId: string) => ({
                            user_id: userId,
                            type: 'escalation_closed',
                            title: 'Client Escalation Closed',
                            content: 'Your escalation has been verified and closed by Admin',
                            metadata: { escalation_id: id },
                            is_read: false
                        }));
                        await (supabase.from('notifications') as any).insert(notifications);
                    }
                } catch (err) {
                    console.error('Error creating notifications:', err);
                }
            }

            // Force refetch with small delay to ensure data is updated on backend
            await new Promise(resolve => setTimeout(resolve, 300));
            refetch();
            toast.success('Ticket closed successfully');
        } catch (error: any) {
            console.error('Full closure error:', error);
            toast.error(error.message || 'Failed to close ticket');
        } finally {
            setIsSaving(false);
        }
    }, [user, refetch]);

    const rejectProof = useCallback(async (id: string, type: 'escalation' | 'critical' | 'site_visit', reason: string) => {
        if (!user) return;
        setIsSaving(true);
        try {
            let result;
            if (type === 'escalation' || type === 'site_visit') {
                result = await supabase.from('client_escalations').update({
                    status: 'acknowledged',
                    rejection_reason: reason,
                    updated_at: new Date().toISOString(),
                }).eq('id', id);
            } else {
                result = await supabase.from('hourly_criticals').update({
                    status: 'acknowledged',
                    rejection_reason: reason,
                    updated_at: new Date().toISOString(),
                }).eq('id', id);
            }

            if (result.error) {
                console.error('Database update error:', result.error);
                throw result.error;
            }

            await logTimeline(id, type, 'admin_rejected_proof', { reason, message: `Proof rejected by Admin: ${reason}` });

            // Notify assigned users about proof rejection
            if (type === 'escalation' || type === 'site_visit') {
                try {
                    const { data: ticketData } = await supabase.from('client_escalations').select('assigned_user_ids').eq('id', id).single();
                    if (ticketData?.assigned_user_ids && ticketData.assigned_user_ids.length > 0) {
                        const notifications = ticketData.assigned_user_ids.map((userId: string) => ({
                            user_id: userId,
                            type: 'escalation_rejected',
                            title: 'Client Escalation Proof Rejected',
                            content: `Your resolution proof was rejected. Reason: ${reason}`,
                            metadata: { escalation_id: id },
                            is_read: false
                        }));
                        await (supabase.from('notifications') as any).insert(notifications);
                    }
                } catch (err) {
                    console.error('Error creating notifications:', err);
                }
            }

            // Force refetch with small delay to ensure data is updated on backend
            await new Promise(resolve => setTimeout(resolve, 300));
            refetch();
            toast.warning('Proof rejected. Ticket reverted.');
        } catch (error: any) {
            console.error('Full rejection error:', error);
            toast.error(error.message || 'Failed to reject proof');
            throw error; // Re-throw so caller can detect failure
        } finally {
            setIsSaving(false);
        }
    }, [user, refetch]);

    const createEscalation = useCallback(async (data: any) => {
        if (!user) return { success: false };
        setIsSaving(true);
        try {
            const { data: result, error } = await supabase.from('client_escalations').insert({
                ...data,
                client_name: data.client_name || 'N/A',
                project_id: data.project_id || null, // Handles UUID or null
                created_by: user.id,
                status: 'open',
                urgency: data.urgency || 'medium',
                priority_level: data.priority_level || 'P2',
                is_war_room: data.priority_level === 'P0' || data.priority_level === 'P1' || data.is_war_room || false
            }).select().single();

            if (error) throw error;

            await logTimeline(result.id, 'escalation', 'created', { message: 'Escalation created' });

            // Notify BOI/Admin about new escalation
            try {
                const { data: boiUsers } = await supabase.from('profiles').select('id').eq('role', 'BOI');
                if (boiUsers && boiUsers.length > 0) {
                    const notifications = boiUsers.map(boi => ({
                        user_id: boi.id,
                        type: 'escalation_created',
                        title: 'New Client Escalation Created',
                        content: `New escalation from ${data.client_name || 'client'}: ${data.issue_title || 'Issue'}`,
                        metadata: { escalation_id: result.id },
                        is_read: false
                    }));
                    await (supabase.from('notifications') as any).insert(notifications);
                }
            } catch (err) {
                console.error('Error creating notifications:', err);
            }

            toast.success('Escalation created successfully');
            return { success: true, data: result };
        } catch (error: any) {
            toast.error(error.message || 'Failed to create escalation');
            return { success: false };
        } finally {
            setIsSaving(false);
        }
    }, [user, refetch]);

    const createCritical = useCallback(async (data: any) => {
        if (!user) return { success: false };
        setIsSaving(true);
        try {
            // Calculate deadlines
            const now = new Date();
            const ackDeadline = new Date(now.getTime() + 10 * 60000).toISOString();
            const resolveDeadline = new Date(now.getTime() + 45 * 60000).toISOString();

            const { data: result, error } = await supabase.from('hourly_criticals').insert({
                ...data,
                created_by: user.id,
                status: 'open',
                ack_deadline: ackDeadline,
                resolve_deadline: resolveDeadline
            }).select().single();

            if (error) throw error;

            await logTimeline(result.id, 'critical', 'created', { message: 'Hourly Critical created by Data Team' });
            toast.success('Critical ticket created successfully');
            return { success: true, data: result };
        } catch (error: any) {
            toast.error(error.message || 'Failed to create critical');
            return { success: false };
        } finally {
            setIsSaving(false);
        }
    }, [user, refetch]);

    const dispatch = useCallback(async (id: string, type: 'escalation' | 'critical' | 'site_visit', data: {
        userId?: string;
        userIds?: string[];
        smoId?: string;
        smoIds?: string[];
        gmoId?: string;
        bucket?: string;
        assigneeNames?: string[]
    }) => {
        if (!user) return;
        setIsSaving(true);
        try {
            const table = (type === 'escalation' || type === 'site_visit') ? 'client_escalations' : 'hourly_criticals';

            // Generate assigned role string 
            const roles = [];
            if (data.smoId || (data.smoIds && data.smoIds.length > 0)) roles.push('SMO');
            if (data.gmoId) roles.push('GMO');
            const assignedRoleStr = roles.join('+');

            const updateData: any = {
                assigned_user_id: data.userId || data.userIds?.[0] || null,
                assigned_user_ids: data.userIds || (data.userId ? [data.userId] : []),
                assigned_user_names: data.assigneeNames || [],
                assigned_smo_id: data.smoId || data.smoIds?.[0] || null,
                assigned_gmo_id: data.gmoId || null,
                assigned_by_boi_id: user.id,
                assigned_at: new Date().toISOString(),
                status: 'acknowledged', // Dispatch acknowledges it
            };

            // If site visit, also update assigned_layer_1_id for consistency
            if (type === 'site_visit') {
                updateData.assigned_layer_1_id = data.userId || data.userIds?.[0] || null;
            }

            if (data.bucket) {
                updateData.bucket = data.bucket;
            }

            if (assignedRoleStr) {
                updateData.assigned_role = assignedRoleStr;
                updateData.current_owner = roles[0].toLowerCase();
            } else if (data.userId || data.userIds?.[0]) {
                updateData.assigned_role = 'EMPLOYEE';
                updateData.current_owner = 'employee';
            }

            const { error } = await supabase.from(table).update(updateData).eq('id', id);
            if (error) throw error;

            const dispatchedTo = data.assigneeNames && data.assigneeNames.length > 0
                ? data.assigneeNames.join(' & ')
                : roles.join(' & ');

            await logTimeline(id, type, 'assigned_by_boi', {
                smo_id: data.smoId,
                smo_ids: data.smoIds,
                gmo_id: data.gmoId,
                bucket: data.bucket,
                message: `Dispatched by BOI to ${dispatchedTo}`
            });

            toast.success(`Dispatched successfully`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to dispatch');
        } finally {
            setIsSaving(false);
        }
    }, [user, refetch]);

    const addComment = useCallback(async (id: string, type: 'escalation' | 'critical' | 'site_visit', comment: string, audioUrl?: string) => {
        if (!user) return;
        setIsSaving(true);
        try {
            await logTimeline(id, type, audioUrl ? 'voice_comment' : 'comment_added', {
                comment,
                audio_url: audioUrl
            });
            toast.success('Comment added');
        } catch (error: any) {
            toast.error(error.message || 'Failed to add comment');
        } finally {
            setIsSaving(false);
        }
    }, [user, refetch]);

    const startWarRoom = useCallback(async (id: string, url: string) => {
        if (!user) return;
        setIsSaving(true);
        try {
            const { error } = await supabase.from('client_escalations').update({
                is_war_room: true,
                war_room_url: url,
                updated_at: new Date().toISOString()
            }).eq('id', id);

            if (error) throw error;

            await logTimeline(id, 'escalation', 'war_room_started', { war_room_url: url, message: 'War Room session started' });
            toast.success('War Room started successfully');
        } catch (error: any) {
            toast.error(error.message || 'Failed to start war room');
        } finally {
            setIsSaving(false);
        }
    }, [user, refetch]);

    const deleteTicket = useCallback(async (id: string, type: 'escalation' | 'critical' | 'site_visit') => {
        if (!user || user.role !== 'admin') return;
        setIsSaving(true);
        try {
            let table = 'client_escalations';
            if (type === 'critical') table = 'hourly_criticals';

            const { error } = await supabase.from(table as any).delete().eq('id', id);

            if (error) throw error;

            toast.success('Ticket deleted successfully');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete ticket');
        } finally {
            setIsSaving(false);
        }
    }, [user, refetch]);

    return {
        tickets: unifiedTickets,
        counts,
        isLoading,
        isSaving,
        lastUpdated,
        acknowledge,
        resolve,
        assign,
        escalateToGM,
        escalateToCEO,
        verifyAndClose,
        rejectProof,
        addComment,
        startWarRoom,
        createEscalation,
        createCritical,
        dispatch,
        deleteTicket,
        refetch
    };
}
