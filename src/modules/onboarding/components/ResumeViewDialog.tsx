/**
 * ResumeViewDialog Component
 * 
 * Modal dialog for viewing candidate resumes
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Download, ExternalLink } from 'lucide-react';
import { getResumeSignedUrl } from '../services/onboardingService';
import { useState, useEffect } from 'react';

interface ResumeViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  resumeUrl: string | null;
  resumePath: string | null;
  candidateName: string;
}

export function ResumeViewDialog({
  isOpen,
  onClose,
  resumeUrl,
  resumePath,
  candidateName,
}: ResumeViewDialogProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && resumePath) {
      setIsLoading(true);
      getResumeSignedUrl(resumePath)
        .then((url) => {
          setSignedUrl(url);
        })
        .catch((error) => {
          console.error('Error getting signed URL:', error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, resumePath]);

  const viewUrl = signedUrl || resumeUrl;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Resume - {candidateName}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : viewUrl ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-4">
                  Resume is ready for viewing. You can open it in a new tab or download.
                </p>
                <div className="flex gap-2">
                  <Button asChild variant="outline">
                    <a
                      href={viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in New Tab
                    </a>
                  </Button>
                  <Button asChild>
                    <a
                      href={viewUrl}
                      download={`${candidateName.replace(/\s+/g, '_')}_resume.pdf`}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </Button>
                </div>
              </div>

              {/* Preview for images */}
              {(viewUrl.endsWith('.jpg') || viewUrl.endsWith('.jpeg') || viewUrl.endsWith('.png')) && (
                <div className="border rounded-lg overflow-hidden">
                  <img
                    src={viewUrl}
                    alt={`${candidateName}'s resume`}
                    className="max-w-full h-auto"
                  />
                </div>
              )}

              {/* PDF Preview iframe */}
              {viewUrl.includes('.pdf') && (
                <div className="border rounded-lg overflow-hidden h-96">
                  <iframe
                    src={viewUrl}
                    title={`${candidateName}'s resume`}
                    className="w-full h-full"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No resume available</p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
