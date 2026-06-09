import { useState, useEffect, useCallback } from 'react';
import { getStorageUrl } from '@/utils/storageUrl';

/**
 * Hook that takes a stored file path/URL and a bucket name,
 * and returns a fresh signed URL that auto-refreshes.
 *
 * Use this anywhere you need to DISPLAY a stored file.
 * 
 * @example
 * const { url, isLoading } = useStorageUrl('payment-documents', entry.reversal_proof_url);
 * return url ? <a href={url}>View Proof</a> : null;
 */
export function useStorageUrl(bucket: string, pathOrUrl: string | null | undefined) {
    const [url, setUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!pathOrUrl) {
            setUrl(null);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const freshUrl = await getStorageUrl(bucket, pathOrUrl);
            setUrl(freshUrl);
        } catch (err) {
            setError('Failed to load file');
            setUrl(null);
        } finally {
            setIsLoading(false);
        }
    }, [bucket, pathOrUrl]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { url, isLoading, error, refresh };
}
