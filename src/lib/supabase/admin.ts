import { createClient } from "@supabase/supabase-js";

/**
 * Admin client using the service role key — bypasses RLS.
 * Only use server-side for privileged operations (e.g. looking up user emails).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin env vars not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
