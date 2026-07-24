import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { TRIAGE_DISCLAIMER } from "@/lib/prompt";

const AUTH_SCAN_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Chest_x-ray_-_posteroanterior_view.jpg/1280px-Chest_x-ray_-_posteroanterior_view.jpg";
const AUTH_SCAN_ATTRIBUTION =
  "https://commons.wikimedia.org/wiki/File:Chest_x-ray_-_posteroanterior_view.jpg";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Form column */}
      <div className="flex flex-col">
        <div className="p-6 md:p-8">
          <Link href="/" className="inline-flex items-center text-accent">
            <Logo size={22} withWordmark />
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>
        <div className="p-6 md:p-8 text-xs text-muted">
          {TRIAGE_DISCLAIMER}
        </div>
      </div>

      {/* Visual column */}
      <aside className="hidden md:block relative bg-surface2 border-l hairline overflow-hidden">
        <AuthVisual />
      </aside>
    </div>
  );
}

function AuthVisual() {
  return (
    <div className="absolute inset-0 bg-black">
      {/* Actual chest X-ray — Wikimedia Commons, CC BY-SA 3.0. */}
      <Image
        src={AUTH_SCAN_URL}
        alt="Chest X-ray (Wikimedia Commons, © O'Dea, CC BY-SA 3.0)"
        fill
        priority
        sizes="(max-width: 768px) 0px, 55vw"
        style={{ objectFit: "cover", objectPosition: "center 34%" }}
        className="opacity-70"
      />

      {/* Vignette + tint so the image reads as a viewbox, not a photo. */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-black/60" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

      {/* Scan-line sweep */}
      <div className="scan-line" />

      {/* Two illustrative pins so this reads as RadioAct, not just "an X-ray". */}
      <AuthPin
        top="32%"
        left="34%"
        color="rgb(var(--flag))"
        label="possible upper lobe infiltrate"
        sub="respiratory · right upper lobe"
      />
      <AuthPin
        top="58%"
        left="45%"
        color="rgb(var(--accent))"
        label="possible cardiomegaly"
        sub="cardiovascular · cardiac silhouette"
      />

      {/* Overlay copy */}
      <div className="relative h-full flex flex-col justify-end p-10">
        <div className="max-w-md">
          <p className="text-xs uppercase tracking-[0.14em] text-accent mb-3">
            RadioAct
          </p>
          <p className="font-display text-2xl leading-snug text-white">
            "The first read shouldn't take longer than the scan."
          </p>
          <p className="text-sm text-white/70 mt-3">
            A triage-assist reader for chest X-rays, limb X-rays, and CT slices,
            built on the Ontomorph digital-twin platform.
          </p>
          <a
            href={AUTH_SCAN_ATTRIBUTION}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-block text-[10px] text-white/50 hover:text-white/80"
          >
            Chest radiograph © O'Dea via Wikimedia Commons · CC BY-SA 3.0
          </a>
        </div>
      </div>
    </div>
  );
}

function AuthPin({
  top,
  left,
  color,
  label,
  sub,
}: {
  top: string;
  left: string;
  color: string;
  label: string;
  sub: string;
}) {
  return (
    <div
      className="absolute animate-pinDrop"
      style={{ top, left, transform: "translate(-50%, -50%)" }}
    >
      <div className="relative w-3.5 h-3.5">
        <span
          className="absolute inset-0 rounded-full animate-pulse2"
          style={{ background: color, opacity: 0.5 }}
        />
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}
        />
      </div>
      <div
        className="absolute left-5 top-0 whitespace-nowrap text-[11px] leading-tight px-2 py-1 rounded-md text-white"
        style={{
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,255,255,0.15)",
          backdropFilter: "blur(6px)",
        }}
      >
        <div style={{ fontWeight: 500 }}>{label}</div>
        <div className="text-white/60" style={{ fontSize: 9 }}>
          {sub}
        </div>
      </div>
    </div>
  );
}
