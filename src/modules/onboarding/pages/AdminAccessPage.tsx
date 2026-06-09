/**
 * AdminAccessPage Component
 * 
 * Admin page for processing CEO-approved onboarding requests
 * - View all candidates with status = ceo_selected
 * - Auto-generate username and password
 * - Send credentials email
 * - Create Supabase Auth user and profile
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Eye, Loader2, Mail, UserCheck, Shield, CheckCircle, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { OnboardingStatusBadge } from '../components/OnboardingStatusBadge';
import { ResumeViewDialog } from '../components/ResumeViewDialog';
import { AdminCredentialPreview } from '../components/AdminCredentialPreview';
import { supabase } from '@/integrations/supabase/client';
import {
  getAdminQueue,
  generateCredentialsSync,
  completeAdminApproval,
  resendOnboardingEmail,
  type CompleteAdminApprovalParams,
} from '../services/onboardingService';
import type { OnboardingRequest } from '../types/onboarding.types';

type RequestWithCredentials = OnboardingRequest & {
  generated_username?: string;
  generated_password_temp?: string;
};

export function AdminAccessPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<RequestWithCredentials[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const processingRef = useRef<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RequestWithCredentials | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  
  // Resume dialog state
  const [selectedResume, setSelectedResume] = useState<{
    url: string | null;
    path: string | null;
    name: string;
  } | null>(null);

  // Resend dialog state
  const [showResendDialog, setShowResendDialog] = useState(false);
  const [resendRequest, setResendRequest] = useState<RequestWithCredentials | null>(null);
  const [isResending, setIsResending] = useState(false);

  // Delete dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState<RequestWithCredentials | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      console.log('[AdminAccess] Fetching admin queue...');
      const data = await getAdminQueue();
      console.log('[AdminAccess] Raw data from API:', data?.length || 0, 'records');
      
      // Auto-generate credentials for requests that don't have them
      // Use safe per-row error handling so one bad row doesn't crash the page
      const withCredentials = data.map((request) => {
        try {
          console.log('[AdminAccess] Processing request:', request.id, request.full_name);
          
          // Normalize field names - handle both full_name and name
          const fullName = request.full_name || (request as any).name || '';
          const department = request.department || '';
          
          if (!fullName) {
            console.warn('[AdminAccess] Empty full_name for request:', request.id);
          }
          
          if (!request.generated_username || !request.generated_password_temp) {
            const creds = generateCredentialsSync(fullName, department);
            return {
              ...request,
              generated_username: creds.username,
              generated_password_temp: creds.password,
            };
          }
          return request as RequestWithCredentials;
        } catch (rowError) {
          console.error('[AdminAccess] Credential generation failed for request:', request.id, rowError);
          // Return request with fallback empty credentials so page still loads
          return {
            ...request,
            generated_username: 'error',
            generated_password_temp: 'error',
            _credential_error: true,
          } as RequestWithCredentials;
        }
      });
      
      console.log('[AdminAccess] Final processed requests:', withCredentials.length);
      setRequests(withCredentials);
    } catch (error) {
      console.error('[AdminAccess] Error fetching admin queue:', error);
      // Only show toast for actual API errors, not credential generation issues
      toast({
        title: 'Error',
        description: 'Failed to fetch admin queue from server',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleRegenerateCredentials = (requestId: string) => {
    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          try {
            // Normalize field names
            const fullName = req.full_name || (req as any).name || '';
            const department = req.department || '';
            
            const creds = generateCredentialsSync(fullName, department);
            return {
              ...req,
              generated_username: creds.username,
              generated_password_temp: creds.password,
              _credential_error: false,
            };
          } catch (error) {
            console.error('[AdminAccess] Regenerate failed for request:', requestId, error);
            return {
              ...req,
              generated_username: 'error',
              generated_password_temp: 'error',
              _credential_error: true,
            };
          }
        }
        return req;
      })
    );
  };

  const openSendConfirm = (request: RequestWithCredentials) => {
    setSelectedRequest(request);
    setShowSendConfirm(true);
  };

  const handleSendCredentials = async () => {
    if (!selectedRequest) return;
    
    // DOUBLE-CLICK PREVENTION: Use ref for synchronous check, state for UI
    if (processingRef.current) {
      return;
    }
    processingRef.current = selectedRequest.id;
    setIsProcessing(selectedRequest.id);

    // Validate session before proceeding
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData?.session?.access_token) {
      toast({
        title: 'Session Expired',
        description: 'Your session has expired. Please log in again.',
        variant: 'destructive',
      });
      processingRef.current = null;
      setIsProcessing(null);
      return;
    }

    try {
      // Validate all required fields before calling the edge function
      const missingFields: string[] = [];
      if (!selectedRequest.id) missingFields.push('onboardingId');
      if (!selectedRequest.generated_username) missingFields.push('generatedUsername');
      if (!selectedRequest.generated_password_temp) missingFields.push('generatedPassword');
      if (!selectedRequest.full_name) missingFields.push('fullName');
      if (!selectedRequest.email) missingFields.push('email');
      if (!selectedRequest.department) missingFields.push('department');

      if (missingFields.length > 0) {
        console.error('[AdminAccess] Missing required fields:', missingFields);
        toast({
          title: 'Missing Information',
          description: `Cannot create account. Missing: ${missingFields.join(', ')}. Please refresh and try again.`,
          variant: 'destructive',
        });
        setIsProcessing(null);
        return;
      }

      const params: CompleteAdminApprovalParams = {
        onboardingId: selectedRequest.id,
        generatedUsername: selectedRequest.generated_username!,
        generatedPassword: selectedRequest.generated_password_temp!,
        fullName: selectedRequest.full_name,
        email: selectedRequest.email,
        department: selectedRequest.department,
      };

      // Use atomic function - all or nothing
      const result = await completeAdminApproval(params);

      // STRICT SUCCESS CHECK: Must have success=true AND emailSent=true (or data.emailSent=true)
      const isSuccess = result.success === true;
      const isEmailSent = result.emailSent === true || result.data?.emailSent === true;
      const isAlreadyCompleted = result.data?.alreadyCompleted === true;

      if (isSuccess && (isEmailSent || isAlreadyCompleted)) {
        // SUCCESS CASE
        toast({
          title: isAlreadyCompleted ? 'Already Completed' : 'Success!',
          description: isAlreadyCompleted
            ? `Onboarding was already completed for ${selectedRequest.full_name}.`
            : `Account created and credentials sent to ${selectedRequest.email}`,
        });

        // Remove from list immediately for better UX
        setRequests((prev) => prev.filter((r) => r.id !== selectedRequest.id));

        // Close modal and clear selection
        setShowSendConfirm(false);
        setSelectedRequest(null);

        // Refresh the list to ensure sync with server
        await fetchRequests();
      } else if (isSuccess && !isEmailSent) {
        // EDGE CASE: Success but email not sent (shouldn't happen with atomic design)
        toast({
          title: 'Account Created',
          description: `Account created for ${selectedRequest.full_name}, but email could not be sent. Please try resending.`,
          variant: 'destructive',
        });
        setShowSendConfirm(false);
        setSelectedRequest(null);
      } else {
        // FAILURE CASE
        console.error('[AdminAccess] Failed to create account:', result);

        const errorMsg = result.error || result.message || '';
        const stepMsg  = result.step  ? ` (Step: ${result.step})` : '';

        const isAuthError  = /invalid jwt|401|unauthorized/i.test(errorMsg);
        const isEmailError = result.step === 'send_email' ||
                             /not verified|resend|domain|email/i.test(errorMsg);

        if (isAuthError) {
          toast({
            title: 'Session Expired',
            description: 'Your admin session has expired. Please log out and log in again.',
            variant: 'destructive',
          });
        } else if (isEmailError) {
          toast({
            title: 'Email Sending Failed',
            description:
              `The welcome email could not be sent — account was NOT created (rolled back). ` +
              `Check Resend domain verification or ask your system admin to set RESEND_FROM_EMAIL.${stepMsg}`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Failed to Create Account',
            description: `${errorMsg || 'Account could not be created. Please try again.'}${stepMsg}`,
            variant: 'destructive',
          });
        }

        if (result.details) {
          console.error('[AdminAccess] Error details:', result.details);
        }
      }
    } catch (error) {
      console.error('[AdminAccess] handleSendCredentials ERROR:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      processingRef.current = null;
      setIsProcessing(null);
    }
  };

  const openResume = (request: OnboardingRequest) => {
    setSelectedResume({
      url: request.resume_url,
      path: request.resume_path,
      name: request.full_name,
    });
  };

  const openResendDialog = (request: RequestWithCredentials) => {
    setResendRequest(request);
    setShowResendDialog(true);
  };

  const openDeleteConfirm = (request: RequestWithCredentials) => {
    setDeleteRequest(request);
    setShowDeleteConfirm(true);
  };

  const handleDeleteRequest = async () => {
    if (!deleteRequest) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('onboarding_requests')
        .delete()
        .eq('id', deleteRequest.id);

      if (error) throw error;

      setRequests((prev) => prev.filter((r) => r.id !== deleteRequest.id));
      toast({ title: 'Deleted', description: `${deleteRequest.full_name} has been removed from the queue.` });
      setShowDeleteConfirm(false);
      setDeleteRequest(null);
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Could not delete request.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResendEmail = async () => {
    if (!resendRequest) return;

    setIsResending(true);
    try {
      const result = await resendOnboardingEmail(resendRequest.id);

      if (result.success) {
        toast({
          title: 'Email Resent',
          description: `Credentials resent to ${resendRequest.email}`,
        });
        setShowResendDialog(false);
        setResendRequest(null);
      } else {
        toast({
          title: 'Failed to Resend',
          description: result.error || 'Could not resend email',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resend email',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>Admin Access - Onboarding Queue</CardTitle>
                <CardDescription>
                  Generate credentials and send login details to approved candidates
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-sm">
              {requests.length} Pending
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No pending requests</p>
              <p className="text-sm">All CEO-approved candidates have been processed</p>
            </div>
          ) : (
            <div className="space-y-6">
              {requests.map((request) => (
                <Card key={request.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Left: Candidate Info */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg">{request.full_name}</h3>
                          <OnboardingStatusBadge status={request.status} />
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <p>
                            <span className="text-muted-foreground">Email:</span>{' '}
                            {request.email}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Department:</span>{' '}
                            {request.department}
                          </p>
                          <p>
                            <span className="text-muted-foreground">CEO Approved:</span>{' '}
                            {request.ceo_action_at
                              ? new Date(request.ceo_action_at).toLocaleDateString('en-IN')
                              : 'N/A'}
                          </p>
                        </div>

                        {request.resume_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResume(request)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Resume
                          </Button>
                        )}
                      </div>

                      {/* Right: Credentials & Action */}
                      <div className="space-y-4">
                        {request.generated_username && request.generated_password_temp && (
                          <AdminCredentialPreview
                            username={request.generated_username}
                            password={request.generated_password_temp}
                            fullName={request.full_name}
                            onRegenerate={() => handleRegenerateCredentials(request.id)}
                          />
                        )}

                        <div className="flex gap-2">
                          <Button
                            onClick={() => openSendConfirm(request)}
                            disabled={isProcessing === request.id}
                            className="flex-1"
                          >
                            {isProcessing === request.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Mail className="w-4 h-4 mr-2" />
                                Send Credentials & Create Account
                              </>
                            )}
                          </Button>
                          
                          <Button
                            variant="outline"
                            onClick={() => openResendDialog(request)}
                            disabled={isProcessing === request.id}
                            title="Resend credentials email"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="outline"
                            onClick={() => openDeleteConfirm(request)}
                            disabled={isProcessing === request.id}
                            title="Delete request"
                            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Confirmation Dialog */}
      <Dialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Account Creation
            </DialogTitle>
            <DialogDescription>
              This will create a new user account and send login credentials to{' '}
              <strong>{selectedRequest?.email}</strong>. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="py-4">
              <AdminCredentialPreview
                username={selectedRequest.generated_username!}
                password={selectedRequest.generated_password_temp!}
                fullName={selectedRequest.full_name}
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSendConfirm(false)}
              disabled={!!isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendCredentials}
              disabled={!!isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm & Send
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resend Email Dialog */}
      <Dialog open={showResendDialog} onOpenChange={setShowResendDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-500" />
              Resend Credentials Email
            </DialogTitle>
            <DialogDescription>
              Resend the onboarding email with credentials to{' '}
              <strong>{resendRequest?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          {resendRequest && (
            <div className="py-4">
              <AdminCredentialPreview
                username={resendRequest.generated_username!}
                password={resendRequest.generated_password_temp!}
                fullName={resendRequest.full_name}
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowResendDialog(false)}
              disabled={isResending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResendEmail}
              disabled={isResending}
            >
              {isResending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Resend Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Delete Request
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <strong>{deleteRequest?.full_name}</strong> from the onboarding queue? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRequest}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resume View Dialog */}
      {selectedResume && (
        <ResumeViewDialog
          isOpen={!!selectedResume}
          onClose={() => setSelectedResume(null)}
          resumeUrl={selectedResume.url}
          resumePath={selectedResume.path}
          candidateName={selectedResume.name}
        />
      )}
    </div>
  );
}

export default AdminAccessPage;
