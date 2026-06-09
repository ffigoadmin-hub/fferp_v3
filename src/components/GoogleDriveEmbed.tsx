import React, { useMemo } from 'react';
import { FileText, ExternalLink, Eye, AlertTriangle, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState } from 'react';

interface GoogleDriveEmbedProps {
    url: string;
    label: string;
}

/**
 * Extracts Google Drive file ID from various URL formats and
 * returns an embeddable preview URL
 */
const getGoogleDriveEmbedUrl = (url: string): string | null => {
    if (!url) return null;

    // Pattern 1: https://drive.google.com/file/d/FILE_ID/view
    let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;

    // Pattern 2: https://drive.google.com/open?id=FILE_ID
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;

    // Pattern 3: Direct preview link
    if (url.includes('/preview')) return url;

    return null;
};

export function GoogleDriveEmbed({ url, label }: GoogleDriveEmbedProps) {
    const embedUrl = useMemo(() => getGoogleDriveEmbedUrl(url), [url]);
    const [showAccessWarning, setShowAccessWarning] = useState(true);

    if (!embedUrl) {
        // Fallback to external link if not a valid Drive URL
        return (
            <Button variant="outline" size="sm" asChild className="flex-1 text-xs h-9">
                <a href={url} target="_blank" rel="noopener noreferrer">
                    <Eye className="w-3 h-3 mr-2" /> {label}
                    <ExternalLink className="w-3 h-3 ml-1" />
                </a>
            </Button>
        );
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 text-xs h-9">
                    <Eye className="w-3 h-3 mr-2" /> {label}
                    <FileText className="w-3 h-3 ml-1" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>{label}</span>
                        <Button variant="ghost" size="sm" asChild>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs">
                                <ExternalLink className="w-3 h-3 mr-2" /> Open in Drive
                            </a>
                        </Button>
                    </DialogTitle>
                </DialogHeader>
                
                {showAccessWarning && (
                    <Alert className="mb-4 border-status-pending/50 bg-status-pending/10">
                        <AlertTriangle className="h-4 w-4 text-status-pending" />
                        <AlertTitle className="text-status-pending">Preview may require access</AlertTitle>
                        <AlertDescription className="text-sm text-muted-foreground">
                            <p className="mb-2">
                                If you see "You need access", the document's sharing settings may be restricted.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                                    <a href={url} target="_blank" rel="noopener noreferrer">
                                        <Link2 className="w-3 h-3 mr-1" /> Open Original Link
                                    </a>
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 text-xs"
                                    onClick={() => setShowAccessWarning(false)}
                                >
                                    Dismiss
                                </Button>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}
                
                <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-border">
                    <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allowFullScreen
                        title={label}
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
