import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/serverAuth";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const client = await clerkClient();
    await client.users.deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin] error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  
  try {
    const body = await req.json();
    const newRole = body.role; // "admin", "clinician", "patient", "pending_clinician", etc.
    
    if (!newRole) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    const client = await clerkClient();
    
    if (newRole === "admin" || newRole === "clinician") {
      // These are secure roles, they go in publicMetadata
      await client.users.updateUserMetadata(id, {
        publicMetadata: { role: newRole },
      });
    } else {
      // Demote them back to a standard role by removing from publicMetadata
      // and placing it back in unsafeMetadata
      await client.users.updateUserMetadata(id, {
        publicMetadata: { role: null }, // Clear secure role
        unsafeMetadata: { role: newRole }, // Set client role
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin] error updating user role:", error);
    return NextResponse.json({ error: "Failed to update user role" }, { status: 500 });
  }
}
