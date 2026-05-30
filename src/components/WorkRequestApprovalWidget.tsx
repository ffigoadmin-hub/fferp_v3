
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hammer, Clock, CheckCircle, XCircle, Search,
  IndianRupee, Building2, User, FileText,
  ArrowRight, ShieldCheck, RefreshCw, Zap,
  Layers, Eye, AlertTriangle, TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useVendorWorkRequests, VendorWorkRequest } from '@/hooks/useVendorWorkRequests';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface WorkRequestApprovalWidgetProps {
  role: 'gm' | 'admin' | 'ceo' | 'gmo' | 'smo';
  targetStatus: string;
  title: string;
  subtitle: string;
}

export function WorkRequestApprovalWidget({
  role,
  targetStatus,
  title,
  subtitle
}: WorkRequestApprovalWidgetProps) {
  const { requests: allRequests, isLoading, approveRequest, rejectRequest, isSaving, refetch } = useVendorWorkRequests();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Filter requests for this specific approval stage
  const approvalRequests = allRequests.filter(r => r.approval_status === targetStatus);

  const filteredRequests = approvalRequests.filter(r =>
    r.project?.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.requester?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.work_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading work requests...
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Hammer className="w-5 h-5 text-authority-admin" />
            {title}
            <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-0">
              {approvalRequests.length} Pending
            </Badge>
          </h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search work requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-muted/30 border-none h-10"
          />
        </div>
      </div>

      {/* Content */}
      {filteredRequests.length === 0 ? (
        <Card className="border-dashed bg-muted/5">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <ShieldCheck className="w-16 h-16 opacity-10 mb-4" />
            <p className="font-medium">No Pending Approvals</p>
            <p className="text-sm">You have reviewed all work requests in this stage.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => {
            const isExpanded = expandedId === request.id;
            
            return (
              <Card
                key={request.id}
                className={cn(
                  "overflow-hidden transition-all duration-300 border-border/50 relative group",
                  isExpanded ? "ring-2 ring-primary/40 shadow-2xl" : "hover:bg-muted/5"
                )}
              >
                <div
                  className="p-5 cursor-pointer relative z-10"
                  onClick={() => setExpandedId(isExpanded ? null : request.id)}
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <Badge variant="outline" className="capitalize text-[10px] font-bold tracking-tighter bg-primary/10 text-primary border-primary/20">
                            {request.work_type?.replace(/_/g, ' ') || 'Work Request'}
                          </Badge>
                          {request.aligned_vendor_details?.is_internal ? (
                            <Badge variant="outline" className="gap-1.5 py-0 px-2 h-5 bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[9px] font-black tracking-widest uppercase italic">
                              <ShieldCheck className="w-3 h-3" />
                              INTERNAL SOURCING
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1.5 py-0 px-2 h-5 bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px] font-black tracking-widest uppercase italic">
                              <Building2 className="w-3 h-3" />
                              VENDOR SOURCING
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] font-mono text-amber-400 border-amber-500/30 gap-1.5 py-0 uppercase">
                            <Clock className="w-3 h-3" />
                            {request.approval_status?.replace(/_/g, ' ')}
                          </Badge>
                        {request.phase?.phase_name && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-[10px] font-bold px-2 h-5">
                            {request.phase.phase_name}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-black text-xl md:text-2xl leading-none tracking-tighter text-white/90 group-hover:text-white transition-colors">
                        {request.project?.project_name || 'Project Request'}
                      </h3>
                      <div className="flex items-center gap-5 mt-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-2 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                          <User className="w-3.5 h-3.5 text-primary/70" />
                          <span className="font-medium text-foreground/80">{request.requester?.name || 'Requester'}</span>
                          <span className="text-[10px] opacity-40">|</span>
                          <span className="text-[10px] uppercase font-bold text-primary/60">{request.requester?.department || 'Staff'}</span>
                        </span>
                        <span className="flex items-center gap-2 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                          <Building2 className="w-3.5 h-3.5 text-primary/70" />
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground/80 tracking-tight">{request.project?.project_name || request.project?.project_id}</span>
                            {request.project?.created_at && (
                              <span className="text-[9px] font-bold text-emerald-400">
                                {Math.floor((new Date().getTime() - new Date(request.project.created_at).getTime()) / (1000 * 60 * 60 * 24)) === 0 
                                  ? 'New Project (Today)' 
                                  : `Project Age: ${Math.floor((new Date().getTime() - new Date(request.project.created_at).getTime()) / (1000 * 60 * 60 * 24))} Days`}
                              </span>
                            )}
                          </div>
                        </span>
                        {request.phase?.phase_name && (
                          <span className="flex items-center gap-2 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                            <Layers className="w-3.5 h-3.5 text-primary/70" />
                            <div className="flex flex-col">
                              <span className="font-bold text-foreground/80">{request.phase.phase_name}</span>
                              <span className="text-[9px] font-medium opacity-60 italic tracking-tighter">Active Phase Details</span>
                            </div>
                          </span>
                        )}
                        {request.timeline_days && (
                          <span className="flex items-center gap-2 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                            <Clock className="w-3.5 h-3.5 text-primary/70" />
                            <span className="font-bold text-foreground/80 lowercase">
                              <span className="uppercase">{request.timeline_days} Days</span> WORK DURATION TIMELINE
                            </span>
                          </span>
                        )}
                        <Badge variant="outline" className="text-[9px] font-mono tracking-tighter opacity-40 hover:opacity-100 transition-opacity border-white/10">
                          REQ ID: {request.id.slice(0, 12).toUpperCase()}
                        </Badge>
                        <span className="flex items-center gap-2 bg-amber-500/5 px-2.5 py-1 rounded-md border border-amber-500/10">
                          <Zap className="w-3.5 h-3.5 text-amber-500/70" />
                          <span className="text-[10px] uppercase font-black text-amber-500/80">
                            REQUEST AGE: {Math.max(0, Math.floor((new Date().getTime() - new Date(request.created_at).getTime()) / (1000 * 60 * 60 * 24)))} DAYS PENDING
                          </span>
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end justify-between self-stretch">
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-60">
                          {request.final_price && request.final_price !== request.estimated_budget ? 'Sourced / Project Value' : 'Estimated Budget'}
                        </p>
                        <div className="flex flex-col items-end">
                          <p className="text-2xl md:text-3xl font-black text-white tracking-tighter flex items-center justify-end">
                            <IndianRupee className="w-5 h-5 opacity-40 mr-0.5" />
                            {Number(request.final_price || request.estimated_budget || 0).toLocaleString()}
                          </p>
                          {request.final_price && request.estimated_budget && request.final_price > request.estimated_budget && (
                            <div className="flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[9px] font-black uppercase text-rose-500 animate-pulse">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              +₹{(request.final_price - request.estimated_budget).toLocaleString()} OVER BUDGET
                            </div>
                          )}
                          {request.final_price && request.estimated_budget && request.final_price < request.estimated_budget && (
                            <div className="flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase text-emerald-400">
                              <TrendingUp className="w-2.5 h-2.5 rotate-180" />
                              -₹{(request.estimated_budget - request.final_price).toLocaleString()} BELOW BUDGET
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={cn(
                        "w-8 h-8 rounded-full border border-white/10 flex items-center justify-center transition-all duration-300",
                        isExpanded ? "rotate-90 bg-primary/20 border-primary/30 text-primary" : "hover:bg-white/5 text-muted-foreground"
                      )}>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 bg-black/40"
                    >
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Details */}
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-2 tracking-[0.2em] opacity-70">
                              <FileText className="w-3 h-3" /> Description & Scope
                            </h4>
                            <div className="bg-black/40 rounded-xl p-5 border border-white/5 shadow-inner">
                              <p className="text-sm leading-relaxed text-white/80 whitespace-pre-wrap">{request.work_description}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <p className="text-[10px] uppercase text-muted-foreground font-black tracking-widest opacity-60">Urgency Level</p>
                              <div className="h-10 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center">
                                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/5 font-black text-[10px] tracking-widest">
                                  NORMAL
                                </Badge>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[10px] uppercase text-muted-foreground font-black tracking-widest opacity-60">Request Date</p>
                              <div className="h-10 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center">
                                <span className="text-xs font-bold text-white/90">{format(new Date(request.created_at), 'MMMM do, yyyy')}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-6">
                          <h4 className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-2 tracking-[0.2em] opacity-70">
                            <ShieldCheck className="w-3 h-3" /> Management Audit
                          </h4>
                          <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 space-y-5 shadow-xl shadow-black/20">
                            <div className="space-y-2">
                              <Label className="text-[10px] uppercase font-black tracking-widest opacity-50 ml-1">Review Comments (Optional)</Label>
                              <Textarea
                                placeholder="Instructions for vendor sourcing team..."
                                className="bg-black/60 border-white/10 text-sm min-h-[120px] resize-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 rounded-xl"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <Button
                                variant="outline"
                                className="h-12 font-black uppercase tracking-widest text-[11px] border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
                                onClick={() => { setRejectDialogId(request.id); setRejectReason(''); }}
                              >
                                <XCircle className="w-4 h-4 mr-2" /> Reject
                              </Button>
                              <Button
                                className="h-12 font-black uppercase tracking-widest text-[11px] bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white shadow-lg shadow-emerald-500/20 border-0 transition-all hover:scale-[1.02] active:scale-95"
                                disabled={isSaving}
                                onClick={() => handleApprove(request.id)}
                              >
                                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                Final Approve
                              </Button>
                            </div>
                          </div>
                          
                          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-4">
                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-amber-200/80 leading-relaxed font-medium">
                              By approving, you authorize the sourcing team to initiate vendor negotiations for this work request based on the estimated budget of <span className="text-white font-black">₹{request.estimated_budget?.toLocaleString()}</span>.
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      )}
    </div>

      {/* ── Rejection Dialog ── */}
      {rejectDialogId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setRejectDialogId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-black text-gray-900 mb-1">Reject Work Request</h3>
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
    </>
  );
}
