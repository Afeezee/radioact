import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthUserId } from "@/lib/serverAuth";
import { analyzeImage, hasAnthropic, hasGroq, NoVisionModelAvailableError } from "@/lib/groq";
import {
  enrichFindingWithHolon,
  flagFindingToTwin,
  hasHolon,
  hasOntomorph,
  saveInspectorNotes,
} from "@/lib/ontomorph";
import { resolveRegion, toBodyCoord } from "@/lib/regions";
import { getDB } from "@/lib/db";
import { publishFinding } from "@/lib/stream";
import type { Finding, StoredFinding } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  patientId: string;
  imageDataUrl: string;
  filename?: string;
  context?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  if (!body?.patientId || !body?.imageDataUrl) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const db = await getDB();
  const ownerUserId = await getAuthUserId();

  const patient = await db.ensurePatient({
    id: body.patientId,
    name: body.patientId,
    twinGrantToken: process.env.DTP_GRANT_TOKEN,
  });

  const scanId = `s_${randomUUID().slice(0, 8)}`;
  await db.insertScan({
    id: scanId,
    patientId: patient.id,
    imageDataUrl: body.imageDataUrl,
    uploadedAt: new Date().toISOString(),
  });

  const clinicalContext = (body.context ?? "").trim().slice(0, 800) || undefined;
  let analysis;
  try {
    analysis = await analyzeImage(
      body.imageDataUrl,
      body.filename,
      clinicalContext,
    );
  } catch (error) {
    if (error instanceof NoVisionModelAvailableError) {
      return NextResponse.json(
        {
          error: "no_vision_model",
          message:
            "Your Groq account does not currently have any vision-capable models available. Vision models tried: " +
            error.triedModels.join(", ") +
            ". Update the key or switch to a provider that ships a vision model.",
          triedModels: error.triedModels,
        },
        { status: 503 },
      );
    }
    const status = getErrorStatus(error);
    const code = getErrorCode(error);
    const providerMessage = getErrorMessage(error);
    console.error("[analyze] image analysis failed:", error);
    const invalidImage =
      status === 400 &&
      (code === "invalid_image" ||
        providerMessage.toLowerCase().includes("image must") ||
        providerMessage.toLowerCase().includes("invalid image"));
    return NextResponse.json(
      {
        error: invalidImage
          ? "invalid_image"
          : code === "json_validate_failed"
            ? "analysis_format_failed"
          : status === 401 || status === 403
            ? "groq_access_denied"
            : "analysis_unavailable",
        message:
          invalidImage
            ? providerMessage || "Use a valid image file that your browser can open, then try again."
            : code === "json_validate_failed"
              ? "The analysis model returned an invalid structured response. The app retried automatically; please try the image again."
            : status === 401 || status === 403
              ? "The configured Groq service rejected this request. Check the API key and network access, then try again."
              : providerMessage || "The image analysis service is temporarily unavailable. Please try again.",
      },
      { status: invalidImage ? 400 : 503 },
    );
  }

  const stored: StoredFinding[] = [];
  for (const f of analysis.findings) {
    const enriched = await enrich(f);
    const region = resolveRegion(enriched.bodySystem, enriched.region);
    const withFma: Finding = {
      ...enriched,
      fmaCode: region.fmaCode,
      fmaLabel: region.label,
    };
    const coord = toBodyCoord(region.x, region.y);
    const { eventId } = await flagFindingToTwin(withFma, coord);

    // Best-effort: also persist as the provider's inspector note for the
    // structure, so a clinician opening that structure sees RadioAct's read.
    if (hasOntomorph() && region.fmaCode) {
      const note = composeNote(withFma);
      saveInspectorNotes(region.fmaCode, note).catch(() => {});
    }

    const row: StoredFinding = {
      ...withFma,
      id: `f_${randomUUID().slice(0, 8)}`,
      scanId,
      patientId: patient.id,
      patientName: patient.name,
      ontomorphEventId: eventId,
      createdAt: new Date().toISOString(),
      clinicalContext,
      ownerUserId,
      status: "private",
    };
    await db.insertFinding(row);
    publishFinding(row);
    stored.push(row);
  }

  return NextResponse.json({
    scanId,
    imageQuality: analysis.imageQuality,
    disclaimer: analysis.disclaimer,
    findings: stored,
    mode: {
      groq: hasGroq(),
      holon: hasHolon(),
      ontomorph: hasOntomorph(),
      anthropic: hasAnthropic(),
    },
  });
}

async function enrich(f: Finding): Promise<Finding> {
  if (!hasHolon()) return f;
  const holon = await enrichFindingWithHolon(f);
  return holon ? { ...f, holon } : f;
}

function composeNote(f: Finding): string {
  const conf = Math.round(f.confidence * 100);
  const parts = [
    `RadioAct triage read (${conf}% confidence, requires clinician confirmation)`,
    `Possible: ${f.finding}`,
    `Region: ${f.region}`,
    f.reasoning ? `Reasoning: ${f.reasoning}` : null,
    f.holon?.conceptName
      ? `HOLON concept: ${f.holon.conceptName} (${f.holon.vocabularyId ?? "?"}:${f.holon.conceptCode ?? "?"})`
      : null,
    "Not a diagnosis.",
  ].filter(Boolean);
  return parts.join("\n");
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  if (error instanceof Error) {
    const match = error.message.match(/\b([1-5]\d{2})\b/);
    return match ? Number(match[1]) : undefined;
  }
  return undefined;
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("error" in error)) {
    return undefined;
  }
  const code = (error as { error?: { code?: unknown } }).error?.code;
  return typeof code === "string" ? code : undefined;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "error" in error) {
    const message = (error as { error?: { message?: unknown } }).error?.message;
    if (typeof message === "string") return message;
  }
  if (error instanceof Error) {
    const match = error.message.match(/^\d{3}\s+(.*)$/s);
    return match?.[1] ?? error.message;
  }
  return "";
}
