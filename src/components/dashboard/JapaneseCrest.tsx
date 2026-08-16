import clsx from "clsx";

type JapaneseCrestProps = {
  className?: string;
  size?: number;
};

/** Simple mon-style crest ring — a thin circle with a five-petal mark, used behind avatars/icons. */
export default function JapaneseCrest({ className, size = 40 }: JapaneseCrestProps) {
  const petals = Array.from({ length: 5 }, (_, i) => i * 72);
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={clsx("pointer-events-none", className)}
    >
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <g fill="none" stroke="currentColor" strokeWidth="1">
        {petals.map((deg) => (
          <ellipse key={deg} cx="20" cy="9" rx="3" ry="6.5" transform={`rotate(${deg} 20 20)`} />
        ))}
      </g>
      <circle cx="20" cy="20" r="2.5" fill="currentColor" opacity="0.55" />
    </svg>
  );
}
