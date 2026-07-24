import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { ClerkAuthWidget } from "@/components/ClerkAuthWidget";
import { hasClerk } from "@/lib/auth";

export const metadata = {
  title: "Create your account — RadioAct",
};

export default function SignUpPage() {
  if (hasClerk()) return <ClerkAuthWidget mode="signup" />;
  return (
    <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
