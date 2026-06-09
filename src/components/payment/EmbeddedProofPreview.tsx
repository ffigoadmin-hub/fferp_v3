import React, { useState } from 'react';
import { FileText, Maximize2, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmbeddedProofPreviewProps {
    url: string;
    title: string;
    onExpand: (url: string, title: string) => void;
}

export function EmbeddedProofPreview({ url, title, onExpand }: EmbeddedProofPreviewProps) {
    const [isLoading, setIsLoading] = useState(true);
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
    const isPDF = /\.pdf(\?|$)/i.test(url);
    const isGoogleDrive = /drive\.google\.com|docs\.google\.com|sheets\.google\.com|slides\.google\.com/i.test(url);

    let embedUrl = url;
    if (isGoogleDrive) {
        if (url.includes('/view')) embedUrl = url.replace(/\/view(\?.*)?$/, '/preview$1');
        else if (url.includes('/edit')) embedUrl = url.replace(/\/edit(\?.*)?$/, '/preview$1');
    }

    return (
        <div className="relative group w-full aspect-video rounded-xl border border-border bg-muted/20 overflow-hidden shadow-inner mt-2">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
            )}

            <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 rounded-full shadow-lg"
                    onClick={() => onExpand(url, title)}
                >
                    <Maximize2 className="w-4 h-4" />
                </Button>
            </div>

            {isImage ? (
                <img
                    src={url}
                    alt={title}
                    className="w-full h-full object-contain"
                    onLoad={() => setIsLoading(false)}
                    onError={() => setIsLoading(false)}
                />
            ) : isPDF || isGoogleDrive ? (
                <iframe
                    src={embedUrl}
                    className="w-full h-full border-0 bg-white"
                    onLoad={() => setIsLoading(false)}
                />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <FileText className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground font-medium">Unable to preview directly</p>
                    <Button variant="outline" size="sm" onClick={() => onExpand(url, title)}>Open Viewer</Button>
                </div>
            )}
        </div>
    );
}

export function ProofPreviewGrid({ proofs, onExpand }: { proofs: string | string[], onExpand: (url: string, title: string) => void }) {
    const urls = typeof proofs === 'string'
        ? (proofs.startsWith('[') ? JSON.parse(proofs) : proofs.split(',').map(s => s.trim()).filter(Boolean))
        : proofs;

    if (!urls || urls.length === 0) return null;

    return (
        <div className={urls.length > 1 ? "grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3" : "mt-2"}>
            {urls.map((url: string, i: number) => (
                <EmbeddedProofPreview
                    key={i}
                    url={url}
                    title={`Proof Document ${i + 1}`}
                    onExpand={onExpand}
                />
            ))}
        </div>
    );
}
