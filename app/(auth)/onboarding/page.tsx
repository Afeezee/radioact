import { Suspense } from "react";
import { OnboardingForm } from "@/components/OnboardingForm";

export const metadata = {
  title: "Choose your role — RadioAct",
};

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
      <OnboardingForm />
    </Suspense>
  );
}
