import { RequireAuth } from "@/components/RequireAuth";

// Clinician-only subtree. The outer /app/layout.tsx already renders the nav
// and demands a signed-in Clerk session; this layer re-runs the guard with the
// clinician role so a patient landing here gets bounced to their own home.
export default function ClinicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireAuth requiredRole="clinician">{children}</RequireAuth>;
}
