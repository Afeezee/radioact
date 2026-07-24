import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/serverAuth";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await clerkClient();
    // In a real production app with many users, we would need pagination here.
    // For now, fetch up to 500 users for the admin dashboard.
    const users = await client.users.getUserList({ limit: 500 });

    const serializedUsers = users.data.map((u) => {
      const pubRole = (u.publicMetadata as { role?: string })?.role;
      const unsafeRole = (u.unsafeMetadata as { role?: string })?.role;
      
      let role = "unknown";
      if (pubRole === "admin" || pubRole === "clinician") {
        role = pubRole;
      } else if (unsafeRole === "patient" || unsafeRole === "clinician" || unsafeRole === "pending_clinician") {
        role = unsafeRole;
      }

      return {
        id: u.id,
        email: u.emailAddresses[0]?.emailAddress ?? "no-email",
        firstName: u.firstName,
        lastName: u.lastName,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Unknown",
        role,
        createdAt: new Date(u.createdAt).toISOString(),
        lastSignInAt: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : null,
      };
    });

    return NextResponse.json({ users: serializedUsers });
  } catch (error) {
    console.error("[admin] error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
