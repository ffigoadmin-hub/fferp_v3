import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Maximize2,
    X,
    FileText,
    Download,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface EvidenceMediaGalleryProps {
    images?: string[];
    documents?: string[];
    singleImage?: string;
    className?: string;
}

// Helper to detect and convert Google Drive URLs
const getGoogleDriveInfo = (url: string): { isGoogleDrive: boolean; fileId?: string; thumbnailUrl?: string; previewUrl?: string } => {
    if (!url) return { isGoogleDrive: false };

    // Match Google Drive file URL patterns
    const patterns = [
        /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/,
        /docs\.google\.com\/.*\/d\/([a-zA-Z0-9_-]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            const fileId = match[1];
            return {
                isGoogleDrive: true,
                fileId,
                thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`,
                previewUrl: `https://drive.google.com/file/d/${fileId}/preview`
            };
        }
    }

    return { isGoogleDrive: false };
};

export function EvidenceMediaGallery({ images = [], documents = [], singleImage, className }: EvidenceMediaGalleryProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showIframePreview, setShowIframePreview] = useState<string | null>(null);

    // Normalize images
    const allImages = singleImage ? [singleImage, ...images] : images;
    const hasImages = allImages.length > 0;
    const hasDocs = documents.length > 0;

    if (!hasImages && !hasDocs) return null;

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % allImages.length);
        setSelectedImage(allImages[(currentIndex + 1) % allImages.length]);
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
        setSelectedImage(allImages[(currentIndex - 1 + allImages.length) % allImages.length]);
    };

    return (
        <div className={cn("space-y-4", className)}>
            {/* Image Grid */}
            {hasImages && (
                <div className={cn(
                    "grid gap-3",
                    allImages.length === 1 ? "grid-cols-1" :
                        allImages.length === 2 ? "grid-cols-2" :
                            "grid-cols-2 md:grid-cols-3"
                )}>
                    {allImages.map((url, idx) => {
                        const driveInfo = getGoogleDriveInfo(url);
                        const displayUrl = driveInfo.isGoogleDrive && driveInfo.thumbnailUrl ? driveInfo.thumbnailUrl : url;

                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-black/40 cursor-zoom-in"
                                onClick={() => {
                                    if (driveInfo.isGoogleDrive && driveInfo.previewUrl) {
                                        setShowIframePreview(driveInfo.previewUrl);
                                    } else {
                                        setSelectedImage(url);
                                    }
                                    setCurrentIndex(idx);
                                }}
                            >
                                {driveInfo.isGoogleDrive ? (
                                    <img
                                        src={displayUrl}
                                        alt={`Evidence ${idx + 1}`}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjY2NjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIi8+PGNpcmNsZSBjeD0iOC41IiBjeT0iOC41IiByPSIxLjUiLz48cGF0aCBkPSJtMjEgMTUtMy0zLTYgNi0zLTMtNiA2Ii8+PC9zdmc+';
                                        }}
                                    />
                                ) : (
                                    <img
                                        src={url}
                                        alt={`Evidence ${idx + 1}`}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <div className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center gap-2">
                                        {driveInfo.isGoogleDrive ? (
                                            <Eye className="w-5 h-5 text-white" />
                                        ) : (
                                            <Maximize2 className="w-5 h-5 text-white" />
                                        )}
                                    </div>
                                </div>
                                {driveInfo.isGoogleDrive && (
                                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-[8px] font-bold text-white/80 uppercase tracking-wider">
                                        Drive
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Document List */}
            {hasDocs && (
                <div className="space-y-2">
                    {documents.map((url, idx) => {
                        const driveInfo = getGoogleDriveInfo(url);
                        return (
                            <div
                                key={idx}
                                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] transition-all group cursor-pointer"
                                onClick={(e) => {
                                    if (driveInfo.isGoogleDrive && driveInfo.previewUrl) {
                                        e.preventDefault();
                                        setShowIframePreview(driveInfo.previewUrl);
                                    }
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                                        <FileText className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-white/90">Document Evidence {idx + 1}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                            {driveInfo.isGoogleDrive ? 'Google Drive Preview' : 'Verification PDF'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {driveInfo.isGoogleDrive ? (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Eye className="w-4 h-4 text-primary" />
                                        </Button>
                                    ) : (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" asChild onClick={(e) => e.stopPropagation()}>
                                            <a href={url} target="_blank" rel="noopener noreferrer">
                                                <Download className="w-4 h-4 text-primary" />
                                            </a>
                                        </Button>
                                    )}
                                    <ExternalLink className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Lightbox Dialog */}
            <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
                <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/90 backdrop-blur-xl flex items-center justify-center overflow-hidden">
                    <div className="relative w-full h-full flex items-center justify-center p-4">
                        <AnimatePresence mode="wait">
                            {selectedImage && (
                                <motion.img
                                    key={selectedImage}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.1 }}
                                    src={selectedImage}
                                    alt="Evidence Fullscreen"
                                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                                />
                            )}
                        </AnimatePresence>

                        {/* Navigation */}
                        {allImages.length > 1 && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/5 hover:bg-white/10 text-white border border-white/10"
                                    onClick={handlePrev}
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/5 hover:bg-white/10 text-white border border-white/10"
                                    onClick={handleNext}
                                >
                                    <ChevronRight className="w-6 h-6" />
                                </Button>
                            </>
                        )}

                        {/* Toolbar */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-2xl">
                            <span className="text-xs font-mono text-white/60 tracking-tighter">
                                {currentIndex + 1} / {allImages.length}
                            </span>
                            <div className="w-px h-4 bg-white/10" />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-[10px] font-black uppercase text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => window.open(selectedImage!, '_blank')}
                            >
                                <ExternalLink className="w-3 h-3 mr-2" />
                                Open Original
                            </Button>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 right-4 h-10 w-10 bg-black/20 hover:bg-black/40 text-white rounded-full border border-white/10"
                            onClick={() => setSelectedImage(null)}
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Google Drive Iframe Preview */}
            <Dialog open={!!showIframePreview} onOpenChange={() => setShowIframePreview(null)}>
                <DialogContent className="max-w-[90vw] max-h-[90vh] w-[90vw] h-[85vh] p-0 border-none bg-black/95 backdrop-blur-xl overflow-hidden">
                    <div className="relative w-full h-full flex flex-col">
                        <div className="flex items-center justify-between p-3 bg-black/60 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Eye className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-white">Google Drive Preview</p>
                                    <p className="text-[10px] text-muted-foreground">Embedded file viewer</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-[10px] font-black uppercase border-primary/30 text-primary hover:bg-primary/10"
                                    onClick={() => {
                                        const originalUrl = allImages[currentIndex];
                                        window.open(originalUrl, '_blank');
                                    }}
                                >
                                    <ExternalLink className="w-3 h-3 mr-2" />
                                    Open in Drive
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
                                    onClick={() => setShowIframePreview(null)}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 bg-black">
                            {showIframePreview && (
                                <iframe
                                    src={showIframePreview}
                                    className="w-full h-full border-0"
                                    allow="autoplay"
                                    title="Google Drive Preview"
                                />
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
