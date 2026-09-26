"use client";

import { useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { Crown } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import AchievementsBrowser from "./AchievementsBrowser";
import type { AchievementState } from "@/lib/achievements/progress";

const numberFmt = new Intl.NumberFormat("ru-RU");
const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export type RatingRow = {
  playerId: string;
  name: string;
  role: string;
  points: number;
  tiers: number;
};

export default function AchievementsView({
  mine,
  all,
  rating,
  totals,
  startedAt,
  isAdmin,
  meId,
  readyCount,
}: {
  /** Прогресс вошедшего игрока; null — учётка не привязана к составу. */
  mine: AchievementState[] | null;
  all: AchievementState[];
  rating: RatingRow[];
  totals: { points: number; tiers: number; maxPoints: number } | null;
  startedAt: string;
  isAdmin: boolean;
  meId: string | null;
  readyCount: number;
}) {
  const tabs = ["Мои достижения", "Все достижения", "Рейтинг", ...(isAdmin ? ["Управление"] : [])];
  const [tab, setTab] = useState(tabs[0]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Достижения</h1>
        <p className="mt-0.5 text-sm text-muted">
          Учёт начат {dateFmt.format(new Date(startedAt))}. Засчитываются только заслуги после этой даты — золото
          считается за всё время.
        </p>
      </div>

      {/* ——— Вкладки ——— */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
              tab === t ? "bg-accent/10 font-medium text-foreground" : "text-muted hover:bg-surface-2"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Мои достижения" &&
        (mine && totals ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Очки" value={`${numberFmt.format(totals.points)} из ${numberFmt.format(totals.maxPoints)}`} />
              <Stat label="Ступеней получено" value={String(totals.tiers)} />
              <Stat label="Цепочек считается" value={`${readyCount} из ${all.length}`} />
            </div>
            <AchievementsBrowser items={mine} />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState
              title="Учётная запись не привязана к игроку"
              hint="Достижения считаются для игрока из состава. Попросите ГМ связать вашу учётку с ником."
            />
          </div>
        ))}

      {tab === "Все достижения" && <AchievementsBrowser items={all} />}

      {tab === "Рейтинг" && <Rating rows={rating} meId={meId} maxPoints={totals?.maxPoints ?? 0} />}

      {tab === "Управление" && isAdmin && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
            Дата начала учёта: <span className="font-medium text-foreground">{dateFmt.format(new Date(startedAt))}</span>.
            Она записывается один раз и не меняется при перезапуске или миграции — иначе гильдия разом получила бы
            прогресс за старые заслуги.
          </div>
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
            Настройка порогов и редактирование названий пока не подключены. Сейчас действуют значения из задания:
            10 / 20 / 50 / 100 / 500 / 1000.
          </div>
          <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
            <p className="font-medium">Источники данных</p>
            <p className="mt-1 text-muted">
              Считается {readyCount} цепочек из {all.length}. Остальным нужны новые поля в формах — до этого они
              показывают «Источник данных не настроен» и очков не дают.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-heading text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Rating({ rows, meId, maxPoints }: { rows: RatingRow[]; meId: string | null; maxPoints: number }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <EmptyState title="Рейтинг пуст" hint="Очки появятся, когда участники начнут набирать ступени." />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Игрок</th>
            <th className="px-4 py-3 font-medium">Роль</th>
            <th className="px-4 py-3 font-medium">Ступеней</th>
            <th className="px-4 py-3 font-medium">Очки</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={r.playerId} className={clsx("row-tint transition-colors", r.playerId === meId && "bg-accent/5")}>
              <td className="px-4 py-3 font-mono tabular-nums text-muted">
                {i < 3 ? <Crown size={13} className="inline text-amber-500" /> : null} {i + 1}
              </td>
              <td className="px-4 py-3 font-medium">
                <Link href={`/players/${r.playerId}`} className="text-accent hover:underline">
                  {r.name}
                </Link>
                {r.playerId === meId && <span className="ml-1.5 text-xs text-muted">это вы</span>}
              </td>
              <td className="px-4 py-3 text-muted">{r.role}</td>
              <td className="px-4 py-3 font-mono tabular-nums text-muted">{r.tiers}</td>
              <td className="px-4 py-3 font-mono font-medium tabular-nums">
                {numberFmt.format(r.points)}
                <span className="ml-1 text-xs text-muted">из {numberFmt.format(maxPoints)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
