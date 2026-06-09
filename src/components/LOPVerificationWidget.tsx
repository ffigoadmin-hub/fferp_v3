import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useLOPEntries } from '@/hooks/useLOPEntries';
import { format } from 'date-fns';
import { Check, X, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LOPVerificationWidgetProps {
  role: 'boi' | 'admin' | 'ceo';
}

export function LOPVerificationWidget({ role }: LOPVerificationWidgetProps) {
  const statusFilter = role === 'boi' ? 'pending_admin' : role === 'admin' ? 'pending_admin' : 'pending_ceo';
  const { entries, isLoading, isSaving, verifyEntry, approveEntry, getLOPValue } = useLOPEntries(statusFilter);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const getLOPTypeLabel = (type: string) => {
    switch (type) {
      case '1_day': return '1 Day';
      case '0.5_day': return '0.5 Day';
      case '0.25_day': return '0.25 Day';
      case '0.1_day': return '0.1 Day';
      default: return type;
    }
  };

  const handleApprove = async (id: string) => {
    if (role === 'boi' || role === 'admin') {
      await verifyEntry(id, 'verify');
    } else {
      await approveEntry(id, 'approve');
    }
  };

  const handleReject = async () => {
    if (!selectedEntry) return;

    if (role === 'boi' || role === 'admin') {
      await verifyEntry(selectedEntry, 'reject', rejectionReason);
    } else {
      await approveEntry(selectedEntry, 'reject', rejectionReason);
    }

    setRejectDialogOpen(false);
    setSelectedEntry(null);
    setRejectionReason('');
  };

  const openRejectDialog = (id: string) => {
    setSelectedEntry(id);
    setRejectDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-status-late" />
                {role === 'boi' ? 'LOP Verification Queue' : role === 'admin' ? 'LOP Verification Queue' : 'LOP Approval Queue'}
              </CardTitle>
              <CardDescription>
                {role === 'boi'
                  ? 'Verify LOP entries before forwarding to Admin'
                  : role === 'admin'
                    ? 'Verify LOP entries before forwarding to CEO'
                    : 'Final approval for payroll deduction'}
              </CardDescription>
            </div>
            {entries.length > 0 && (
              <Badge variant="destructive" className="text-lg px-3 py-1">
                {entries.length} Pending
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No pending {role === 'boi' ? 'verifications' : role === 'admin' ? 'verifications' : 'approvals'}</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Evidence</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(entry.lop_date), 'dd MMM')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{entry.employee_name}</p>
                          <p className="text-xs text-muted-foreground">{entry.employee_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getLOPTypeLabel(entry.lop_type)}</Badge>
                      </TableCell>
                      <TableCell className="font-mono font-semibold">
                        {getLOPValue(entry.lop_type)}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate text-sm" title={entry.reason}>
                          {entry.reason}
                        </p>
                      </TableCell>
                      <TableCell>
                        {entry.evidence_url === 'SYSTEM_AUTO' ? (
                          <Badge variant="outline" className="text-xs bg-muted">
                            Auto-Generated
                          </Badge>
                        ) : (
                          <a
                            href={entry.evidence_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 text-sm"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(entry.id)}
                            disabled={isSaving}
                            className="bg-status-live hover:bg-status-live/80"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            {role === 'ceo' ? 'Approve' : 'Verify'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openRejectDialog(entry.id)}
                            disabled={isSaving}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject LOP Entry</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection (optional)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
