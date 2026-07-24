import { AppNav } from "@/components/AppNav";
import { RequireAuth } from "@/components/RequireAuth";

// Wrapper for the whole /app tree: renders the nav and enforces that the user
// is signed in and has picked a role. Role-narrowed routes (e.g. the clinician
// clinic) re-run the guard with their required role.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      <RequireAuth>{children}</RequireAuth>
    </>
  );
}
