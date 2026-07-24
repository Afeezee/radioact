import { NextRequest, NextResponse } from "next/server";
import {
  getInspectorNotes,
  getInspectorSnapshot,
  hasOntomorph,
  saveInspectorNotes,
} from "@/lib/ontomorph";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ fmaCode: string }> },
) {
  const { fmaCode } = await ctx.params;
  if (!hasOntomorph()) {
    return NextResponse.json({ snapshot: demoSnapshot(fmaCode), notes: null, demo: true });
  }
  const [snapshot, notes] = await Promise.all([
    getInspectorSnapshot(fmaCode),
    getInspectorNotes(fmaCode),
  ]);
  return NextResponse.json({ snapshot, notes, demo: false });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ fmaCode: string }> },
) {
  const { fmaCode } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const providerNotes = String(body?.providerNotes ?? "").slice(0, 4000);
  if (!hasOntomorph()) {
    return NextResponse.json({
      notes: { providerNotes, updatedAt: new Date().toISOString() },
      demo: true,
    });
  }
  const updated = await saveInspectorNotes(fmaCode, providerNotes);
  return NextResponse.json({ notes: updated, demo: false });
}

function demoSnapshot(fmaCode: string) {
  return {
    structureName: labelFor(fmaCode),
    fmaId: fmaCode,
    biomarkers: [
      { label: "Baseline scan availability", value: "no prior on file", trend: "neutral", verified: false },
    ],
    lastScan: null,
    aiRisk: null,
    dataSources: [],
    withheldCount: 0,
    synthetic: true,
  };
}

function labelFor(code: string): string {
  return `Structure ${code}`;
}
