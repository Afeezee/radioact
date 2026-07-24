import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getAuthContext } from "@/lib/serverAuth";
import type { FindingStatus } from "@/lib/types";

export const runtime = "nodejs";

// Role-aware read:
//   Patient  → only findings they own (all statuses).
//   Clinician → all pending_review, plus reviewed findings they marked (audit).
//   Unknown / demo → old behaviour, everything.
export async function GET(req: NextRequest) {
  const db = await getDB();
  const patientId = req.nextUrl.searchParams.get("patientId") ?? undefined;
  const statusParam = req.nextUrl.searchParams.get("status") ?? undefined;
  const scope = req.nextUrl.searchParams.get("scope") ?? undefined;

  const { userId, role } = await getAuthContext();
  const statuses = statusParam
    ? (statusParam.split(",") as FindingStatus[])
    : undefined;

  if (role === "patient") {
    const findings = await db.listFindings({
      patientId,
      ownerUserId: userId,
      status: statuses,
    });
    return NextResponse.json({ findings, scope: "owner" });
  }

  if (role === "clinician") {
    // Default clinician view: the pending queue.
    const wanted: FindingStatus[] =
      scope === "reviewed"
        ? ["reviewed"]
        : scope === "all"
          ? ["pending_review", "reviewed"]
          : ["pending_review"];
    const findings = await db.listFindings({
      patientId,
      status: statuses ?? wanted,
    });
    return NextResponse.json({ findings, scope: scope ?? "queue" });
  }

  // Fallback (no Clerk or role unset): unrestricted.
  const findings = await db.listFindings({ patientId, status: statuses });
  return NextResponse.json({ findings, scope: "unrestricted" });
}
