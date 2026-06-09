/**
 * FFERPv2 — Supabase Error Guard
 * Silently handles errors from IGO-Chain tables that don't exist in this project.
 * Use isMissingTable(error) before showing toast.error for fetch operations.
 */
export function isMissingTable(error: unknown): boolean {
  if (!error) return false;
  const e = error as any;
  return (
    e?.code === 'PGRST205' ||
    e?.code === '42P01' ||          // relation does not exist
    e?.code === 'PGRST200' ||       // embedded resource not found
    e?.message?.includes('schema cache') ||
    e?.message?.includes('does not exist') ||
    e?.message?.includes('relation') ||
    e?.hint?.includes('Perhaps you meant')
  );
}

/** Wraps a toast.error — only shows if error is NOT a missing table error */
export function toastFetchError(toast: any, message: string, error: unknown) {
  if (!isMissingTable(error)) {
    toast.error(message);
  } else {
    console.info(`[FFERPv2] Suppressed missing-table error: ${(error as any)?.message}`);
  }
}
