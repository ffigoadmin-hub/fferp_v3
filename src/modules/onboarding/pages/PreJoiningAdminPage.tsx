/**
 * PreJoiningAdminPage Component
 * 
 * Admin page for the NEW pre-joining onboarding flow:
 * - Create onboarding invitations (generates username, password, token, link)
 * - Send invitation emails (mandatory - fails completely if email doesn't send)
 * - View pending invitations
 * - Resend emails if needed
 * - No partial success - everything is atomic
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Mail, UserPlus, RefreshCw, CheckCircle, AlertTriangle, Copy, ExternalLink } from 'lucide-react';
import { generateCredentialsPreview } from '../services/prejoiningOnboardingService';
import { 
  createOnboardingUser, 
  resendOnboardingEmail, 
  getPendingInvitations,
  type CreateOnboardingUserParams 
} from '../services/createOnboardingUserService';
import { DEPARTMENT_SHORT_CODES } from '../utils/prejoiningPasswordGenerator';
import type { EmployeeOnboardingRequest } from '../types/prejoining.types';

export function PreJoiningAdminPage() {
  const { toast } = useToast();
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Pending invitations
  const [pendingInvitations, setPendingInvitations] = useState<EmployeeOnboardingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Resend dialog
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<EmployeeOnboardingRequest | null>(null);
  const [isResending, setIsResending] = useState(false);

  const departments = Object.keys(DEPARTMENT_SHORT_CODES);

  // Load pending invitations
  const loadPending = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getPendingInvitations();
      setPendingInvitations(data);
    } catch (error) {
      console.error('[PreJoiningAdmin] Error loading pending:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending invitations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  // Get credential preview
  const credentials = fullName && department 
    ? generateCredentialsPreview(fullName, department)
    : null;

  const handleCreateInvitation = async () => {
    // Validation
    if (!fullName.trim()) {
      toast({ title: 'Error', description: 'Full name is required', variant: 'destructive' });
      return;
    }
    if (!email.trim()) {
      toast({ title: 'Error', description: 'Email is required', variant: 'destructive' });
      return;
    }
    if (!department) {
      toast({ title: 'Error', description: 'Department is required', variant: 'destructive' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ title: 'Error', description: 'Invalid email format', variant: 'destructive' });
      return;
    }

    if (!credentials) {
      toast({ title: 'Error', description: 'Failed to generate credentials', variant: 'destructive' });
      return;
    }

    setIsCreating(true);

    try {
      const params: CreateOnboardingUserParams = {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        department,
        generatedUsername: credentials.username,
        generatedPassword: credentials.password,
      };

      console.log('[PreJoiningAdmin] Creating invitation...', params);
      const result = await createOnboardingUser(params);
      console.log('[PreJoiningAdmin] Result:', result);

      if (result.success && result.emailSent) {
        toast({
          title: 'Success!',
          description: `Invitation sent to ${email}. Email delivered successfully.`,
        });

        // Reset form
        setFullName('');
        setEmail('');
        setDepartment('');

        // Refresh list
        loadPending();
      } else {
        // ATOMIC FAILURE - no partial success
        toast({
          title: 'Failed to Create Invitation',
          description: result.error || 'Invitation could not be created. Email may have failed.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[PreJoiningAdmin] Unexpected error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const openResendDialog = (invitation: EmployeeOnboardingRequest) => {
    setSelectedInvitation(invitation);
    setResendDialogOpen(true);
  };

  const handleResend = async () => {
    if (!selectedInvitation) return;

    setIsResending(true);

    try {
      const result = await resendOnboardingEmail(selectedInvitation.id);

      if (result.success) {
        toast({
          title: 'Email Resent',
          description: `Invitation resent to ${selectedInvitation.email}`,
        });
        setResendDialogOpen(false);
        loadPending();
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Copied to clipboard' });
  };

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Pre-Joining Onboarding</h1>
        <p className="text-gray-400">Create onboarding invitations with automatic email delivery</p>
      </div>

      <div className="grid gap-6">
        {/* Create Invitation Form */}
        <Card className="bg-[#1a1a1a] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-500" />
              Create New Invitation
            </CardTitle>
            <CardDescription className="text-gray-400">
              Enter employee details to generate credentials and send invitation email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-gray-300">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fullName"
                  placeholder="e.g., Arun Kumar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-[#0f0f0f] border-gray-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="e.g., arun@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#0f0f0f] border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department" className="text-gray-300">
                Department <span className="text-red-500">*</span>
              </Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="bg-[#0f0f0f] border-gray-700 text-white">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-gray-700">
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept} className="text-white hover:bg-gray-800">
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Credential Preview */}
            {credentials && (
              <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Generated Credentials Preview</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500 text-xs">Username</Label>
                    <div className="flex items-center gap-2">
                      <code className="text-green-400 font-mono text-sm">{credentials.username}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-500"
                        onClick={() => copyToClipboard(credentials.username)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-xs">Password</Label>
                    <div className="flex items-center gap-2">
                      <code className="text-yellow-400 font-mono text-sm">{credentials.password}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-500"
                        onClick={() => copyToClipboard(credentials.password)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-900/20 border border-blue-800 rounded p-3">
              <p className="text-sm text-blue-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  An email with credentials and onboarding link will be automatically sent.
                  <strong className="block mt-1">If email fails, no account will be created.</strong>
                </span>
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setFullName('');
                  setEmail('');
                  setDepartment('');
                }}
                disabled={isCreating}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Reset
              </Button>
              <Button
                onClick={handleCreateInvitation}
                disabled={isCreating || !fullName || !email || !department}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating & Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Create & Send Invitation
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        <Card className="bg-[#1a1a1a] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white">Pending Invitations</CardTitle>
              <CardDescription className="text-gray-400">
                Employees who have been invited but haven't completed onboarding yet
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadPending}
              disabled={isLoading}
              className="border-gray-700 text-gray-300"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : pendingInvitations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No pending invitations</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800">
                    <TableHead className="text-gray-400">Name</TableHead>
                    <TableHead className="text-gray-400">Email</TableHead>
                    <TableHead className="text-gray-400">Department</TableHead>
                    <TableHead className="text-gray-400">Username</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400">Invited</TableHead>
                    <TableHead className="text-gray-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvitations.map((inv) => (
                    <TableRow key={inv.id} className="border-gray-800">
                      <TableCell className="text-white">{inv.full_name}</TableCell>
                      <TableCell className="text-gray-400">{inv.email}</TableCell>
                      <TableCell className="text-gray-400">{inv.department}</TableCell>
                      <TableCell className="text-green-400 font-mono text-sm">
                        {inv.generated_username}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={inv.email_sent ? "default" : "secondary"}
                          className={inv.email_sent ? "bg-green-600" : "bg-yellow-600"}
                        >
                          {inv.email_sent ? 'Email Sent' : 'Email Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        {(inv as any).invited_at 
                          ? new Date((inv as any).invited_at).toLocaleDateString() 
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openResendDialog(inv)}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <Mail className="w-4 h-4 mr-1" />
                            Resend
                          </Button>
                          {inv.activation_link && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(inv.activation_link!)}
                              className="text-gray-400 hover:text-white"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resend Dialog */}
      <Dialog open={resendDialogOpen} onOpenChange={setResendDialogOpen}>
        <DialogContent className="bg-[#1a1a1a] border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-500" />
              Resend Invitation Email
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Resend the onboarding invitation email to {selectedInvitation?.email}
            </DialogDescription>
          </DialogHeader>

          {selectedInvitation && (
            <div className="py-4 space-y-3">
              <div className="bg-[#0f0f0f] rounded p-3">
                <p className="text-sm text-gray-400">To:</p>
                <p className="text-white">{selectedInvitation.full_name} ({selectedInvitation.email})</p>
              </div>
              <div className="bg-[#0f0f0f] rounded p-3">
                <p className="text-sm text-gray-400">Username:</p>
                <p className="text-green-400 font-mono">{selectedInvitation.generated_username}</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => setResendDialogOpen(false)}
              disabled={isResending}
              className="border-gray-700 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResend}
              disabled={isResending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
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
    </div>
  );
}

export default PreJoiningAdminPage;
