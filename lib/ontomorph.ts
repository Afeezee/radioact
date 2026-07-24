import { DTP } from "@ontomorph/dtp-sdk";
import type { HealthEvent, SimulationResult } from "@ontomorph/dtp-sdk";
import { decodeGrantToken } from "@ontomorph/dtp-sdk";
import {
  createHolonClient,
  type HolonClient,
} from "@ontomorph/holon-client";
import type {
  BodySystem,
  Finding,
  HolonEnrichment,
  InspectorNotes,
  InspectorSnapshot,
  StoredFinding,
} from "./types";

const DEFAULT_HOLON_URL = "https://holon-api.ontomorph.com";

let cached: {
  dtp: DTP | null;
  grantToken: string | null;
  twinId: string | null;
  baseUrl: string;
  apiKey: string | null;
} | null = null;

const DEFAULT_LIVE_URL = "https://api.ontomorph.com";
const DEFAULT_SANDBOX_URL = "https://sandbox-api.ontomorph.com";

export function hasOntomorph(): boolean {
  return !!process.env.DTP_API_KEY && !!process.env.DTP_GRANT_TOKEN;
}

export function hasHolon(): boolean {
  return !!process.env.HOLON_API_KEY;
}

let cachedHolon: HolonClient | null = null;
function getHolon(): HolonClient | null {
  if (cachedHolon) return cachedHolon;
  if (!hasHolon()) return null;
  cachedHolon = createHolonClient({
    apiUrl: process.env.HOLON_API_URL ?? DEFAULT_HOLON_URL,
    apiKey: process.env.HOLON_API_KEY!,
  });
  return cachedHolon;
}

function getClient() {
  if (cached) return cached;
  if (!hasOntomorph()) {
    cached = {
      dtp: null,
      grantToken: null,
      twinId: null,
      baseUrl: DEFAULT_LIVE_URL,
      apiKey: null,
    };
    return cached;
  }
  const apiKey = process.env.DTP_API_KEY!;
  const grantToken = process.env.DTP_GRANT_TOKEN!;
  const inferred = apiKey.startsWith("dtp_test_")
    ? DEFAULT_SANDBOX_URL
    : DEFAULT_LIVE_URL;
  const baseUrl = process.env.DTP_BASE_URL ?? inferred;
  const dtp = new DTP({
    apiKey,
    baseUrl,
    holonApiUrl: process.env.HOLON_API_URL,
    holonApiKey: process.env.HOLON_API_KEY,
  });
  let twinId: string | null = null;
  try {
    twinId = decodeGrantToken(grantToken).twinId;
  } catch (e) {
    console.error("[ontomorph] failed to decode grant token:", e);
  }
  cached = { dtp, grantToken, twinId, baseUrl, apiKey };
  return cached;
}

export function getGrantSummary() {
  if (!hasOntomorph()) return null;
  const { grantToken } = getClient();
  if (!grantToken) return null;
  try {
    return decodeGrantToken(grantToken);
  } catch {
    return null;
  }
}

// ---------- Flag ----------

export async function flagFindingToTwin(
  finding: Finding,
  bodyCoord?: { x: number; y: number; z: number },
): Promise<{ eventId?: string; twinId?: string }> {
  const { dtp, grantToken } = getClient();
  if (!dtp || !grantToken) return {};
  try {
    const twin = dtp.twins.connect(grantToken);
    const event = await twin.flag(finding.bodySystem, {
      eventType: "clinical_note",
      title: `RadioAct: ${finding.finding}`,
      description: finding.reasoning,
      code: finding.holon?.conceptCode ?? undefined,
      data: {
        source: "radioact",
        region: finding.region,
        confidence: finding.confidence,
        reviewRecommended: finding.reviewRecommended,
        fmaCode: finding.fmaCode,
        fmaLabel: finding.fmaLabel,
        holonUri: finding.holon?.holonUri,
        conceptName: finding.holon?.conceptName,
        bodyCoord,
      },
    });
    return { eventId: event.id, twinId: twin.id };
  } catch (e) {
    console.error("[ontomorph] flag failed:", (e as Error).message);
    return {};
  }
}

// ---------- HOLON enrichment ----------

export async function enrichFindingWithHolon(
  f: Finding,
): Promise<HolonEnrichment | undefined> {
  const holon = getHolon();
  if (!holon) return undefined;
  try {
    const search = await holon.concepts.search(f.finding, { pageSize: 3 });
    const hit = search.hits?.[0];
    if (!hit) return undefined;
    const enrichment: HolonEnrichment = {
      conceptId: hit.conceptId,
      conceptCode: hit.conceptCode,
      conceptName: hit.conceptName,
      vocabularyId: hit.vocabularyId,
      holonUri: hit.holonUri,
    };
    // Fire ancestry + mappings in parallel; either can fail without blocking the finding.
    const [ancestryRes, mappingRes] = await Promise.allSettled([
      holon.concepts.getAncestors(hit.conceptId),
      hit.vocabularyId === "SNOMED"
        ? holon.mappings.translate(hit.conceptCode, "SNOMED", "ICD10")
        : Promise.resolve(null),
    ]);
    if (ancestryRes.status === "fulfilled") {
      enrichment.ancestors = (ancestryRes.value.ancestors ?? [])
        .slice(0, 4)
        .map((a) => ({ code: a.conceptCode, name: a.conceptName }));
    }
    if (mappingRes.status === "fulfilled" && mappingRes.value) {
      const raw = mappingRes.value as any;
      const list = raw?.mappings ?? raw?.hits ?? raw ?? [];
      enrichment.mappings = (Array.isArray(list) ? list : [])
        .slice(0, 3)
        .map((m: any) => ({
          system: String(m.targetVocabulary ?? m.system ?? "ICD10"),
          code: String(m.targetCode ?? m.code ?? ""),
          name: m.targetName ?? m.name,
        }));
    }
    return enrichment;
  } catch (e) {
    console.error("[holon] enrichment failed:", (e as Error).message);
    return undefined;
  }
}

// ---------- Inspector snapshot (grant-authed, not wrapped by SDK) ----------

export async function getInspectorSnapshot(
  fmaCode: string,
): Promise<InspectorSnapshot | null> {
  const { grantToken, twinId, baseUrl, apiKey } = getClient();
  if (!grantToken || !twinId || !apiKey) return null;
  try {
    const res = await fetch(
      `${baseUrl}/provider/twins/${encodeURIComponent(twinId)}/inspector/${encodeURIComponent(fmaCode)}/snapshot`,
      {
        headers: {
          "X-DTP-API-Key": apiKey,
          Authorization: `Bearer ${grantToken}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) {
      console.error(
        "[inspector] snapshot failed:",
        res.status,
        await res.text().catch(() => ""),
      );
      return null;
    }
    const body = (await res.json()) as { data: InspectorSnapshot };
    return body.data;
  } catch (e) {
    console.error("[inspector] snapshot error:", (e as Error).message);
    return null;
  }
}

export async function getInspectorNotes(
  fmaCode: string,
): Promise<InspectorNotes | null> {
  const { grantToken, twinId, baseUrl, apiKey } = getClient();
  if (!grantToken || !twinId || !apiKey) return null;
  try {
    const res = await fetch(
      `${baseUrl}/provider/twins/${encodeURIComponent(twinId)}/inspector/${encodeURIComponent(fmaCode)}/notes`,
      {
        headers: {
          "X-DTP-API-Key": apiKey,
          Authorization: `Bearer ${grantToken}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { data: InspectorNotes };
    return body.data;
  } catch {
    return null;
  }
}

export async function saveInspectorNotes(
  fmaCode: string,
  providerNotes: string,
): Promise<InspectorNotes | null> {
  const { grantToken, twinId, baseUrl, apiKey } = getClient();
  if (!grantToken || !twinId || !apiKey) return null;
  try {
    const res = await fetch(
      `${baseUrl}/provider/twins/${encodeURIComponent(twinId)}/inspector/${encodeURIComponent(fmaCode)}/notes`,
      {
        method: "PATCH",
        headers: {
          "X-DTP-API-Key": apiKey,
          Authorization: `Bearer ${grantToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ providerNotes }),
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { data: InspectorNotes };
    return body.data;
  } catch {
    return null;
  }
}

// ---------- Simulation ----------

export async function runSimulation(
  simulationType: string,
  params: Record<string, unknown>,
): Promise<SimulationResult | null> {
  const { dtp, grantToken } = getClient();
  if (!dtp || !grantToken) return null;
  try {
    const twin = dtp.twins.connect(grantToken);
    return await twin.simulate(simulationType as any, params);
  } catch (e) {
    console.error("[simulate] failed:", (e as Error).message);
    return null;
  }
}

// ---------- Streaming ----------

export interface StreamedEvent {
  eventId: string;
  system: BodySystem;
  title: string;
  data: Record<string, unknown>;
  occurredAt: string;
}

export function streamAllSystems(
  onEvent: (e: StreamedEvent) => void,
): { stop: () => void } {
  const { dtp, grantToken } = getClient();
  if (!dtp || !grantToken) return { stop: () => {} };

  const twin = dtp.twins.connect(grantToken);
  const systems: BodySystem[] = [
    "respiratory",
    "skeletal",
    "cardiovascular",
    "neurological",
  ];
  const handles = systems.map((system) =>
    twin.events.stream({ system, intervalMs: 4000 }, (event: HealthEvent) => {
      onEvent({
        eventId: event.id,
        system,
        title: event.title,
        data: event.data ?? {},
        occurredAt: event.occurredAt,
      });
    }),
  );
  return { stop: () => handles.forEach((h) => h.stop()) };
}

export function storedFindingToStream(f: StoredFinding): StreamedEvent {
  return {
    eventId: f.ontomorphEventId ?? f.id,
    system: f.bodySystem,
    title: `RadioAct: ${f.finding}`,
    data: {
      source: "radioact",
      region: f.region,
      confidence: f.confidence,
      reviewRecommended: f.reviewRecommended,
      patientName: f.patientName,
      findingId: f.id,
    },
    occurredAt: f.createdAt,
  };
}
