"use client";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { extractRole, homeForRole, type Role } from "@/lib/role";

export function OnboardingForm() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [role, setRole] = useState<"patient" | "clinician">("patient");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSubmitted, setPendingSubmitted] = useState(false);

  // If the user already has a role, don't make them pick again — send them home.
  useEffect(() => {
    if (!isLoaded || !user) return;
    const existing = extractRole(user);
    if (existing === "pending_clinician") {
      setPendingSubmitted(true);
      return;
    }
    if (existing) router.replace(homeForRole(existing));
  }, [isLoaded, user, router]);

  if (!isLoaded) {
    return <div className="text-sm text-muted">Loading your account…</div>;
  }
  if (!user) {
    return (
      <div className="text-sm">
        You need to sign in first.{" "}
        <a href="/signin" className="text-accent underline">
          Go to sign in
        </a>
      </div>
    );
  }

  if (pendingSubmitted) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-6 text-center">
          <div className="text-3xl mb-3" aria-hidden>⏳</div>
          <h1 className="font-display text-2xl md:text-3xl tracking-[-0.01em] mb-2">
            Registration pending
          </h1>
          <p className="text-sm text-muted leading-relaxed max-w-md mx-auto">
            Your clinician registration has been submitted and is awaiting admin
            approval. You'll be able to access the clinic queue once an
            administrator confirms your credentials.
          </p>
        </div>
        <p className="text-xs text-muted leading-relaxed text-center">
          If you believe this is taking too long, contact the platform administrator.
        </p>
      </div>
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (role === "clinician") {
        // Clinician sign-ups require admin approval.
        await user!.update({
          unsafeMetadata: {
            ...(user!.unsafeMetadata ?? {}),
            role: "pending_clinician",
            onboardedAt: new Date().toISOString(),
          },
        });
        setPendingSubmitted(true);
      } else {
        // Patients go straight through — no approval needed.
        await user!.update({
          unsafeMetadata: {
            ...(user!.unsafeMetadata ?? {}),
            role: "patient",
            onboardedAt: new Date().toISOString(),
          },
        });
        router.replace(homeForRole("patient"));
      }
    } catch (e) {
      console.error(e);
      setError("Couldn't save your role. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl md:text-4xl tracking-[-0.01em]">
          Who's using RadioAct?
        </h1>
        <p className="text-sm text-muted mt-2">
          Choose the role that fits how you'll use the app. You can change this
          later from your profile.
        </p>
      </div>

      <div className="grid gap-2.5">
        <RoleCard
          selected={role === "patient"}
          onSelect={() => setRole("patient")}
          title="I'm a patient"
          body="Upload your own scan, get an AI-assisted read, then send it to a clinician for expert review."
        />
        <RoleCard
          selected={role === "clinician"}
          onSelect={() => setRole("clinician")}
          title="I'm a clinician"
          body="Review scans patients have sent in. Confirm or reject the AI read, and see the twin's inspector snapshot for context."
          hint="Clinician accounts require admin approval before access is granted."
        />
      </div>

      {error && (
        <div className="text-sm text-danger" role="alert">
          {error}
        </div>
      )}

      <button
        onClick={save}
        disabled={busy}
        className="btn btn-primary w-full !py-2.5 text-base"
      >
        {busy ? "Saving…" : role === "clinician" ? "Submit for approval" : "Continue"}
      </button>

      <p className="text-xs text-muted leading-relaxed">
        RadioAct is a triage-assist tool. Every AI finding requires clinician
        confirmation before it becomes a diagnosis.
      </p>
    </div>
  );
}

function RoleCard({
  selected,
  onSelect,
  title,
  body,
  hint,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  body: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-xl border p-4 transition-colors ${
        selected
          ? "border-accent bg-accent/10 text-ink"
          : "hairline hover:bg-surface2"
      }`}
    >
      <div className="font-medium mb-1">{title}</div>
      <div className="text-xs text-muted leading-relaxed">{body}</div>
      {hint && (
        <div className="text-[11px] text-flag mt-1.5 leading-relaxed">{hint}</div>
      )}
    </button>
  );
}
