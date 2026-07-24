# RadioAct

A patient-first radiology triage app built on the Ontomorph digital-twin platform.

**Patient uploads a scan → gets an AI-assisted read privately → sends it to a clinician for expert review.** The clinician sees a queue of pending findings, opens the twin's inspector snapshot for real biomarkers, and confirms or rejects the read. The confirmed finding is written back to the patient's history.

**This is triage, not diagnosis.** Every AI finding surfaces with confidence, reasoning, and a "recommend clinician review" flag. Nothing becomes a diagnosis without a clinician confirming it.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Sign up as a **patient** or a **clinician** and you'll land on the right home screen.

## What each role sees

| Role | Home | Can do |
|---|---|---|
| Patient | `/app` | Upload a scan, see AI findings privately, send them to a clinician, see their history |
| Clinician | `/app/clinic` | See the queue of scans patients have sent, open the inspector, confirm review |

The role is captured on `/onboarding` immediately after signup and stored on the Clerk user's `unsafeMetadata.role`. Change it later by editing that field.

## Environment

`.env.local` — every field is independent. Missing keys degrade gracefully.

```
# Vision inference. See "Groq vision reality" below.
GROQ_API_KEY=

# HOLON clinical knowledge API — concept search, ancestors, mappings.
HOLON_API_URL=https://holon-api.ontomorph.com
HOLON_API_KEY=

# Neon Postgres. Blank → in-memory store (resets on server restart).
DATABASE_URL=

# Clerk auth. Both keys required for role-based auth; if blank, the app
# falls back to a very simple localStorage session (no roles enforced).
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Ontomorph DTP twin — flag events, inspector, simulate. Blank → demo mode.
# DTP_API_KEY=
# DTP_GRANT_TOKEN=
```

### Groq vision reality (2026-07)

As of writing, **every vision-capable model Groq shipped has been decommissioned or removed from typical accounts**: `llama-4-maverick-17b-128e-instruct`, `llama-4-scout-17b-16e-instruct`, `llama-3.2-90b-vision-preview`, `llama-3.2-11b-vision-preview` — all gone. The current inventory is text-only (`llama-3.3-70b-versatile`, `qwen/qwen3.6-27b`, `openai/gpt-oss-*`) plus Whisper + TTS + prompt guards.

The reader walks a candidate list (`lib/groq.ts` → `MODEL_CANDIDATES`) and, if none succeed, returns `503 no_vision_model` with the list it tried, so the UI can say the truth.

**Options:**
1. **Wait for Groq's vision inventory to return** — they've rotated models before. Keep the list in `MODEL_CANDIDATES`.
2. **Swap providers** — Anthropic Claude, OpenAI GPT-4o / GPT-4.1, Google Gemini all ship stable vision APIs. `lib/groq.ts` is a single function you can point elsewhere.
3. **Ship demo mode** — leave `GROQ_API_KEY` blank; the app uses `demoAnalyze()`, a deterministic pseudo-analyser that reads filename + clinical context and returns plausible findings for TB / fracture / cardiomegaly / brain bleed. Not a diagnosis, not a real read — but the whole downstream flow (HOLON resolution, inspector, send-to-clinician, review) still works end-to-end.

## The pipeline

1. **Patient uploads** a chest X-ray, limb X-ray, or CT slice + optional clinical context ("42F, cough, night sweats").
2. **`/api/analyze`** sends the image to the first working vision model, parses structured JSON findings, enriches each via HOLON (`concepts.search` + `getAncestors` + `mappings.translate` SNOMED→ICD10), resolves to an FMA anatomical code (`lib/regions.ts`), and (if DTP is configured) writes a `clinical_note` event to the twin with a 3D `bodyCoord` plus the read as the provider's inspector note.
3. **The finding is stored `status: "private"`** and owned by the patient's Clerk userId. It shows only on their reader.
4. **Patient clicks "Send to clinician"** → `/api/findings/:id/send` moves the status to `pending_review` and publishes to the SSE stream.
5. **Clinician's `/app/clinic`** subscribes to `/api/stream` (role-scoped: patients get their own, clinicians get pending queue + their own reviewed audit). The card lights up.
6. **Clinician opens the finding** in the inspector panel: platform biomarkers, `aiRisk` score/differential, LOINC data sources, HOLON concept walk, and — for cardiovascular findings — a `twin.simulate('ldl_trajectory')` what-if.
7. **Clinician clicks "Confirm review"** → `/api/findings/:id/review` moves the status to `reviewed`, records the reviewer, and returns the finding to the patient's history.

## Data model

```
patients { id, name, twinGrantToken, createdAt }
scans    { id, patientId, imageDataUrl, imageQuality, uploadedAt }
findings {
  id, scanId, patientId,
  ownerUserId,               -- Clerk userId of the patient
  status,                    -- "private" | "pending_review" | "reviewed"
  sentAt, reviewedAt, reviewedBy,
  finding, bodySystem, region, confidence, reasoning,
  clinicalContext,
  fmaCode, fmaLabel,
  ontomorphEventId,
  holon{conceptId, code, name, vocabulary, uri, ancestors, mappings}
}
```

Backed by Neon + Drizzle when `DATABASE_URL` is set, in-memory Map otherwise. Both survive Next dev-mode HMR via a `globalThis` singleton.

## Files worth knowing

| File | Role |
|---|---|
| `app/page.tsx` | Marketing landing. Hero uses a real chest X-ray from Wikimedia Commons (© O'Dea, CC BY-SA 3.0) with animated finding pins overlaid. |
| `app/(auth)/signin`, `signup`, `onboarding` | Clerk's `<SignIn>` / `<SignUp>` widgets themed to the palette; `/onboarding` is the role picker after signup. |
| `app/app/page.tsx` + `components/Reader.tsx` | Patient reader. Upload + optional context, 3D twin, findings feed, inspector panel with "Send to clinician". |
| `app/app/clinic/page.tsx` + `components/Clinic.tsx` | Clinician queue. Scope tabs (Pending / Reviewed), system filters, SSE-driven. |
| `components/TwinScene.tsx` | react-three-fiber 3D twin. Loads `/public/models/overview-skeleton.glb` (~3.4 MB), falls back to a procedural primitive body if the model errors. Pins placed via `bodyCoord` from the region resolver. |
| `components/InspectorPanel.tsx` | Per-finding detail. Fetches `/api/inspector/:fma` (real platform data when DTP is set), shows HOLON walk, what-if simulate for cardiovascular, and the role-aware action row (Send / Confirm review). |
| `lib/regions.ts` | `(bodySystem, region-string) → (x, y, label, fmaCode)` plus `toBodyCoord()`. |
| `lib/groq.ts` | Vision call with graceful candidate-model fallback and demo mode. |
| `lib/ontomorph.ts` | DTP twin wraps: `flag()` with `bodyCoord`, `enrichFindingWithHolon`, `getInspectorSnapshot` / `saveInspectorNotes` (direct fetch — SDK doesn't wrap these), `runSimulation`, `streamAllSystems`. |
| `lib/role.ts` + `lib/useCurrentPatient.tsx` | Client-side role helpers + a hook that gives the current patient identity (Clerk userId + name) uniformly. |
| `lib/serverAuth.ts` | Server-side Clerk `auth()` reader with a demo `anon` fallback so route handlers never crash without a session. |
| `middleware.ts` | Clerk middleware; guards `/app(.*)`. No-op when Clerk keys aren't set. |

## Performance notes

- Dev mode is heavy — three.js + drei + Clerk + Next dev. `npm run build && npm run start` will feel much snappier for a demo.
- The default twin model is the 3.4 MB `overview-skeleton.glb`. There's also a sibling `human-skeleton.glb` at ~26 MB — swap it in `TwinScene.tsx` if you need the higher-detail mesh for a specific shot, but expect a slower cold load.

## What still needs a real DTP twin

Everything under `Ontomorph twin` in the mode badges depends on `DTP_API_KEY` + `DTP_GRANT_TOKEN`. Without them: `twin.flag`, `twin.simulate`, `twin.events.stream`, and the `/inspector/:fma/snapshot` real biomarkers all return synthetic stubs. The rest of the flow — LLM read (with a working vision model), HOLON enrichment, patient-clinician handoff, roles, SSE feed — works without DTP.
