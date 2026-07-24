// Conditionally wrap the app in ClerkProvider when Clerk keys are present.
// Split into a server component (this file) that decides which path to take,
// and a small client wrapper (ClerkProviderClient) that imports @clerk/nextjs.

import { hasClerk } from "@/lib/auth";
import { ClerkProviderClient } from "./ClerkProviderClient";

export function ClerkGate({ children }: { children: React.ReactNode }) {
  if (!hasClerk()) return <>{children}</>;
  return <ClerkProviderClient>{children}</ClerkProviderClient>;
}
