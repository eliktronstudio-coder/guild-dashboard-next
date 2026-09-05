import Link from "next/link";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import BlurValue from "@/components/BlurValue";
import AttendanceChart from "@/components/charts/AttendanceChart";

const numberFmt = new Intl.NumberFormat("ru-RU");
const coefficientFmt = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const activityStatusTone: Record<string, "accent" | "success" | "danger"> = {
  "К выплате": "accent",
  Выплачено: "success",
  Отменено: "danger",
};

const paymentStatusTone: Record<string, "accent" | "success" | "danger"> = {
  Ожидает: "accent",
  Подтверждено: "accent",
  Выплачено: "success",
  Отклонено: "danger",
};

export type PlayerProfileData = {
  player: {
    name: string;
    role: string;
    attendancePct: number;
    attendancePctPrime: number;
    attendancePctMiniRb: number;
    salary: number;
    salaryPrime: number;
    salaryMiniRb: number;
    level: number;
    xp: number;
    salaryCoefficient: number;
  };
  activities: { id: string; name: string; date: string; status: string }[];
  payments: { id: string; amount: number; status: string; date: string }[];
  attendanceChart: { date: string; count: number }[];
  isRandom: boolean;
  /** Ссылка "назад" вверху страницы; пусто — без неё (например, на «Моём профиле»). */
  backHref?: string;
  backLabel?: string;
};

/** Общее тело профиля игрока — используется и на /players/[id], и на /profile. */
export default function PlayerProfileView({
  player,
  activities,
  payments,
  attendanceChart,
  isRandom,
  backHref,
  backLabel = "← Состав",
}: PlayerProfileData) {
  return (
    <div className="space-y-4">
      {backHref && (
        <div>
          <Link href={backHref} className="text-xs text-accent hover:underline">
            {backLabel}
          </Link>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent-bright">
          {player.name.charAt(0).toUpperCase()}
        </span>
        <div>
          <h2 className="text-lg font-semibold">{player.name}</h2>
          <p className="text-xs text-muted">{player.role}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BlurValue blurred={isRandom}>
          <StatCard label="Посещаемость" value={`${player.attendancePct}%`} hint="за всё время" />
        </BlurValue>
        <BlurValue blurred={isRandom}>
          <StatCard label="Посещаемость: Прайм" value={`${player.attendancePctPrime}%`} hint="за всё время" />
        </BlurValue>
        <BlurValue blurred={isRandom}>
          <StatCard label="Посещаемость: Мини-РБ" value={`${player.attendancePctMiniRb}%`} hint="за всё время" />
        </BlurValue>
        <BlurValue blurred={isRandom}>
          <StatCard label="Зарплата" value={`${numberFmt.format(player.salary)} золота`} hint="расчётная" />
        </BlurValue>
        <BlurValue blurred={isRandom}>
          <StatCard label="Зарплата: Прайм" value={`${numberFmt.format(player.salaryPrime)} золота`} hint="расчётная" />
        </BlurValue>
        <BlurValue blurred={isRandom}>
          <StatCard label="Зарплата: Мини-РБ" value={`${numberFmt.format(player.salaryMiniRb)} золота`} hint="расчётная" />
        </BlurValue>
        <StatCard label="Уровень" value={String(player.level)} hint="текущий уровень" />
        <StatCard label="Опыт" value={`${numberFmt.format(player.xp)} XP`} hint="накоплено" />
        <StatCard label="Коэффициент" value={coefficientFmt.format(player.salaryCoefficient)} hint="настраивает админ" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold">Посещаемость по неделям</h3>
        <BlurValue blurred={isRandom}>
          <AttendanceChart data={attendanceChart} />
        </BlurValue>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">История активностей</h3>
          {activities.length === 0 ? (
            <EmptyState title="Нет данных за выбранный период" hint="Игрок ещё не участвовал в активностях." />
          ) : (
            <ul className="divide-y divide-border">
              {activities.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                  <Link href={`/activities/${a.id}`} className="min-w-0 hover:text-accent">
                    <p className="truncate font-medium">{a.name}</p>
                    <p className="text-xs text-muted">{a.date}</p>
                  </Link>
                  <StatusBadge label={a.status} tone={activityStatusTone[a.status] ?? "muted"} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">История выплат</h3>
          {payments.length === 0 ? (
            <EmptyState title="Нет данных за выбранный период" hint="Выплат этому игроку ещё не было." />
          ) : (
            <ul className="divide-y divide-border">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <BlurValue blurred={isRandom}>
                      <p className="font-mono font-medium tabular-nums">{numberFmt.format(p.amount)} золота</p>
                    </BlurValue>
                    <p className="text-xs text-muted">{p.date}</p>
                  </div>
                  <StatusBadge label={p.status} tone={paymentStatusTone[p.status] ?? "muted"} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
