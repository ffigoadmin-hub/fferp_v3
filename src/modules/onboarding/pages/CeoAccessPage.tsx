/**
 * CeoAccessPage Component
 * 
 * CEO page for reviewing pending onboarding requests
 * - View all candidates with status = pending_ceo_review
 * - View resumes
 * - Select or reject candidates
 */

import { useState, useEffect } from 'react';
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
import { Eye, Loader2, Shield, UserCheck, UserX, FileText } from 'lucide-react';
import { OnboardingStatusBadge } from '../components/OnboardingStatusBadge';
import { ResumeViewDialog } from '../components/ResumeViewDialog';
import { CeoActionButtons } from '../components/CeoActionButtons';
import {
  getPendingCeoRequests,
  getCeoApprovedHistory,
  selectByCeo,
  rejectByCeo,
} from '../services/onboardingService';
import type { OnboardingRequest } from '../types/onboarding.types';

export function CeoAccessPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'pending' | 'history'>('pending');
  
  // Resume dialog state
  const [selectedResume, setSelectedResume] = useState<{
    url: string | null;
    path: string | null;
    name: string;
  } | null>(null);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const data = activeView === 'pending'
        ? await getPendingCeoRequests()
        : await getCeoApprovedHistory();
      setRequests(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: activeView === 'pending'
          ? 'Failed to fetch pending requests'
          : 'Failed to fetch approved history',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [activeView]);

  const handleSelect = async (id: string) => {
    setIsProcessing(id);
    try {
      const result = await selectByCeo(id);
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Candidate has been selected and moved to Admin queue',
        });
        // Remove from list
        setRequests((prev) => prev.filter((r) => r.id !== id));
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to select candidate',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    setIsProcessing(id);
    try {
      const result = await rejectByCeo(id, reason);
      if (result.success) {
        toast({
          title: 'Candidate Rejected',
          description: reason 
            ? 'Candidate has been rejected with reason'
            : 'Candidate has been rejected',
        });
        // Remove from list
        setRequests((prev) => prev.filter((r) => r.id !== id));
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to reject candidate',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
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
                <CardTitle>CEO Review - Onboarding Requests</CardTitle>
                <CardDescription>
                  {activeView === 'pending'
                    ? 'Review and approve new employee onboarding requests'
                    : 'History of CEO-approved onboarding requests'}
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-sm">
              {requests.length} {activeView === 'pending' ? 'Pending' : 'Approved History'}
            </Badge>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              variant={activeView === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveView('pending')}
            >
              Pending Review
            </Button>
            <Button
              variant={activeView === 'history' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveView('history')}
            >
              Approved History
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">
                {activeView === 'pending' ? 'No pending requests' : 'No approved history yet'}
              </p>
              <p className="text-sm">
                {activeView === 'pending'
                  ? 'All onboarding requests have been reviewed'
                  : 'Approved onboarding requests will appear here'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>{activeView === 'pending' ? 'Submitted' : 'Approved On'}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resume</TableHead>
                    <TableHead className="text-right">{activeView === 'pending' ? 'Actions' : 'Review'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.full_name}
                      </TableCell>
                      <TableCell>{request.department}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date((activeView === 'pending' ? request.created_at : (request.ceo_action_at || request.created_at))).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <OnboardingStatusBadge status={request.status} />
                      </TableCell>
                      <TableCell>
                        {request.resume_url ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResume(request)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">No resume</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {activeView === 'pending' ? (
                          <CeoActionButtons
                            requestId={request.id}
                            candidateName={request.full_name}
                            onSelect={handleSelect}
                            onReject={handleReject}
                            isLoading={isProcessing === request.id}
                          />
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResume(request)}
                            disabled={!request.resume_url}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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

export default CeoAccessPage;
