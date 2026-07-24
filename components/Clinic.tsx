"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BodySystem, FindingStatus, StoredFinding } from "@/lib/types";
import { systemLabel } from "@/lib/regions";
import { InspectorPanel } from "./InspectorPanel";
import { StatusTag } from "./StatusTag";

const SYSTEMS: BodySystem[] = [
  "respiratory",
  "cardiovascular",
  "skeletal",
  "neurological",
];

type ScopeKey = "queue" | "reviewed";

interface TwinStreamEvent {
  eventId: string;
  system: BodySystem;
  title: string;
  data: Record<string, unknown>;
  occurredAt: string;
}

type Selection =
  | { kind: "finding"; id: string }
  | { kind: "event"; id: string };

export function Clinic() {
  const [scope, setScope] = useState<ScopeKey>("queue");
  const [rows, setRows] = useState<StoredFinding[]>([]);
  const [streamEvents, setStreamEvents] = useState<TwinStreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState<BodySystem | "all">("all");
  const [ambient, setAmbient] = useState(true);
  const [selected, setSelected] = useState<Selection | undefined>();
  const seen = useRef(new Set<string>());
  const seenEvents = useRef(new Set<string>());

  // Reload whenever the scope changes.
  useEffect(() => {
    seen.current = new Set();
    fetch(`/api/findings?scope=${scope}`)
      .then((r) => r.json())
      .then((d) => {
        const list = (d.findings ?? []) as StoredFinding[];
        for (const f of list) seen.current.add(f.id);
        setRows(list);
      })
      .catch(() => {});
  }, [scope]);

  // SSE stream — filtered by scope on the client (we still receive everything).
  useEffect(() => {
    let closed = false;
    let es: EventSource | null = null;

    function connect() {
      if (closed) return;
      es = new EventSource("/api/stream");
      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        es?.close();
        setTimeout(connect, 2000);
      };
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "finding") {
            const f = msg.finding as StoredFinding;
            if (!statusInScope(f.status, scope)) return;
            if (seen.current.has(f.id)) {
              setRows((prev) => prev.map((r) => (r.id === f.id ? f : r)));
              return;
            }
            seen.current.add(f.id);
            setRows((prev) => [f, ...prev]);
            return;
          }
          if (msg.type !== "twin-event") return;
          const event = msg.event as TwinStreamEvent;
          if (seenEvents.current.has(event.eventId)) return;
          seenEvents.current.add(event.eventId);
          setStreamEvents((prev) =>
            [event, ...prev]
              .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
              .slice(0, 60),
          );
        } catch {
          /* ignore */
        }
      };
    }
    connect();
    return () => {
      closed = true;
      es?.close();
    };
  }, [scope]);

  // Ambient emitter — simulates other patients sending scans.
  useEffect(() => {
    if (!ambient) return;
    const int = setInterval(() => {
      fetch("/api/demo-emit", { method: "POST" }).catch(() => {});
    }, 12000);
    return () => clearInterval(int);
  }, [ambient]);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.bodySystem === filter)),
    [rows, filter],
  );
  const patientRows = useMemo(
    () => filtered.filter((r) => r.scanId !== "s_ambient"),
    [filtered],
  );
  const syntheticRows = useMemo(
    () => filtered.filter((r) => r.scanId === "s_ambient"),
    [filtered],
  );
  const filteredEvents = useMemo(
    () =>
      filter === "all"
        ? streamEvents
        : streamEvents.filter((event) => event.system === filter),
    [filter, streamEvents],
  );

  const counts = useMemo(() => {
    const c: Record<BodySystem, number> = {
      respiratory: 0,
      cardiovascular: 0,
      skeletal: 0,
      neurological: 0,
    };
    for (const r of rows) c[r.bodySystem]++;
    return c;
  }, [rows]);

  const active = useMemo(
    () =>
      selected?.kind === "finding"
        ? rows.find((r) => r.id === selected.id)
        : undefined,
    [rows, selected],
  );
  const activeEvent = useMemo(
    () =>
      selected?.kind === "event"
        ? streamEvents.find((event) => event.eventId === selected.id)
        : undefined,
    [selected, streamEvents],
  );

  function upsert(updated: StoredFinding) {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === updated.id ? updated : r));
      // If the update knocked it out of scope, drop it.
      return next.filter((r) => statusInScope(r.status, scope));
    });
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="card p-3 flex flex-wrap items-center gap-3">
          <span
            aria-hidden
            className={`inline-block w-2 h-2 rounded-full ${
              connected ? "bg-accent animate-pulse2" : "bg-muted"
            }`}
          />
          <span className="text-sm">
            {connected ? "Live" : "Reconnecting…"} · {patientRows.length + syntheticRows.length} {scope === "queue" ? "in queue" : "reviewed"} · {filteredEvents.length} twin events
          </span>
          <div className="flex gap-1">
            <ScopeBtn
              label="Pending"
              active={scope === "queue"}
              onClick={() => setScope("queue")}
            />
            <ScopeBtn
              label="Reviewed"
              active={scope === "reviewed"}
              onClick={() => setScope("reviewed")}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            <SysBtn
              label="All"
              active={filter === "all"}
              count={rows.length}
              onClick={() => setFilter("all")}
            />
            {SYSTEMS.map((s) => (
              <SysBtn
                key={s}
                label={systemLabel(s)}
                active={filter === s}
                count={counts[s]}
                onClick={() => setFilter(s)}
              />
            ))}
          </div>
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={ambient}
              onChange={(e) => setAmbient(e.target.checked)}
            />
            Ambient demo traffic
          </label>
        </div>

        {patientRows.length === 0 && syntheticRows.length === 0 && filteredEvents.length === 0 ? (
          <div className="card p-10 text-center text-muted text-sm">
            {scope === "queue"
              ? "No findings waiting on review right now."
              : "No reviewed findings yet."}
          </div>
        ) : (
          <div className="space-y-4">
            <FeedSection
              title="Patient handoffs"
              description="Findings sent from the patient reader and waiting for clinician review."
              empty={scope === "queue" ? "No patient handoffs in the queue." : "No reviewed patient handoffs in this filter."}
            >
              {patientRows.map((f) => (
                <FindingCard
                  key={f.id}
                  f={f}
                  active={selected?.kind === "finding" && f.id === selected.id}
                  label="Patient handoff"
                  onSelect={() => setSelected({ kind: "finding", id: f.id })}
                />
              ))}
            </FeedSection>

            <FeedSection
              title="Synthetic ambient findings"
              description="Demo traffic generated inside RadioAct to keep the queue active during a walkthrough."
              empty="No synthetic ambient findings in this filter."
            >
              {syntheticRows.map((f) => (
                <FindingCard
                  key={f.id}
                  f={f}
                  active={selected?.kind === "finding" && f.id === selected.id}
                  label="Synthetic"
                  onSelect={() => setSelected({ kind: "finding", id: f.id })}
                />
              ))}
            </FeedSection>

            <FeedSection
              title="Twin stream events"
              description="Non-RadioAct events arriving from the granted twin stream, separated from the internal demo queue."
              empty="No twin stream events in this filter."
            >
              {filteredEvents.map((event) => (
                <TwinEventCard
                  key={event.eventId}
                  event={event}
                  active={selected?.kind === "event" && event.eventId === selected.id}
                  onSelect={() => setSelected({ kind: "event", id: event.eventId })}
                />
              ))}
            </FeedSection>
          </div>
        )}
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        {active ? (
          <InspectorPanel
            key={active.id}
            finding={active}
            viewerRole="clinician"
            onReviewed={upsert}
          />
        ) : activeEvent ? (
          <TwinEventPanel event={activeEvent} />
        ) : (
          <div className="card p-6 text-sm text-muted">
            Select a finding to open its inspector.
          </div>
        )}
      </aside>
    </div>
  );
}

function statusInScope(status: FindingStatus, scope: ScopeKey): boolean {
  if (scope === "queue") return status === "pending_review";
  return status === "reviewed";
}

function FeedSection({
  title,
  description,
  empty,
  children,
}: {
  title: string;
  description: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <section className="card p-4 space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg">{title}</h2>
          <span className="tag">{items.length}</span>
        </div>
        <p className="text-xs text-muted mt-1 leading-relaxed">{description}</p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border hairline px-3 py-4 text-sm text-muted text-center">
          {empty}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">{children}</ul>
      )}
    </section>
  );
}

function ScopeBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`btn !py-1 !px-2.5 !text-xs ${
        active ? "btn-primary" : "btn-ghost"
      }`}
    >
      {label}
    </button>
  );
}

function SysBtn({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`btn !py-1 !px-2.5 !text-xs ${
        active ? "btn-primary" : "btn-ghost"
      }`}
    >
      {label} <span className="opacity-70 ml-1">{count}</span>
    </button>
  );
}

function FindingCard({
  f,
  active,
  label,
  onSelect,
}: {
  f: StoredFinding;
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  const conf = Math.round(f.confidence * 100);
  return (
    <li
      onClick={onSelect}
      className={`card p-4 animate-fadeIn cursor-pointer transition-colors ${
        active ? "ring-1 ring-accent" : "hover:bg-surface2"
      }`}
    >
      <div className="flex items-start gap-3">
        <ConfidenceDot value={conf} flag={f.reviewRecommended} reviewed={f.status === "reviewed"} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{f.finding}</span>
            <StatusTag status={f.status} />
            <span className="tag">{label}</span>
            <span className="tag">{systemLabel(f.bodySystem)}</span>
          </div>
          <div className="text-xs text-muted mt-1">
            {f.patientName} · {f.region}
            {f.fmaCode ? ` · ${f.fmaCode}` : ""}
          </div>
          {f.reasoning && (
            <p className="text-xs mt-1.5 leading-relaxed">{f.reasoning}</p>
          )}
          {f.patientExplanation && (
            <div className="mt-1.5 rounded-md bg-surface2 px-2.5 py-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted">Patient sees: </span>
              <span className="text-xs leading-relaxed">{f.patientExplanation}</span>
            </div>
          )}
          <div className="mt-2 text-xs text-muted flex justify-between">
            <span>Received {f.sentAt ? new Date(f.sentAt).toLocaleTimeString() : "—"}</span>
            <span>{new Date(f.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

function TwinEventCard({
  event,
  active,
  onSelect,
}: {
  event: TwinStreamEvent;
  active: boolean;
  onSelect: () => void;
}) {
  const source = typeof event.data.source === "string" ? event.data.source : "Twin stream";
  return (
    <li
      onClick={onSelect}
      className={`card p-4 animate-fadeIn cursor-pointer transition-colors ${
        active ? "ring-1 ring-accent" : "hover:bg-surface2"
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{event.title}</span>
          <span className="tag accent">Twin stream</span>
          <span className="tag">{systemLabel(event.system)}</span>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Source: {source}
        </p>
        <div className="text-xs text-muted flex justify-between gap-3">
          <span className="truncate">Event ID {event.eventId}</span>
          <span>{new Date(event.occurredAt).toLocaleString()}</span>
        </div>
      </div>
    </li>
  );
}

function TwinEventPanel({ event }: { event: TwinStreamEvent }) {
  const entries = Object.entries(event.data ?? {});
  return (
    <div className="card p-4 space-y-4 animate-fadeIn">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display text-lg leading-tight">{event.title}</h3>
          <span className="tag accent">Twin stream</span>
          <span className="tag">{systemLabel(event.system)}</span>
        </div>
        <p className="text-xs text-muted mt-1">
          Received {new Date(event.occurredAt).toLocaleString()}
        </p>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">Event ID</dt>
        <dd className="font-mono text-xs break-all">{event.eventId}</dd>
        <dt className="text-muted">System</dt>
        <dd>{systemLabel(event.system)}</dd>
        <dt className="text-muted">Source</dt>
        <dd>{typeof event.data.source === "string" ? event.data.source : "Twin stream"}</dd>
      </dl>
      <section>
        <div className="text-[10px] uppercase tracking-wider text-muted mb-2">Payload</div>
        {entries.length === 0 ? (
          <p className="text-sm text-muted">No structured payload was attached to this event.</p>
        ) : (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
            {entries.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-muted">{key}</dt>
                <dd className="break-words">{formatEventValue(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}

function formatEventValue(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function ConfidenceDot({
  value,
  flag,
  reviewed,
}: {
  value: number;
  flag: boolean;
  reviewed: boolean;
}) {
  const color = reviewed
    ? "rgb(var(--muted))"
    : flag
      ? "rgb(var(--flag))"
      : "rgb(var(--accent))";
  return (
    <div className="w-10 h-10 relative shrink-0" title={`${value}% confidence`}>
      <svg viewBox="0 0 36 36" className="w-full h-full">
        <circle cx="18" cy="18" r="14" fill="none" stroke="rgb(var(--line))" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="14"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * 88} 88`}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">
        {value}
      </span>
    </div>
  );
}
