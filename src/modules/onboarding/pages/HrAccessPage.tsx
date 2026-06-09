import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  FileText,
  Search,
  Filter,
  UserCheck,
  UserX,
  MessageSquare,
  ClipboardList,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getPendingOnboardingRequests, approveOnboarding, rejectOnboarding, requestDocumentsCorrection } from '../services/onboardingService';
import type { OnboardingListItem, EmployeeOnboardingRequest, OnboardingStatus } from '../types/prejoining.types';
import { ONBOARDING_STATUS_LABELS, ONBOARDING_STATUS_COLORS } from '../types/prejoining.types';
import { DEPARTMENT_SHORT_CODES } from '../utils/prejoiningPasswordGenerator';

export default function HrAccessPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<OnboardingListItem[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<EmployeeOnboardingRequest | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'verify' | 'correction' | 'reject' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OnboardingStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const departments = Object.keys(DEPARTMENT_SHORT_CODES);

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const result = await getPendingOnboardingRequests();
      if (result.success && result.data) {
        setRequests(result.data as any);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to load onboarding requests',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load onboarding requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter((req) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      req.full_name.toLowerCase().includes(query) ||
      req.email.toLowerCase().includes(query) ||
      req.department.toLowerCase().includes(query)
    );
  });

  const handleViewDetails = async (request: OnboardingListItem) => {
    try {
      const { data } = await import('../services/prejoiningOnboardingService').then((mod) =>
        mod.getOnboardingByToken(request.id)
      );
      if (data) {
        setSelectedRequest(data);
        setViewDialogOpen(true);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load details', variant: 'destructive' });
    }
  };

  const handleAction = (type: 'verify' | 'correction' | 'reject') => {
    setActionType(type);
    setActionReason('');
    setActionDialogOpen(true);
  };

  const executeAction = async () => {
    if (!selectedRequest || !actionType) return;
    if ((actionType === 'correction' || actionType === 'reject') && !actionReason.trim()) {
      toast({ title: 'Reason Required', description: 'Please provide a reason for this action', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      let result;
      switch (actionType) {
        case 'verify':    result = await approveOnboarding(selectedRequest.id, actionReason); break;
        case 'correction':result = await requestDocumentsCorrection(selectedRequest.id, actionReason); break;
        case 'reject':    result = await rejectOnboarding(selectedRequest.id, actionReason); break;
      }
      if (result.success) {
        toast({ title: 'Success', description: `Onboarding ${actionType === 'verify' ? 'verified' : actionType === 'correction' ? 'correction requested' : 'rejected'} successfully` });
        setActionDialogOpen(false);
        setViewDialogOpen(false);
        loadRequests();
      } else {
        toast({ title: 'Failed', description: result.error || 'Action failed', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const openDocument = (url?: string) => { if (url) window.open(url, '_blank'); };

  const getDocumentStatus = (url?: string) =>
    url ? <Badge className="bg-green-100 text-green-700 border-green-200">Uploaded</Badge>
        : <Badge variant="outline" className="text-gray-400 border-gray-200">Missing</Badge>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Onboarding Status</h1>
          <p className="text-sm text-gray-400 mt-0.5">Review and verify employee onboarding submissions</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-emerald-600" />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 border-gray-200 bg-gray-50 focus:bg-white text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OnboardingStatus | 'all')}>
            <SelectTrigger className="w-[180px] h-10 border-gray-200 bg-gray-50 text-sm">
              <Filter className="w-4 h-4 mr-2 text-gray-400" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(ONBOARDING_STATUS_LABELS).map(([status, label]) => (
                <SelectItem key={status} value={status}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={loadRequests}
            disabled={loading}
            className="h-10 border-gray-200 text-gray-600 hover:bg-gray-50 text-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-black text-gray-900">Onboarding Submissions</h2>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">No onboarding requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-5 text-xs font-black uppercase tracking-wider text-gray-400">Name</th>
                  <th className="text-left py-3 px-5 text-xs font-black uppercase tracking-wider text-gray-400">Email</th>
                  <th className="text-left py-3 px-5 text-xs font-black uppercase tracking-wider text-gray-400">Department</th>
                  <th className="text-left py-3 px-5 text-xs font-black uppercase tracking-wider text-gray-400">Username</th>
                  <th className="text-left py-3 px-5 text-xs font-black uppercase tracking-wider text-gray-400">Status</th>
                  <th className="text-left py-3 px-5 text-xs font-black uppercase tracking-wider text-gray-400">Docs</th>
                  <th className="text-left py-3 px-5 text-xs font-black uppercase tracking-wider text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-5 font-semibold text-gray-900">{request.full_name}</td>
                    <td className="py-3 px-5 text-gray-500">{request.email}</td>
                    <td className="py-3 px-5 text-gray-500">{request.department}</td>
                    <td className="py-3 px-5 font-mono text-xs text-emerald-600 font-bold">{request.generated_username || '—'}</td>
                    <td className="py-3 px-5">
                      <Badge className={ONBOARDING_STATUS_COLORS[request.status]}>
                        {ONBOARDING_STATUS_LABELS[request.status]}
                      </Badge>
                    </td>
                    <td className="py-3 px-5">
                      {request.hasDocuments
                        ? <CheckCircle className="w-4 h-4 text-green-500" />
                        : <XCircle className="w-4 h-4 text-gray-300" />}
                    </td>
                    <td className="py-3 px-5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(request)}
                        className="h-8 px-3 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Onboarding Details</DialogTitle>
            <DialogDescription>Review all submitted information and documents</DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-5 py-2">

              {/* Basic Info */}
              <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 rounded-xl">
                {[
                  { label: 'Full Name',  value: selectedRequest.full_name },
                  { label: 'Email',      value: selectedRequest.email },
                  { label: 'Department', value: selectedRequest.department },
                  { label: 'Username',   value: selectedRequest.generated_username, mono: true },
                  { label: 'Submitted',  value: new Date(selectedRequest.updated_at).toLocaleDateString() },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{f.label}</p>
                    <p className={`text-sm font-semibold text-gray-900 ${f.mono ? 'font-mono text-emerald-600' : ''}`}>{f.value || '—'}</p>
                  </div>
                ))}
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Status</p>
                  <Badge className={ONBOARDING_STATUS_COLORS[selectedRequest.status]}>
                    {ONBOARDING_STATUS_LABELS[selectedRequest.status]}
                  </Badge>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Contact Information</p>
                <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 rounded-xl">
                  {[
                    { label: 'Contact Number',   value: selectedRequest.contact_number },
                    { label: 'Emergency Contact', value: selectedRequest.emergency_contact_number },
                    { label: 'Parents Number',    value: selectedRequest.parents_number },
                  ].map(f => (
                    <div key={f.label}>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{f.label}</p>
                      <p className="text-sm font-semibold text-gray-900">{f.value || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Address */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Address</p>
                <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl">
                  {[
                    { label: 'Permanent Address', value: selectedRequest.permanent_address },
                    { label: 'Current Address',   value: selectedRequest.current_address },
                  ].map(f => (
                    <div key={f.label}>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{f.label}</p>
                      <p className="text-sm font-semibold text-gray-900">{f.value || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documents */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Documents</p>
                <div className="grid grid-cols-3 gap-2 p-4 bg-gray-50 rounded-xl">
                  {[
                    { label: 'Aadhaar',       url: selectedRequest.aadhaar_url },
                    { label: 'Passbook',       url: selectedRequest.passbook_url },
                    { label: '10th Marksheet', url: selectedRequest.marksheet_10_url },
                    { label: '12th Marksheet', url: selectedRequest.marksheet_12_url },
                    { label: 'Degree',         url: selectedRequest.degree_marksheet_url },
                    { label: 'Resume',         url: selectedRequest.resume_url },
                    { label: 'Photo',          url: selectedRequest.photo_url },
                    { label: 'HR Policy',      url: selectedRequest.hr_policy_url },
                    { label: 'Offer Letter',   url: selectedRequest.offer_letter_url },
                  ].map((doc) => (
                    <div key={doc.label} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-gray-100">
                      <span className="text-xs font-semibold text-gray-600">{doc.label}</span>
                      {doc.url ? (
                        <Button variant="ghost" size="sm" onClick={() => openDocument(doc.url)}
                          className="h-7 w-7 p-0 text-blue-500 hover:bg-blue-50">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-300" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Acknowledgements */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Acknowledgements</p>
                <div className="flex gap-4 p-4 bg-gray-50 rounded-xl">
                  {[
                    { label: 'HR Policy Accepted',    ok: selectedRequest.hr_policy_accepted },
                    { label: 'Offer Letter Accepted',  ok: selectedRequest.offer_letter_accepted },
                  ].map(a => (
                    <div key={a.label} className="flex items-center gap-2">
                      {a.ok
                        ? <CheckCircle className="w-4 h-4 text-green-500" />
                        : <XCircle className="w-4 h-4 text-gray-300" />}
                      <span className="text-sm text-gray-600">{a.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              {(selectedRequest.status === 'details_submitted' || selectedRequest.status === 'correction_requested') && (
                <DialogFooter className="gap-2 pt-2">
                  <Button variant="outline" onClick={() => handleAction('reject')}
                    className="border-red-200 text-red-600 hover:bg-red-50">
                    <UserX className="w-4 h-4 mr-2" /> Reject
                  </Button>
                  <Button variant="outline" onClick={() => handleAction('correction')}
                    className="border-amber-200 text-amber-600 hover:bg-amber-50">
                    <MessageSquare className="w-4 h-4 mr-2" /> Request Correction
                  </Button>
                  <Button onClick={() => handleAction('verify')}
                    className="bg-green-600 hover:bg-green-700 text-white">
                    <UserCheck className="w-4 h-4 mr-2" /> Verify & Activate
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirm Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'verify'     && 'Verify Onboarding'}
              {actionType === 'correction' && 'Request Correction'}
              {actionType === 'reject'     && 'Reject Onboarding'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'verify'     && 'This will activate the employee account. Are you sure?'}
              {actionType === 'correction' && 'Provide details on what needs to be corrected.'}
              {actionType === 'reject'     && 'Provide the reason for rejection.'}
            </DialogDescription>
          </DialogHeader>

          {(actionType === 'correction' || actionType === 'reject') && (
            <div className="py-2">
              <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                Reason <span className="text-red-500">*</span>
              </Label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={actionType === 'correction' ? 'What needs to be corrected?' : 'Why is this being rejected?'}
                rows={4}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionDialogOpen(false)} disabled={processing}>Cancel</Button>
            <Button
              onClick={executeAction}
              disabled={processing}
              className={
                actionType === 'verify'     ? 'bg-green-600 hover:bg-green-700 text-white' :
                actionType === 'reject'     ? 'bg-red-600 hover:bg-red-700 text-white' :
                                              'bg-amber-500 hover:bg-amber-600 text-white'
              }
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {!processing && actionType === 'verify'     && <CheckCircle className="w-4 h-4 mr-2" />}
              {!processing && actionType === 'correction' && <MessageSquare className="w-4 h-4 mr-2" />}
              {!processing && actionType === 'reject'     && <UserX className="w-4 h-4 mr-2" />}
              {actionType === 'verify'     && 'Confirm Verify'}
              {actionType === 'correction' && 'Send Correction Request'}
              {actionType === 'reject'     && 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
