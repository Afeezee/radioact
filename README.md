# RadioAct

A patient-first radiology triage app built on the Ontomorph digital-twin platform.

**Patient uploads a scan -> gets an AI-assisted read privately -> sends it to a clinician for expert review.** The clinician sees a live queue of patient handoffs, clearly separated from synthetic demo traffic and any external twin-stream events, opens the inspector for context, and confirms reviewed findings. The confirmed result is written back to the patient's history.

**This is triage, not diagnosis.** Every AI finding is presented with confidence, reasoning, and a clinician-review signal. Nothing becomes a confirmed outcome until a clinician reviews it.

## What The App Does

RadioAct is a workflow product, not just an image analyzer.

1. A patient uploads a chest X-ray, limb X-ray, or CT slice.
2. The patient can include symptoms or clinical context to guide the read.
3. The app runs an AI-assisted analysis using Anthropic first, Groq second, or a deterministic demo analyzer when no live vision model is available.
4. Each finding is normalized into a structured record with confidence, reasoning, patient-facing explanation, body-system classification, and anatomical anchoring.
5. Findings are enriched with HOLON concepts when HOLON credentials are configured.
6. The patient sees the findings privately first.
7. When the patient clicks "Send to clinician", the finding moves into the clinician queue and is streamed live.
8. The clinician feed keeps real patient handoffs visually separate from synthetic demo traffic and external twin events.
9. A clinician can inspect the finding, review supporting context, and confirm it.

## Run It

```bash
npm install
npm run dev
```

Open http://localhost:3000.

In Clerk mode, sign up and complete onboarding.
In demo mode, the app falls back to a lightweight local session.

## Roles

| Role | Home | Can do |
|---|---|---|
| Patient | `/app` | Upload a scan, review findings privately, send them to a clinician, and see personal history |
| Clinician | `/app/clinic` | Review patient handoffs, inspect details, and confirm reviewed cases |
| Admin | `/app/admin` | Review users, approve clinician registrations, and switch views across the app |

### Role Flow

- Patients are activated immediately after onboarding.
- Clinicians enter a pending state until an admin approves them.
- Admins can access the admin dashboard and use the role switcher for view-level inspection.
- Server-side routes still enforce the real role even when the client view is switched.

## Environment

Every variable is optional and the app degrades gracefully when a service is unavailable.

```env
# Preferred vision provider
ANTHROPIC_API_KEY=

# Fallback vision provider
GROQ_API_KEY=

# HOLON clinical knowledge API
HOLON_API_URL=https://holon-api.ontomorph.com
HOLON_API_KEY=

# Neon Postgres. Blank -> in-memory store.
DATABASE_URL=

# Clerk auth. If absent, the app falls back to a demo session model.
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Ontomorph DTP twin. If absent, twin-facing features fall back to demo stubs.
DTP_API_KEY=
DTP_GRANT_TOKEN=
```

### Runtime Fallbacks

- If `DATABASE_URL` is set, RadioAct uses Neon + Drizzle and auto-provisions its core tables on first boot.
- If `DATABASE_URL` is blank, RadioAct uses an in-memory store.
- If Clerk is not configured, RadioAct uses a simple local demo session.
- If DTP is not configured, twin inspector, simulation, and external event streaming degrade to demo-safe behavior.
- If no live vision model is available, the analyzer falls back to deterministic demo findings so the workflow still runs end to end.

## Vision Provider Notes

RadioAct prefers Anthropic when `ANTHROPIC_API_KEY` is present.

Groq remains supported as a fallback, but its vision model inventory has been unstable. The analyzer walks a candidate list in `lib/groq.ts` and reports a clear failure when no supported vision model is available.

If no live model works, the app uses `demoAnalyze()` to generate stable, plausible findings for product and workflow testing.

## How It Works

1. `POST /api/analyze` accepts the image and optional clinical context.
2. The image is analyzed by the first available vision path.
3. Findings are enriched through HOLON when configured.
4. The region resolver maps each finding to an FMA anchor and display position.
5. If DTP is configured, the finding is also written to the twin as a `clinical_note` event and can be saved as provider inspector notes.
6. The finding is stored as `private` and owned by the patient's identity.
7. `POST /api/findings/:id/send` promotes that finding to `pending_review` and publishes it into the live stream.
8. The clinician dashboard subscribes to `/api/stream` and updates in real time.
9. `POST /api/findings/:id/review` marks the finding as reviewed and records who reviewed it.

## Clinic Feed Behavior

The clinic dashboard mixes multiple sources on purpose, but labels them clearly.

- **Patient handoffs**: real findings created in the patient reader and explicitly sent for review.
- **Synthetic ambient findings**: internal demo traffic generated to keep the queue active during walkthroughs.
- **Twin stream events**: non-RadioAct events arriving from `twin.events.stream()` when a real DTP twin is connected.

This separation is important. Real patient escalations should not look like synthetic demo traffic.

## Data Model

```text
patients { id, name, twinGrantToken, twinId, createdAt }
scans    { id, patientId, imageDataUrl, imageQuality, uploadedAt }
findings {
  id, scanId, patientId, patientName,
  ownerUserId,
  status,
  sentAt, reviewedAt, reviewedBy,
  finding, bodySystem, region, confidence, reasoning,
  patientExplanation,
  clinicalContext,
  fmaCode, fmaLabel,
  ontomorphEventId,
  holon { conceptId, conceptCode, conceptName, vocabularyId, holonUri, ancestors, mappings }
}
```

## Persistence

- Neon + Drizzle is used when `DATABASE_URL` is set.
- The schema is created automatically if the database is empty.
- In-memory fallback is used when no database is configured.
- The in-memory path survives Next.js dev HMR through a `globalThis` singleton, but not full process restarts.

## Files Worth Knowing

| File | Role |
|---|---|
| `app/app/page.tsx` + `components/Reader.tsx` | Patient reader flow: upload, analyze, findings feed, inspector, send to clinician |
| `app/app/clinic/page.tsx` + `components/Clinic.tsx` | Clinician queue with sectioned live feed for patient handoffs, synthetic ambient items, and twin-stream events |
| `app/app/admin/page.tsx` | Admin dashboard for reviewing users and approving clinicians |
| `components/InspectorPanel.tsx` | Per-finding detail, role-aware actions, inspector data, HOLON data, and simulation surface |
| `components/TwinScene.tsx` | 3D twin visualization with finding pins |
| `lib/groq.ts` | Vision provider orchestration and demo analyzer |
| `lib/ontomorph.ts` | Twin flagging, HOLON enrichment, inspector fetches, simulation, and external stream wiring |
| `lib/db.ts` | Persistence layer with Neon and in-memory implementations |
| `lib/useEffectiveRole.ts` | Admin view switching without weakening server-side authorization |
| `lib/regions.ts` | Maps findings to anatomical labels, FMA codes, and twin positions |
| `lib/serverAuth.ts` | Server-side role and identity helpers |

## Performance Notes

- Dev mode is heavy because the app combines Next.js, Clerk, three.js, and live UI updates.
- `npm run build && npm run start` is a better demo path when you want smoother performance.
- The default twin model is `public/models/overview-skeleton.glb`.

## What Requires A Real DTP Twin

The following features depend on `DTP_API_KEY` and `DTP_GRANT_TOKEN`:

- writing `clinical_note` events to the twin
- reading external twin events
- real inspector biomarker snapshots
- simulation calls such as `twin.simulate(...)`

Without DTP, the rest of the app still works: the reader flow, HOLON enrichment when configured, patient-to-clinician handoff, role gating, and the internal live queue.
