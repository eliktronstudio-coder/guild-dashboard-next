"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import EmptyState from "@/components/EmptyState";
import BlurValue from "@/components/BlurValue";
import { attendanceColor } from "@/components/AttendanceBar";

const numberFmt = new Intl.NumberFormat("ru-RU");

type PlayerShare = {
  id: string;
  name: string;
  role: string;
  attendancePctPrime: number;
  attendancePctMiniRb: number;
  salary: number;
  salaryPrime: number;
  salaryMiniRb: number;
};

type Category = "Прайм" | "Мини-РБ";


/**
 * Переключатель «Ожидает / Выплачено» для одной доли (П или М) одного
 * игрока. Выплата списывает сумму из соответствующей казны и переносит
 * игрока в Журнал выплат — см. /api/payments/payout. Для read-only
 * пользователей (не админ) рендерится как обычная подпись без кликов.
 */
function StatusToggle({
  playerId,
  category,
  paid,
  disabled,
  canAct,
  archiveId,
  onChanged,
}: {
  playerId: string;
  category: Category;
  /** id закрытого периода; null — выплата за текущий. */
  archiveId?: string | null;
  paid: boolean;
  /** Доля равна нулю — переключать нечего. */
  disabled: boolean;
  canAct: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  if (!canAct) {
    return (
      <span className={clsx("text-[10px]", paid ? "text-success" : "text-muted-2")}>
        {paid ? "Выплачено" : "Ожидает"}
      </span>
    );
  }

  async function setPaid(next: boolean) {
    if (busy || next === paid) return;
    if (next) {
      const where = archiveId ? "из казны закрытого периода" : "из соответствующей казны";
      if (!confirm(`Отметить долю (${category}) как выплаченную? Сумма спишется ${where}.`)) return;
    } else {
      const where = archiveId ? "в казну закрытого периода" : `в казну (${category})`;
      if (!confirm(`Вернуть в «Ожидает»? Сумма вернётся ${where}.`)) return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/payments/payout", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, category, archiveId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Не удалось изменить статус.");
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={clsx(
        "inline-flex overflow-hidden rounded border border-border text-[10px]",
        (disabled || busy) && "opacity-50"
      )}
    >
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => setPaid(false)}
        className={clsx(
          "px-1.5 py-0.5 transition-colors",
          !paid ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2"
        )}
      >
        Ожидает
      </button>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => setPaid(true)}
        className={clsx(
          "px-1.5 py-0.5 transition-colors",
          paid ? "bg-success/20 text-success" : "text-muted hover:bg-surface-2"
        )}
      >
        Выплата
      </button>
    </div>
  );
}

export default function PayoutSummaryTable({
  players,
  totalPayout,
  isRandom = false,
  isAdmin = false,
  paidStatus = [],
  archiveId = null,
  title = "Расчёт распределения",
  subtitle,
}: {
  players: PlayerShare[];
  totalPayout: number;
  isRandom?: boolean;
  isAdmin?: boolean;
  /** Выбран закрытый период — выплата пойдёт в его книги, не в живую казну. */
  archiveId?: string | null;
  /** Заголовок блока: у закрытого периода ничего не «рассчитывается». */
  title?: string;
  subtitle?: string;
  /** Ключи вида `${playerId}:${category}` — уже выплаченные в этом периоде. */
  paidStatus?: string[];
}) {
  const router = useRouter();
  const rows = [...players].sort((a, b) => b.salary - a.salary);
  const paidSet = new Set(paidStatus);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border p-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-muted">
          {subtitle ?? (
            <>
              Основная казна делится между игроками по посещаемости с учётом индивидуального коэффициента.
              {isAdmin && " Статус «Выплата» списывает долю из казны Прайма или Мини-РБ и переносит её в Журнал выплат."}
            </>
          )}
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto">
          <table data-design-el="shared.table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-medium">Игрок</th>
                <th className="px-4 py-3 font-medium">Посещаемость</th>
                <th className="px-4 py-3 font-medium">Доля</th>
                <th className="px-4 py-3 font-medium">Выплата</th>
                <th className="px-4 py-3 font-medium">Зарплата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => {
                const primePaid = paidSet.has(`${p.id}:Прайм`);
                const miniRbPaid = paidSet.has(`${p.id}:Мини-РБ`);
                return (
                  <tr key={p.id} className="row-tint transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 text-xs text-muted">{p.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <BlurValue blurred={isRandom}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-3 flex-shrink-0 text-[10px] font-semibold text-muted" title="Прайм">
                              П
                            </span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                              <div
                                className={clsx("h-full rounded-full", attendanceColor(p.attendancePctPrime).bar)}
                                style={{ width: `${Math.min(p.attendancePctPrime, 100)}%` }}
                              />
                            </div>
                            <span className={clsx("text-xs font-medium", attendanceColor(p.attendancePctPrime).text)}>
                              {p.attendancePctPrime}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 flex-shrink-0 text-[10px] font-semibold text-muted" title="Мини-РБ">
                              М
                            </span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                              <div
                                className={clsx("h-full rounded-full", attendanceColor(p.attendancePctMiniRb).bar)}
                                style={{ width: `${Math.min(p.attendancePctMiniRb, 100)}%` }}
                              />
                            </div>
                            <span
                              className={clsx("text-xs font-medium", attendanceColor(p.attendancePctMiniRb).text)}
                            >
                              {p.attendancePctMiniRb}%
                            </span>
                          </div>
                        </div>
                      </BlurValue>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-muted">
                      {totalPayout > 0 ? `${((p.salary / totalPayout) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium tabular-nums">
                      <BlurValue blurred={isRandom}>{numberFmt.format(p.salary)}</BlurValue>
                    </td>
                    <td className="px-4 py-3">
                      <BlurValue blurred={isRandom}>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-3 flex-shrink-0 text-[10px] font-semibold text-muted" title="Прайм">
                              П
                            </span>
                            <span className="w-16 flex-shrink-0 font-medium tabular-nums">
                              {numberFmt.format(p.salaryPrime)}
                            </span>
                            <StatusToggle
                              playerId={p.id}
                              category="Прайм"
                              paid={primePaid}
                              disabled={p.salaryPrime <= 0}
                              canAct={isAdmin}
                              archiveId={archiveId}
                              onChanged={() => router.refresh()}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 flex-shrink-0 text-[10px] font-semibold text-muted" title="Мини-РБ">
                              М
                            </span>
                            <span className="w-16 flex-shrink-0 font-medium tabular-nums">
                              {numberFmt.format(p.salaryMiniRb)}
                            </span>
                            <StatusToggle
                              playerId={p.id}
                              category="Мини-РБ"
                              paid={miniRbPaid}
                              disabled={p.salaryMiniRb <= 0}
                              canAct={isAdmin}
                              archiveId={archiveId}
                              onChanged={() => router.refresh()}
                            />
                          </div>
                        </div>
                      </BlurValue>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
