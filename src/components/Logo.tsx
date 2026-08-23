import clsx from "clsx";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  variant?: "full" | "mark";
  className?: string;
};

const badgeSize: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "h-8 w-8 text-sm",
  md: "h-9 w-9 text-base",
  lg: "h-10 w-10 text-lg",
};

const nameSize: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "text-sm",
  md: "text-[15px]",
  lg: "text-base",
};

export default function Logo({ size = "md", variant = "full", className }: LogoProps) {
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <span
        className={clsx(
          badgeSize[size],
          "flex flex-shrink-0 items-center justify-center rounded-lg border border-accent bg-accent-soft font-heading font-black text-accent"
        )}
      >
        XD
      </span>
      {variant === "full" && (
        <span className="flex flex-col leading-none">
          <span className={clsx(nameSize[size], "font-heading font-bold text-foreground")}>XD GUILD</span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.25em] text-muted-2">
            Samurai Reign
          </span>
        </span>
      )}
    </div>
  );
}
