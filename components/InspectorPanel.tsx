"use client";
import { useEffect, useState } from "react";
import type {
  InspectorNotes,
  InspectorSnapshot,
  SimulationScalarResult,
  StoredFinding,
} from "@/lib/types";
import { systemLabel } from "@/lib/regions";

interface Props {
  finding: StoredFinding;
  onReviewed: (f: StoredFinding) => void;
  viewerRole?: "patient" | "clinician";
}

export function InspectorPanel({ finding, onReviewed, viewerRole }: Props) {
  const [snapshot, setSnapshot] = useState<InspectorSnapshot | null>(null);
  const [notes, setNotes] = useState<InspectorNotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoInspector, setDemoInspector] = useState(false);

  useEffect(() => {
    if (!finding.fmaCode) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/inspector/${encodeURIComponent(finding.fmaCode)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setSnapshot(d.snapshot ?? null);
        setNotes(d.notes ?? null);
        setDemoInspector(!!d.demo);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [finding.id, finding.fmaCode]);

  return (
    <div className="card p-4 animate-fadeIn space-y-4">
      <Header finding={finding} onReviewed={onReviewed} viewerRole={viewerRole} />

      <section>
        <SectionTitle
          title="Anatomical inspector"
          hint={
            finding.fmaCode
              ? `${finding.fmaLabel ?? "structure"} · ${finding.fmaCode}`
              : "no FMA anchor"
          }
        />
        {loading ? (
          <p className="text-xs text-muted">Loading structure snapshot…</p>
        ) : snapshot ? (
          <InspectorView snapshot={snapshot} notes={notes} demo={demoInspector} />
        ) : (
          <p className="text-xs text-muted">
            No inspector data for this structure yet.
          </p>
        )}
      </section>

      {finding.holon && <HolonView finding={finding} />}

      {finding.bodySystem === "cardiovascular" && (
        <WhatIfPanel />
      )}
    </div>
  );
}

function Header({
  finding,
  onReviewed,
  viewerRole,
}: {
  finding: StoredFinding;
  onReviewed: (f: StoredFinding) => void;
  viewerRole?: "patient" | "clinician";
}) {
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  async function markReviewed() {
    setBusy(true);
    try {
      const res = await fetch(`/api/findings/${finding.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ by: "clinician" }),
      });
      const data = await res.json();
      if (data.finding) onReviewed(data.finding);
    } finally {
      setBusy(false);
    }
  }

  async function sendToClinician() {
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/findings/${finding.id}/send`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.finding) onReviewed(data.finding);
      else setSendError(data.error ?? "Could not send. Try again.");
    } finally {
      setSending(false);
    }
  }
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-display text-lg leading-tight">{finding.finding}</h3>
        <span className="text-xs text-muted">
          {new Date(finding.createdAt).toLocaleTimeString()}
        </span>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">System</dt>
        <dd>{systemLabel(finding.bodySystem)}</dd>
        <dt className="text-muted">Region</dt>
        <dd>{finding.region}</dd>
        <dt className="text-muted">Confidence</dt>
        <dd>{Math.round(finding.confidence * 100)}%</dd>
        <dt className="text-muted">Reasoning</dt>
        <dd>{finding.reasoning}</dd>
        {finding.clinicalContext && (
          <>
            <dt className="text-muted">Context</dt>
            <dd className="italic">"{finding.clinicalContext}"</dd>
          </>
        )}
        {finding.ontomorphEventId && (
          <>
            <dt className="text-muted">Event</dt>
            <dd className="font-mono text-xs truncate">{finding.ontomorphEventId}</dd>
          </>
        )}
      </dl>

      {/* Plain-language explanation */}
      {finding.patientExplanation && viewerRole === "patient" && (
        <div className="mt-3 rounded-xl bg-accent/5 border border-accent/20 px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-accent text-base mt-0.5" aria-hidden>ℹ️</span>
            <div>
              <div className="text-sm font-medium mb-1">What this means</div>
              <p className="text-sm leading-relaxed">{finding.patientExplanation}</p>
              <p className="text-[11px] text-muted mt-2 leading-relaxed">
                This explanation is for your awareness. Your clinician will confirm or update it after review.
              </p>
            </div>
          </div>
        </div>
      )}
      {finding.patientExplanation && viewerRole === "clinician" && (
        <div className="mt-3 rounded-lg border hairline px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">Patient will see</div>
          <p className="text-xs leading-relaxed">{finding.patientExplanation}</p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {finding.status === "reviewed" ? (
          <span className="text-xs text-muted">
            Reviewed by {finding.reviewedBy ?? "clinician"}
            {finding.reviewedAt ? " · " + new Date(finding.reviewedAt).toLocaleString() : ""}
          </span>
        ) : finding.status === "pending_review" ? (
          viewerRole === "clinician" ? (
            <button className="btn btn-primary" onClick={markReviewed} disabled={busy}>
              {busy ? "Marking…" : "Confirm review"}
            </button>
          ) : (
            <span className="text-xs text-muted">
              Sent {finding.sentAt ? new Date(finding.sentAt).toLocaleString() : "just now"} · awaiting clinician
            </span>
          )
        ) : viewerRole === "clinician" ? (
          <span className="text-xs text-muted">
            Not yet sent by the patient.
          </span>
        ) : (
          <>
            <button className="btn btn-primary" onClick={sendToClinician} disabled={sending}>
              {sending ? "Sending…" : "Send to clinician"}
            </button>
            {sendError && (
              <span className="text-xs text-danger">{sendError}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InspectorView({
  snapshot,
  notes,
  demo,
}: {
  snapshot: InspectorSnapshot;
  notes: InspectorNotes | null;
  demo: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{snapshot.structureName}</span>
        {demo ? (
          <span className="tag">demo snapshot</span>
        ) : (
          <span className="tag accent">live inspector</span>
        )}
        {snapshot.aiRisk && (
          <span className="tag flag">
            AI risk {Math.round(snapshot.aiRisk.score * 100)}%
          </span>
        )}
      </div>
      {snapshot.biomarkers.length > 0 && (
        <ul className="text-xs divide-y hairline card-quiet">
          {snapshot.biomarkers.slice(0, 4).map((b, i) => (
            <li key={i} className="px-3 py-1.5 flex items-center gap-2">
              <span className="text-muted flex-1 truncate">{b.label}</span>
              <span className="font-mono">
                {b.value}
                {b.unit ? ` ${b.unit}` : ""}
              </span>
              <TrendArrow trend={b.trend} />
            </li>
          ))}
        </ul>
      )}
      {snapshot.aiRisk?.differential.length ? (
        <p className="text-xs text-muted">
          Differential: {snapshot.aiRisk.differential.slice(0, 4).join(" · ")}
        </p>
      ) : null}
      {snapshot.dataSources.length > 0 && (
        <p className="text-xs text-muted">
          {snapshot.dataSources.length} LOINC data source
          {snapshot.dataSources.length === 1 ? "" : "s"} ·{" "}
          {snapshot.dataSources
            .slice(0, 3)
            .map((d) => d.display)
            .join(", ")}
        </p>
      )}
      {snapshot.withheldCount > 0 && (
        <p className="text-xs text-muted">
          {snapshot.withheldCount} data point{snapshot.withheldCount === 1 ? "" : "s"} withheld by grant scope
        </p>
      )}
      {notes?.providerNotes && (
        <div className="card-quiet px-3 py-2 text-xs">
          <div className="text-muted mb-0.5">Provider note</div>
          <div className="whitespace-pre-line">{notes.providerNotes}</div>
        </div>
      )}
    </div>
  );
}

function HolonView({ finding }: { finding: StoredFinding }) {
  const h = finding.holon!;
  return (
    <section>
      <SectionTitle title="HOLON knowledge" />
      <div className="text-sm">
        <span className="font-medium">{h.conceptName ?? "—"}</span>
        {h.vocabularyId && h.conceptCode && (
          <span className="text-muted">
            {" "}
            · {h.vocabularyId}:{h.conceptCode}
          </span>
        )}
      </div>
      {h.ancestors?.length ? (
        <p className="text-xs text-muted mt-1">
          Ancestors: {h.ancestors.map((a) => a.name).join(" ▸ ")}
        </p>
      ) : null}
      {h.mappings?.length ? (
        <p className="text-xs text-muted mt-1">
          Mapped: {h.mappings.map((m) => `${m.system}:${m.code}`).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}

function WhatIfPanel() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationScalarResult | null>(null);
  const [demo, setDemo] = useState(false);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulationType: "ldl_trajectory",
          params: { intervention: "start_statin", duration_months: 12 },
        }),
      });
      const data = await res.json();
      setResult(data.result);
      setDemo(!!data.demo);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section>
      <SectionTitle
        title="What-if"
        hint="project intervention against this twin"
      />
      {result ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Statin, 12 months</span>
            {demo ? (
              <span className="tag">demo</span>
            ) : (
              <span className="tag accent">
                {result.animationAvailable ? "3D + scalar" : "scalar only"}
              </span>
            )}
          </div>
          {result.narration?.narrative && (
            <p className="text-sm">{result.narration.narrative}</p>
          )}
          {result.scalarOutputs && Object.keys(result.scalarOutputs).length > 0 && (
            <ul className="text-xs text-muted grid grid-cols-2 gap-x-3">
              {Object.entries(result.scalarOutputs).map(([k, v]) => (
                <li key={k} className="flex justify-between">
                  <span>{k}</span>
                  <span className="font-mono">{String(v)}</span>
                </li>
              ))}
            </ul>
          )}
          {result.disclaimer && (
            <p className="text-xs text-muted italic">{result.disclaimer}</p>
          )}
        </div>
      ) : (
        <button className="btn btn-ghost" onClick={run} disabled={running}>
          {running ? "Simulating…" : "Simulate: start statin, 12 mo"}
        </button>
      )}
    </section>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <h4 className="text-xs uppercase tracking-wider text-muted">{title}</h4>
      {hint && <span className="text-[10px] text-muted">{hint}</span>}
    </div>
  );
}

function TrendArrow({ trend }: { trend: "up" | "down" | "neutral" }) {
  if (trend === "up")
    return <span className="text-flag text-xs" aria-label="up">▲</span>;
  if (trend === "down")
    return <span className="text-accent text-xs" aria-label="down">▼</span>;
  return <span className="text-muted text-xs" aria-label="stable">—</span>;
}
