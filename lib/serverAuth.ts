// Server-side auth helpers. When Clerk is configured, read the caller's userId
// from Clerk's auth() context. Otherwise return "anon" so demo-mode continues
// to work without a session.
//
// Kept in its own module so route handlers can import it without pulling in
// @clerk/nextjs directly (which throws if imported without a provider).

import { hasClerk } from "./auth";

export type ServerRole = "patient" | "clinician" | "admin" | "pending_clinician" | "unknown";

export async function getAuthUserId(): Promise<string> {
  if (!hasClerk()) return "anon";
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const a = await auth();
    return a.userId ?? "anon";
  } catch (e) {
    console.error("[auth] getAuthUserId failed", e);
    return "anon";
  }
}

export async function getAuthContext(): Promise<{
  userId: string;
  role: ServerRole;
}> {
  if (!hasClerk()) return { userId: "anon", role: "admin" }; // Demo mode acts as admin
  try {
    const { auth, currentUser } = await import("@clerk/nextjs/server");
    const a = await auth();
    const userId = a.userId ?? "anon";
    if (userId === "anon") return { userId, role: "unknown" };
    const user = await currentUser();

    // publicMetadata roles (admin, approved clinician) take priority.
    // Hard-coded super admin bootstrap. This address always gets admin.
    const email = user?.primaryEmailAddress?.emailAddress ?? "";
    if (email.toLowerCase() === "cereusedtech@gmail.com") {
      return { userId, role: "admin" };
    }

    const pubRole = (user?.publicMetadata as { role?: unknown } | null)?.role;
    if (pubRole === "admin") return { userId, role: "admin" };
    if (pubRole === "clinician") return { userId, role: "clinician" };

    // unsafeMetadata roles (patient, pending_clinician).
    const unsafeRole = (user?.unsafeMetadata as { role?: unknown } | null)?.role;
    if (unsafeRole === "patient") return { userId, role: "patient" };
    if (unsafeRole === "clinician") return { userId, role: "clinician" };
    if (unsafeRole === "pending_clinician") return { userId, role: "pending_clinician" };

    return { userId, role: "unknown" };
  } catch (e) {
    console.error("[auth] getAuthContext failed", e);
    return { userId: "anon", role: "unknown" };
  }
}

/** Check if the current request is from an admin. */
export async function isAdmin(): Promise<boolean> {
  const { role } = await getAuthContext();
  return role === "admin";
}
