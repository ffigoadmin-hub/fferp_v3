import { useStorageUrl } from '@/hooks/useStorageUrl';
import { FileText, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

interface ProofLinkProps {
    /** The stored value — can be a file path OR an old full URL */
    pathOrUrl: string | null | undefined;
    /** The storage bucket (default: 'payment-documents') */
    bucket?: string;
    /** Label for the link */
    label?: string;
    /** If true, also renders an <img> preview for image files */
    showPreview?: boolean;
    className?: string;
}

/**
 * Displays a link (and optionally a preview) for a stored file.
 * Automatically generates a fresh signed URL using useStorageUrl.
 * 
 * Use this anywhere you need to display proof files stored in Supabase Storage.
 * Works with old expired signed URLs AND new file paths.
 */
export function ProofLink({
    pathOrUrl,
    bucket = 'payment-documents',
    label = 'View Attached Evidence',
    showPreview = false,
    className = ''
}: ProofLinkProps) {
    const { url, isLoading, error } = useStorageUrl(bucket, pathOrUrl);

    if (!pathOrUrl) return null;

    if (isLoading) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading file...
            </span>
        );
    }

    if (error || !url) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5" /> File unavailable
            </span>
        );
    }

    const isImage = url.match(/\.(jpg|jpeg|png|webp)(\?|$)/i) ||
        (pathOrUrl && pathOrUrl.match(/\.(jpg|jpeg|png|webp)$/i));

    return (
        <div className={`space-y-2 ${className}`}>
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors bg-primary/5 hover:bg-primary/10 px-3 py-2 rounded-md border border-primary/10"
            >
                <FileText className="w-3.5 h-3.5" />
                {label}
                <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
            {showPreview && isImage && (
                <img
                    src={url}
                    alt="Proof"
                    className="mt-2 rounded-md max-h-48 object-cover border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
            )}
        </div>
    );
}
