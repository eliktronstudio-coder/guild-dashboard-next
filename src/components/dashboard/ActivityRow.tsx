import Link from "next/link";
import BannerMedia from "@/components/BannerMedia";
import StatusBadge from "@/components/StatusBadge";

const statusTone: Record<string, "accent" | "success" | "danger"> = {
  "К выплате": "accent",
  Выплачено: "success",
  Отменено: "danger",
};

type ActivityRowProps = {
  href: string;
  name: string;
  participants: number;
  status: string;
  date: string;
  bannerUrl?: string | null;
  bannerIsVideo?: boolean;
};

/**
 * Full-row banner background with a left-to-right scrim, same treatment as
 * the schedule panel rows — the text sits on the opaque left side, the
 * artwork reveals on the right.
 */
export default function ActivityRow({ href, name, participants, status, date, bannerUrl, bannerIsVideo }: ActivityRowProps) {
  return (
    <Link
      href={href}
      className="relative flex min-h-[64px] items-center gap-3 overflow-hidden rounded-lg border border-border bg-surface px-4 py-2.5 text-sm transition-colors duration-150 hover:border-accent/30"
    >
      {bannerUrl && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <BannerMedia
            src={bannerUrl}
            isVideo={bannerIsVideo}
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            className="object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(var(--art-scrim),0.97) 0%, rgba(var(--art-scrim),0.9) 45%, rgba(var(--art-scrim),0.45) 75%, rgba(var(--art-scrim),0.15) 100%)",
            }}
          />
        </div>
      )}
      <span className="relative min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{name}</span>
        <span className="mt-1 flex items-center gap-2 text-xs text-muted-2">
          <span className="whitespace-nowrap">{date}</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">{participants} уч.</span>
        </span>
      </span>
      <span className="relative flex-shrink-0">
        <StatusBadge tone={statusTone[status] ?? "muted"} label={status} />
      </span>
    </Link>
  );
}
