import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, Calendar, ArrowRight, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface DeviationRequest {
  id: string;
  milestone_id: string;
  project_id: string;
  requested_by: string;
  original_date: string;
  new_proposed_date: string;
  reason: string;
  proof_url: string | null;
  status: string;
  smo_reviewed_at: string | null;
  smo_reviewed_by: string | null;
  smo_remarks: string | null;
  gmo_reviewed_at: string | null;
  gmo_reviewed_by: string | null;
  gmo_remarks: string | null;
  ceo_reviewed_at: string | null;
  ceo_reviewed_by: string | null;
  ceo_remarks: string | null;
  rejection_reason: string | null;
  created_at: string;
  milestone?: { milestone_name: string };
  project?: { project_name: string };
  requester?: { name: string };
}

interface DeviationApprovalsWidgetProps {
  role: 'smo' | 'gmo' | 'ceo' | 'admin';
}

export function DeviationApprovalsWidget({ role }: DeviationApprovalsWidgetProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<DeviationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DeviationRequest | null>(null);
  const [remarks, setRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const statusFilter = {
    smo: 'pending_smo',
    gmo: 'pending_gmo',
    ceo: 'pending_ceo',
    admin: '', // Admin sees all
  }[role];

  const fetchRequests = async () => {
    try {
      let query = supabase
        .from('milestone_deviation_requests')
        .select(`
          *,
          milestone:project_milestones(milestone_name),
          project:projects(project_name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch requester names in a single batch query to avoid N+1
      const requesterIds = [...new Set((data || []).map(req => req.requested_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', requesterIds);

      const profileMap = Object.fromEntries(profiles?.map(p => [p.id, p]) || []);
      
      const requestsWithNames = (data || []).map((req: any) => ({
        ...req,
        requester: profileMap[req.requested_by] || { name: 'Unknown' }
      })) as DeviationRequest[];
      
      setRequests(requestsWithNames);
    } catch (error) {
      console.error('Error fetching deviation requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [role]);

  const handleApprove = async (request: DeviationRequest) => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (role === 'smo') {
        updates.smo_reviewed_at = new Date().toISOString();
        updates.smo_reviewed_by = user.id;
        updates.smo_remarks = remarks;
        updates.status = 'pending_gmo';
      } else if (role === 'gmo') {
        updates.gmo_reviewed_at = new Date().toISOString();
        updates.gmo_reviewed_by = user.id;
        updates.gmo_remarks = remarks;
        updates.status = 'pending_ceo';
      } else if (role === 'ceo') {
        updates.ceo_reviewed_at = new Date().toISOString();
        updates.ceo_reviewed_by = user.id;
        updates.ceo_remarks = remarks;
        updates.status = 'approved';

        // Update the milestone with new date
        await supabase
          .from('project_milestones')
          .update({
            planned_date: request.new_proposed_date,
            updated_at: new Date().toISOString(),
          })
          .eq('id', request.milestone_id);
      }

      const { error } = await supabase
        .from('milestone_deviation_requests')
        .update(updates)
        .eq('id', request.id);

      if (error) throw error;
      
      toast.success(role === 'ceo' ? 'Deviation approved' : 'Forwarded for next approval');
      setSelectedRequest(null);
      setRemarks('');
      fetchRequests();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('milestone_deviation_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;
      
      toast.success('Deviation request rejected');
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectionReason('');
      fetchRequests();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_smo':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Pending SMO</Badge>;
      case 'pending_gmo':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Pending GMO</Badge>;
      case 'pending_ceo':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">Pending CEO</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const pendingCount = requests.filter(r => !['approved', 'rejected'].includes(r.status)).length;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Milestone Deviation Requests
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingCount}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No deviation requests {role !== 'admin' && 'pending your approval'}</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <h4 className="font-medium">{request.milestone?.milestone_name || 'Unknown Milestone'}</h4>
                          {getStatusBadge(request.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Project: {request.project?.project_name || 'Unknown'} • 
                          Requested by: {request.requester?.name || 'Unknown'}
                        </p>
                        
                        <div className="flex items-center gap-4 text-sm mb-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Original:</span>
                            <span className="font-medium">{format(new Date(request.original_date), 'MMM d, yyyy')}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Proposed:</span>
                            <span className="font-medium text-amber-600">{format(new Date(request.new_proposed_date), 'MMM d, yyyy')}</span>
                          </div>
                        </div>

                        <p className="text-sm bg-muted/50 p-2 rounded">{request.reason}</p>

                        {/* Show approval chain progress */}
                        {request.smo_remarks && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <span className="font-medium">SMO:</span> {request.smo_remarks}
                          </div>
                        )}
                        {request.gmo_remarks && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <span className="font-medium">GMO:</span> {request.gmo_remarks}
                          </div>
                        )}
                        {request.ceo_remarks && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <span className="font-medium">CEO:</span> {request.ceo_remarks}
                          </div>
                        )}
                        {request.rejection_reason && (
                          <div className="mt-2 text-xs text-destructive">
                            <span className="font-medium">Rejection Reason:</span> {request.rejection_reason}
                          </div>
                        )}
                      </div>

                      {role !== 'admin' && request.status === statusFilter && (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            {role === 'ceo' ? 'Approve' : 'Forward'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowRejectDialog(true);
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={!!selectedRequest && !showRejectDialog} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{role === 'ceo' ? 'Approve' : 'Forward'} Deviation Request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium">{selectedRequest.milestone?.milestone_name}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(selectedRequest.original_date), 'MMM d, yyyy')} → 
                  <span className="text-amber-600 font-medium"> {format(new Date(selectedRequest.new_proposed_date), 'MMM d, yyyy')}</span>
                </p>
              </div>
              <div>
                <Label>Remarks (optional)</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add any remarks..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>Cancel</Button>
            <Button onClick={() => selectedRequest && handleApprove(selectedRequest)} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {role === 'ceo' ? 'Approve & Update Milestone' : 'Forward to ' + (role === 'smo' ? 'GMO' : 'CEO')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Deviation Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rejection Reason *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why the request is being rejected..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason || isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
