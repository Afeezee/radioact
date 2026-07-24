"use client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { setSession, type DemoSession } from "@/lib/session";

type Mode = "signin" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<DemoSession["role"]>("radiographer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Enter an email and password to continue.");
      return;
    }
    setBusy(true);
    // Small delay so the state transition feels like a real request.
    await new Promise((r) => setTimeout(r, 320));
    setSession({
      name:
        mode === "signup" && name.trim()
          ? name.trim()
          : email.split("@")[0] || "You",
      email: email.trim().toLowerCase(),
      role,
      createdAt: new Date().toISOString(),
    });
    router.push(next);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="font-display text-3xl md:text-4xl tracking-[-0.01em]">
          {mode === "signin" ? "Welcome back." : "Create your account."}
        </h1>
        <p className="text-sm text-muted mt-2">
          {mode === "signin"
            ? "Sign in to your RadioAct reader."
            : "One free workspace per person. Add real keys anytime."}
        </p>
      </div>

      {mode === "signup" && (
        <Field label="Name">
          <input
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Bello"
            className="input"
          />
        </Field>
      )}
      <Field label="Work email">
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@hospital.org"
          className="input"
        />
      </Field>
      <Field label="Password">
        <input
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          className="input"
        />
      </Field>
      {mode === "signup" && (
        <Field label="Your role">
          <div className="grid grid-cols-2 gap-2">
            <RoleChip
              active={role === "radiographer"}
              onClick={() => setRole("radiographer")}
              label="Radiographer"
              hint="I acquire scans"
            />
            <RoleChip
              active={role === "clinician"}
              onClick={() => setRole("clinician")}
              label="Clinician"
              hint="I review findings"
            />
          </div>
        </Field>
      )}

      {error && (
        <div className="text-sm text-danger" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="btn btn-primary w-full !py-2.5 text-base"
      >
        {busy
          ? mode === "signin"
            ? "Signing in…"
            : "Creating account…"
          : mode === "signin"
            ? "Sign in"
            : "Create account"}
      </button>

      <p className="text-sm text-muted text-center">
        {mode === "signin" ? (
          <>
            New to RadioAct?{" "}
            <Link href="/signup" className="text-accent hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/signin" className="text-accent hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>

      <div className="pt-2 border-t hairline">
        <p className="text-xs text-muted mt-3 leading-relaxed">
          <span className="tag mr-1.5">Prototype</span>
          This is a hackathon build. No account is actually created on any
          server — your session lives in this browser only. It's here so the
          product's shape is honest, not to collect anything.
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink2">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function RoleChip({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border px-3 py-2 transition-colors ${
        active
          ? "border-accent bg-accent/10 text-ink"
          : "hairline hover:bg-surface2"
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-muted">{hint}</div>
    </button>
  );
}
