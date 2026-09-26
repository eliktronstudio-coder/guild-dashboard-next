import Link from "next/link";
import clsx from "clsx";
import AchievementIcon from "./AchievementIcon";
import { rarityStyle } from "./rarity";
import { DEFAULT_TIERS } from "@/lib/achievements/tiers";
import { pluralizeUnit } from "@/lib/achievements/units";
import type { AchievementState } from "@/lib/achievements/progress";

const numberFmt = new Intl.NumberFormat("ru-RU");

/**
 * Достижения в профиле игрока: суммарные очки, число взятых ступеней и до
 * трёх закреплённых цепочек.
 *
 * Пока закрепление вручную не сделано, показываем три сильнейших — это
 * честнее пустого места и сразу полезно.
 */
export default function ProfileAchievements({
  items,
  totalPoints,
  earnedTiers,
  maxPoints,
}: {
  items: AchievementState[];
  totalPoints: number;
  earnedTiers: number;
  maxPoints: number;
}) {
  const pinned = [...items]
    .filter((i) => (i.progress?.level ?? 0) > 0)
    .sort((a, b) => (b.progress?.points ?? 0) - (a.progress?.points ?? 0))
    .slice(0, 3);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Достижения</h2>
        <Link href="/achievements" className="text-xs text-accent hover:underline">
          Все достижения →
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-sm">
        <span>
          <span className="text-muted">Очки: </span>
          <span className="font-mono font-medium tabular-nums">{numberFmt.format(totalPoints)}</span>
          <span className="text-xs text-muted"> из {numberFmt.format(maxPoints)}</span>
        </span>
        <span>
          <span className="text-muted">Ступеней: </span>
          <span className="font-mono font-medium tabular-nums">{earnedTiers}</span>
        </span>
      </div>

      {pinned.length === 0 ? (
        <p className="mt-3 text-xs text-muted">Ступеней пока нет — они появятся с первыми заслугами.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {pinned.map((i) => {
            const tier = DEFAULT_TIERS[(i.progress?.level ?? 1) - 1];
            const style = rarityStyle(tier.rarity);
            return (
              <li
                key={i.key}
                className={clsx("flex items-center gap-2 rounded-md border bg-surface-2 p-2", style.border)}
              >
                <span className={clsx("flex-shrink-0", style.text)}>
                  <AchievementIcon name={i.icon} size={26} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{i.title}</span>
                  <span className={clsx("block text-[11px] tabular-nums", style.text)}>
                    {tier.roman} · {numberFmt.format(i.progress?.value ?? 0)}{" "}
                    {pluralizeUnit(i.progress?.value ?? 0, i.unit)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
