import { supabase } from '@/integrations/supabase/client';

const BUCKET_NAME = 'employee-selfies';

/**
 * Extract the storage file path from a selfie URL (signed or public).
 * Handles:
 *  - Full signed URLs: https://xxx.supabase.co/storage/v1/object/sign/employee-selfies/userId/date/file.jpg?token=...
 *  - Full public URLs: https://xxx.supabase.co/storage/v1/object/public/employee-selfies/userId/date/file.jpg
 *  - Raw file paths: userId/date/file.jpg
 */
export function extractSelfieFilePath(url: string): string | null {
    if (!url) return null;

    // Already a raw path (no http)
    if (!url.startsWith('http')) {
        return url;
    }

    try {
        // Match path after bucket name in either signed or public URL patterns
        const patterns = [
            /\/storage\/v1\/object\/sign\/employee-selfies\/(.+?)(\?|$)/,
            /\/storage\/v1\/object\/public\/employee-selfies\/(.+?)(\?|$)/,
            /\/storage\/v1\/object\/employee-selfies\/(.+?)(\?|$)/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match?.[1]) {
                return decodeURIComponent(match[1]);
            }
        }
    } catch {
        // Fall through
    }

    return null;
}

/**
 * Get the public URL for a selfie image.
 * Works with both existing signed URLs and raw file paths.
 */
export function getSelfiePublicUrl(urlOrPath: string): string {
    if (!urlOrPath) return '/placeholder.svg';

    const filePath = extractSelfieFilePath(urlOrPath);
    if (!filePath) return urlOrPath; // Return original if can't parse

    const { data } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

    return data?.publicUrl || urlOrPath;
}
