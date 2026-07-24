import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, TRIAGE_DISCLAIMER } from "./prompt";
import type { AnalysisResult, BodySystem, Finding } from "./types";

const ANTHROPIC_MODEL = "claude-opus-4-8";

// Vision-capable multimodal models on Groq, in priority order. The account's
// inventory can shift week to week; if the first one returns model_not_found
// we walk the list. If none exist for this key we surface a specific error so
// the UI can tell the user Groq has no vision model configured.
const MODEL_CANDIDATES = [
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "llama-3.2-90b-vision-preview",
  "llama-3.2-11b-vision-preview",
];
const VALID_SYSTEMS: BodySystem[] = [
  "respiratory",
  "skeletal",
  "cardiovascular",
  "neurological",
];

export function hasGroq(): boolean {
  return !!process.env.GROQ_API_KEY;
}

export function hasAnthropic(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export class NoVisionModelAvailableError extends Error {
  triedModels: string[];
  constructor(tried: string[]) {
    super("no_vision_model_available");
    this.triedModels = tried;
  }
}

export async function analyzeImage(
  imageDataUrl: string,
  hintFilename?: string,
  clinicalContext?: string,
): Promise<AnalysisResult> {
  // Preferred path: Anthropic Claude (vision). Falls through to Groq only if
  // Anthropic isn't configured. If neither is set, demo mode.
  if (hasAnthropic()) {
    return analyzeWithAnthropic(imageDataUrl, hintFilename, clinicalContext);
  }
  if (!hasGroq()) return demoAnalyze(imageDataUrl, hintFilename, clinicalContext);

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const ctx = (clinicalContext ?? "").trim().slice(0, 800);
  const tried: string[] = [];
  let lastError: unknown = undefined;

  for (const model of MODEL_CANDIDATES) {
    tried.push(model);
    try {
      let res;
      try {
        res = await requestAnalysis(client, model, imageDataUrl, hintFilename, ctx, true);
      } catch (error) {
        if (!shouldRetryWithoutJsonMode(error)) throw error;
        res = await requestAnalysis(client, model, imageDataUrl, hintFilename, ctx, false);
      }
      const raw = res.choices[0]?.message?.content ?? "{}";
      const result = parseAndSanitize(raw);
      if (result.findings.length === 0) {
        console.warn(
          "[groq] parse yielded zero findings. Model:",
          model,
          "raw response (first 800 chars):",
          raw.slice(0, 800),
        );
      }
      return result;
    } catch (error) {
      lastError = error;
      if (isModelNotFound(error)) {
        console.warn(`[groq] model ${model} unavailable; trying next candidate`);
        continue;
      }
      throw error;
    }
  }

  console.error(
    "[groq] no vision-capable model available on this key. Tried:",
    tried,
    "last error:",
    lastError,
  );
  throw new NoVisionModelAvailableError(tried);
}

function isModelNotFound(error: unknown): boolean {
  const code = getGroqErrorCode(error);
  if (code === "model_not_found" || code === "model_decommissioned") return true;
  const status = (error as any)?.status;
  if (status === 404) return true;
  const message = getGroqErrorMessage(error).toLowerCase();
  return (
    message.includes("model_not_found") ||
    message.includes("does not exist") ||
    message.includes("do not have access") ||
    message.includes("decommissioned") ||
    message.includes("no longer supported")
  );
}

// -------------- Anthropic Claude vision --------------
// Uses structured outputs so the model is constrained to valid JSON matching
// the AnalysisResult shape — no prose fallback, no manual retry-on-bad-JSON.

async function analyzeWithAnthropic(
  imageDataUrl: string,
  hintFilename?: string,
  clinicalContext?: string,
): Promise<AnalysisResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const ctx = (clinicalContext ?? "").trim().slice(0, 800);

  // Split "data:image/png;base64,AAAA" into media type + payload.
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.*)$/);
  if (!match) {
    throw new Error("invalid_image_data_url");
  }
  const mediaType = match[1] as "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  const base64Data = match[2];

  const userText =
    `Analyse this medical image and return JSON as described in the system prompt.` +
    (hintFilename ? ` Filename hint: ${hintFilename}.` : "") +
    (ctx
      ? `\n\nClinical context (from the referring clinician; may be empty or inaccurate — verify against the image):\n"""\n${ctx}\n"""`
      : "");

  const res = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["findings", "imageQuality", "disclaimer"],
          properties: {
            findings: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "finding",
                  "bodySystem",
                  "region",
                  "confidence",
                  "reasoning",
                  "patientExplanation",
                  "reviewRecommended",
                ],
                properties: {
                  finding: { type: "string" },
                  bodySystem: {
                    type: "string",
                    enum: [
                      "respiratory",
                      "skeletal",
                      "cardiovascular",
                      "neurological",
                    ],
                  },
                  region: { type: "string" },
                  confidence: { type: "number" },
                  reasoning: { type: "string" },
                  patientExplanation: { type: "string" },
                  reviewRecommended: { type: "boolean" },
                },
              },
            },
            imageQuality: { type: "string" },
            disclaimer: { type: "string" },
          },
        },
      },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Data,
            },
          },
          { type: "text", text: userText },
        ],
      },
    ],
  });

  let raw = "";
  for (const block of res.content) {
    if (block.type === "text") raw += block.text;
  }
  const result = parseAndSanitize(raw);
  if (result.findings.length === 0) {
    console.warn(
      "[anthropic] parse yielded zero findings. Model:",
      ANTHROPIC_MODEL,
      "raw response (first 800 chars):",
      raw.slice(0, 800),
    );
  }
  return result;
}

async function requestAnalysis(
  client: Groq,
  model: string,
  imageDataUrl: string,
  hintFilename: string | undefined,
  ctx: string,
  useJsonMode: boolean,
) {
  return client.chat.completions.create({
    model,
    temperature: 0.1,
    max_tokens: 900,
    ...(useJsonMode ? { response_format: { type: "json_object" as const } } : {}),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Analyse this medical image and return the JSON described in the system prompt.` +
              (hintFilename ? ` Filename hint: ${hintFilename}.` : "") +
              (ctx ? `\n\nClinical context (from the referring clinician; may be empty or inaccurate — verify against the image):\n"""\n${ctx}\n"""` : "") +
              (useJsonMode ? "" : "\n\nReturn only valid JSON. Do not wrap it in markdown."),
          },
          {
            type: "image_url",
            image_url: { url: imageDataUrl },
          },
        ],
      },
    ],
  });
}

function shouldRetryWithoutJsonMode(error: unknown): boolean {
  const code = getGroqErrorCode(error);
  if (code === "json_validate_failed") return true;
  const message = getGroqErrorMessage(error).toLowerCase();
  return (
    message.includes("json_validate_failed") ||
    message.includes("failed to validate json")
  );
}

function getGroqErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("error" in error)) {
    return undefined;
  }
  const code = (error as { error?: { code?: unknown } }).error?.code;
  return typeof code === "string" ? code : undefined;
}

function getGroqErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "error" in error) {
    const message = (error as { error?: { message?: unknown } }).error?.message;
    if (typeof message === "string") return message;
  }
  if (error instanceof Error) return error.message;
  return "";
}

function parseAndSanitize(raw: string): AnalysisResult {
  let json: any = {};
  try {
    json = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        json = JSON.parse(m[0]);
      } catch {
        json = {};
      }
    }
  }
  const findings: Finding[] = Array.isArray(json.findings)
    ? json.findings
        .map((f: any): Finding | null => {
          const sys = String(f?.bodySystem ?? "").toLowerCase();
          if (!VALID_SYSTEMS.includes(sys as BodySystem)) return null;
          const conf = Number(f?.confidence);
          return {
            finding: String(f.finding ?? "unspecified finding"),
            bodySystem: sys as BodySystem,
            region: String(f.region ?? "unspecified"),
            confidence: Number.isFinite(conf)
              ? Math.max(0, Math.min(1, conf))
              : 0.5,
            reasoning: String(f.reasoning ?? ""),
            patientExplanation: f.patientExplanation
              ? String(f.patientExplanation)
              : undefined,
            reviewRecommended: Boolean(f.reviewRecommended ?? true),
          };
        })
        .filter((f: Finding | null): f is Finding => !!f)
    : [];
  return {
    findings,
    imageQuality: String(json.imageQuality ?? "adequate"),
    disclaimer: String(json.disclaimer ?? TRIAGE_DISCLAIMER),
  };
}

// -------------- Demo-mode analyzer --------------
// Deterministic pseudo-analysis keyed by a hash of the image bytes + filename,
// so the demo flow always produces something plausible without hitting Groq.

function demoAnalyze(
  imageDataUrl: string,
  filename?: string,
  clinicalContext?: string,
): Promise<AnalysisResult> {
  const seedSrc = (filename ?? "") + (clinicalContext ?? "") + imageDataUrl.slice(0, 4096);
  const seed = hash(seedSrc);
  const rand = mulberry32(seed);

  // Context can also nudge the demo pool so a user typing "cough, night sweats"
  // reads as TB, not a random draw. Filename still wins if it matches — it's
  // the more reliable signal.
  const nameLower = (filename ?? "").toLowerCase();
  const ctxLower = (clinicalContext ?? "").toLowerCase();
  const combined = `${nameLower} ${ctxLower}`;
  const themes: Array<{ key: string; picks: DemoFinding[] }> = [
    { key: "chest", picks: DEMO_CHEST },
    { key: "cxr", picks: DEMO_CHEST },
    { key: "lung", picks: DEMO_CHEST },
    { key: "cough", picks: DEMO_CHEST },
    { key: "breath", picks: DEMO_CHEST },
    { key: "night sweat", picks: DEMO_TB },
    { key: "haemopt", picks: DEMO_TB },
    { key: "hemopt", picks: DEMO_TB },
    { key: "tb", picks: DEMO_TB },
    { key: "tuberc", picks: DEMO_TB },
    { key: "tibia", picks: DEMO_FRACTURE },
    { key: "shin", picks: DEMO_FRACTURE },
    { key: "wrist", picks: DEMO_FRACTURE_WRIST },
    { key: "hand", picks: DEMO_FRACTURE_WRIST },
    { key: "fract", picks: DEMO_FRACTURE },
    { key: "fell", picks: DEMO_FRACTURE },
    { key: "trauma", picks: DEMO_FRACTURE },
    { key: "brain", picks: DEMO_BRAIN },
    { key: "head", picks: DEMO_BRAIN },
    { key: "headache", picks: DEMO_BRAIN },
    { key: "stroke", picks: DEMO_BRAIN },
    { key: "ct", picks: DEMO_BRAIN },
    { key: "cardio", picks: DEMO_CARDIO },
    { key: "heart", picks: DEMO_CARDIO },
    { key: "chest pain", picks: DEMO_CARDIO },
    { key: "hypertens", picks: DEMO_CARDIO },
  ];
  const matched = themes.find((t) => combined.includes(t.key));
  const pool =
    matched?.picks ??
    [DEMO_CHEST, DEMO_FRACTURE, DEMO_CARDIO, DEMO_BRAIN, DEMO_TB][
      seed % 5
    ];

  const n = 1 + (seed % 2); // 1–2 findings
  const chosen: DemoFinding[] = [];
  const used = new Set<number>();
  while (chosen.length < Math.min(n, pool.length)) {
    const i = Math.floor(rand() * pool.length);
    if (used.has(i)) continue;
    used.add(i);
    chosen.push(pool[i]);
  }

  const findings: Finding[] = chosen.map((c) => {
    const jitter = (rand() - 0.5) * 0.14;
    const confidence = Math.max(
      0.25,
      Math.min(0.94, c.baseConfidence + jitter),
    );
    return {
      finding: c.finding,
      bodySystem: c.bodySystem,
      region: c.region,
      confidence: Math.round(confidence * 100) / 100,
      reasoning: c.reasoning,
      patientExplanation: c.patientExplanation,
      reviewRecommended: confidence >= 0.5,
    };
  });

  return Promise.resolve({
    findings,
    imageQuality: rand() > 0.85 ? "underexposed" : "adequate",
    disclaimer: TRIAGE_DISCLAIMER,
  });
}

interface DemoFinding {
  finding: string;
  bodySystem: BodySystem;
  region: string;
  reasoning: string;
  patientExplanation: string;
  baseConfidence: number;
}

const DEMO_CHEST: DemoFinding[] = [
  {
    finding: "possible cardiomegaly",
    bodySystem: "cardiovascular",
    region: "mediastinum",
    reasoning: "cardiothoracic ratio appears above 0.5 on PA projection",
    patientExplanation:
      "The heart looks a little larger than usual on this scan. There are many possible reasons for that, and it doesn't mean something is wrong on its own — a clinician will check it.",
    baseConfidence: 0.72,
  },
  {
    finding: "possible pulmonary oedema",
    bodySystem: "respiratory",
    region: "bilateral perihilar",
    reasoning: "bilateral perihilar haziness with septal line pattern",
    patientExplanation:
      "The reader noticed a hazy pattern near the middle of both lungs. This can happen with fluid build-up. A clinician will confirm whether this needs attention.",
    baseConfidence: 0.6,
  },
];

const DEMO_TB: DemoFinding[] = [
  {
    finding: "possible upper lobe infiltrate",
    bodySystem: "respiratory",
    region: "right upper lobe",
    reasoning: "focal opacity in apex with suggestion of cavitation",
    patientExplanation:
      "The scan may show a small cloudy area at the top of the right lung. Given the cough and night sweats you mentioned, a clinician will want to look at this closely.",
    baseConfidence: 0.68,
  },
  {
    finding: "possible hilar lymphadenopathy",
    bodySystem: "respiratory",
    region: "right hilum",
    reasoning: "hilar contour appears prominent versus contralateral side",
    patientExplanation:
      "The area where blood vessels enter the right lung looks a little more prominent than the other side. It can be nothing, or it can be worth a clinician's second look.",
    baseConfidence: 0.54,
  },
];

const DEMO_FRACTURE: DemoFinding[] = [
  {
    finding: "possible transverse fracture",
    bodySystem: "skeletal",
    region: "mid-shaft tibia, right",
    reasoning: "discontinuity of cortex at mid-shaft with minimal displacement",
    patientExplanation:
      "The reader flagged what looks like a break across the middle of your right shin bone. The pieces still look aligned. A clinician will confirm the plan.",
    baseConfidence: 0.83,
  },
];

const DEMO_FRACTURE_WRIST: DemoFinding[] = [
  {
    finding: "possible distal radius fracture",
    bodySystem: "skeletal",
    region: "distal radius, left",
    reasoning: "cortical step at distal radial metaphysis, dorsal angulation",
    patientExplanation:
      "There's a step in the outline of your wrist bone that suggests a small break, tilted slightly backwards. A clinician will decide next steps.",
    baseConfidence: 0.78,
  },
];

const DEMO_CARDIO: DemoFinding[] = [
  {
    finding: "possible aortic widening",
    bodySystem: "cardiovascular",
    region: "aortic arch",
    reasoning: "aortic knob contour appears prominent, mediastinum widened",
    patientExplanation:
      "The main blood vessel coming out of the heart looks a little wider than expected. This has many possible causes and a clinician will want to review it.",
    baseConfidence: 0.62,
  },
  {
    finding: "possible cardiomegaly",
    bodySystem: "cardiovascular",
    region: "cardiac silhouette",
    reasoning: "cardiothoracic ratio appears above 0.5",
    patientExplanation:
      "The heart's outline looks a little larger than usual. This isn't a diagnosis on its own — a clinician will confirm.",
    baseConfidence: 0.7,
  },
];

const DEMO_BRAIN: DemoFinding[] = [
  {
    finding: "possible acute haemorrhage",
    bodySystem: "neurological",
    region: "right basal ganglia",
    reasoning: "hyperdense focus in right basal ganglia on non-contrast CT",
    patientExplanation:
      "The scan shows a bright spot deep on the right side of the brain that can mean bleeding. This is something a clinician should look at urgently.",
    baseConfidence: 0.66,
  },
  {
    finding: "possible mass effect",
    bodySystem: "neurological",
    region: "right hemisphere",
    reasoning: "midline shift and effacement of adjacent sulci",
    patientExplanation:
      "There's a slight shift in the shape of the brain suggesting something on the right side is pressing on nearby tissue. A clinician will need to review.",
    baseConfidence: 0.55,
  },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
