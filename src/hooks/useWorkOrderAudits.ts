import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface WorkOrderAudit {
    id: string;
    work_order_id: string;
    payment_id: string | null;
    audited_by: string; // The person who requested/raised the audit
    verified_by?: string | null; // The Data Team member who performed the audit
    audit_status: string;
    explanation: string;
    proof_of_call: string | null;
    image_urls: string[] | null;
    audit_remarks: string | null;
    approval_proof_url: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields
    requester?: { name: string; department: string };
    auditor?: { name: string; department: string };
    work_order?: {
        wo_number: number;
        work_description: string;
        estimated_amount: number;
        detailed_scope: string;
        signed_document_url: string | null;
        payment_stage: string;
        requester?: { name: string; department: string };
        project?: { project_name: string; project_id: string; total_project_value: number };
        boq_item?: {
            id: string;
            material_name: string;
            phase?: {
                id: string;
                phase_name: string;
            };
        } | null;
    };
    payment?: {
        payment_number: number;
        payment_type: string;
        amount: number;
        status: string;
    } | null;
}

interface CreateAuditData {
    workOrderId: string;
    paymentId?: string;
    explanation: string;
    proofOfCall?: string;
    imageUrls?: string[];
}

export function useWorkOrderAudits() {
    const { user } = useAuth();
    const [audits, setAudits] = useState<WorkOrderAudit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);


    const lastFetchRef = useRef<number>(0);
    const FETCH_THROTTLE = 2000;

    const fetchAudits = useCallback(async (silent = false) => {
        const now = Date.now();
        if (silent && now - lastFetchRef.current < FETCH_THROTTLE) return;
        lastFetchRef.current = now;

        if (!silent) setIsLoading(true);
        try {
            // Step 1: Fetch raw audits (no joins)
            const { data: rawAudits, error: auditErr } = await (supabase as any)
                .from('work_order_final_audits')
                .select('*')
                .order('created_at', { ascending: false });

            if (auditErr) throw auditErr;
            if (!rawAudits || rawAudits.length === 0) { setAudits([]); return; }

            // Step 2: Fetch work orders (no FK joins)
            const woIds = [...new Set(rawAudits.map((a: any) => a.work_order_id).filter(Boolean))];
            const requesterIds = [...new Set(rawAudits.map((a: any) => a.audited_by).filter(Boolean))];
            const verifiedByIds = [...new Set(rawAudits.map((a: any) => a.verified_by).filter(Boolean))];
            let woMap: Record<string, any> = {};
            let profileMap: Record<string, any> = {};

            if (woIds.length > 0) {
                const { data: woData } = await (supabase as any)
                    .from('work_orders')
                    .select('id, wo_number, work_description, estimated_amount, detailed_scope, signed_document_url, payment_stage, project_id, requester_id, boq_item_id')
                    .in('id', woIds);
                if (woData) {
                    woData.forEach((wo: any) => { woMap[wo.id] = wo; });
                }

                // Step 3: Fetch projects for those WOs
                const projectIds = [...new Set(woData?.map((w: any) => w.project_id).filter(Boolean) || [])];
                const woRequesterIds = [...new Set(woData?.map((w: any) => w.requester_id).filter(Boolean) || [])];
                const allProfileIds = [...new Set([...requesterIds, ...verifiedByIds, ...woRequesterIds])];

                if (projectIds.length > 0) {
                    const { data: projData } = await (supabase as any)
                        .from('projects')
                        .select('id, project_name, project_id, total_project_value')
                        .in('id', projectIds);
                    if (projData) {
                        const projMap: Record<string, any> = {};
                        projData.forEach((p: any) => { projMap[p.id] = p; });
                        // Attach project to each WO
                        Object.keys(woMap).forEach(id => {
                            woMap[id].project = projMap[woMap[id].project_id] || null;
                        });
                    }
                }

                // Step 3b: Fetch BOQ items and Phases
                const boqIds = [...new Set(woData?.map((w: any) => w.boq_item_id).filter(Boolean) || [])];
                if (boqIds.length > 0) {
                    const { data: boqData } = await (supabase as any)
                        .from('project_boq')
                        .select('id, material_name, phase_id')
                        .in('id', boqIds);

                    if (boqData) {
                        const phaseIds = [...new Set(boqData.map((b: any) => b.phase_id).filter(Boolean))];
                        let phaseMap: Record<string, any> = {};

                        if (phaseIds.length > 0) {
                            const { data: phaseData } = await (supabase as any)
                                .from('project_phases')
                                .select('id, phase_name')
                                .in('id', phaseIds);
                            if (phaseData) {
                                phaseData.forEach((ph: any) => { phaseMap[ph.id] = ph; });
                            }
                        }

                        const boqMap: Record<string, any> = {};
                        boqData.forEach((b: any) => {
                            boqMap[b.id] = {
                                ...b,
                                phase: phaseMap[b.phase_id] || null
                            };
                        });

                        // Attach BOQ item to each WO
                        Object.keys(woMap).forEach(id => {
                            woMap[id].boq_item = boqMap[woMap[id].boq_item_id] || null;
                        });
                    }
                }

                if (allProfileIds.length > 0) {
                    const { data: profData } = await (supabase as any)
                        .from('profiles')
                        .select('id, name, department')
                        .in('id', allProfileIds);
                    if (profData) {
                        profData.forEach((p: any) => { profileMap[p.id] = p; });
                        
                        // Attach requester to each WO
                        Object.keys(woMap).forEach(id => {
                            woMap[id].requester = profileMap[woMap[id].requester_id] || null;
                        });
                    }
                }
            }

            // Step 4: Merge everything
            const merged = rawAudits.map((a: any) => ({
                ...a,
                requester: profileMap[a.audited_by] || null,
                auditor: profileMap[a.verified_by] || null,
                work_order: woMap[a.work_order_id] || null,
                payment: null,
            }));

            setAudits(merged);
        } catch (error) {
            console.error('Error fetching audits:', error);
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAudits();
    }, [fetchAudits]);

    useEffect(() => {
        const channel = supabase
            .channel('wo-audits-all')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'work_order_final_audits',
            }, () => {
                fetchAudits(true);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchAudits]);

    const createAudit = async (data: CreateAuditData) => {
        if (!user) return { success: false };

        setIsSaving(true);
        try {
            const { data: newAudit, error } = await (supabase as any)
                .from('work_order_final_audits')
                .insert({
                    work_order_id: data.workOrderId,
                    payment_id: data.paymentId,
                    audited_by: user.id,
                    explanation: data.explanation,
                    proof_of_call: data.proofOfCall || null,
                    image_urls: data.imageUrls || [],
                    audit_status: 'pending',
                } as any)
                .select()
                .single();

            if (error) throw error;
            toast.success('Audit submitted');
            await fetchAudits();
            return { success: true, data: newAudit };
        } catch (error: any) {
            console.error('Error creating audit:', error);
            toast.error(error.message || 'Failed to create audit');
            return { success: false };
        } finally {
            setIsSaving(false);
        }
    };

    const approveAudit = async (id: string, workOrderId: string, remarks?: string, proofUrl?: string) => {
        if (!user) return;
        try {
            const { error: auditError } = await (supabase as any)
                .from('work_order_final_audits')
                .update({
                    audit_status: 'approved',
                    audit_remarks: remarks || null,
                    approval_proof_url: proofUrl || null,
                    verified_by: user.id,
                    updated_at: new Date().toISOString(),
                } as any)
                .eq('id', id);

            if (auditError) throw auditError;

            // Update Work Order stage to 'audited'
            const { error: woError } = await (supabase as any)
                .from('work_orders')
                .update({
                    payment_stage: 'audited',
                    updated_at: new Date().toISOString()
                } as any)
                .eq('id', workOrderId);

            if (woError) throw woError;

            toast.success('Audit approved');
            await fetchAudits();
        } catch (error: any) {
            console.error('Error approving audit:', error);
            toast.error(error.message || 'Failed to approve audit');
        }
    };

    const rejectAudit = async (id: string, workOrderId: string, remarks: string) => {
        if (!user) return;
        try {
            const { error: auditError } = await (supabase as any)
                .from('work_order_final_audits')
                .update({
                    audit_status: 'rejected',
                    audit_remarks: remarks,
                    verified_by: user.id,
                    updated_at: new Date().toISOString(),
                } as any)
                .eq('id', id);

            if (auditError) throw auditError;

            // Update Work Order stage back to 'advance_paid' so it can be re-submitted
            const { error: woError } = await (supabase as any)
                .from('work_orders')
                .update({
                    payment_stage: 'advance_paid',
                    updated_at: new Date().toISOString()
                } as any)
                .eq('id', workOrderId);

            if (woError) throw woError;

            toast.success('Audit rejected');
            await fetchAudits();
        } catch (error: any) {
            console.error('Error rejecting audit:', error);
            toast.error(error.message || 'Failed to reject audit');
        }
    };

    return {
        audits,
        isLoading,
        isSaving,
        createAudit,
        approveAudit,
        rejectAudit,
        refetch: fetchAudits,
    };
}
