import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Download, Eye, Check, X, Upload, FileText } from "lucide-react";
import { 
  getSalaryApprovals, 
  updateSalaryApprovalByCEO, 
  executeSalaryByAccounts, 
  auditSalaryByAuditor,
  auditSalaryByDirector,
  getSalaryFileUrl,
  SalaryApprovalWithDetails 
} from '../services/salaryApprovalService';
import { supabase } from '@/integrations/supabase/client';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary">Pending Auditor Review</Badge>;
    case 'auditor_audited':
      return <Badge variant="secondary">Audited by Auditor</Badge>;
    case 'auditor_rejected':
      return <Badge variant="destructive">Auditor Rejected</Badge>;
    case 'director_audited':
      return <Badge variant="secondary">Audited by Director</Badge>;
    case 'director_rejected':
      return <Badge variant="destructive">Director Rejected</Badge>;
    case 'ceo_approved':
      return <Badge variant="default">CEO Approved</Badge>;
    case 'ceo_rejected':
      return <Badge variant="destructive">CEO Rejected</Badge>;
    case 'account_executed':
      return <Badge variant="default" className="bg-green-600">Account Executed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export default function SalaryApprovalPage() {
  const [selectedApproval, setSelectedApproval] = useState<SalaryApprovalWithDetails | null>(null);
  const [auditorComment, setAuditorComment] = useState('');
  const [directorComment, setDirectorComment] = useState('');
  const [ceoComment, setCeoComment] = useState('');
  const [accountComment, setAccountComment] = useState('');
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: approvals = [], isLoading, error, refetch } = useQuery({
    queryKey: ['salary-approvals'],
    queryFn: getSalaryApprovals,
  });

  const [userRole, setUserRole] = useState<string>('');
  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        setUserRole(profile?.role || '');
      }
    };
    checkUserRole();
  }, []);

  const auditorMutation = useMutation({
    mutationFn: ({ id, status, comment }: { id: string; status: 'auditor_audited' | 'auditor_rejected'; comment?: string }) =>
      auditSalaryByAuditor(id, status, comment),
    onSuccess: () => {
      toast.success('Salary audit updated successfully');
      setSelectedApproval(null);
      setAuditorComment('');
      queryClient.invalidateQueries({ queryKey: ['salary-approvals'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update audit')
  });

  const directorMutation = useMutation({
    mutationFn: ({ id, status, comment }: { id: string; status: 'director_audited' | 'director_rejected'; comment?: string }) =>
      auditSalaryByDirector(id, status, comment),
    onSuccess: () => {
      toast.success('Salary audit updated successfully');
      setSelectedApproval(null);
      setDirectorComment('');
      queryClient.invalidateQueries({ queryKey: ['salary-approvals'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update audit')
  });

  const ceoMutation = useMutation({
    mutationFn: ({ id, status, comment }: { id: string; status: 'ceo_approved' | 'ceo_rejected'; comment?: string }) =>
      updateSalaryApprovalByCEO(id, status, comment),
    onSuccess: () => {
      toast.success('Salary approval updated successfully');
      setSelectedApproval(null);
      setCeoComment('');
      queryClient.invalidateQueries({ queryKey: ['salary-approvals'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update approval')
  });

  const accountMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      executeSalaryByAccounts(id, comment),
    onSuccess: () => {
      toast.success('Salary executed by accounts successfully');
      setSelectedApproval(null);
      setAccountComment('');
      queryClient.invalidateQueries({ queryKey: ['salary-approvals'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to execute salary')
  });

  const downloadFile = async (approval: SalaryApprovalWithDetails) => {
    try {
      setIsDownloading(approval.id);
      const url = await getSalaryFileUrl(approval.file_path);
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = approval.file_name;
        link.click();
        toast.success('File downloaded successfully');
      }
    } catch (error) {
      toast.error('Failed to download file');
    } finally {
      setIsDownloading(null);
    }
  };

  const filteredApprovals = approvals.filter(approval => {
    const lowerRole = userRole.toLowerCase();
    if (lowerRole === 'auditor') {
      return approval.status === 'pending';
    } else if (lowerRole === 'director') {
      return approval.status === 'auditor_audited';
    } else if (lowerRole === 'ceo') {
      return approval.status === 'director_audited';
    } else if (lowerRole === 'accounts') {
      return approval.status === 'ceo_approved';
    }
    return true; // HR can see all
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading salary approvals...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600">Error loading salary approvals</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Salary Approval Management
          </CardTitle>
          <CardDescription>
            Manage payroll approvals - HR uploads, Auditor & Director audits, CEO reviews, Accounts executes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month/Year</TableHead>
                <TableHead>Day Range</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latest Comment</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApprovals.map((approval) => (
                <TableRow key={approval.id}>
                  <TableCell>
                    {MONTHS.find(m => m.value === approval.month)?.label} {approval.year}
                  </TableCell>
                  <TableCell>Days {approval.from_day}-{approval.to_day}</TableCell>
                  <TableCell className="max-w-xs truncate">{approval.file_name}</TableCell>
                  <TableCell>{approval.uploader_name || 'Unknown'}</TableCell>
                  <TableCell>{getStatusBadge(approval.status)}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {approval.account_comment || approval.ceo_comment || approval.director_comment || approval.auditor_comment || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadFile(approval)}
                        disabled={isDownloading === approval.id}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        {isDownloading === approval.id ? 'Downloading...' : 'Download'}
                      </Button>
                      
                      {userRole.toLowerCase() === 'auditor' && approval.status === 'pending' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setSelectedApproval(approval)}>
                              <Eye className="w-4 h-4 mr-1" />
                              Audit
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Audit Salary File</DialogTitle>
                              <DialogDescription>
                                Audit and approve or reject the salary submission for {MONTHS.find(m => m.value === selectedApproval?.month)?.label} {selectedApproval?.year}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="auditor-comment">Auditor Comment</Label>
                                <Textarea
                                  id="auditor-comment"
                                  placeholder="Enter your comments..."
                                  value={auditorComment}
                                  onChange={(e) => setAuditorComment(e.target.value)}
                                  rows={3}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => selectedApproval && auditorMutation.mutate({ id: selectedApproval.id, status: 'auditor_audited', comment: auditorComment })}
                                  disabled={auditorMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="w-4 h-4 mr-2" />
                                  Audit Complete
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => selectedApproval && auditorMutation.mutate({ id: selectedApproval.id, status: 'auditor_rejected', comment: auditorComment })}
                                  disabled={auditorMutation.isPending}
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}

                      {userRole.toLowerCase() === 'director' && approval.status === 'auditor_audited' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setSelectedApproval(approval)}>
                              <Eye className="w-4 h-4 mr-1" />
                              Audit
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Audit Salary File</DialogTitle>
                              <DialogDescription>
                                Audit and approve or reject the salary submission for {MONTHS.find(m => m.value === selectedApproval?.month)?.label} {selectedApproval?.year}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="director-comment">Director Comment</Label>
                                <Textarea
                                  id="director-comment"
                                  placeholder="Enter your comments..."
                                  value={directorComment}
                                  onChange={(e) => setDirectorComment(e.target.value)}
                                  rows={3}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => selectedApproval && directorMutation.mutate({ id: selectedApproval.id, status: 'director_audited', comment: directorComment })}
                                  disabled={directorMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="w-4 h-4 mr-2" />
                                  Audit Complete
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => selectedApproval && directorMutation.mutate({ id: selectedApproval.id, status: 'director_rejected', comment: directorComment })}
                                  disabled={directorMutation.isPending}
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      
                      {userRole.toLowerCase() === 'ceo' && approval.status === 'director_audited' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setSelectedApproval(approval)}>
                              <Eye className="w-4 h-4 mr-1" />
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Review Salary Approval</DialogTitle>
                              <DialogDescription>
                                Review and approve or reject the salary submission for {MONTHS.find(m => m.value === selectedApproval?.month)?.label} {selectedApproval?.year}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="ceo-comment">CEO Comment</Label>
                                <Textarea
                                  id="ceo-comment"
                                  placeholder="Enter your comments..."
                                  value={ceoComment}
                                  onChange={(e) => setCeoComment(e.target.value)}
                                  rows={3}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => selectedApproval && ceoMutation.mutate({ id: selectedApproval.id, status: 'ceo_approved', comment: ceoComment })}
                                  disabled={ceoMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="w-4 h-4 mr-2" />
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => selectedApproval && ceoMutation.mutate({ id: selectedApproval.id, status: 'ceo_rejected', comment: ceoComment })}
                                  disabled={ceoMutation.isPending}
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      
                      {userRole.toLowerCase() === 'accounts' && approval.status === 'ceo_approved' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setSelectedApproval(approval)}>
                              <Check className="w-4 h-4 mr-1" />
                              Execute
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Accounts Execution</DialogTitle>
                              <DialogDescription>
                                Execute the salary processing for {MONTHS.find(m => m.value === selectedApproval?.month)?.label} {selectedApproval?.year}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="account-comment">Accounts Comment</Label>
                                <Textarea
                                  id="account-comment"
                                  placeholder="Enter your comments..."
                                  value={accountComment}
                                  onChange={(e) => setAccountComment(e.target.value)}
                                  rows={3}
                                />
                              </div>
                              <Button
                                onClick={() => selectedApproval && accountMutation.mutate({ id: selectedApproval.id, comment: accountComment })}
                                disabled={accountMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Check className="w-4 h-4 mr-2" />
                                Mark as Executed
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredApprovals.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {userRole.toLowerCase() === 'auditor' ? 'No pending auditor reviews' :
               userRole.toLowerCase() === 'director' ? 'No pending director reviews' :
               userRole.toLowerCase() === 'ceo' ? 'No pending CEO approvals' : 
               userRole.toLowerCase() === 'accounts' ? 'No pending account executions' : 
               'No salary approvals found'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
