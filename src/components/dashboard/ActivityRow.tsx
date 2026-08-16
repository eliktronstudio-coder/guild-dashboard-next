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
      className="group flex min-h-[48px] items-center gap-3 rounded-[7px] border border-white/[0.035] bg-gradient-to-r from-white/[0.026] to-white/[0.012] px-2.5 py-2 text-sm transition-[background-color,border-color,transform] duration-150 hover:-translate-y-px hover:border-accent/20 hover:bg-accent-soft"
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent-soft text-accent">
        <Swords size={15} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{name}</span>
      <span className="hidden flex-shrink-0 text-xs text-muted sm:block">{participants} участников</span>
      <StatusBadge tone={statusTone[status] ?? "muted"} label={status} />
      <span className="flex-shrink-0 text-xs text-muted">{date}</span>
    </Link>
  );
}
