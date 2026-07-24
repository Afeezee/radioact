import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/serverAuth";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const client = await clerkClient();
    
    // Clear the pending status by setting the role to rejected
    await client.users.updateUserMetadata(id, {
      unsafeMetadata: {
        role: "rejected",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin] error rejecting user:", error);
    return NextResponse.json({ error: "Failed to reject user" }, { status: 500 });
  }
}
