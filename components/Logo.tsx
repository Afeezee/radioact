interface Props {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}

// RadioAct mark: a ring + sweep arc + center pin.
// The sweep reads as "scanning", the pin reads as "flagged finding".
export function Logo({ size = 28, withWordmark = false, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden={withWordmark ? true : undefined}
        role={withWordmark ? undefined : "img"}
        aria-label={withWordmark ? undefined : "RadioAct"}
      >
        <circle
          cx="12"
          cy="12"
          r="9.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          opacity="0.28"
        />
        <path
          d="M 12 2.5 A 9.5 9.5 0 0 1 21.5 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
      {withWordmark && (
        <span className="font-display text-[1.35em] leading-none tracking-tight">
          RadioAct
        </span>
      )}
    </span>
  );
}
