"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { InspectorPanel } from "./InspectorPanel";
import { StatusTag } from "./StatusTag";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import type { Patient, StoredFinding } from "@/lib/types";
import { systemLabel } from "@/lib/regions";
import { TRIAGE_DISCLAIMER } from "@/lib/prompt";

const TwinScene = dynamic(
  () => import("./TwinScene").then((module) => module.TwinScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        Loading twin…
      </div>
    ),
  },
);

type Phase = "idle" | "reading" | "resolving" | "pinning" | "done" | "error";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "Upload a scan to begin",
  reading: "Reading image…",
  resolving: "Resolving against HOLON…",
  pinning: "Pinning to twin…",
  done: "Findings ready",
  error: "Analysis failed",
};

export function Reader() {
  const identity = useCurrentPatient();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState<string>("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | undefined>();
  const [context, setContext] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [analysisError, setAnalysisError] = useState<string | undefined>();
  const [lastAnalysisFindingCount, setLastAnalysisFindingCount] = useState<
    number | undefined
  >();
  const [findings, setFindings] = useState<StoredFinding[]>([]);
  const [selected, setSelected] = useState<string | undefined>();
  const [meta, setMeta] = useState<{
    imageQuality?: string;
    disclaimer?: string;
    mode?: { groq: boolean; holon: boolean; ontomorph: boolean; anthropic?: boolean };
  }>({});

  // Bind the reader to the current signed-in patient (or a stable demo id).
  useEffect(() => {
    if (!identity.ready) return;
    setPatientId(identity.patientId);
    setPatients([
      {
        id: identity.patientId,
        name: identity.patientName,
        createdAt: new Date().toISOString(),
      },
    ]);
  }, [identity.ready, identity.patientId, identity.patientName]);

  // Load existing findings for the current patient.
  useEffect(() => {
    if (!patientId) return;
    fetch(`/api/findings?patientId=${patientId}`)
      .then((r) => r.json())
      .then((d) => setFindings(d.findings ?? []))
      .catch(() => {});
  }, [patientId]);

  const onFile = useCallback(async (file: File) => {
    setAnalysisError(undefined);
    setLastAnalysisFindingCount(undefined);
    try {
      const imageDataUrl = await normalizeImage(file);
      setFilename(file.name);
      setImageDataUrl(imageDataUrl);
    } catch {
      setImageDataUrl(null);
      setAnalysisError(
        "This image could not be opened in your browser. Choose a different image file and try again.",
      );
      setPhase("error");
    }
  }, []);

  async function analyze() {
    if (!imageDataUrl || !patientId) return;
    setAnalysisError(undefined);
    setLastAnalysisFindingCount(undefined);
    setPhase("reading");
    setFindings((prior) => prior.filter((f) => f.scanId !== "s_ambient")); // keep patient prior, clear ambient
    try {
      // simulate the three visible beats — actual work is one request but we
      // still narrate the stages so the sequence reads clearly.
      const req = fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          imageDataUrl,
          filename,
          context: context.trim() || undefined,
        }),
      });
      await pause(650);
      setPhase("resolving");
      await pause(500);
      const res = await req;
      const data = (await res.json().catch(() => null)) as AnalysisResponse | null;
      if (!res.ok) {
        setAnalysisError(
          data?.message ?? "Analysis could not be completed. Please try again.",
        );
        setPhase("error");
        return;
      }
      if (!data) throw new Error("Analysis returned no response.");
      const nextFindings = data.findings ?? [];
      setLastAnalysisFindingCount(nextFindings.length);
      setMeta({
        imageQuality: data.imageQuality,
        disclaimer: data.disclaimer,
        mode: data.mode,
      });
      setFindings((prev) => {
        const dedup = new Map<string, StoredFinding>();
        for (const f of [...nextFindings, ...prev]) {
          dedup.set(f.id, f);
        }
        return Array.from(dedup.values()).sort(
          (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
        );
      });
      setSelected(nextFindings[0]?.id);
      setPhase("done");
    } catch {
      setAnalysisError("Analysis could not be completed. Please try again.");
      setPhase("error");
    }
  }

  const active = useMemo(
    () => findings.find((f) => f.id === selected),
    [findings, selected],
  );

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Twin panel */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b hairline">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg">Your digital twin</span>
            {identity.ready && (
              <span className="tag" title={identity.patientId}>
                {identity.patientName}
              </span>
            )}
          </div>
          <ModeBadges mode={meta.mode} />
        </div>
        <div className="relative aspect-[400/720] max-h-[76vh] mx-auto">
          <TwinScene
            findings={findings}
            activeId={selected}
            onSelect={setSelected}
            scanning={phase === "reading" || phase === "resolving" || phase === "pinning"}
          />
        </div>
      </section>

      {/* Right column: upload + status + feed + detail */}
      <section className="flex flex-col gap-4 min-h-0">
        <UploadPanel
          imageDataUrl={imageDataUrl}
          filename={filename}
          context={context}
          onContextChange={setContext}
          phase={phase}
          onFile={onFile}
          onAnalyze={analyze}
          onReset={() => {
            setImageDataUrl(null);
            setFilename(undefined);
            setContext("");
            setAnalysisError(undefined);
            setLastAnalysisFindingCount(undefined);
            setPhase("idle");
          }}
        />
        <StatusStrip
          phase={phase}
          imageQuality={meta.imageQuality}
          errorMessage={analysisError}
          findingCount={lastAnalysisFindingCount}
        />
        <FindingsFeed
          findings={findings}
          activeId={selected}
          onSelect={setSelected}
          phase={phase}
          lastAnalysisFindingCount={lastAnalysisFindingCount}
        />
        {active && (
          <InspectorPanel
            key={active.id}
            finding={active}
            viewerRole="patient"
            onReviewed={(updated) => {
              setFindings((prev) =>
                prev.map((f) => (f.id === updated.id ? updated : f)),
              );
            }}
          />
        )}
        <p className="text-xs text-muted leading-relaxed">
          {meta.disclaimer ?? TRIAGE_DISCLAIMER}
        </p>
      </section>
    </div>
  );
}

function ModeBadges({
  mode,
}: {
  mode?: { groq: boolean; holon: boolean; ontomorph: boolean; anthropic?: boolean };
}) {
  return (
    <div className="flex items-center gap-1.5">
      <ModeTag
        label="Vision"
        state={mode?.anthropic || mode?.groq}
        title={
          mode?.anthropic
            ? "Vision inference: Anthropic Claude"
            : mode?.groq
              ? "Vision inference: Groq"
              : "Vision inference: demo analyzer"
        }
      />
      <ModeTag label="HOLON" state={mode?.holon} title="Clinical knowledge API" />
      <ModeTag label="Twin" state={mode?.ontomorph} title="Ontomorph DTP twin flag + inspector" />
    </div>
  );
}

function ModeTag({
  label,
  state,
  title,
}: {
  label: string;
  state?: boolean;
  title: string;
}) {
  const cls = state ? "tag accent" : "tag";
  const text =
    state === undefined ? `${label} —` : state ? `${label} live` : `${label} demo`;
  return (
    <span className={cls} title={title}>
      {text}
    </span>
  );
}

function UploadPanel({
  imageDataUrl,
  filename,
  context,
  onContextChange,
  phase,
  onFile,
  onAnalyze,
  onReset,
}: {
  imageDataUrl: string | null;
  filename?: string;
  context: string;
  onContextChange: (v: string) => void;
  phase: Phase;
  onFile: (f: File) => void | Promise<void>;
  onAnalyze: () => void;
  onReset: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const busy = phase !== "idle" && phase !== "done" && phase !== "error";

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display text-lg">Upload scan</h2>
        <span className="text-xs text-muted">
          Any browser-supported image
        </span>
      </div>
      {!imageDataUrl ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          className={`w-full aspect-[16/9] rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-sm transition-colors ${
            drag
              ? "border-accent bg-accent/5 text-ink"
              : "hairline text-muted hover:text-ink hover:bg-surface2"
          }`}
        >
          <span className="font-display text-base text-ink mb-1">
            Drop a scan or click to choose
          </span>
          <span className="text-xs">
            Nothing leaves your machine until you press Analyse
          </span>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border hairline bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageDataUrl}
              alt={filename ?? "uploaded scan"}
              className="w-full max-h-[42vh] object-contain"
            />
            {busy && <div className="scan-line" />}
          </div>

          <div>
            <label className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm font-medium text-ink2">
                Symptoms or clinical context <span className="text-muted font-normal">(optional)</span>
              </span>
              <span className="text-xs text-muted">
                {context.length}/800
              </span>
            </label>
            <textarea
              value={context}
              onChange={(e) => onContextChange(e.target.value.slice(0, 800))}
              disabled={busy}
              placeholder="e.g. 42F, 3 weeks cough, night sweats, weight loss. Prior TB contact. Or: 8yo, fell on outstretched hand, wrist pain, no obvious deformity."
              className="input min-h-[92px] resize-y leading-relaxed"
              aria-label="Presenting complaint or clinical context"
            />
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
              Add symptoms or notes from the care team. This helps weight what
              the reader looks for, but never forces a finding; the image still wins.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted truncate">{filename}</span>
            <div className="flex gap-2">
              <button
                onClick={onReset}
                className="btn btn-ghost"
                disabled={busy}
              >
                Replace
              </button>
              <button
                onClick={onAnalyze}
                className="btn btn-primary"
                disabled={busy}
              >
                {busy ? "Analysing…" : "Analyse"}
              </button>
            </div>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}

interface AnalysisResponse {
  error?: string;
  message?: string;
  imageQuality?: string;
  disclaimer?: string;
  mode?: { groq: boolean; holon: boolean; ontomorph: boolean; anthropic?: boolean };
  findings?: StoredFinding[];
}

const MAX_IMAGE_DIMENSION = 2048;

async function normalizeImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("unsupported_image_type");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    if (image.naturalWidth < 2 || image.naturalHeight < 2) {
      throw new Error("undersized_image");
    }

    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const width = Math.max(2, Math.round(image.naturalWidth * scale));
    const height = Math.max(2, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas_unavailable");
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.92);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_decode_failed"));
    image.src = src;
  });
}

function StatusStrip({
  phase,
  imageQuality,
  errorMessage,
  findingCount,
}: {
  phase: Phase;
  imageQuality?: string;
  errorMessage?: string;
  findingCount?: number;
}) {
  const busy = phase === "reading" || phase === "resolving" || phase === "pinning";
  const message =
    phase === "error" && errorMessage
      ? errorMessage
      : phase === "done" && findingCount === 0
        ? "Analysis complete. No findings identified for this scan."
        : PHASE_LABEL[phase];
  return (
    <div className="card-quiet px-4 py-2 text-sm flex items-center gap-3">
      <span
        aria-hidden
        className={`inline-block w-2 h-2 rounded-full ${
          busy
            ? "bg-accent animate-pulse2"
            : phase === "done"
              ? "bg-accent"
              : phase === "error"
                ? "bg-danger"
                : "bg-muted"
        }`}
      />
      <span className="flex-1">{message}</span>
      {imageQuality && phase === "done" && (
        <span className="text-xs text-muted">Image quality: {imageQuality}</span>
      )}
    </div>
  );
}

function FindingsFeed({
  findings,
  activeId,
  onSelect,
  phase,
  lastAnalysisFindingCount,
}: {
  findings: StoredFinding[];
  activeId?: string;
  onSelect: (id: string) => void;
  phase: Phase;
  lastAnalysisFindingCount?: number;
}) {
  const emptyMessage =
    phase === "done" && lastAnalysisFindingCount === 0
      ? "Analysis completed with no findings to pin on this twin."
      : "No findings yet. Upload a scan to begin.";
  return (
    <div className="card">
      <div className="px-4 py-3 border-b hairline flex items-center justify-between">
        <h2 className="font-display text-lg">Findings</h2>
        <span className="text-xs text-muted">
          {findings.length} on this twin
        </span>
      </div>
      {findings.length === 0 ? (
        <div className="p-6 text-sm text-muted text-center">
          {emptyMessage}
        </div>
      ) : (
        <ul className="divide-y hairline">
          {findings.slice(0, 8).map((f) => (
            <li
              key={f.id}
              onClick={() => onSelect(f.id)}
              className={`px-4 py-3 cursor-pointer transition-colors animate-fadeIn ${
                f.id === activeId ? "bg-surface2" : "hover:bg-surface2"
              }`}
            >
              <div className="flex items-start gap-3">
                <ConfidenceMeter value={f.confidence} flag={f.reviewRecommended} reviewed={!!f.reviewedAt} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">
                      {f.finding}
                    </span>
                    <StatusTag status={f.status} />
                  </div>
                  {f.patientExplanation && (
                    <p className="text-xs mt-1 leading-relaxed text-ink2">
                      {f.patientExplanation}
                    </p>
                  )}
                  <div className="text-xs text-muted mt-0.5">
                    {systemLabel(f.bodySystem)} · {f.region}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConfidenceMeter({
  value,
  flag,
  reviewed,
}: {
  value: number;
  flag: boolean;
  reviewed: boolean;
}) {
  const pct = Math.round(value * 100);
  const color = reviewed
    ? "rgb(var(--muted))"
    : flag
      ? "rgb(var(--flag))"
      : "rgb(var(--accent))";
  return (
    <div className="flex flex-col items-center pt-0.5" title={`${pct}% confidence`}>
      <div className="w-9 h-9 relative">
        <svg viewBox="0 0 36 36" className="w-full h-full">
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke="rgb(var(--line))"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 88} 88`}
            transform="rotate(-90 18 18)"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">
          {pct}
        </span>
      </div>
    </div>
  );
}

function pause(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
