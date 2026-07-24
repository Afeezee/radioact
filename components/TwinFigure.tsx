"use client";
import { useMemo } from "react";
import type { StoredFinding } from "@/lib/types";
import { resolveRegion, systemLabel } from "@/lib/regions";

interface Props {
  findings: StoredFinding[];
  activeId?: string;
  onSelect?: (id: string) => void;
  scanning?: boolean;
}

// Stylized front-facing anatomical twin. Silhouette + skeletal-hint underlay +
// pin overlay. Pins are (region-resolved) x,y in the 0 0 400 720 viewBox.

export function TwinFigure({ findings, activeId, onSelect, scanning }: Props) {
  const pins = useMemo(
    () =>
      findings.map((f) => {
        const p = resolveRegion(f.bodySystem, f.region);
        return { finding: f, x: p.x, y: p.y, label: p.label };
      }),
    [findings],
  );

  return (
    <div className="relative w-full h-full">
      <svg
        viewBox="0 0 400 720"
        className="w-full h-full"
        role="img"
        aria-label="Digital twin: front-facing anatomical figure with radiology findings pinned"
      >
        <defs>
          <linearGradient id="body" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--surface-2))" />
            <stop offset="100%" stopColor="rgb(var(--surface))" />
          </linearGradient>
          <radialGradient id="chestGlow" cx="0.5" cy="0.4" r="0.5">
            <stop offset="0%" stopColor="rgb(var(--accent) / 0.14)" />
            <stop offset="100%" stopColor="rgb(var(--accent) / 0)" />
          </radialGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>

        {/* soft base backdrop */}
        <rect
          x="0"
          y="0"
          width="400"
          height="720"
          fill="rgb(var(--surface-2))"
          rx="14"
        />

        {/* Body silhouette */}
        <Silhouette />

        {/* Anatomical hints — lungs, heart, ribs, skeletal outlines */}
        <AnatomyLayer />

        {/* Faint scan-line while analyzing */}
        {scanning && <ScanBand />}

        {/* Pins */}
        {pins.map((p, i) => (
          <Pin
            key={p.finding.id}
            x={p.x}
            y={p.y}
            index={i}
            active={p.finding.id === activeId}
            reviewed={!!p.finding.reviewedAt}
            flag={p.finding.reviewRecommended}
            label={p.finding.finding}
            system={systemLabel(p.finding.bodySystem)}
            onSelect={() => onSelect?.(p.finding.id)}
          />
        ))}
      </svg>
    </div>
  );
}

function Silhouette() {
  return (
    <g>
      {/* Head */}
      <ellipse cx="200" cy="70" rx="42" ry="52" fill="url(#body)" stroke="rgb(var(--line))" strokeWidth="1.2" />
      {/* Neck */}
      <path d="M182 118 L218 118 L214 148 L186 148 Z" fill="url(#body)" stroke="rgb(var(--line))" strokeWidth="1.2" />
      {/* Torso */}
      <path
        d="M136 156 Q120 168 122 200 L128 356 Q130 380 148 386 L200 392 L252 386 Q270 380 272 356 L278 200 Q280 168 264 156 Q250 148 200 148 Q150 148 136 156 Z"
        fill="url(#body)"
        stroke="rgb(var(--line))"
        strokeWidth="1.4"
      />
      {/* Pelvis */}
      <path
        d="M144 386 L256 386 L260 432 Q254 452 236 456 L200 460 L164 456 Q146 452 140 432 Z"
        fill="url(#body)"
        stroke="rgb(var(--line))"
        strokeWidth="1.2"
      />
      {/* Left arm (viewer's right) */}
      <path
        d="M266 168 Q296 176 300 216 L306 320 Q308 360 316 400 L320 440"
        fill="none"
        stroke="rgb(var(--line))"
        strokeWidth="18"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="320" cy="440" r="10" fill="url(#body)" stroke="rgb(var(--line))" strokeWidth="1" opacity="0.7" />
      {/* Right arm */}
      <path
        d="M134 168 Q104 176 100 216 L94 320 Q92 360 84 400 L80 440"
        fill="none"
        stroke="rgb(var(--line))"
        strokeWidth="18"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="80" cy="440" r="10" fill="url(#body)" stroke="rgb(var(--line))" strokeWidth="1" opacity="0.7" />
      {/* Legs */}
      <path
        d="M168 460 L178 630 L182 692"
        fill="none"
        stroke="rgb(var(--line))"
        strokeWidth="30"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M232 460 L222 630 L218 692"
        fill="none"
        stroke="rgb(var(--line))"
        strokeWidth="30"
        strokeLinecap="round"
        opacity="0.55"
      />
    </g>
  );
}

function AnatomyLayer() {
  return (
    <g opacity="0.9">
      {/* Chest glow */}
      <rect x="130" y="180" width="140" height="180" fill="url(#chestGlow)" />

      {/* Ribcage hints */}
      <g stroke="rgb(var(--line))" strokeWidth="0.9" fill="none" opacity="0.7">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path
            key={i}
            d={`M148 ${200 + i * 22} Q200 ${210 + i * 22} 252 ${200 + i * 22}`}
          />
        ))}
      </g>

      {/* Lungs */}
      <g fill="rgb(var(--accent) / 0.08)" stroke="rgb(var(--accent) / 0.35)" strokeWidth="1">
        <path d="M148 200 Q134 240 138 320 Q142 350 172 348 Q188 344 188 320 L188 220 Q188 200 172 198 Q158 196 148 200 Z" />
        <path d="M252 200 Q266 240 262 320 Q258 350 228 348 Q212 344 212 320 L212 220 Q212 200 228 198 Q242 196 252 200 Z" />
      </g>

      {/* Heart */}
      <path
        d="M188 260 Q182 246 194 244 Q202 244 204 254 Q206 244 214 244 Q226 246 220 260 Q216 274 204 288 Q192 274 188 260 Z"
        fill="rgb(var(--accent-2) / 0.22)"
        stroke="rgb(var(--accent-2) / 0.65)"
        strokeWidth="1.2"
      />

      {/* Spine hint */}
      <line x1="200" y1="150" x2="200" y2="440" stroke="rgb(var(--line))" strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />

      {/* Brain hint inside head */}
      <g stroke="rgb(var(--accent) / 0.55)" strokeWidth="0.9" fill="rgb(var(--accent) / 0.08)">
        <path d="M170 62 Q166 46 186 42 Q200 34 214 42 Q234 46 230 62 Q232 78 218 88 Q200 96 182 88 Q168 78 170 62 Z" />
        <line x1="200" y1="42" x2="200" y2="90" strokeDasharray="1 3" opacity="0.7" fill="none" />
      </g>
    </g>
  );
}

function ScanBand() {
  return (
    <g style={{ mixBlendMode: "screen" as any }}>
      <rect x="0" y="0" width="400" height="720" fill="url(#chestGlow)" opacity="0.4" />
      <g>
        <rect x="0" y="0" width="400" height="180" fill="rgb(var(--accent) / 0.16)">
          <animate
            attributeName="y"
            values="-180;720"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </rect>
      </g>
    </g>
  );
}

function Pin({
  x,
  y,
  index,
  active,
  reviewed,
  flag,
  label,
  system,
  onSelect,
}: {
  x: number;
  y: number;
  index: number;
  active: boolean;
  reviewed: boolean;
  flag: boolean;
  label: string;
  system: string;
  onSelect: () => void;
}) {
  const color = reviewed
    ? "rgb(var(--muted))"
    : flag
      ? "rgb(var(--flag))"
      : "rgb(var(--accent))";
  const ring = active ? "rgb(var(--ink))" : color;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: "pointer" }}
      onClick={onSelect}
      className="animate-pinDrop"
    >
      {/* halo pulse — only for unreviewed */}
      {!reviewed && (
        <circle r="14" fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="1.2">
          <animate
            attributeName="r"
            values="8;18;8"
            dur="2.4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-opacity"
            values="0.35;0.05;0.35"
            dur="2.4s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      <circle r="7" fill={color} stroke={ring} strokeWidth={active ? 2.5 : 1.5} />
      <text
        x="12"
        y="-8"
        fontSize="10"
        fontFamily="Inter, system-ui, sans-serif"
        fill="rgb(var(--ink))"
        style={{
          paintOrder: "stroke",
          stroke: "rgb(var(--surface))",
          strokeWidth: 4,
          strokeLinejoin: "round",
        } as any}
      >
        {label}
      </text>
      <text
        x="12"
        y="4"
        fontSize="8"
        fontFamily="Inter, system-ui, sans-serif"
        fill="rgb(var(--muted))"
        style={{
          paintOrder: "stroke",
          stroke: "rgb(var(--surface))",
          strokeWidth: 4,
          strokeLinejoin: "round",
        } as any}
      >
        {system}
      </text>
    </g>
  );
}
