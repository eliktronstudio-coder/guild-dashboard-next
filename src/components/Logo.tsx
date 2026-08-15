export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <defs>
        <linearGradient id="xdLogoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent-bright)" />
          <stop offset="100%" stopColor="var(--accent-dim)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="10" fill="url(#xdLogoGrad)" />
      {/* X — two crossed blade strokes */}
      <path d="M7 9 L20 32" stroke="rgba(9,10,16,0.85)" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M20 9 L7 32" stroke="rgba(9,10,16,0.85)" strokeWidth="3.4" strokeLinecap="round" />
      {/* D — vertical stroke + geometric arc */}
      <path
        d="M25 9 V32 M25 9 C33 9 33 32 25 32"
        stroke="rgba(9,10,16,0.85)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
