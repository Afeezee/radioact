import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { isAdmin } from "@/lib/serverAuth";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDB();
    const findings = await db.listFindings();

    let privateCount = 0;
    let pendingCount = 0;
    let reviewedCount = 0;

    for (const f of findings) {
      if (f.status === "private") privateCount++;
      else if (f.status === "pending_review") pendingCount++;
      else if (f.status === "reviewed") reviewedCount++;
    }

    return NextResponse.json({
      stats: {
        totalFindings: findings.length,
        private: privateCount,
        pending: pendingCount,
        reviewed: reviewedCount,
      }
    });
  } catch (error) {
    console.error("[admin] error fetching stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
