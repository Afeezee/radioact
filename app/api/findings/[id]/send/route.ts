import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getAuthContext } from "@/lib/serverAuth";
import { publishFinding } from "@/lib/stream";

export const runtime = "nodejs";

// Patient action: hand a private finding off to a clinician.
// Enforces ownership: only the finding's owner (or the demo "anon" user) can send it.
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const db = await getDB();
  const cur = await db.getFinding(id);
  if (!cur) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { userId, role } = await getAuthContext();
  const isOwner = cur.ownerUserId === userId || cur.ownerUserId === "anon";
  if (!isOwner && role !== "unknown") {
    return NextResponse.json({ error: "not_owner" }, { status: 403 });
  }

  if (cur.status !== "private") {
    return NextResponse.json(
      { error: "wrong_status", current: cur.status },
      { status: 409 },
    );
  }

  const updated = await db.markSent(id);
  if (updated) publishFinding(updated);
  return NextResponse.json({ finding: updated });
}
