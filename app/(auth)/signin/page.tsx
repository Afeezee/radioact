import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { ClerkAuthWidget } from "@/components/ClerkAuthWidget";
import { hasClerk } from "@/lib/auth";

export const metadata = {
  title: "Sign in — RadioAct",
};

export default function SignInPage() {
  if (hasClerk()) return <ClerkAuthWidget mode="signin" />;
  return (
    <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
      <AuthForm mode="signin" />
    </Suspense>
  );
}
