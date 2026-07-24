import { RequireAuth } from "@/components/RequireAuth";

// Wraps the admin area to ensure only users with the 'admin' role can enter.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth requiredRole="admin">
      {children}
    </RequireAuth>
  );
}
