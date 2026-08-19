import JapaneseWavePattern from "./JapaneseWavePattern";

/**
 * Dashboard header band. Dark theme shows the painted samurai/torii key art
 * (public/images/hero-guild.png); light theme keeps the original line-art
 * Fuji/sun sprig so the "fantasy landscape" mood isn't broken by a night scene.
 * Both are always in the DOM and toggled by the `data-theme` CSS rule below
 * (see globals.css) to avoid a hydration/theme flash.
 */
export default function DashboardHero() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -inset-x-4 -top-6 -z-10 h-[300px] overflow-hidden rounded-lg sm:-inset-x-6 sm:h-[340px]">
      <div
        className="hero-art absolute inset-0 bg-[url(/images/hero-guild.png)] bg-cover bg-center"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--background)_0%,transparent_38%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background/70" />
        <div className="absolute inset-0 bg-background/10" />
      </div>

      <svg
        className="hero-art-light absolute right-0 top-0 h-full w-full"
        viewBox="0 0 900 300"
        preserveAspectRatio="xMidYMin slice"
      >
        <circle cx="760" cy="40" r="55" fill="var(--red)" opacity="0.15" />

        <path
          d="M 620 210 L 730 90 L 745 106 L 762 90 L 900 210 Z"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.14"
        />

        <g stroke="var(--accent)" strokeWidth="1.2" fill="none" opacity="0.22">
          <path d="M 560 60 Q 610 40 650 70" />
        </g>
        <g fill="var(--red-bright)" opacity="0.28">
          <circle cx="655" cy="68" r="4" />
          <circle cx="638" cy="55" r="3.5" />
          <circle cx="620" cy="48" r="3" />
          <circle cx="600" cy="46" r="3" />
        </g>
      </svg>

      <JapaneseWavePattern className="hero-art-light bottom-0 left-0 right-0 h-24 text-accent" opacity={0.05} />
    </div>
  );
}
