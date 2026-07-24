import {
  boolean,
  doublePrecision,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const patients = pgTable("patients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  twinGrantToken: text("twin_grant_token"),
  twinId: text("twin_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scans = pgTable("scans", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  imageDataUrl: text("image_data_url").notNull(),
  imageQuality: text("image_quality"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const findings = pgTable("findings", {
  id: text("id").primaryKey(),
  scanId: text("scan_id")
    .notNull()
    .references(() => scans.id),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  patientName: text("patient_name").notNull().default(""),
  ontomorphEventId: text("ontomorph_event_id"),
  finding: text("finding").notNull(),
  bodySystem: text("body_system").notNull(),
  region: text("region").notNull(),
  confidence: doublePrecision("confidence").notNull(),
  reasoning: text("reasoning"),
  patientExplanation: text("patient_explanation"),
  clinicalContext: text("clinical_context"),
  reviewRecommended: boolean("review_recommended").notNull().default(false),
  fmaCode: text("fma_code"),
  fmaLabel: text("fma_label"),
  ownerUserId: text("owner_user_id").notNull().default("anon"),
  status: text("status").notNull().default("private"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  holonConceptId: doublePrecision("holon_concept_id"),
  holonConceptCode: text("holon_concept_code"),
  holonConceptName: text("holon_concept_name"),
  holonVocabularyId: text("holon_vocabulary_id"),
  holonUri: text("holon_uri"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by"),
});
