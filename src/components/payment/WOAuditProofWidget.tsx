import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileSearch, CheckCircle, XCircle, Clock, Phone, Image, User, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface AuditProof {
    id: string;
    audit_status: string;
    explanation: string;
    proof_of_call: string | null;
    image_urls: string[] | null;
    audit_remarks: string | null;
    created_at: string;
    auditor_name: string;
    auditor_department: string;
    raised_by_name: string;
    requester_name: string;
    wo_number: number;
    work_description: string;
    estimated_amount: number;
}

interface WOAuditProofWidgetProps {
    workOrderId: string;
}

const statusStyle: Record<string, { bg: string; text: string; label: string; Icon: React.ElementType }> = {
    pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Pending', Icon: Clock },
    approved: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Approved', Icon: CheckCircle },
    rejected: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected', Icon: XCircle },
};

export function WOAuditProofWidget({ workOrderId }: WOAuditProofWidgetProps) {
    const [audit, setAudit] = useState<AuditProof | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!workOrderId) { setIsLoading(false); return; }

        const fetchAudit = async () => {
            try {
                const [auditRes, paymentRes] = await Promise.all([
                    (supabase as any)
                        .from('work_order_final_audits')
                        .select(`
            id, audit_status, explanation, proof_of_call, image_urls, audit_remarks, created_at,
            audited_by, verified_by,
            work_order:work_orders!work_order_final_audits_work_order_id_fkey(
              wo_number,
              work_description,
              estimated_amount,
              requester:profiles!work_orders_requester_id_fkey(name)
            )
          `)
                        .eq('work_order_id', workOrderId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single(),
                    (supabase as any)
                        .from('payment_requests')
                        .select('requester:profiles!payment_requests_requester_id_fkey(name)')
                        .eq('work_order_id', workOrderId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle(),
                ]);

                if (auditRes.error) throw auditRes.error;

                const data = auditRes.data;
                const paymentRequesterName = paymentRes?.data?.requester?.name;
                
                let auditorName = 'Data Team';
                let auditorDept = 'Data Team';
                let raisedByName = 'Unknown';

                // Fetch requester (who raised the audit)
                if (data?.audited_by) {
                    const { data: raisedByProfile } = await (supabase as any)
                        .from('profiles')
                        .select('name')
                        .eq('id', data.audited_by)
                        .maybeSingle();
                    if (raisedByProfile?.name) raisedByName = raisedByProfile.name;
                }

                // Fetch actual auditor (who verified it)
                if (data?.verified_by) {
                    const { data: auditorProfile } = await (supabase as any)
                        .from('profiles')
                        .select('name, department')
                        .eq('id', data.verified_by)
                        .maybeSingle();
                    if (auditorProfile?.name) auditorName = auditorProfile.name;
                    if (auditorProfile?.department) auditorDept = auditorProfile.department;
                }

                setAudit({
                    id: data.id,
                    audit_status: data.audit_status,
                    explanation: data.explanation,
                    proof_of_call: data.proof_of_call,
                    image_urls: data.image_urls,
                    audit_remarks: data.audit_remarks,
                    created_at: data.created_at,
                    auditor_name: auditorName,
                    auditor_department: auditorDept,
                    raised_by_name: raisedByName,
                    requester_name: paymentRequesterName || data.work_order?.requester?.name || 'Unknown',
                    wo_number: data.work_order?.wo_number || 0,
                    work_description: data.work_order?.work_description || '',
                    estimated_amount: data.work_order?.estimated_amount || 0,
                });
            } catch {
                // No audit found for this WO — that's fine
                setAudit(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAudit();
    }, [workOrderId]);

    if (isLoading || !audit) return null;

    const style = statusStyle[audit.audit_status] || statusStyle.pending;
    const { Icon } = style;
    const auditorDisplayName = audit.auditor_name;
    const raisedByName = audit.raised_by_name;
    
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const extractLinks = (text?: string | null) => (text ? (text.match(urlRegex) || []) : []);
    const normalizeLink = (value: string | null) => {
        if (!value) return null;
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        if (/^(drive|docs)\.google\.com/i.test(trimmed)) return `https://${trimmed}`;
        return trimmed;
    };
    const candidateLinks = [
        ...(audit.image_urls || []),
        ...extractLinks(audit.proof_of_call),
        ...extractLinks(audit.audit_remarks),
        ...extractLinks(audit.explanation),
        ...(audit.proof_of_call ? [audit.proof_of_call] : []),
    ]
        .map(normalizeLink)
        .filter((link): link is string => Boolean(link));
    const proofLink = candidateLinks.find((u) =>
        u.includes('drive.google.com') || u.includes('docs.google.com')
    ) || null;
    const callProofLink = normalizeLink(audit.proof_of_call);
    const isCallLink = Boolean(callProofLink) && /^(https?:\/\/|drive\.google\.com|docs\.google\.com)/i.test(callProofLink!);

    return (
        <Card className="border-indigo-500/30 bg-indigo-500/5">
            <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                    <FileSearch className="w-4 h-4 text-indigo-400" />
                    WO Audit Report
                    <Badge className={`${style.bg} ${style.text} border-0 text-[10px] ml-auto`}>
                        <Icon className="w-3 h-3 mr-1" />
                        {style.label}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
                <div className="bg-muted/30 rounded-lg p-2.5 text-xs space-y-1">
                    <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                            <p><strong>WO-{audit.wo_number.toString().padStart(3, '0')}:</strong> {audit.work_description}</p>
                            <p><strong>Value:</strong> ₹{audit.estimated_amount.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="text-right space-y-1">
                            <p className="text-muted-foreground">Raised by</p>
                            <p className="font-bold text-indigo-400">{raisedByName}</p>
                        </div>
                    </div>
                </div>

                <div className="text-xs space-y-1.5">
                    <p className="font-medium text-muted-foreground">Audit Explanation:</p>
                    <p className="whitespace-pre-wrap bg-muted/20 p-2 rounded text-xs">{audit.explanation}</p>
                </div>

                {audit.proof_of_call && (
                    <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded-md px-2 py-1.5">
                        <Phone className="w-3 h-3" />
                        <span className="font-semibold">Call Proof:</span>
                        {isCallLink ? (
                            <a
                                href={callProofLink!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono underline hover:text-blue-300"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {audit.proof_of_call}
                            </a>
                        ) : (
                            <a
                                href={`tel:${audit.proof_of_call}`}
                                className="font-mono underline hover:text-blue-300"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {audit.proof_of_call}
                            </a>
                        )}
                    </div>
                )}

                {proofLink && (
                    <div className="flex">
                        <a
                            href={proofLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-2 py-1 hover:bg-emerald-500/15"
                        >
                            <ExternalLink className="w-3 h-3" />
                            Audit Proof (Data Team)
                        </a>
                    </div>
                )}

                {audit.image_urls && audit.image_urls.length > 0 && (
                    <div className="space-y-1">
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Image className="w-3 h-3" />
                            Evidence ({audit.image_urls.length})
                        </p>
                        <div className="flex gap-1.5 flex-wrap">
                            {audit.image_urls.map((url: string, i: number) => (
                                <img
                                    key={i}
                                    src={url}
                                    alt={`Evidence ${i + 1}`}
                                    className="rounded border-2 border-emerald-500/40 w-16 h-16 object-cover cursor-pointer hover:opacity-80"
                                    onClick={() => window.open(url, '_blank')}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {audit.audit_remarks && (
                    <div className="text-xs">
                        <span className="font-medium text-muted-foreground uppercase tracking-widest text-[9px]">Data Team Remarks: </span>
                        <p className="bg-emerald-500/5 border border-emerald-500/20 p-2 rounded mt-1 italic">{audit.audit_remarks}</p>
                    </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/30">
                    <div className="flex items-center gap-2">
                        <User className="w-3 h-3" />
                        <span>Audited by <span className="font-bold text-emerald-400">{auditorDisplayName}</span></span>
                    </div>
                    <span>{format(new Date(audit.created_at), 'dd MMM yyyy, HH:mm')}</span>
                </div>
            </CardContent>
        </Card>
    );
}
