import { NextRequest, NextResponse } from "next/server";
import { hasOntomorph, runSimulation } from "@/lib/ontomorph";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  simulationType: string;
  params?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const simulationType = String(body?.simulationType ?? "");
  const params = body?.params ?? {};
  if (!simulationType) {
    return NextResponse.json({ error: "missing_simulationType" }, { status: 400 });
  }
  if (!hasOntomorph()) {
    return NextResponse.json({
      result: demoSimulation(simulationType, params),
      demo: true,
    });
  }
  const result = await runSimulation(simulationType, params);
  if (!result) {
    return NextResponse.json({ error: "simulation_failed" }, { status: 502 });
  }
  return NextResponse.json({
    result: {
      type: result.type,
      scalarOutputs: result.scalarOutputs,
      disclaimer: result.disclaimer,
      narration: result.narration,
      animationAvailable: result.animation !== null,
    },
    demo: false,
  });
}

function demoSimulation(type: string, params: Record<string, unknown>) {
  if (type === "ldl_trajectory") {
    const start = Number(params.baseline_ldl ?? 158);
    const target = Math.max(70, Math.round(start * 0.62));
    return {
      type,
      scalarOutputs: {
        peak_value: start,
        peak_month: 0,
        end_value: target,
        end_month: 12,
      },
      disclaimer:
        "Projection based on baseline lab values; not a treatment recommendation.",
      narration: {
        narrative: `Starting a statin projects LDL from ${start} mg/dL toward ~${target} mg/dL over 12 months on this twin's own baseline lipid trajectory.`,
        keyFindings: [
          `LDL projected down ${start - target} mg/dL`,
          "Effect front-loaded in months 1–3",
        ],
        caveats: [
          "Assumes adherence and no adverse events",
          "Baseline auto-derived from twin labs when available",
        ],
      },
      animationAvailable: false,
    };
  }
  return {
    type,
    scalarOutputs: {},
    disclaimer: "Simulation demo mode",
    narration: null,
    animationAvailable: false,
  };
}
