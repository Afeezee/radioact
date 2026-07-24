"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

// Landing hero visual: a real chest X-ray from Wikimedia Commons (CC BY-SA 3.0,
// © O'Dea) with an animated finding-pin overlay so a first-time visitor sees
// the product's signature moment without having to upload anything.

const SCAN_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Chest_x-ray_-_posteroanterior_view.jpg/1280px-Chest_x-ray_-_posteroanterior_view.jpg";
const SCAN_ATTRIBUTION_URL =
  "https://commons.wikimedia.org/wiki/File:Chest_x-ray_-_posteroanterior_view.jpg";

const PIN_STAGES: Array<{
  label: string;
  system: string;
  region: string;
  x: number; // 0..1 in image coordinates
  y: number;
  color: "accent" | "flag";
}> = [
  {
    label: "possible upper lobe infiltrate",
    system: "Respiratory",
    region: "right upper lobe",
    x: 0.34,
    y: 0.35,
    color: "flag",
  },
  {
    label: "possible cardiomegaly",
    system: "Cardiovascular",
    region: "cardiac silhouette",
    x: 0.44,
    y: 0.58,
    color: "accent",
  },
  {
    label: "left hilum unremarkable",
    system: "Respiratory",
    region: "left hilum",
    x: 0.58,
    y: 0.5,
    color: "accent",
  },
];

export function LandingTwinDemo() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let i = 0;
    setCount(1);
    const int = setInterval(() => {
      i += 1;
      if (i >= PIN_STAGES.length + 2) {
        i = 0;
        setCount(0);
        return;
      }
      setCount(Math.min(i + 1, PIN_STAGES.length));
    }, 2200);
    return () => clearInterval(int);
  }, []);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-8 rounded-[24px] bg-accent/[0.06] blur-2xl" />
      <div className="relative rounded-2xl border hairline bg-surface/70 backdrop-blur-sm p-3 md:p-4 shadow-[0_1px_0_rgba(255,255,255,0.04),0_20px_60px_-30px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between px-2 pb-2 border-b hairline">
          <span className="text-xs text-muted tracking-wide uppercase">
            Live preview · reading a scan
          </span>
          <div className="flex items-center gap-1.5">
            <span className="tag accent">HOLON</span>
            <span className="tag accent">FMA</span>
            <span className="tag accent">bodyCoord</span>
          </div>
        </div>

        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-black">
          <Image
            src={SCAN_URL}
            alt="Chest X-ray, posteroanterior view (Wikimedia Commons, © O'Dea, CC BY-SA 3.0)"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 560px"
            style={{ objectFit: "cover", objectPosition: "center 30%" }}
            className="opacity-95"
          />

          {/* soft radiologist-viewer wash so the pins read on dark X-ray */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/40 pointer-events-none" />

          {/* Scan-line sweep */}
          <div className="scan-line" />

          {/* Pins */}
          {PIN_STAGES.slice(0, count).map((p, i) => (
            <Pin key={i} p={p} />
          ))}

          {/* Corner watermark for attribution */}
          <a
            href={SCAN_ATTRIBUTION_URL}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-2 right-2 text-[9px] text-white/60 hover:text-white bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm"
          >
            X-ray: Wikimedia · CC BY-SA
          </a>
        </div>

        <div className="mt-3 px-2 flex items-center justify-between text-xs text-muted">
          <span>chest-pa.jpg</span>
          <span className="tag accent">
            {count === 0 ? "reading…" : `${count} finding${count === 1 ? "" : "s"}`}
          </span>
        </div>
      </div>
    </div>
  );
}

function Pin({ p }: { p: (typeof PIN_STAGES)[number] }) {
  const bg = p.color === "flag" ? "rgb(var(--flag))" : "rgb(var(--accent))";
  return (
    <div
      className="absolute animate-pinDrop"
      style={{
        left: `${p.x * 100}%`,
        top: `${p.y * 100}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="relative w-3.5 h-3.5">
        <span
          className="absolute inset-0 rounded-full animate-pulse2"
          style={{ background: bg, opacity: 0.5 }}
        />
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: bg, boxShadow: `0 0 8px ${bg}` }}
        />
      </div>
      <div
        className="absolute left-4 top-0 whitespace-nowrap text-[11px] leading-tight px-2 py-1 rounded-md"
        style={{
          background: "rgb(var(--surface))",
          color: "rgb(var(--ink))",
          border: "1px solid rgb(var(--line))",
          boxShadow: "0 6px 14px -6px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ fontWeight: 500 }}>{p.label}</div>
        <div className="text-muted" style={{ fontSize: 9 }}>
          {p.system} · {p.region}
        </div>
      </div>
    </div>
  );
}
