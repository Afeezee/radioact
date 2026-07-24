export type BodySystem =
  | "respiratory"
  | "skeletal"
  | "cardiovascular"
  | "neurological";

export interface HolonMapping {
  system: string;
  code: string;
  name?: string;
}

export interface HolonEnrichment {
  conceptId?: number;
  conceptCode?: string;
  conceptName?: string;
  vocabularyId?: string;
  holonUri?: string;
  ancestors?: Array<{ code: string; name: string }>;
  mappings?: HolonMapping[];
}

export interface Finding {
  finding: string;
  bodySystem: BodySystem;
  region: string;
  confidence: number;
  reasoning: string;
  patientExplanation?: string;
  reviewRecommended: boolean;
  fmaCode?: string;
  fmaLabel?: string;
  holon?: HolonEnrichment;
}

export interface AnalysisResult {
  findings: Finding[];
  imageQuality: string;
  disclaimer: string;
}

export type FindingStatus = "private" | "pending_review" | "reviewed";

export interface StoredFinding extends Finding {
  id: string;
  scanId: string;
  patientId: string;
  patientName: string;
  ontomorphEventId?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  clinicalContext?: string;
  // Auth-scoped ownership: the Clerk userId of the patient whose scan this is.
  // Anonymous / demo-mode uploads use "anon".
  ownerUserId: string;
  // Handoff status. Patients see "private" and "pending_review" / "reviewed"
  // that they own; clinicians see all "pending_review" plus their own
  // "reviewed" for context.
  status: FindingStatus;
  sentAt?: string;
}

export interface Patient {
  id: string;
  name: string;
  twinGrantToken?: string;
  twinId?: string;
  createdAt: string;
}

export interface Scan {
  id: string;
  patientId: string;
  imageDataUrl: string;
  imageQuality?: string;
  uploadedAt: string;
}

// Shape returned by GET /provider/twins/:id/inspector/:fmaCode/snapshot.
export interface InspectorSnapshot {
  structureName: string;
  fmaId: string | null;
  biomarkers: Array<{
    label: string;
    value: string;
    unit?: string;
    trend: "up" | "down" | "neutral";
    verified: boolean;
  }>;
  lastScan: null;
  aiRisk: { score: number; differential: string[] } | null;
  dataSources: Array<{
    loincCode: string;
    display: string;
    dataPointCount: number;
  }>;
  withheldCount: number;
  synthetic: boolean;
}

export interface InspectorNotes {
  providerNotes: string;
  updatedAt: string;
}

export interface SimulationScalarResult {
  jobId: string;
  status: string;
  scalarOutputs?: Record<string, unknown>;
  narration?: {
    narrative: string;
    keyFindings: string[];
    caveats: string[];
  } | null;
  disclaimer?: string;
  animationAvailable?: boolean;
}
