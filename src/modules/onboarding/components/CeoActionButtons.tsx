/**
 * CeoActionButtons Component
 * 
 * Action buttons for CEO to select or reject a candidate
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface CeoActionButtonsProps {
  requestId: string;
  candidateName: string;
  onSelect: (id: string) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
  isLoading?: boolean;
}

export function CeoActionButtons({
  requestId,
  candidateName,
  onSelect,
  onReject,
  isLoading = false,
}: CeoActionButtonsProps) {
  const [showSelectConfirm, setShowSelectConfirm] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelect = async () => {
    setIsProcessing(true);
    try {
      await onSelect(requestId);
      setShowSelectConfirm(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject(requestId, rejectReason || undefined);
      setShowRejectDialog(false);
      setRejectReason('');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={() => setShowSelectConfirm(true)}
          disabled={isLoading || isProcessing}
          className="bg-green-600 hover:bg-green-700"
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Select
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowRejectDialog(true)}
          disabled={isLoading || isProcessing}
        >
          <XCircle className="w-4 h-4 mr-1" />
          Reject
        </Button>
      </div>

      {/* Select Confirmation Dialog */}
      <Dialog open={showSelectConfirm} onOpenChange={setShowSelectConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Confirm Selection
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to select <strong>{candidateName}</strong>? 
              This will move the candidate to the Admin queue for credential generation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSelectConfirm(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSelect}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? 'Processing...' : 'Confirm Selection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog with Reason */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Reject Candidate
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to reject <strong>{candidateName}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Rejection Reason (Optional)
            </label>
            <Textarea
              placeholder="Enter reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
