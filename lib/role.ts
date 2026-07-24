// Client-side role helpers. Roles are stored on the Clerk user's
// unsafeMetadata (writeable from the client). If Clerk isn't configured, we
// treat everyone as a patient so the demo flow still works.
//
// Admin and approved-clinician roles are set via publicMetadata (server-side
// only, not user-writeable). extractRole checks publicMetadata first.

export type Role = "patient" | "clinician" | "admin" | "pending_clinician";
export type MaybeRole = Role | undefined;

export function extractRole(user: {
  unsafeMetadata?: Record<string, unknown> | null;
  publicMetadata?: Record<string, unknown> | null;
} | null | undefined): MaybeRole {
  // publicMetadata is set server-side (admin, approved clinician) — takes priority.
  const pub = user?.publicMetadata?.role;
  if (pub === "admin" || pub === "clinician") return pub as Role;

  // unsafeMetadata is set client-side during onboarding.
  const raw = user?.unsafeMetadata?.role ?? undefined;
  if (
    raw === "patient" ||
    raw === "clinician" ||
    raw === "pending_clinician"
  )
    return raw;
  return undefined;
}

export function homeForRole(role: MaybeRole): string {
  if (role === "admin") return "/app/admin";
  if (role === "clinician") return "/app/clinic";
  return "/app";
}

/** True when `actualRole` is allowed to enter a route gated to `requiredRole`.
 *  Admins are always allowed through so they can move between all app areas. */
export function canAccess(actualRole: MaybeRole, requiredRole: Role): boolean {
  if (actualRole === "admin") return true;
  return actualRole === requiredRole;
}
