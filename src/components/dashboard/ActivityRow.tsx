import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";

const statusTone: Record<string, "accent" | "success" | "danger"> = {
  "К выплате": "accent",
  Выплачено: "success",
  Отменено: "danger",
};

/**
 * Short badge label for an activity, e.g. "АГЛ Т1" -> "АГЛ", "Кракен" -> "КР".
 * Already-uppercase first words (in-game raid codes) are kept as-is up to three
 * characters; ordinary names collapse to their first two letters.
 */
function abbreviate(name: string) {
  const word = name.trim().split(/[\s(]+/)[0]?.replace(/[^\p{L}\p{N}]/gu, "") ?? "";
  if (!word) return "—";
  const isCode = word === word.toUpperCase();
  return word.slice(0, isCode ? 3 : 2).toUpperCase();
}

type ActivityRowProps = {
  href: string;
  name: string;
  participants: number;
  status: string;
  date: string;
};

export default function ActivityRow({ href, name, participants, status, date }: ActivityRowProps) {
  return (
    <Link
      href={href}
      className="flex min-h-[46px] items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm transition-colors duration-150 hover:border-accent/30"
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent-bright">
        {abbreviate(name)}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{name}</span>
      <span className="hidden flex-shrink-0 text-xs text-muted sm:block">{participants} участников</span>
      <StatusBadge tone={statusTone[status] ?? "muted"} label={status} />
      <span className="flex-shrink-0 text-xs text-muted-2">{date}</span>
    </Link>
  );
}
