import Link from "next/link";
import { Swords } from "lucide-react";
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
};

export default function ActivityRow({ href, name, participants, status, date }: ActivityRowProps) {
  return (
    <Link
      href={href}
      className="flex min-h-[46px] items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm transition-colors duration-150 hover:border-accent/30"
    >
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Swords size={14} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{name}</span>
      <span className="hidden flex-shrink-0 text-xs text-muted sm:block">{participants} участников</span>
      <StatusBadge tone={statusTone[status] ?? "muted"} label={status} />
      <span className="flex-shrink-0 text-xs text-muted">{date}</span>
    </Link>
  );
}
