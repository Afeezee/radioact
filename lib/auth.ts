// Auth mode selection. RadioAct supports two paths:
//   1. Clerk — used when both Clerk env vars are present. Full-fat auth.
//   2. Demo session — the lightweight client-side session in lib/session.ts.
//      Used when Clerk isn't configured so the app still boots for a demo.
//
// This module is safe to import from server or client; it only reads env vars.

export function hasClerk(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    !!process.env.CLERK_SECRET_KEY
  );
}
