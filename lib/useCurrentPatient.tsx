"use client";
import { useUser } from "@clerk/nextjs";
import { getSession } from "./session";
import { extractRole, type Role } from "./role";

const HAS_CLERK = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export interface CurrentIdentity {
  ready: boolean;
  patientId: string;
  patientName: string;
  role: Role | undefined;
}

// Uniform way to derive "who is this scan for?" across Clerk / demo modes.
// Falls back to a stable demo patient id when neither Clerk nor a demo session
// is available.
export function useCurrentPatient(): CurrentIdentity {
  const clerk = HAS_CLERK ? useUser() : null;
  if (HAS_CLERK) {
    const isLoaded = clerk?.isLoaded ?? false;
    const user = clerk?.user;
    if (!isLoaded) {
      return { ready: false, patientId: "", patientName: "", role: undefined };
    }
    if (!user) {
      return { ready: true, patientId: "p_anon", patientName: "Guest", role: undefined };
    }
    return {
      ready: true,
      patientId: `p_${user.id}`,
      patientName:
        user.fullName ||
        user.primaryEmailAddress?.emailAddress ||
        "You",
      role: extractRole(user),
    };
  }

  const s = typeof window !== "undefined" ? getSession() : null;
  if (!s) {
    return { ready: true, patientId: "p_demo_1", patientName: "Guest", role: undefined };
  }
  return {
    ready: true,
    patientId: `p_demo_${s.email.replace(/[^a-z0-9]/gi, "_").slice(0, 20)}`,
    patientName: s.name,
    role: s.role === "clinician" ? "clinician" : "patient",
  };
}
