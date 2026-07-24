import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { hasClerk } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  if (!hasClerk()) {
    return NextResponse.json({ error: "Clerk not configured" }, { status: 400 });
  }

  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({ 
      emailAddress: ["olagunjuafeez@gmail.com"]
    });

    if (users.data.length === 0) {
      return NextResponse.json({ 
        error: "User olagunjuafeez@gmail.com not found. Sign up first." 
      }, { status: 404 });
    }

    const targetUser = users.data[0];

    await client.users.updateUserMetadata(targetUser.id, {
      publicMetadata: {
        role: "admin",
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: "olagunjuafeez@gmail.com is now an admin." 
    });
  } catch (error) {
    console.error("[admin] seed error:", error);
    return NextResponse.json({ error: "Failed to seed admin" }, { status: 500 });
  }
}
