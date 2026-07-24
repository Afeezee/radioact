"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { getSession } from "@/lib/session";
import {
  canAccess,
  extractRole,
  homeForRole,
  type Role,
} from "@/lib/role";
import { useEffectiveRole } from "@/lib/useEffectiveRole";

const HAS_CLERK = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

interface Props {
  children: React.ReactNode;
  /** Optional gate — when set, only this role can enter this subtree. */
  requiredRole?: Role;
}

// Guard for the /app subtree. Chooses Clerk or the demo-session guard at
// module load; component identity is stable per request, no conditional hooks.
export function RequireAuth({ children, requiredRole }: Props) {
  if (HAS_CLERK) return <ClerkGuard requiredRole={requiredRole}>{children}</ClerkGuard>;
  return <DemoGuard>{children}</DemoGuard>;
}

// --------- Clerk path ---------
function ClerkGuard({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: Role;
}) {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const { role: effectiveRole } = useEffectiveRole();

  const actualRole = user
    ? extractRole({
        publicMetadata: user.publicMetadata,
        unsafeMetadata: user.unsafeMetadata,
        primaryEmailAddress: user.primaryEmailAddress,
      })
    : undefined;

  useEffect(() => {
    if (!authLoaded || !userLoaded) return;
    if (!isSignedIn) {
      const next = encodeURIComponent(pathname ?? "/app");
      router.replace(`/signin?redirect_url=${next}`);
      return;
    }
    if (!actualRole) {
      // Signed in but hasn't picked a role yet.
      router.replace("/onboarding");
      return;
    }
    if (actualRole === "pending_clinician" && pathname !== "/onboarding") {
      // Pending clinicians can only see the onboarding/pending page.
      router.replace("/onboarding");
      return;
    }
    if (requiredRole && !canAccess(actualRole, requiredRole)) {
      router.replace(homeForRole(effectiveRole));
    }
  }, [
    authLoaded,
    userLoaded,
    isSignedIn,
    actualRole,
    effectiveRole,
    requiredRole,
    pathname,
    router,
  ]);

  // Pending clinicians: show them a waiting state.
  if (
    authLoaded &&
    userLoaded &&
    isSignedIn &&
    actualRole === "pending_clinician"
  ) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md text-center space-y-4 p-6">
          <div className="text-4xl" aria-hidden>⏳</div>
          <h2 className="font-display text-2xl">Approval pending</h2>
          <p className="text-sm text-muted leading-relaxed">
            Your clinician registration is awaiting admin approval. You'll
            be redirected to the clinic once approved.
          </p>
          <p className="text-xs text-muted">
            Check back later or contact the platform administrator.
          </p>
        </div>
      </div>
    );
  }

  const ready =
    authLoaded &&
    userLoaded &&
    isSignedIn &&
    !!actualRole &&
    actualRole !== "pending_clinician" &&
    (!requiredRole || canAccess(actualRole, requiredRole));

  if (!ready) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="text-sm text-muted">Loading…</span>
      </div>
    );
  }
  return <>{children}</>;
}

// --------- Demo path (no Clerk) — everyone can enter both subtrees ---------
function DemoGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      const next = encodeURIComponent(pathname ?? "/app");
      router.replace(`/signin?next=${next}`);
    } else {
      setReady(true);
    }
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="text-sm text-muted">Loading…</span>
      </div>
    );
  }
  return <>{children}</>;
}
