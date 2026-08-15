import clsx from "clsx";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  variant?: "full" | "mark";
  className?: string;
};

const markSize: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
};

const subSize: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "text-[6px] tracking-[0.3em]",
  md: "text-[9px] tracking-[0.35em] mt-0.5",
  lg: "text-[11px] tracking-[0.4em] mt-1",
};

export default function Logo({ size = "md", variant = "full", className }: LogoProps) {
  return (
    <div className={clsx("flex flex-col leading-none", className)}>
      <span
        className={clsx(
          markSize[size],
          "bg-gradient-to-br from-accent-bright via-accent to-ember bg-clip-text font-black italic tracking-tight text-transparent"
        )}
        style={{ filter: "drop-shadow(0 0 10px var(--accent-soft))" }}
      >
        XD
      </span>
      {variant === "full" && (
        <span className={clsx(subSize[size], "font-semibold uppercase text-muted")}>Guild</span>
      )}
    </div>
  );
}
