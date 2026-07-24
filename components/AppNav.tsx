"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { Logo } from "./Logo";
import { clearSession, getSession, type DemoSession } from "@/lib/session";
import { extractRole, type Role } from "@/lib/role";
import { useEffectiveRole, useMounted } from "@/lib/useEffectiveRole";

const HAS_CLERK = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function AppNav() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const pathname = usePathname();

  useEffect(() => {
    const cur = (document.documentElement.getAttribute("data-theme") as
      | "light"
      | "dark") || "light";
    setTheme(cur);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("radioact-theme", next);
    setTheme(next);
  }

  return (
    <header className="border-b hairline sticky top-0 z-30 backdrop-blur bg-base/85">
      <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center justify-between">
        <Link href="/app" className="flex items-center gap-2 text-accent">
          <Logo size={22} withWordmark />
          <span className="text-muted text-xs ml-1 hidden md:inline font-sans">
            · radiology triage on Ontomorph
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <RoleAwareLinks pathname={pathname} />
          <RoleSwitcher />
          <div className="mx-2 h-5 w-px bg-line" />
          <button
            aria-label="Toggle theme"
            onClick={toggle}
            className="btn btn-ghost !py-1.5 !px-2.5"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
          {HAS_CLERK ? <ClerkChip /> : <DemoChip />}
        </nav>
      </div>
    </header>
  );
}

function RoleAwareLinks({ pathname }: { pathname: string | null }) {
  const mounted = useMounted();
  const { role } = useEffectiveRole();
  if (!mounted) return null;
  if (!HAS_CLERK) {
    return <NavLinks links={linksForRole(role)} pathname={pathname} />;
  }
  return <ClerkLinks pathname={pathname} effectiveRole={role} />;
}

function ClerkLinks({
  pathname,
  effectiveRole,
}: {
  pathname: string | null;
  effectiveRole: Role;
}) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return null;
  if (!user) return null;
  const links = linksForRole(effectiveRole);
  return <NavLinks links={links} pathname={pathname} />;
}

function linksForRole(
  role: "patient" | "clinician" | "admin" | "pending_clinician" | undefined,
): Array<{ href: string; label: string }> {
  if (role === "admin") return [
    { href: "/app", label: "Your scans" },
    { href: "/app/clinic", label: "Clinic queue" },
    { href: "/app/admin", label: "Admin Dashboard" }
  ];
  if (role === "clinician") return [{ href: "/app/clinic", label: "Clinic queue" }];
  if (role === "patient") return [{ href: "/app", label: "Your scans" }];
  return [];
}

function RoleSwitcher() {
  const mounted = useMounted();
  const { role, actualRole, canSwitch, setRole } = useEffectiveRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!mounted) return null;
  if (!canSwitch) return null;

  const label: Record<Role, string> = {
    patient: "Patient view",
    clinician: "Clinician view",
    admin: "Admin view",
    pending_clinician: "Pending clinician",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost !py-1.5 !px-2.5 text-xs flex items-center gap-1"
        title={`Viewing as ${role}${actualRole === "admin" ? " (admin)" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="w-2 h-2 rounded-full bg-accent" />
        {label[role]}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 min-w-[10rem] rounded-lg border hairline bg-base shadow-lg z-50 py-1"
          role="listbox"
        >
          {(["patient", "clinician", "admin"] as Role[]).map((r) => (
            <button
              key={r}
              role="option"
              aria-selected={r === role}
              onClick={() => {
                setRole(r);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-surface2 flex items-center gap-2 ${
                r === role ? "text-accent" : "text-ink2"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${r === role ? "bg-accent" : "bg-line"}`} />
              {label[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavLinks({
  links,
  pathname,
}: {
  links: Array<{ href: string; label: string }>;
  pathname: string | null;
}) {
  return (
    <>
      {links.map((l) => {
        const active =
          l.href === "/app"
            ? pathname === "/app"
            : pathname?.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`btn !py-1.5 !px-3 ${active ? "btn-primary" : "btn-ghost"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );
}

function ClerkChip() {
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return null;
  return isSignedIn ? (
    <div className="ml-1">
      <UserButton />
    </div>
  ) : (
    <SignInButton mode="redirect">
      <button className="btn btn-ghost !py-1.5 !px-3 ml-1">Sign in</button>
    </SignInButton>
  );
}

function DemoChip() {
  const router = useRouter();
  const [session, setSessionState] = useState<DemoSession | null>(null);
  useEffect(() => {
    setSessionState(getSession());
  }, []);
  function signOut() {
    clearSession();
    router.push("/");
  }
  return session ? (
    <div className="flex items-center gap-2 ml-1">
      <span
        className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-accent/12 text-accent text-xs font-medium"
        aria-hidden
      >
        {initials(session.name)}
      </span>
      <button
        onClick={signOut}
        className="btn btn-ghost !py-1.5 !px-3"
        title={session.email}
      >
        Sign out
      </button>
    </div>
  ) : (
    <Link href="/signin" className="btn btn-ghost !py-1.5 !px-3 ml-1">
      Sign in
    </Link>
  );
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
