import { format } from 'date-fns';

/**
 * Safe wrapper around date-fns `format` that never throws.
 * Returns `fallback` when the value is null, undefined, or an invalid date.
 */
export function safeFormat(
    value: string | number | Date | null | undefined,
    formatStr: string,
    fallback = '—'
): string {
    if (!value) return fallback;
    try {
        const d = value instanceof Date ? value : new Date(value);
        if (isNaN(d.getTime())) return fallback;
        return format(d, formatStr);
    } catch {
        return fallback;
    }
}
