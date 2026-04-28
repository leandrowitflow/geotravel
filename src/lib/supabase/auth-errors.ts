import type { AuthError } from "@supabase/supabase-js";

/** Stale cookies / server reset — client must clear local session before signing in again. */
export function isStaleSessionAuthError(error: AuthError | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  const code = (error as { code?: string }).code?.toLowerCase() ?? "";
  return (
    msg.includes("refresh token") ||
    msg.includes("invalid jwt") ||
    code === "refresh_token_not_found" ||
    code === "invalid_refresh_token"
  );
}
