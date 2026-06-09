import { supabase } from '@/integrations/supabase/client';

// How long signed URLs stay valid (7 days)
const SIGNED_URL_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

/**
 * Determines if a stored URL is a file path (not a full HTTP URL) or a full URL.
 * File paths look like: "userId/1234567890.jpg"
 * Full URLs look like: "https://..."
 */
const isFilePath = (value: string): boolean =>
    !value.startsWith('http://') && !value.startsWith('https://');

/**
 * Given a stored value from the database (either a file path OR an old signed/public URL),
 * return a fresh signed URL valid for 7 days.
 *
 * This is the single source of truth for generating viewable URLs.
 * Call this whenever you need to display or open a stored file.
 */
export async function getStorageUrl(
    bucket: string,
    pathOrUrl: string | null | undefined
): Promise<string | null> {
    if (!pathOrUrl) return null;

    // If it's already a full URL (old signed URL or public URL), extract the path
    let filePath = pathOrUrl;

    if (!isFilePath(pathOrUrl)) {
        // It's a full URL - try to extract the file path from it
        try {
            const url = new URL(pathOrUrl);
            // Supabase storage URLs are like: /storage/v1/object/sign/bucket/path...
            // or: /storage/v1/object/public/bucket/path...
            const match = url.pathname.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/[^/]+\/(.+?)(?:\?|$)/);
            if (match) {
                filePath = decodeURIComponent(match[1]);
            } else {
                // Can't parse the path — try using it as-is (might work for public buckets)
                return pathOrUrl;
            }
        } catch {
            // Not a valid URL, use as-is
            return pathOrUrl;
        }
    }

    // Generate a fresh signed URL
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, SIGNED_URL_LIFETIME_SECONDS);

    if (error || !data?.signedUrl) {
        console.warn('[getStorageUrl] Could not generate signed URL for', filePath, error?.message);
        // Fallback: try public URL (works if bucket is public)
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        return publicData?.publicUrl || null;
    }

    return data.signedUrl;
}

/**
 * A simpler helper that returns the file path to store in the database.
 * ALWAYS store paths, never signed URLs.
 */
export function extractFilePath(fullUrl: string): string {
    if (isFilePath(fullUrl)) return fullUrl;
    try {
        const url = new URL(fullUrl);
        const match = url.pathname.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/[^/]+\/(.+?)(?:\?|$)/);
        if (match) return decodeURIComponent(match[1]);
    } catch { /* ignore */ }
    return fullUrl;
}
