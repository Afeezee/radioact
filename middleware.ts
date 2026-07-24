// Route protection.
// Clerk's `clerkMiddleware` is only wired when Clerk keys are present, so a
// missing config doesn't hard-crash dev. The /app/* routes still get client-
// side protection via components/RequireAuth.tsx in either mode.

import { NextResponse, type NextRequest } from "next/server";

const HAS_CLERK =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

// Dynamic import so @clerk/nextjs/server never touches modules when keys are
// missing (it throws during instantiation without a publishable key).
type ClerkHandler = (req: NextRequest) => Promise<Response> | Response;
let clerkHandler: ClerkHandler | null = null;

async function makeClerkHandler(): Promise<ClerkHandler> {
  const { clerkMiddleware, createRouteMatcher } = await import(
    "@clerk/nextjs/server"
  );
  const isProtected = createRouteMatcher(["/app(.*)"]);
  return clerkMiddleware(async (auth, req) => {
    if (isProtected(req)) {
      await auth.protect();
    }
  }) as unknown as ClerkHandler;
}

export async function middleware(req: NextRequest) {
  if (!HAS_CLERK) return NextResponse.next();
  if (!clerkHandler) {
    clerkHandler = await makeClerkHandler();
  }
  return clerkHandler(req);
}

export const config = {
  matcher: [
    // Skip Next internals & static files, run on everything else including api
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
