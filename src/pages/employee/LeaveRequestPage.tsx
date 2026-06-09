import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useLeaveRequests, LeaveRequest } from '@/hooks/useLeaveRequests';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { Plus, Loader2, Calendar, CheckCircle, XCircle, Clock, AlertCircle, User, Send, Building2, Crown } from 'lucide-react';
import { GoogleDriveLinkInput } from '@/components/GoogleDriveLinkInput';
import { cn } from '@/lib/utils';

// Leave Request Approval Timeline Component
function LeaveApprovalTimeline({ request }: { request: LeaveRequest }) {
  const getRejecterRole = () => {
    // Determine who rejected based on what stage it was at
    if (request.rejected_by === request.hr_reviewed_by && !request.admin_reviewed_at && !request.ceo_reviewed_at) {
      return 'HR';
    } else if (request.rejected_by === request.admin_reviewed_by && !request.ceo_reviewed_at) {
      return 'Admin';
    } else if (request.rejected_by === request.ceo_reviewed_by) {
      return 'CEO';
    }
    return null;
  };

  const rejecterRole = request.status === 'rejected' ? getRejecterRole() : null;

  return (
    <div className="mt-4 p-4 rounded-lg bg-muted/20 border border-border">
      <p className="text-sm font-medium mb-4 flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        Approval Timeline
      </p>

      <div className="space-y-4">
        {/* Applied Step */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Send className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Applied</p>
              <Badge variant="outline" className="text-xs">You</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(request.created_at), 'dd MMM yyyy, HH:mm')}
            </p>
          </div>
        </div>

        {/* Connector */}
        <div className="ml-4 border-l-2 border-dashed border-border h-2"></div>

        {/* HR Review Step */}
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            request.hr_reviewed_at
              ? (rejecterRole === 'HR' ? "bg-status-missed/20" : "bg-status-live/20")
              : "bg-muted/50"
          )}>
            {request.hr_reviewed_at ? (
              rejecterRole === 'HR' ? (
                <XCircle className="w-4 h-4 text-status-missed" />
              ) : (
                <CheckCircle className="w-4 h-4 text-status-live" />
              )
            ) : (
              <Clock className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">
                {rejecterRole === 'HR' ? 'HR Rejected' : request.hr_reviewed_at ? 'HR Approved' : 'HR Review'}
              </p>
              {request.hr_reviewer_name && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <User className="w-3 h-3" />
                  {request.hr_reviewer_name}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {request.hr_reviewed_at
                ? format(new Date(request.hr_reviewed_at), 'dd MMM yyyy, HH:mm')
                : 'Pending...'}
            </p>
            {request.hr_remarks && (
              <p className="text-xs text-muted-foreground mt-1 italic">"{request.hr_remarks}"</p>
            )}
          </div>
        </div>

        {/* Only show further steps if HR approved */}
        {request.hr_reviewed_at && rejecterRole !== 'HR' && (
          <>
            {/* Connector */}
            <div className="ml-4 border-l-2 border-dashed border-border h-2"></div>

            {/* Admin Review Step */}
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                request.admin_reviewed_at
                  ? (rejecterRole === 'Admin' ? "bg-status-missed/20" : "bg-status-live/20")
                  : "bg-muted/50"
              )}>
                {request.admin_reviewed_at ? (
                  rejecterRole === 'Admin' ? (
                    <XCircle className="w-4 h-4 text-status-missed" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-status-live" />
                  )
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">
                    {rejecterRole === 'Admin' ? 'Admin Rejected' : request.admin_reviewed_at ? 'Admin Approved' : 'Admin Review'}
                  </p>
                  {request.admin_reviewer_name && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Building2 className="w-3 h-3" />
                      {request.admin_reviewer_name}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {request.admin_reviewed_at
                    ? format(new Date(request.admin_reviewed_at), 'dd MMM yyyy, HH:mm')
                    : 'Pending...'}
                </p>
                {request.admin_remarks && (
                  <p className="text-xs text-muted-foreground mt-1 italic">"{request.admin_remarks}"</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Only show CEO step if Admin approved */}
        {request.admin_reviewed_at && rejecterRole !== 'Admin' && rejecterRole !== 'HR' && (
          <>
            {/* Connector */}
            <div className="ml-4 border-l-2 border-dashed border-border h-2"></div>

            {/* CEO Review Step */}
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                request.ceo_reviewed_at
                  ? (rejecterRole === 'CEO' ? "bg-status-missed/20" : "bg-status-live/20")
                  : "bg-muted/50"
              )}>
                {request.ceo_reviewed_at ? (
                  rejecterRole === 'CEO' ? (
                    <XCircle className="w-4 h-4 text-status-missed" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-status-live" />
                  )
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">
                    {rejecterRole === 'CEO' ? 'CEO Rejected' : request.ceo_reviewed_at ? 'CEO Approved' : 'CEO Review'}
                  </p>
                  {request.ceo_reviewer_name && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Crown className="w-3 h-3" />
                      {request.ceo_reviewer_name}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {request.ceo_reviewed_at
                    ? format(new Date(request.ceo_reviewed_at), 'dd MMM yyyy, HH:mm')
                    : 'Pending...'}
                </p>
                {request.ceo_remarks && (
                  <p className="text-xs text-muted-foreground mt-1 italic">"{request.ceo_remarks}"</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Final Status Step */}
        {(request.status === 'approved' || request.status === 'rejected') && (
          <>
            {/* Connector */}
            <div className="ml-4 border-l-2 border-dashed border-border h-2"></div>

            <div className="flex items-start gap-3">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                request.status === 'approved' ? "bg-status-live/20" : "bg-status-missed/20"
              )}>
                {request.status === 'approved' ? (
                  <CheckCircle className="w-4 h-4 text-status-live" />
                ) : (
                  <XCircle className="w-4 h-4 text-status-missed" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={cn(
                    "text-sm font-medium",
                    request.status === 'approved' ? "text-status-live" : "text-status-missed"
                  )}>
                    {request.status === 'approved' ? 'Leave Approved' : 'Leave Rejected'}
                  </p>
                  {request.status === 'rejected' && request.rejected_by_name && (
                    <Badge variant="destructive" className="text-xs gap-1">
                      Rejected by {request.rejected_by_name}
                    </Badge>
                  )}
                </div>
                {request.status === 'rejected' && request.rejection_reason && (
                  <p className="text-xs text-status-missed mt-1">
                    Reason: {request.rejection_reason}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function LeaveRequestPage() {
  const { user } = useAuth();
  const { requests, leaveTypes, isLoading, isSaving, createRequest } = useLeaveRequests();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form states
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [durationCategory, setDurationCategory] = useState<'full' | 'hourly'>('full');
  const [shift, setShift] = useState<'first' | 'second' | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);

  const myRequests = requests.filter(r => r.employee_id === user?.id);

  // Check if selected leave type is emergency
  const selectedLeaveType = leaveTypes.find(t => t.id === leaveTypeId);
  const isEmergencyLeave = selectedLeaveType?.name?.toLowerCase().includes('emergency');

  const handleSubmit = async () => {
    const effectiveEndDate = durationCategory === 'hourly' ? startDate : endDate;

    if (!leaveTypeId || !startDate || !effectiveEndDate || !reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validation: Proof required
    if (selectedLeaveType?.requires_proof && !proofUrl) {
      toast.error('Supporting proof (Google Drive link) is required for this leave type');
      return;
    }

    // Validation: Retroactive application
    const isPastDate = new Date(startDate) < new Date(new Date().setHours(0, 0, 0, 0));
    if (isPastDate && !selectedLeaveType?.allow_retroactive) {
      toast.error('This leave type cannot be applied for past dates');
      return;
    }

    // Validation: Custom times for permissions
    if (durationCategory === 'hourly' && (!startTime || !endTime)) {
      toast.error('Please specify start and end times for permission');
      return;
    }

    const result = await createRequest({
      leave_type_id: leaveTypeId,
      start_date: startDate,
      end_date: effectiveEndDate,
      reason,
      proof_url: proofUrl || null,
      duration_category: durationCategory,
      shift,
      start_time: startTime,
      end_time: endTime
    });

    if (result.success) {
      setDialogOpen(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setLeaveTypeId('');
    setStartDate('');
    setEndDate('');
    setReason('');
    setProofUrl('');
    setDurationCategory('full');
    setShift(null);
    setStartTime(null);
    setEndTime(null);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending_hr':
        return { label: 'Waiting for HR', color: 'bg-yellow-500' };
      case 'pending_admin':
        return { label: 'Waiting for Admin', color: 'bg-blue-500' };
      case 'pending_ceo':
        return { label: 'Waiting for CEO', color: 'bg-purple-500' };
      case 'approved':
        return { label: 'Approved', color: 'bg-green-500' };
      case 'rejected':
        return { label: 'Rejected', color: 'bg-red-500' };
      default:
        return { label: status, color: 'bg-gray-500' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Leave Requests</h1>
          <p className="text-sm text-muted-foreground">Apply for leave and track approval status</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Apply for Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <Label>Leave Type *</Label>
                <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedLeaveType?.description && (
                  <p className="mt-1.5 text-xs text-muted-foreground bg-muted/30 p-2 rounded italic">
                    {selectedLeaveType.description}
                  </p>
                )}
              </div>

              {/* Duration Category */}
              <div>
                <Label>Duration Type</Label>
                <div className="flex gap-2 mt-1.5">
                  <Button
                    type="button"
                    variant={durationCategory === 'full' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setDurationCategory('full')}
                  >
                    Full Day
                  </Button>
                  <Button
                    type="button"
                    variant={durationCategory === 'hourly' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => {
                      setDurationCategory('hourly');
                      if (startDate) setEndDate(startDate);
                    }}
                  >
                    Permission
                  </Button>
                </div>
              </div>


              {durationCategory === 'hourly' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={startTime || ''}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={endTime || ''}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className={durationCategory === 'hourly' ? "col-span-2" : ""}>
                  <Label>{durationCategory === 'hourly' ? 'Date' : 'Start Date'} *</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (durationCategory === 'hourly') {
                        setEndDate(e.target.value);
                      }
                    }}
                  />
                </div>
                {durationCategory !== 'hourly' && (
                  <div>
                    <Label>End Date *</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                    />
                  </div>
                )}
              </div>

              {startDate && (endDate || durationCategory === 'hourly') && (
                <div className="p-3 bg-muted rounded-md border border-border">
                  <p className="text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>
                      Duration: <strong>
                        {durationCategory === 'full'
                          ? `${differenceInDays(new Date(endDate), new Date(startDate)) + 1} day(s)`
                          : `Permission (${startTime || '??'} - ${endTime || '??'})`}
                      </strong>
                    </span>
                  </p>
                </div>
              )}

              <div>
                <Label>Reason *</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please provide a reason for your leave request..."
                  rows={3}
                />
              </div>

              {/* Show proof upload for types that require it */}
              {selectedLeaveType?.requires_proof && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-md space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-primary">Proof Required</p>
                      <p className="text-xs text-muted-foreground italic">Required for {selectedLeaveType.name}</p>
                    </div>
                  </div>
                  <GoogleDriveLinkInput
                    value={proofUrl}
                    onChange={setProofUrl}
                    label="Proof Document (Google Drive Link) *"
                    placeholder="https://drive.google.com/..."
                  />
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
                Submit {durationCategory === 'hourly' ? 'Permission' : 'Leave Request'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* My Requests */}
      <div className="space-y-4">
        {myRequests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Leave Requests</h3>
              <p className="text-muted-foreground">You haven't applied for any leaves yet.</p>
            </CardContent>
          </Card>
        ) : (
          myRequests.map(request => {
            const statusInfo = getStatusInfo(request.status);
            const days = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;

            return (
              <Card key={request.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="outline">{request.leave_type_name}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(request.start_date), 'dd MMM')}
                        {request.duration_category === 'full' && ` - ${format(new Date(request.end_date), 'dd MMM yyyy')}`}
                      </span>
                      <span className="text-sm font-medium">
                        (
                        {request.duration_category === 'full'
                          ? `${days} days`
                          : `Permission: ${request.start_time} - ${request.end_time}`
                        }
                        )
                      </span>
                    </div>
                    <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{request.reason}</p>

                  {/* Approval Timeline */}
                  <LeaveApprovalTimeline request={request} />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
