import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { publishFinding } from "@/lib/stream";
import { getDB } from "@/lib/db";
import type { BodySystem, StoredFinding } from "@/lib/types";

export const runtime = "nodejs";

// Small helper the clinic view uses to simulate other clinicians uploading
// scans elsewhere in the hospital, so the live feed has something to react
// to during a demo. Emits one plausible finding per call.

const POOL: Array<
  Omit<
    StoredFinding,
    "id" | "createdAt" | "scanId" | "patientId" | "patientName" | "ownerUserId" | "status" | "sentAt"
  >
> = [
  {
    finding: "possible cardiomegaly",
    bodySystem: "cardiovascular",
    region: "cardiac silhouette",
    confidence: 0.71,
    reasoning: "cardiothoracic ratio appears above 0.5",
    reviewRecommended: true,
  },
  {
    finding: "possible distal radius fracture",
    bodySystem: "skeletal",
    region: "distal radius, left",
    confidence: 0.82,
    reasoning: "cortical step at distal radial metaphysis",
    reviewRecommended: true,
  },
  {
    finding: "possible upper lobe infiltrate",
    bodySystem: "respiratory",
    region: "right upper lobe",
    confidence: 0.66,
    reasoning: "focal opacity in apex with early cavitation",
    reviewRecommended: true,
  },
  {
    finding: "possible acute haemorrhage",
    bodySystem: "neurological",
    region: "right basal ganglia",
    confidence: 0.63,
    reasoning: "hyperdense focus on non-contrast CT",
    reviewRecommended: true,
  },
];

const NAMES = ["I. Balogun", "T. Osei", "N. Mensah", "K. Diallo", "S. Adeyemi"];

export async function POST() {
  const db = await getDB();
  const patients = await db.listPatients();
  const chosenPatient = patients[Math.floor(Math.random() * patients.length)] ?? {
    id: "p_ambient",
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    twinGrantToken: undefined,
    twinId: undefined,
    createdAt: new Date().toISOString(),
  };
  const patient = await db.ensurePatient({
    id: chosenPatient.id,
    name: chosenPatient.name,
    twinGrantToken: chosenPatient.twinGrantToken,
    twinId: chosenPatient.twinId,
  });
  const ambientScanId = "s_ambient";
  const existingScan = await db.getScan(ambientScanId);
  if (!existingScan) {
    await db.insertScan({
      id: ambientScanId,
      patientId: patient.id,
      imageDataUrl: "data:,ambient-demo",
      uploadedAt: new Date().toISOString(),
    });
  }
  const template = POOL[Math.floor(Math.random() * POOL.length)];
  const row: StoredFinding = {
    ...template,
    id: `f_${randomUUID().slice(0, 8)}`,
    scanId: ambientScanId,
    patientId: patient.id,
    patientName: patient.name,
    createdAt: new Date().toISOString(),
    ownerUserId: "anon",
    status: "pending_review",
    sentAt: new Date().toISOString(),
  };
  await db.insertFinding(row);
  publishFinding(row);
  return NextResponse.json({ finding: row });
}
