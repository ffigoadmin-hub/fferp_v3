import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInDays } from 'date-fns';
import { Loader2, CheckCircle, XCircle, Clock, Plus, Calendar, User, FileText, Building2, ArrowRight, UserCheck, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeaveWorkflowTimeline } from '@/components/hr/LeaveWorkflowTimeline';

export default function LeaveApprovalsPage() {
  const { user } = useAuth();
  const { requests, leaveTypes, isLoading, isSaving, approveRequest, rejectRequest, addLeaveType } = useLeaveRequests();
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [dialogType, setDialogType] = useState<'approve' | 'reject' | 'type' | 'view' | null>(null);
  const [viewingRequest, setViewingRequest] = useState<any>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');

  const role = user?.role.toLowerCase() || '';

  // Filter requests based on role
  // Leave flow: Employee → HR → Admin → CEO (final)
  const pendingForMe = requests.filter(r => {
    if (role === 'hr') return r.status === 'pending_hr';
    if (role === 'admin') return r.status === 'pending_admin';
    if (role === 'ceo') return r.status === 'pending_ceo';
    return false;
  });

  const allRequests = requests;

  const handleApprove = async () => {
    if (!selectedRequest) return;
    await approveRequest(selectedRequest, remarks);
    setSelectedRequest(null);
    setRemarks('');
    setDialogType(null);
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectReason) return;
    await rejectRequest(selectedRequest, rejectReason);
    setSelectedRequest(null);
    setRejectReason('');
    setDialogType(null);
  };

  const handleAddType = async () => {
    if (!newTypeName) return;
    await addLeaveType(newTypeName, newTypeDescription);
    setNewTypeName('');
    setNewTypeDescription('');
    setDialogType(null);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending_hr: 'bg-status-late/20 text-status-late border-status-late',
      pending_admin: 'bg-blue-500/20 text-blue-600 border-blue-500',
      pending_ceo: 'bg-purple-500/20 text-purple-600 border-purple-500',
      approved: 'bg-status-live/20 text-status-live border-status-live',
      rejected: 'bg-destructive/20 text-destructive border-destructive',
    };
    const labels: Record<string, string> = {
      pending_hr: 'Pending HR',
      pending_admin: 'Pending Admin',
      pending_ceo: 'Pending CEO',
      approved: 'Approved',
      rejected: 'Rejected',
    };
    return (
      <Badge variant="outline" className={cn('font-medium', styles[status] || 'bg-muted')}>
        {labels[status] || status}
      </Badge>
    );
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
            <Calendar className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-1">Leave Approvals</h1>
            <p className="text-muted-foreground">Review and approve leave requests</p>
          </div>
        </div>

        {['hr', 'admin', 'ceo'].includes(role) && (
          <Button variant="outline" onClick={() => setDialogType('type')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Leave Type
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-status-late" />
              Pending for You
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-status-late">{pendingForMe.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-status-live" />
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-status-live">
              {requests.filter(r => r.status === 'approved').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive" />
              Rejected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">
              {requests.filter(r => r.status === 'rejected').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{requests.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pending for Me ({pendingForMe.length})
          </TabsTrigger>
          <TabsTrigger value="all">All Requests</TabsTrigger>
          <TabsTrigger value="types">Leave Types</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {pendingForMe.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-status-live/50" />
                <p className="text-lg font-medium text-muted-foreground">No pending requests</p>
                <p className="text-sm text-muted-foreground/70">All caught up!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingForMe.map((request) => {
                const days = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;
                return (
                  <Card key={request.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{request.employee_name}</CardTitle>
                            <CardDescription className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {request.employee_department || 'N/A'}
                            </CardDescription>
                          </div>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                      <Badge variant="secondary" className="w-fit mt-2">{request.leave_type_name}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Dates */}
                      <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">From</span>
                          <span className="font-medium">{format(new Date(request.start_date), 'dd MMM yyyy')}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">To</span>
                          <span className="font-medium">{format(new Date(request.end_date), 'dd MMM yyyy')}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm border-t border-border pt-2">
                          <span className="text-muted-foreground">Duration</span>
                          <span className="font-bold text-primary">
                            {request.duration_category === 'full'
                              ? `${days} ${days === 1 ? 'day' : 'days'}`
                              : `Permission (${request.start_time} - ${request.end_time})`}
                          </span>
                        </div>
                      </div>

                      {/* Reason */}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Reason</p>
                        <p className="text-sm whitespace-pre-wrap break-words">{request.reason}</p>
                      </div>

                      {/* Applied Date */}
                      <p className="text-xs text-muted-foreground">
                        Applied on {format(new Date(request.created_at), 'dd MMM yyyy')}
                      </p>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          className="flex-1 bg-status-live hover:bg-status-live/90 text-white"
                          onClick={() => {
                            setSelectedRequest(request.id);
                            setDialogType('approve');
                          }}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          className="flex-1 bg-destructive hover:bg-destructive/90 text-white"
                          onClick={() => {
                            setSelectedRequest(request.id);
                            setDialogType('reject');
                          }}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Workflow</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allRequests.map(request => {
                      const days = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;
                      return (
                        <TableRow
                          key={request.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setViewingRequest(request);
                            setDialogType('view');
                          }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <User className="w-4 h-4" />
                              </div>
                              <span className="font-medium">{request.employee_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Building2 className="w-3 h-3" />
                              {request.employee_department || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{request.leave_type_name}</Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">
                                {format(new Date(request.start_date), 'dd MMM')}
                                {request.duration_category === 'full' && ` - ${format(new Date(request.end_date), 'dd MMM')}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {request.duration_category === 'full'
                                  ? `${days} day(s)`
                                  : `Permission (${request.start_time} - ${request.end_time})`}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell className="max-w-[350px]">
                            {/* Compact workflow display */}
                            <div className="text-xs space-y-0.5">
                              {request.hr_reviewed_at && (
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-status-live" />
                                  <span className="text-muted-foreground">HR:</span>
                                  <span className="font-medium">{request.hr_reviewer_name || 'N/A'}</span>
                                </div>
                              )}
                              {request.admin_reviewed_at && (
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-status-live" />
                                  <span className="text-muted-foreground">Admin:</span>
                                  <span className="font-medium">{request.admin_reviewer_name || 'N/A'}</span>
                                </div>
                              )}
                              {request.ceo_reviewed_at && (
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-status-live" />
                                  <span className="text-muted-foreground">CEO:</span>
                                  <span className="font-medium">{request.ceo_reviewer_name || 'N/A'}</span>
                                </div>
                              )}
                              {request.status === 'rejected' && request.rejected_by_name && (
                                <div className="flex items-center gap-1">
                                  <XCircle className="w-3 h-3 text-destructive" />
                                  <span className="text-destructive font-medium">Rejected by: {request.rejected_by_name}</span>
                                </div>
                              )}
                              {!request.hr_reviewed_at && !request.admin_reviewed_at && !request.ceo_reviewed_at && request.status !== 'rejected' && (
                                <span className="text-muted-foreground">Pending review</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Leave Types</CardTitle>
              <CardDescription>Available leave categories in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {leaveTypes.map(type => (
                  <Card key={type.id} className="bg-muted/30">
                    <CardContent className="pt-4">
                      <h4 className="font-medium">{type.name}</h4>
                      <p className="text-sm text-muted-foreground">{type.description || 'No description'}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <Dialog open={dialogType === 'approve'} onOpenChange={() => setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-status-live">
              <CheckCircle className="w-5 h-5" />
              Approve Leave Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Remarks (Optional)</label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any remarks..."
                rows={3}
              />
            </div>
            <Button
              className="w-full bg-status-live hover:bg-status-live/90"
              onClick={handleApprove}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Approve Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={dialogType === 'reject'} onOpenChange={() => setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              Reject Leave Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Rejection Reason *</label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a reason for rejection..."
                rows={3}
              />
            </div>
            <Button
              className="w-full"
              variant="destructive"
              onClick={handleReject}
              disabled={isSaving || !rejectReason}
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
              Reject Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Leave Type Dialog */}
      <Dialog open={dialogType === 'type'} onOpenChange={() => setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Leave Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="e.g., Sick Leave"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newTypeDescription}
                onChange={(e) => setNewTypeDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleAddType}
              disabled={!newTypeName}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Leave Type
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Request Details Dialog */}
      <Dialog open={dialogType === 'view' && !!viewingRequest} onOpenChange={() => { setDialogType(null); setViewingRequest(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Leave Request Details
            </DialogTitle>
          </DialogHeader>
          {viewingRequest && (
            <div className="space-y-4 mt-4">
              {/* Employee Info */}
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{viewingRequest.employee_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {viewingRequest.employee_department || 'N/A'}
                    </p>
                  </div>
                  <div className="ml-auto">
                    {getStatusBadge(viewingRequest.status)}
                  </div>
                </div>
              </div>

              {/* Leave Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Leave Type</p>
                  <Badge variant="outline" className="mt-1">{viewingRequest.leave_type_name}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-medium text-sm">
                    {viewingRequest.duration_category === 'full'
                      ? `${differenceInDays(new Date(viewingRequest.end_date), new Date(viewingRequest.start_date)) + 1} day(s)`
                      : `Permission (${viewingRequest.start_time} - ${viewingRequest.end_time})`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{viewingRequest.duration_category === 'hourly' ? 'Date' : 'From'}</p>
                  <p className="font-medium">{format(new Date(viewingRequest.start_date), 'dd MMM yyyy')}</p>
                </div>
                {viewingRequest.duration_category === 'full' && (
                  <div>
                    <p className="text-xs text-muted-foreground">To</p>
                    <p className="font-medium">{format(new Date(viewingRequest.end_date), 'dd MMM yyyy')}</p>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Reason</p>
                <p className="text-sm p-2 bg-muted/30 rounded">{viewingRequest.reason}</p>
              </div>

              {/* Approval Workflow */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  Approval Workflow
                </p>
                <div className="p-3 rounded-lg border bg-background space-y-2">
                  <LeaveWorkflowTimeline request={viewingRequest} />
                </div>
              </div>

              {/* Proof Document */}
              {viewingRequest.proof_url && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Supporting Document
                  </p>
                  <a
                    href={viewingRequest.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted/50 transition-colors w-full sm:w-fit"
                  >
                    <ExternalLink className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">View Document</span>
                  </a>
                </div>
              )}

              {/* Remarks Section */}
              {(viewingRequest.hr_remarks || viewingRequest.admin_remarks || viewingRequest.ceo_remarks || viewingRequest.rejection_reason) && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Remarks</p>
                  <div className="space-y-2">
                    {viewingRequest.hr_remarks && (
                      <div className="p-2 rounded bg-muted/30 text-sm">
                        <span className="font-medium">HR: </span>{viewingRequest.hr_remarks}
                      </div>
                    )}
                    {viewingRequest.admin_remarks && (
                      <div className="p-2 rounded bg-muted/30 text-sm">
                        <span className="font-medium">Admin: </span>{viewingRequest.admin_remarks}
                      </div>
                    )}
                    {viewingRequest.ceo_remarks && (
                      <div className="p-2 rounded bg-muted/30 text-sm">
                        <span className="font-medium">CEO: </span>{viewingRequest.ceo_remarks}
                      </div>
                    )}
                    {viewingRequest.rejection_reason && (
                      <div className="p-2 rounded bg-destructive/10 text-sm text-destructive">
                        <span className="font-medium">Rejection Reason: </span>{viewingRequest.rejection_reason}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogType(null); setViewingRequest(null); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
