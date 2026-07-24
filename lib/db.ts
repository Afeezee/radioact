// Small persistence layer. Backed by Neon/Drizzle when DATABASE_URL is set,
// otherwise by an in-process Map that survives across route handlers via the
// module singleton. The exported API is identical either way.

import type { FindingStatus, Patient, Scan, StoredFinding } from "./types";
export type { FindingStatus } from "./types";

export type PatientRow = Patient;
export type ScanRow = Scan;
export type FindingRow = StoredFinding;

export interface FindingFilter {
  patientId?: string;
  ownerUserId?: string;
  status?: FindingStatus | FindingStatus[];
}

export interface DB {
  listPatients(): Promise<PatientRow[]>;
  ensurePatient(input: Omit<PatientRow, "createdAt">): Promise<PatientRow>;
  insertScan(scan: ScanRow): Promise<void>;
  getScan(id: string): Promise<ScanRow | undefined>;
  insertFinding(row: FindingRow): Promise<void>;
  getFinding(id: string): Promise<FindingRow | undefined>;
  listFindings(filter?: FindingFilter): Promise<FindingRow[]>;
  markReviewed(id: string, by: string): Promise<FindingRow | undefined>;
  markSent(id: string): Promise<FindingRow | undefined>;
}

class MemoryDB implements DB {
  private patients = new Map<string, PatientRow>();
  private scans = new Map<string, ScanRow>();
  private findings = new Map<string, FindingRow>();

  constructor() {
    // Seed a couple of demo patients so the clinic view has rows on cold start.
    const now = new Date().toISOString();
    const seed: PatientRow[] = [
      {
        id: "p_demo_1",
        name: "A. Okafor",
        twinGrantToken: process.env.DTP_GRANT_TOKEN,
        createdAt: now,
      },
      {
        id: "p_demo_2",
        name: "M. Adekunle",
        twinGrantToken: process.env.DTP_GRANT_TOKEN,
        createdAt: now,
      },
      {
        id: "p_demo_3",
        name: "R. Uchendu",
        twinGrantToken: process.env.DTP_GRANT_TOKEN,
        createdAt: now,
      },
    ];
    seed.forEach((p) => this.patients.set(p.id, p));
  }

  async listPatients() {
    return Array.from(this.patients.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }
  async ensurePatient(input: Omit<PatientRow, "createdAt">) {
    const existing = this.patients.get(input.id);
    if (existing) return existing;
    const row: PatientRow = { ...input, createdAt: new Date().toISOString() };
    this.patients.set(row.id, row);
    return row;
  }
  async insertScan(scan: ScanRow) {
    this.scans.set(scan.id, scan);
  }
  async getScan(id: string) {
    return this.scans.get(id);
  }
  async insertFinding(row: FindingRow) {
    this.findings.set(row.id, row);
  }
  async getFinding(id: string) {
    return this.findings.get(id);
  }
  async listFindings(filter: FindingFilter = {}) {
    const statuses = filter.status
      ? Array.isArray(filter.status)
        ? filter.status
        : [filter.status]
      : undefined;
    return Array.from(this.findings.values())
      .filter((f) =>
        filter.patientId ? f.patientId === filter.patientId : true,
      )
      .filter((f) =>
        filter.ownerUserId ? f.ownerUserId === filter.ownerUserId : true,
      )
      .filter((f) => (statuses ? statuses.includes(f.status) : true))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  async markReviewed(id: string, by: string) {
    const cur = this.findings.get(id);
    if (!cur) return undefined;
    const updated: FindingRow = {
      ...cur,
      reviewedAt: new Date().toISOString(),
      reviewedBy: by,
      status: "reviewed",
    };
    this.findings.set(id, updated);
    return updated;
  }
  async markSent(id: string) {
    const cur = this.findings.get(id);
    if (!cur) return undefined;
    const updated: FindingRow = {
      ...cur,
      status: "pending_review",
      sentAt: new Date().toISOString(),
    };
    this.findings.set(id, updated);
    return updated;
  }
}

async function ensureNeonSchema(client: any) {
  await client`
    CREATE TABLE IF NOT EXISTS patients (
      id text PRIMARY KEY,
      name text NOT NULL,
      twin_grant_token text,
      twin_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS scans (
      id text PRIMARY KEY,
      patient_id text NOT NULL REFERENCES patients(id),
      image_data_url text NOT NULL,
      image_quality text,
      uploaded_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS findings (
      id text PRIMARY KEY,
      scan_id text NOT NULL REFERENCES scans(id),
      patient_id text NOT NULL REFERENCES patients(id),
      patient_name text NOT NULL DEFAULT '',
      ontomorph_event_id text,
      finding text NOT NULL,
      body_system text NOT NULL,
      region text NOT NULL,
      confidence double precision NOT NULL,
      reasoning text,
      patient_explanation text,
      clinical_context text,
      review_recommended boolean NOT NULL DEFAULT false,
      fma_code text,
      fma_label text,
      owner_user_id text NOT NULL DEFAULT 'anon',
      status text NOT NULL DEFAULT 'private',
      sent_at timestamptz,
      holon_concept_id double precision,
      holon_concept_code text,
      holon_concept_name text,
      holon_vocabulary_id text,
      holon_uri text,
      created_at timestamptz NOT NULL DEFAULT now(),
      reviewed_at timestamptz,
      reviewed_by text
    )
  `;
  await client`ALTER TABLE findings ADD COLUMN IF NOT EXISTS patient_name text NOT NULL DEFAULT ''`;
  await client`ALTER TABLE findings ADD COLUMN IF NOT EXISTS patient_explanation text`;
  await client`ALTER TABLE findings ADD COLUMN IF NOT EXISTS fma_code text`;
  await client`ALTER TABLE findings ADD COLUMN IF NOT EXISTS fma_label text`;
}

// Neon/Drizzle backend is dynamically wired only when DATABASE_URL is present,
// so building without a DB never pulls in a live connection.
async function makeNeonDB(): Promise<DB> {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { eq, desc } = await import("drizzle-orm");
  const schema = await import("./schema");
  const client = neon(process.env.DATABASE_URL!);
  const db = drizzle(client);

  // Provision the schema when the database is empty so findings survive server
  // restarts instead of silently falling back to the in-memory demo store.
  await ensureNeonSchema(client);
  await db.select({ id: schema.patients.id }).from(schema.patients).limit(1);

  function rowToFinding(r: any): FindingRow {
    return {
      id: r.id,
      scanId: r.scanId,
      patientId: r.patientId,
      patientName: r.patientName ?? "",
      ontomorphEventId: r.ontomorphEventId ?? undefined,
      finding: r.finding,
      bodySystem: r.bodySystem,
      region: r.region,
      confidence: Number(r.confidence),
      reasoning: r.reasoning ?? "",
      patientExplanation: r.patientExplanation ?? undefined,
      clinicalContext: r.clinicalContext ?? undefined,
      reviewRecommended: !!r.reviewRecommended,
      fmaCode: r.fmaCode ?? undefined,
      fmaLabel: r.fmaLabel ?? undefined,
      holon: r.holonConceptCode
        ? {
            conceptId: r.holonConceptId ?? undefined,
            conceptCode: r.holonConceptCode,
            conceptName: r.holonConceptName ?? undefined,
            vocabularyId: r.holonVocabularyId ?? undefined,
            holonUri: r.holonUri ?? undefined,
          }
        : undefined,
      createdAt:
        (r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : (r.createdAt as string)) ?? new Date().toISOString(),
      reviewedAt:
        r.reviewedAt instanceof Date ? r.reviewedAt.toISOString() : r.reviewedAt ?? undefined,
      reviewedBy: r.reviewedBy ?? undefined,
      ownerUserId: r.ownerUserId ?? "anon",
      status: (r.status as FindingStatus | undefined) ?? "private",
      sentAt:
        r.sentAt instanceof Date ? r.sentAt.toISOString() : r.sentAt ?? undefined,
    };
  }

  const impl: DB = {
    async listPatients() {
      const rows = await db.select().from(schema.patients);
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        twinGrantToken: r.twinGrantToken ?? undefined,
        twinId: r.twinId ?? undefined,
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : r.createdAt,
      }));
    },
    async ensurePatient(input) {
      const existing = await db
        .select()
        .from(schema.patients)
        .where(eq(schema.patients.id, input.id));
      if (existing[0]) {
        const r: any = existing[0];
        return {
          id: r.id,
          name: r.name,
          twinGrantToken: r.twinGrantToken ?? undefined,
          twinId: r.twinId ?? undefined,
          createdAt:
            r.createdAt instanceof Date
              ? r.createdAt.toISOString()
              : r.createdAt,
        };
      }
      await db.insert(schema.patients).values({
        id: input.id,
        name: input.name,
        twinGrantToken: input.twinGrantToken ?? null,
        twinId: input.twinId ?? null,
      });
      return { ...input, createdAt: new Date().toISOString() };
    },
    async insertScan(scan) {
      await db.insert(schema.scans).values({
        id: scan.id,
        patientId: scan.patientId,
        imageDataUrl: scan.imageDataUrl,
        imageQuality: scan.imageQuality ?? null,
      });
    },
    async getScan(id) {
      const rows = await db
        .select()
        .from(schema.scans)
        .where(eq(schema.scans.id, id));
      const r: any = rows[0];
      if (!r) return undefined;
      return {
        id: r.id,
        patientId: r.patientId,
        imageDataUrl: r.imageDataUrl,
        imageQuality: r.imageQuality ?? undefined,
        uploadedAt:
          r.uploadedAt instanceof Date ? r.uploadedAt.toISOString() : r.uploadedAt,
      };
    },
    async insertFinding(row) {
      await db.insert(schema.findings).values({
        id: row.id,
        scanId: row.scanId,
        patientId: row.patientId,
        patientName: row.patientName,
        ontomorphEventId: row.ontomorphEventId ?? null,
        finding: row.finding,
        bodySystem: row.bodySystem,
        region: row.region,
        confidence: row.confidence,
        reasoning: row.reasoning,
        patientExplanation: row.patientExplanation ?? null,
        clinicalContext: row.clinicalContext ?? null,
        reviewRecommended: row.reviewRecommended,
        fmaCode: row.fmaCode ?? null,
        fmaLabel: row.fmaLabel ?? null,
        ownerUserId: row.ownerUserId,
        status: row.status,
        sentAt: row.sentAt ? new Date(row.sentAt) : null,
        holonConceptId: row.holon?.conceptId ?? null,
        holonConceptCode: row.holon?.conceptCode ?? null,
        holonConceptName: row.holon?.conceptName ?? null,
        holonVocabularyId: row.holon?.vocabularyId ?? null,
        holonUri: row.holon?.holonUri ?? null,
      });
    },
    async getFinding(id) {
      const rows = await db
        .select()
        .from(schema.findings)
        .where(eq(schema.findings.id, id));
      return rows[0] ? rowToFinding(rows[0]) : undefined;
    },
    async listFindings(filter: FindingFilter = {}) {
      const { and, inArray } = await import("drizzle-orm");
      const conditions: any[] = [];
      if (filter.patientId) conditions.push(eq(schema.findings.patientId, filter.patientId));
      if (filter.ownerUserId) conditions.push(eq(schema.findings.ownerUserId, filter.ownerUserId));
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        conditions.push(inArray(schema.findings.status, statuses));
      }
      const q = conditions.length
        ? db
            .select()
            .from(schema.findings)
            .where(conditions.length === 1 ? conditions[0] : and(...conditions))
            .orderBy(desc(schema.findings.createdAt))
        : db
            .select()
            .from(schema.findings)
            .orderBy(desc(schema.findings.createdAt));
      const rows = await q;
      return rows.map(rowToFinding);
    },
    async markReviewed(id, by) {
      await db
        .update(schema.findings)
        .set({ reviewedAt: new Date(), reviewedBy: by, status: "reviewed" })
        .where(eq(schema.findings.id, id));
      return impl.getFinding(id);
    },
    async markSent(id) {
      await db
        .update(schema.findings)
        .set({ sentAt: new Date(), status: "pending_review" })
        .where(eq(schema.findings.id, id));
      return impl.getFinding(id);
    },
  };
  return impl;
}

// Stash the DB instance on globalThis so Next's dev HMR (which recycles module
// state) does not wipe the in-memory store between requests. Same trick as
// lib/stream.ts.
const g = globalThis as unknown as {
  __radioactDB?: DB;
  __radioactDBPromise?: Promise<DB>;
};

export function getDB(): Promise<DB> {
  if (g.__radioactDB) return Promise.resolve(g.__radioactDB);
  if (g.__radioactDBPromise) return g.__radioactDBPromise;
  if (process.env.DATABASE_URL) {
    g.__radioactDBPromise = makeNeonDB()
      .then((d) => {
        g.__radioactDB = d;
        return d;
      })
      .catch((e) => {
        console.error("[db] Neon init failed, falling back to memory:", e);
        g.__radioactDB = new MemoryDB();
        return g.__radioactDB;
      });
    return g.__radioactDBPromise;
  }
  g.__radioactDB = new MemoryDB();
  return Promise.resolve(g.__radioactDB);
}
