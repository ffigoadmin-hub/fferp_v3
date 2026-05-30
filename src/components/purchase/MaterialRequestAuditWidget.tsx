
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Clock, CheckCircle, XCircle, Search,
  IndianRupee, Building2, User, FileText,
  ArrowRight, ShieldCheck, RefreshCw, Scale,
  Layers, Eye, ChevronDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useMaterialRequests } from '@/hooks/useMaterialRequests';
import { useVendorQuotes } from '@/hooks/useVendorQuotes';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ApprovalChainDisplay, getMaterialApprovalSteps } from './ApprovalChainDisplay';
import { toast } from 'sonner';
import { QuoteComparisonModal } from './QuoteComparisonModal';
import { supabase } from '@/integrations/supabase/client';

interface MaterialRequestAuditWidgetProps {
  role: 'gm' | 'admin' | 'ceo';
  targetStatus: string;
  title: string;
  subtitle: string;
}

export function MaterialRequestAuditWidget({
  role,
  targetStatus,
  title,
  subtitle
}: MaterialRequestAuditWidgetProps) {
  const { requests: allRequests, isLoading, approveRequest, rejectRequest, isSaving, refetch } = useMaterialRequests();
  const { quotes } = useVendorQuotes();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [note, setNote] = useState('');
  const [activeTab, setActiveTab] = useState<'audit' | 'sourcing'>('audit');
  const [projectBoqMap, setProjectBoqMap] = useState<Record<string, any[]>>({});
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const auditRequests = allRequests.filter(r => r.approval_status === targetStatus);
  const readyForAudit = auditRequests.filter(r => r.selected_quote_id);
  const sourcingRequests = auditRequests.filter(r => !r.selected_quote_id);
  const currentRequests = activeTab === 'audit' ? readyForAudit : sourcingRequests;

  const filteredRequests = currentRequests.filter(r =>
    r.project?.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.requester?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const requestsNeedingBoq = auditRequests.filter(
      r => (!r.boq_items || r.boq_items.length === 0) && r.project_id
    );
    if (requestsNeedingBoq.length === 0) return;
    const projectIds = [...new Set(requestsNeedingBoq.map(r => r.project_id))];
    const fetchProjectBoq = async () => {
      const { data } = await supabase
        .from('project_boq')
        .select('id, material_name, specification, unit, quantity, estimated_unit_cost, project_id')
        .in('project_id', projectIds);
      if (data) {
        const map: Record<string, any[]> = {};
        data.forEach((item: any) => {
          if (!map[item.project_id]) map[item.project_id] = [];
          map[item.project_id].push({
            id: item.id,
            material_name: item.material_name,
            name: item.material_name,
            specification: item.specification,
            unit: item.unit,
            quantity: item.quantity,
            unit_cost: item.estimated_unit_cost,
          });
        });
        setProjectBoqMap(map);
      }
    };
    fetchProjectBoq();
  }, [auditRequests.length]);

  const handleApprove = async (id: string) => {
    try {
      await approveRequest(id, role);
      setExpandedId(null);
      setNote('');
      refetch();
    } catch (error) {
      console.error('Approval failed:', error);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) { toast.error('Please provide a rejection reason'); return; }
    try {
      await rejectRequest(id, rejectReason.trim());
      setRejectDialogId(null);
      setRejectReason('');
      setExpandedId(null);
      refetch();
    } catch (error) {
      console.error('Rejection failed:', error);
    }
  };

  const getSelectedQuote = (requestId: string, selectedQuoteId: string | null) => {
    if (!selectedQuoteId) return null;
    return quotes.find(q => q.id === selectedQuoteId);
  };

  const getRequestItems = (request: any): any[] => {
    if (request.boq_items && request.boq_items.length > 0) return request.boq_items;
    if (request.project_id && projectBoqMap[request.project_id]) return projectBoqMap[request.project_id];
    return [];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-sm" style={{ color: '#6B7280' }}>Loading requests…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2.5" style={{ color: '#111827' }}>
            {title}
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
              Approval Pending
            </span>
          </h2>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{subtitle}</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            style={{ background: '#F9FAFB', borderColor: '#E5E7EB', color: '#111827' }}
          />
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex p-1 rounded-xl gap-0.5 w-fit"
        style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
        <button
          onClick={() => setActiveTab('audit')}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
          style={activeTab === 'audit'
            ? { background: '#FFFFFF', color: '#16A34A', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
            : { color: '#6B7280' }}>
          <ShieldCheck className="w-3.5 h-3.5" />
          Ready for Audit
          {readyForAudit.length > 0 && (
            <span className="ml-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: '#DCFCE7', color: '#16A34A' }}>
              {readyForAudit.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sourcing')}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
          style={activeTab === 'sourcing'
            ? { background: '#FFFFFF', color: '#D97706', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
            : { color: '#6B7280' }}>
          <RefreshCw className="w-3.5 h-3.5" />
          Sourcing
          {sourcingRequests.length > 0 && (
            <span className="ml-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: '#FFFBEB', color: '#D97706' }}>
              {sourcingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Content ── */}
      {filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center py-16 rounded-2xl"
          style={{ background: '#F9FAFB', border: '1px dashed #D1D5DB' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
            style={{ background: '#EFF6FF' }}>
            {activeTab === 'audit'
              ? <ShieldCheck className="w-7 h-7" style={{ color: '#93C5FD' }} />
              : <RefreshCw className="w-7 h-7" style={{ color: '#93C5FD' }} />}
          </div>
          <p className="text-sm font-bold" style={{ color: '#374151' }}>
            {activeTab === 'audit' ? 'All Clear!' : 'No Sourcing Requests'}
          </p>
          <p className="text-xs mt-1 text-center max-w-xs" style={{ color: '#9CA3AF' }}>
            {activeTab === 'audit'
              ? 'No material requests awaiting approval with finalized quotes.'
              : 'No requests are currently being sourced by the Purchase team.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => {
            const selectedQuote = getSelectedQuote(request.id, request.selected_quote_id);
            const isExpanded = expandedId === request.id;
            const items = getRequestItems(request);
            const isProjectFallback = (!request.boq_items || request.boq_items.length === 0) && items.length > 0;

            const urgencyBorder = request.urgency === 'critical' ? '#DC2626'
              : request.urgency === 'high' ? '#D97706' : '#E5E7EB';

            return (
              <div key={request.id}
                className="rounded-2xl overflow-hidden transition-all duration-200"
                style={{
                  background: '#FFFFFF',
                  border: `1px solid ${isExpanded ? '#BFDBFE' : urgencyBorder}`,
                  borderLeft: request.urgency !== 'normal' ? `4px solid ${urgencyBorder}` : undefined,
                  boxShadow: isExpanded ? '0 4px 16px rgba(37,99,235,0.10)' : '0 1px 4px rgba(0,0,0,0.06)',
                }}>

                {/* ── Card header (always visible) ── */}
                <div
                  className="p-5 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : request.id)}>
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      {/* Tags row */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md"
                          style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
                          MR-{request.id.slice(0, 6).toUpperCase()}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#2563EB' }}>
                          {request.requester_department || 'Engineering'}
                        </span>
                        {request.urgency !== 'normal' && (
                          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full")}
                            style={{
                              background: request.urgency === 'critical' ? '#FEF2F2' : '#FFFBEB',
                              color: request.urgency === 'critical' ? '#DC2626' : '#D97706'
                            }}>
                            {request.urgency.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Project name */}
                      <h3 className="font-black text-xl leading-tight tracking-tight" style={{ color: '#111827' }}>
                        {request.project?.project_name || 'Project Request'}
                      </h3>

                      {/* Meta row */}
                      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                        <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
                          style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                          <User className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
                          <span className="font-medium" style={{ color: '#374151' }}>
                            {request.requester?.name || 'Unknown'}
                          </span>
                        </span>
                        {selectedQuote && (
                          <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
                            style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                            <Building2 className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
                            <span className="font-bold" style={{ color: '#2563EB' }}>{selectedQuote.vendor_name}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side */}
                    <div className="text-right flex flex-col items-end gap-2 shrink-0">
                      {selectedQuote ? (
                        <>
                          <p className="text-2xl font-black flex items-center justify-end" style={{ color: '#111827' }}>
                            <IndianRupee className="w-5 h-5 mr-0.5" style={{ color: '#9CA3AF' }} />
                            {Number(selectedQuote.quoted_total).toLocaleString()}
                          </p>
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                            style={{ background: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                            ✓ Quote Finalized
                          </span>
                          <Button size="sm"
                            className="h-8 px-4 text-xs gap-1.5 font-bold mt-1"
                            style={{ background: '#2563EB', color: '#FFFFFF', border: 'none' }}
                            onClick={(e) => { e.stopPropagation(); setExpandedId(request.id); setCompareOpen(true); }}>
                            <Scale className="w-3.5 h-3.5" /> Compare Quotes
                          </Button>
                        </>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                          style={{ background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>
                          <RefreshCw className="w-3 h-3 animate-spin" /> Sourcing
                        </span>
                      )}

                      {/* Expand chevron */}
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center transition-all mt-1",
                        isExpanded ? "" : ""
                      )}
                        style={{
                          background: isExpanded ? '#EFF6FF' : '#F9FAFB',
                          border: `1px solid ${isExpanded ? '#BFDBFE' : '#E5E7EB'}`
                        }}>
                        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isExpanded && "rotate-180")}
                          style={{ color: isExpanded ? '#2563EB' : '#9CA3AF' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Expanded detail ── */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}>
                      <div className="px-5 pb-5 pt-4 space-y-6"
                        style={{ borderTop: '1px solid #F3F4F6' }}>

                        {activeTab === 'audit' ? (
                          /* ── Audit tab: 3 columns ── */
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                              {/* Col 1: Items */}
                              <div className="space-y-2">
                                <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2"
                                  style={{ color: '#6B7280' }}>
                                  <Package className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
                                  Requested Items
                                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                    style={{ background: '#F1F5F9', color: '#6B7280' }}>
                                    {items.length} items
                                  </span>
                                </h4>
                                <div className="rounded-xl p-3 space-y-2"
                                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                                  {items.length > 0 ? items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-sm pb-2 mb-2 last:pb-0 last:mb-0"
                                      style={{ borderBottom: idx < items.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                                      <div>
                                        <p className="font-semibold" style={{ color: '#111827' }}>
                                          {item.material_name || item.name || `Item ${idx + 1}`}
                                        </p>
                                        <p className="text-[10px]" style={{ color: '#9CA3AF' }}>
                                          {item.specification || 'No specification'}
                                        </p>
                                      </div>
                                      <p className="font-mono font-bold text-xs" style={{ color: '#2563EB' }}>
                                        {item.quantity || item.quantity_needed} <span style={{ color: '#9CA3AF' }}>{item.unit || 'units'}</span>
                                      </p>
                                    </div>
                                  )) : (
                                    <p className="text-xs italic text-center py-4" style={{ color: '#9CA3AF' }}>No items data</p>
                                  )}
                                </div>
                              </div>

                              {/* Col 2: Vendor */}
                              <div className="space-y-2">
                                <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2"
                                  style={{ color: '#6B7280' }}>
                                  <Building2 className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
                                  Selected Vendor
                                </h4>
                                {selectedQuote ? (
                                  <div className="rounded-xl p-3 space-y-3"
                                    style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                                    <div>
                                      <p className="font-bold" style={{ color: '#2563EB' }}>{selectedQuote.vendor_name}</p>
                                      <p className="text-xs" style={{ color: '#9CA3AF' }}>{selectedQuote.vendor_contact}</p>
                                    </div>
                                    <div className="p-2.5 rounded-lg space-y-1 text-[11px] font-mono"
                                      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                                      <p><span style={{ color: '#9CA3AF' }}>Bank:</span> <span style={{ color: '#374151' }}>{selectedQuote.vendor_bank_name}</span></p>
                                      <p><span style={{ color: '#9CA3AF' }}>A/C:</span> <span style={{ color: '#374151' }}>{selectedQuote.vendor_account_number}</span></p>
                                      <p><span style={{ color: '#9CA3AF' }}>IFSC:</span> <span style={{ color: '#374151' }}>{selectedQuote.vendor_ifsc}</span></p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {selectedQuote.quote_drive_link && (
                                        <Button variant="outline" size="sm" className="h-8 text-[10px] gap-1.5"
                                          style={{ borderColor: '#E5E7EB', color: '#374151' }} asChild>
                                          <a href={selectedQuote.quote_drive_link} target="_blank" rel="noopener noreferrer">
                                            <FileText className="w-3 h-3" /> View PDF
                                          </a>
                                        </Button>
                                      )}
                                      <Button size="sm" className="h-8 text-[10px] gap-1.5 font-bold col-span-1"
                                        style={{ background: '#2563EB', color: '#FFFFFF', border: 'none' }}
                                        onClick={() => setCompareOpen(true)}>
                                        <Scale className="w-3 h-3" /> Compare
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-8 text-center rounded-xl"
                                    style={{ background: '#F9FAFB', border: '1px dashed #D1D5DB' }}>
                                    <p className="text-xs italic" style={{ color: '#9CA3AF' }}>No vendor selected yet</p>
                                  </div>
                                )}
                              </div>

                              {/* Col 3: Approval Actions */}
                              <div className="space-y-2">
                                <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2"
                                  style={{ color: '#6B7280' }}>
                                  <ShieldCheck className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
                                  Your Audit
                                </h4>
                                <div className="rounded-xl p-4 space-y-3"
                                  style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#6B7280' }}>
                                      Verification Note (Optional)
                                    </Label>
                                    <Textarea
                                      placeholder="Enter any notes or observations..."
                                      className="text-xs min-h-[80px] resize-none"
                                      style={{ background: '#FFFFFF', borderColor: '#BFDBFE', color: '#111827' }}
                                      value={note}
                                      onChange={(e) => setNote(e.target.value)}
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Button variant="destructive" className="h-9 text-xs gap-1.5"
                                      onClick={() => { setRejectDialogId(request.id); setRejectReason(''); }}>
                                      <XCircle className="w-3.5 h-3.5" /> Reject
                                    </Button>
                                    <Button className="h-9 text-xs gap-1.5"
                                      disabled={isSaving || !selectedQuote}
                                      style={{ background: '#16A34A', color: '#FFFFFF', border: 'none' }}
                                      onClick={() => handleApprove(request.id)}>
                                      {isSaving
                                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        : <CheckCircle className="w-3.5 h-3.5" />}
                                      Approve
                                    </Button>
                                  </div>
                                  {!selectedQuote && (
                                    <p className="text-[9px] text-center italic" style={{ color: '#D97706' }}>
                                      ⚠ Cannot approve without a selected quote
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Approval chain */}
                            <div className="pt-4" style={{ borderTop: '1px solid #F3F4F6' }}>
                              <p className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>
                                Overall Procurement Progress
                              </p>
                              <ApprovalChainDisplay steps={getMaterialApprovalSteps(request)} />
                            </div>
                          </>
                        ) : (
                          /* ── Sourcing tab ── */
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Project details */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2"
                                style={{ color: '#6B7280' }}>
                                <Layers className="w-3.5 h-3.5" style={{ color: '#2563EB' }} /> Project Details
                              </h4>
                              <div className="rounded-xl p-4 space-y-3"
                                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                                    <Package className="w-5 h-5" style={{ color: '#2563EB' }} />
                                  </div>
                                  <div>
                                    <p className="font-black text-base" style={{ color: '#111827' }}>
                                      {request.project?.project_name || 'Internal Request'}
                                    </p>
                                    <p className="text-xs" style={{ color: '#9CA3AF' }}>
                                      ID: {request.project?.project_id || 'N/A'}
                                    </p>
                                  </div>
                                </div>
                                {request.phase?.phase_name && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block"
                                    style={{ background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>
                                    Phase: {request.phase.phase_name}
                                  </span>
                                )}
                                <div className="flex items-center gap-4 text-xs" style={{ color: '#6B7280' }}>
                                  <span className="flex items-center gap-1.5">
                                    <User className="w-3 h-3" style={{ color: '#2563EB' }} />
                                    <span className="font-medium" style={{ color: '#374151' }}>{request.requester?.name}</span>
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <Clock className="w-3 h-3" />
                                    {format(new Date(request.created_at), 'dd MMM yyyy')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Materials */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2"
                                style={{ color: '#6B7280' }}>
                                <Package className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
                                {isProjectFallback ? 'Project BOQ Materials' : 'Requested Materials'}
                                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                  style={{ background: '#F1F5F9', color: '#6B7280' }}>
                                  {items.length} items
                                </span>
                              </h4>
                              {isProjectFallback && (
                                <p className="text-[10px] flex items-center gap-1.5" style={{ color: '#2563EB' }}>
                                  <Eye className="w-3 h-3" />
                                  Showing project BOQ items (no specific items attached)
                                </p>
                              )}
                              <div className="rounded-xl p-3 space-y-2 max-h-[280px] overflow-y-auto"
                                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                                {items.length > 0 ? items.map((item: any, idx: number) => (
                                  <div key={idx} className="flex justify-between items-start text-sm pb-2 mb-2 last:pb-0 last:mb-0"
                                    style={{ borderBottom: idx < items.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold" style={{ color: '#111827' }}>
                                        {item.material_name || item.name || `Item ${idx + 1}`}
                                      </p>
                                      {item.specification && (
                                        <p className="text-[10px] truncate max-w-[220px]" style={{ color: '#9CA3AF' }}>
                                          {item.specification}
                                        </p>
                                      )}
                                    </div>
                                    <p className="font-mono font-bold text-xs ml-3" style={{ color: '#2563EB' }}>
                                      {item.quantity || item.quantity_needed}{' '}
                                      <span style={{ color: '#9CA3AF' }}>{item.unit || 'units'}</span>
                                    </p>
                                  </div>
                                )) : (
                                  <p className="text-xs italic text-center py-4" style={{ color: '#9CA3AF' }}>No items data</p>
                                )}
                              </div>
                              <div className="px-3 py-2.5 rounded-xl flex items-center gap-2"
                                style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                                <Eye className="w-3.5 h-3.5 shrink-0" style={{ color: '#D97706' }} />
                                <p className="text-[11px] font-medium" style={{ color: '#D97706' }}>
                                  Viewing only — Purchase team is sourcing vendors for this request.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      <QuoteComparisonModal
        open={compareOpen}
        onOpenChange={setCompareOpen}
        quotes={expandedId ? quotes.filter(q => q.material_request_id === expandedId) : []}
        isReadOnly={true}
        onSelectQuote={async () => {
          toast.success('Quote comparison reviewed');
          setCompareOpen(false);
        }}
      />

      {/* ── Rejection Dialog ── */}
      {rejectDialogId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setRejectDialogId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-black text-gray-900 mb-1">Reject Material Request</h3>
            <p className="text-xs text-gray-500 mb-4">This action will notify the requester. Please provide a clear reason.</p>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none min-h-[100px] focus:outline-none focus:ring-2 focus:ring-red-300"
              placeholder="Enter rejection reason (required)..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                onClick={() => setRejectDialogId(null)}
              >Cancel</button>
              <button
                className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
                disabled={!rejectReason.trim() || isSaving}
                onClick={() => handleReject(rejectDialogId)}
              >{isSaving ? 'Rejecting...' : 'Confirm Reject'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
