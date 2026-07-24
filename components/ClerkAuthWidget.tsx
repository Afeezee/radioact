"use client";
import { SignIn, SignUp } from "@clerk/nextjs";

// Rendered only inside pages that we know are Clerk-gated (see the check in
// each page). Kept as its own client component so we can style it in one place.
export function ClerkAuthWidget({ mode }: { mode: "signin" | "signup" }) {
  return (
    <div className="max-w-[420px] w-full">
      {mode === "signin" ? (
        <SignIn signUpUrl="/signup" fallbackRedirectUrl="/app" />
      ) : (
        <SignUp signInUrl="/signin" fallbackRedirectUrl="/onboarding" />
      )}
    </div>
  );
}
