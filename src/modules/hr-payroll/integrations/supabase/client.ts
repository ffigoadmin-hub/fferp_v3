// DEPRECATED — unused duplicate Supabase client. Nothing in the codebase imports
// this file (verified via full-repo grep). Violates the project rule "never create
// a second Supabase client" — use '@/integrations/supabase/client' instead.
// Safe to delete; kept only because file deletion needs your explicit go-ahead.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables. Check your .env file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
