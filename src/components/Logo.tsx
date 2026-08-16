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
        className={clsx(markSize[size], "bg-clip-text font-extrabold tracking-tight text-transparent")}
        style={{ backgroundImage: "linear-gradient(135deg, #f4c46f, #bc7930)" }}
      >
        XD
      </span>
      {variant === "full" && (
        <span className={clsx(subSize[size], "font-semibold uppercase text-muted")}>Guild</span>
      )}
    </div>
  );
}
