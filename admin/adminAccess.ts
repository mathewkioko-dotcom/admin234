import { Profile } from "../types";

/**
 * Client-side entry check for the admin workspace.
 * Production authorization must still be enforced by Supabase RLS/Edge Functions.
 */
export function isAdminUser(profile: Profile): boolean {
  const allowlistedEmails = (import.meta.env.VITE_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const email = profile.email?.trim().toLowerCase();
  const appMetadata = (profile as Profile & { app_metadata?: { role?: string } })
    .app_metadata;

  return Boolean(
    (email && allowlistedEmails.includes(email)) ||
      appMetadata?.role === "admin",
  );
}
