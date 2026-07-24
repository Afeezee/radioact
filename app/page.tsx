import Link from "next/link";
import { MarketingNav } from "@/components/MarketingNav";
import { Logo } from "@/components/Logo";
import { LandingTwinDemo } from "@/components/LandingTwinDemo";
import { GuestButton } from "@/components/GuestButton";
import { TRIAGE_DISCLAIMER } from "@/lib/prompt";

export default function LandingPage() {
  return (
    <>
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <BackgroundFieldLines />
        <div className="mx-auto max-w-[1200px] px-6 pt-8 pb-16 md:pt-16 md:pb-24 grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-accent mb-4">
              For patients and care teams
            </p>
            <h1 className="font-display text-[44px] leading-[1.02] md:text-[64px] md:leading-[1.02] tracking-[-0.02em]">
              Triage every scan the moment it lands.
            </h1>
            <p className="mt-5 text-lg text-ink2 max-w-xl leading-relaxed">
              RadioAct helps patients and care teams understand what may need
              attention in chest X-rays, limb X-rays, and CT slices — grounded
              in HOLON's clinical knowledge, pinned to the patient's Ontomorph
              twin, and ready for professional review in seconds.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary !py-3 !px-5 text-base">
                Get started
              </Link>
              <Link href="/signin" className="btn btn-ghost !py-3 !px-5 text-base">
                Sign in
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <li className="flex items-center gap-2">
                <Dot /> Not a diagnosis
              </li>
              <li className="flex items-center gap-2">
                <Dot /> Anchored to real anatomy
              </li>
              <li className="flex items-center gap-2">
                <Dot /> Every finding routed for review
              </li>
            </ul>
          </div>
          <div className="lg:pl-6">
            <LandingTwinDemo />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y hairline bg-surface2/50">
        <div className="mx-auto max-w-[1200px] px-6 py-16 md:py-20">
          <SectionHead
            overline="How it works"
            title="Three beats. Nothing hidden."
            sub="You'll see the same three moments in the demo video and inside the reader."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <Step
              n="01"
              title="Upload"
              body="Any scan your machine already outputs — JPEG, PNG, or a DICOM slice. Nothing leaves your browser until you press Analyse."
            />
            <Step
              n="02"
              title="Read"
              body="Qwen3.6 returns structured findings with confidence and reasoning. Each is resolved against HOLON across 19 open vocabularies."
            />
            <Step
              n="03"
              title="Pin"
              body="The finding lands on the correct anatomical structure of the patient's Ontomorph twin, where the patient and care team can follow it through clinician confirmation."
            />
          </div>
        </div>
      </section>

      {/* Platform depth */}
      <section id="platform" className="border-b hairline">
        <div className="mx-auto max-w-[1200px] px-6 py-16 md:py-24">
          <SectionHead
            overline="Built on Ontomorph"
            title="Deeper than a filter over an LLM."
            sub="Every finding travels through the platform's clinical spine, not around it. You get real anatomy, real vocabularies, and real streams — not a UI in front of a chat completion."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <Feature
              title="HOLON concept resolution"
              body="Each finding is resolved to a HOLON concept, walked up its ancestry, and cross-mapped from SNOMED to ICD-10 for downstream systems."
              tag="dtp.holon.concepts + mappings"
            />
            <Feature
              title="FMA anatomical anchoring"
              body='Every pin resolves to a Foundational Model of Anatomy code, so "right upper lobe" is FMA:7311 and the platform can pull the real inspector snapshot for that structure.'
              tag="/inspector/:fmaCode/snapshot"
            />
            <Feature
              title="Twin flag with 3D bodyCoord"
              body="Findings write back to the twin as scoped clinical events with a 3D body coordinate, not tag strings. The event carries source, region, confidence and HOLON URI."
              tag="twin.flag(system, event)"
            />
            <Feature
              title="Live streams per body system"
              body="The Clinic dashboard subscribes to twin.events.stream() across respiratory, cardiovascular, skeletal, and neurological — sorted, filterable, one-click review."
              tag="twin.events.stream({ system })"
            />
          </div>
        </div>
      </section>

      {/* For patients and care teams */}
      <section id="for-clinicians" className="border-b hairline bg-surface2/50">
        <div className="mx-auto max-w-[1200px] px-6 py-16 md:py-24 grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-accent mb-3">
              For patients and care teams
            </p>
            <h2 className="font-display text-3xl md:text-5xl tracking-[-0.01em] leading-[1.05]">
              Made to be understood and handed over.
            </h2>
            <p className="mt-5 text-ink2 leading-relaxed max-w-xl">
              A general-purpose vision model is not a diagnostic device, and we
              don't pretend it is. RadioAct offers a plain-language first look
              for patients and care teams, always framed as possible with
              confidence and reasoning, then routes it for clinician confirmation.
            </p>
            <p className="mt-4 text-muted text-sm leading-relaxed max-w-xl">
              {TRIAGE_DISCLAIMER}
            </p>
          </div>
          <div className="card p-6">
            <h3 className="font-display text-xl mb-4">What you see</h3>
            <ul className="space-y-3 text-sm">
              {[
                "The finding as a plain-language sentence with confidence, region, and reasoning",
                "The structure's real biomarkers and AI risk from the twin's inspector",
                "HOLON concept, ancestors, and cross-vocabulary mappings",
                "One-click sign-off — the event stays scoped to the patient's grant",
                "What-if the finding forward on the same twin (cardiovascular first)",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Tick />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b hairline">
        <div className="mx-auto max-w-[900px] px-6 py-16 md:py-24">
          <SectionHead
            overline="Questions"
            title="Answers for patients and care teams."
          />
          <div className="mt-10 divide-y hairline border-y hairline">
            <FaqItem q="Is this a diagnostic device?">
              No. RadioAct is a triage-assist reader. Every finding is presented
              as a possibility with confidence and reasoning, routed for
              clinician confirmation. The workflow enforces the framing — not
              just the marketing.
            </FaqItem>
            <FaqItem q="What happens to the image?">
              The image is sent to the vision model you configure (Groq by
              default) for the analysis call. It is not stored on any RadioAct
              server; a local database reference is kept only if you set
              DATABASE_URL. The patient's Ontomorph grant token controls what,
              if anything, gets written back to their twin.
            </FaqItem>
            <FaqItem q="How is this different from wrapping GPT in a UI?">
              Every finding is resolved to a HOLON concept, anchored to an FMA
              anatomical structure, flagged as a scoped clinical event with a 3D
              body coordinate, and — for a real twin — becomes the provider's
              inspector note for that structure. The clinical spine is the
              platform, not the prompt.
            </FaqItem>
            <FaqItem q="Does this replace a radiologist?">
              No. It compresses the latency on the first look, so nothing sits
              waiting for the second.
            </FaqItem>
            <FaqItem q="Which platform features does it use?">
              twin.flag with bodyCoord, twin.events.stream per system,
              twin.simulate, dtp.holon.concepts.search + getAncestors,
              dtp.holon.mappings.translate, plus the grant-authed
              /inspector/:fmaCode/snapshot and /notes endpoints that the SDK
              notes but does not wrap.
            </FaqItem>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-28 text-center">
          <h2 className="font-display text-3xl md:text-5xl tracking-[-0.01em]">
            Start reading a scan.
          </h2>
          <p className="mt-4 text-ink2 max-w-xl mx-auto">
            No card, no install. Every account starts in demo mode until you add
            your own keys.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link href="/signup" className="btn btn-primary !py-3 !px-5 text-base">
              Get started
            </Link>
            <GuestButton className="btn btn-ghost !py-3 !px-5 text-base">
              Try without an account
            </GuestButton>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

// ---- Section building blocks ----

function SectionHead({
  overline,
  title,
  sub,
}: {
  overline: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-[0.14em] text-accent mb-3">
        {overline}
      </p>
      <h2 className="font-display text-3xl md:text-5xl tracking-[-0.01em] leading-[1.05]">
        {title}
      </h2>
      {sub && (
        <p className="mt-5 text-ink2 leading-relaxed">{sub}</p>
      )}
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-mono text-xs text-muted">{n}</span>
        <span className="w-6 h-6 rounded-full border hairline flex items-center justify-center text-[10px] text-muted">
          →
        </span>
      </div>
      <h3 className="font-display text-xl mb-2">{title}</h3>
      <p className="text-sm text-ink2 leading-relaxed">{body}</p>
    </div>
  );
}

function Feature({
  title,
  body,
  tag,
}: {
  title: string;
  body: string;
  tag: string;
}) {
  return (
    <div className="card p-6">
      <h3 className="font-display text-xl mb-2">{title}</h3>
      <p className="text-sm text-ink2 leading-relaxed">{body}</p>
      <div className="mt-4 font-mono text-[11px] text-muted px-2.5 py-1 rounded-md bg-surface2 inline-block">
        {tag}
      </div>
    </div>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group py-4">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-4 py-2">
        <span className="font-medium">{q}</span>
        <span className="text-muted text-lg leading-none group-open:rotate-45 transition-transform">
          +
        </span>
      </summary>
      <p className="text-sm text-ink2 leading-relaxed pb-2 pr-8">{children}</p>
    </details>
  );
}

function Dot() {
  return (
    <span
      aria-hidden
      className="inline-block w-1.5 h-1.5 rounded-full bg-accent"
    />
  );
}

function Tick() {
  return (
    <span
      className="mt-1 inline-flex shrink-0 w-4 h-4 items-center justify-center rounded-full bg-accent/12 text-accent"
      aria-hidden
    >
      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none">
        <path
          d="M2.5 6.5L5 9L9.5 3.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function BackgroundFieldLines() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 -z-10 pointer-events-none overflow-hidden"
    >
      <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-accent/[0.05] blur-3xl" />
      <div className="absolute top-40 -left-40 w-[500px] h-[500px] rounded-full bg-accent2/[0.05] blur-3xl" />
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.05]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-surface2/50">
      <div className="mx-auto max-w-[1200px] px-6 py-12 grid gap-8 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <span className="text-accent">
            <Logo size={24} withWordmark />
          </span>
          <p className="text-sm text-muted mt-2 max-w-xs">
            A triage-assist radiology reader for the Ontomorph digital-twin
            platform.
          </p>
        </div>
        <FooterCol
          title="Product"
          links={[
            { label: "Reader", href: "/app" },
            { label: "Clinic feed", href: "/app/clinic" },
            { label: "Sign in", href: "/signin" },
          ]}
        />
        <FooterCol
          title="Platform"
          links={[
            { label: "Ontomorph", href: "https://ontomorph.com" },
            { label: "HOLON API", href: "https://developer.ontomorph.com/docs" },
            { label: "SDK", href: "https://developer.ontomorph.com/sdk" },
          ]}
        />
        <FooterCol
          title="Legal"
          links={[
            { label: "Not a medical device", href: "#for-clinicians" },
            { label: "Terms", href: "#" },
            { label: "Privacy", href: "#" },
          ]}
        />
      </div>
      <div className="border-t hairline">
        <div className="mx-auto max-w-[1200px] px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>© {new Date().getFullYear()} RadioAct</span>
          <span>Built for the Ontomorph Hackathon · OAU · July 2026</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <h4 className="text-xs uppercase tracking-wider text-muted mb-3">
        {title}
      </h4>
      <ul className="space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} className="hover:text-accent transition-colors">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
