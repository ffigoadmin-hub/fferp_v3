import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Download, FileText, Image, X, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface DocumentPreviewModalProps {
  url: string | null;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentPreviewModal({ url, title, open, onOpenChange }: DocumentPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Detect file type from URL
  const isImage = url ? /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url) : false;
  const isPDF = url ? /\.pdf(\?|$)/i.test(url) : false;
  const isGoogleDrive = url ? /drive\.google\.com|docs\.google\.com|sheets\.google\.com|slides\.google\.com/i.test(url) : false;

  // Convert Google Drive view URLs to preview URLs to allow embedding
  let embedUrl = url;
  if (isGoogleDrive && url) {
    if (url.includes('/view')) {
      embedUrl = url.replace(/\/view(\?.*)?$/, '/preview$1');
    } else if (url.includes('/edit')) {
      embedUrl = url.replace(/\/edit(\?.*)?$/, '/preview$1');
    }
  }
  useEffect(() => {
    if (open) {
      if (url) {
        setIsLoading(true);
        setHasError(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [url, open]);

  if (!url) return null;



  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2 flex-1 min-w-0">
              {isImage ? <Image className="w-5 h-5 flex-shrink-0" /> : <FileText className="w-5 h-5 flex-shrink-0" />}
              <span className="truncate">{title}</span>
            </DialogTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" asChild>
                <a href={url} download target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4 mr-2" /> Download
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" /> Open in New Tab
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-9 w-9 rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-[60vh] bg-muted/30 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {hasError ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-semibold text-muted-foreground mb-2">Unable to preview</p>
              <p className="text-sm text-muted-foreground mb-4">
                This file type cannot be previewed directly. Please download or open in a new tab.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={url} download target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-2" /> Download
                  </a>
                </Button>
                <Button variant="default" size="sm" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" /> Open in New Tab
                  </a>
                </Button>
              </div>
            </div>
          ) : isGoogleDrive ? (
            <iframe
              src={embedUrl || ''}
              className="w-full h-full min-h-[70vh] border-0 bg-white"
              title={title}
              onLoad={handleLoad}
              onError={handleError}
              allow="autoplay"
              loading="eager"
            />
          ) : isImage ? (
            <div className="flex items-center justify-center p-4 min-h-full">
              <img
                src={url}
                alt={title}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                onLoad={handleLoad}
                onError={handleError}
              />
            </div>
          ) : isPDF ? (
            <iframe
              src={url}
              className="w-full h-full min-h-[70vh] border-0"
              title={title}
              onLoad={handleLoad}
              onError={handleError}
            />
          ) : (
            // For other file types, try iframe first, fall back to error
            <iframe
              src={url}
              className="w-full h-full min-h-[70vh] border-0"
              title={title}
              onLoad={handleLoad}
              onError={handleError}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
