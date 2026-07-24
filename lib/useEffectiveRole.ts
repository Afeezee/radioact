"use client";

import { useSyncExternalStore } from "react";
import { useUser } from "@clerk/nextjs";
import { getSession, setSessionRole, isDemoRole } from "./session";
import { extractRole, type Role, type MaybeRole } from "./role";

const HAS_CLERK = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const STORAGE_KEY = "radioact-effective-role";

const ROLES: readonly Role[] = ["patient", "clinician", "admin", "pending_clinician"];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

export interface EffectiveRoleState {
  /** The role currently driving the UI (may be an admin impersonation). */
  role: Role;
  /** The user's true role from Clerk metadata or demo session. */
  actualRole: MaybeRole;
  /** Whether the user is allowed to change their effective role. */
  canSwitch: boolean;
  /** Change the effective role. Persists to localStorage (Clerk) or the demo session. */
  setRole: (role: Role) => void;
}

/**
 * Returns the effective role used for navigation and client-side UI.
 *
 * In Clerk mode only true admins can switch; everyone else is locked to their
 * metadata role. In demo mode (no Clerk) any session can switch so the whole
 * role flow can be tested without credentials.
 *
 * Note: this only affects the client shell. Server APIs still see the true
 * Clerk / demo identity, so an admin previewing "patient" still has admin
 * privileges on the server.
 */

// ----- Shared override store -----
// Multiple components (nav, route guards) need the same effective role. We use
// a tiny module-level store backed by localStorage / the demo session.

let override: Role | undefined;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

function getOverride(): Role | undefined {
  if (typeof window === "undefined") return undefined;
  if (HAS_CLERK) {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isRole(stored) ? stored : undefined;
  }
  const s = getSession();
  return s && isRole(s.role) ? s.role : undefined;
}

function setOverride(next: Role | undefined) {
  override = next;
  notify();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function useClerkUserIfEnabled() {
  // HAS_CLERK is a build-time constant, so the hook-call order is stable.
  if (HAS_CLERK) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useUser();
  }
  return { isLoaded: true as const, user: null };
}

const subscribeNoop = () => () => {};

/** Returns true only after the client has hydrated. Safe replacement for the
 *  old `useEffect(() => setMounted(true), [])` pattern. */
export function useMounted() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

export function useEffectiveRole(): EffectiveRoleState {
  const clerk = useClerkUserIfEnabled();

  // Sync the shared override with localStorage/session. We seed once on the
  // client so the initial SSR value doesn't mismatch.
  useSyncExternalStore(
    subscribe,
    () => {
      if (override === undefined) {
        override = getOverride();
      }
      return override;
    },
    () => undefined,
  );

  const rawActualRole: MaybeRole = HAS_CLERK
    ? (clerk.isLoaded ? extractRole(clerk.user) : undefined)
    : getSession()?.role;
  const actualRole: MaybeRole = isRole(rawActualRole) ? rawActualRole : undefined;

  const canSwitch = HAS_CLERK ? actualRole === "admin" : true;

  const role: Role = canSwitch
    ? (override ?? actualRole ?? "patient")
    : (actualRole ?? "patient");

  function setRole(next: Role) {
    if (!canSwitch) return;
    if (HAS_CLERK) {
      localStorage.setItem(STORAGE_KEY, next);
    } else if (isDemoRole(next)) {
      setSessionRole(next);
    }
    setOverride(next);
  }

  return { role, setRole, actualRole, canSwitch };
}
