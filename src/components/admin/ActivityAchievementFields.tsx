"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trophy } from "lucide-react";
import { BOSS_ALIASES } from "@/lib/achievements/catalog";

const BOSS_LABELS: Record<string, string> = {
  kraken: "Кракен",
  leviathan: "Левиафан",
  calidis: "Калидис",
  xanatos: "Ксанатос",
};

type RosterPlayer = { id: string; name: string; fullParticipation: boolean };

type Fields = {
  bossKey: string | null;
  bossKillConfirmed: boolean;
  killCount: number;
  pvpResult: string | null;
  pvpGuildRaid: boolean;
  guildDefense: boolean;
  organizerPlayerId: string | null;
  organizerName: string | null;
  raidLeaderPlayerId: string | null;
  raidLeaderName: string | null;
};

/**
 * Отметки для достижений: убийство босса, результат PvP, организатор,
 * рейд-лидер и полное участие по каждому игроку.
 *
 * Отдельный блок, а не часть общей формы редактирования активности: эти поля
 * подтверждает не тот, кто заводит активность, а тот, кто разбирает бой —
 * обычно позже и не всегда тот же человек. Каждое поле — явное
 * подтверждение факта, а не вывод из посещения: участие в рейде не значит,
 * что босс убит, присутствие на PvP не значит победу.
 */
export default function ActivityAchievementFields({
  activityId,
  mode,
  category,
  roster,
  fields,
  isAdmin,
}: {
  activityId: string;
  mode: string;
  category: string;
  roster: RosterPlayer[];
  fields: Fields;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bossKey, setBossKey] = useState(fields.bossKey ?? "");
  const [bossKillConfirmed, setBossKillConfirmed] = useState(fields.bossKillConfirmed);
  const [killCount, setKillCount] = useState(String(fields.killCount || 1));
  const [pvpResult, setPvpResult] = useState(fields.pvpResult ?? "");
  const [pvpGuildRaid, setPvpGuildRaid] = useState(fields.pvpGuildRaid);
  const [guildDefense, setGuildDefense] = useState(fields.guildDefense);
  const [organizerPlayerId, setOrganizerPlayerId] = useState(fields.organizerPlayerId ?? "");
  const [raidLeaderPlayerId, setRaidLeaderPlayerId] = useState(fields.raidLeaderPlayerId ?? "");
  const [fullIds, setFullIds] = useState<Set<string>>(new Set(roster.filter((p) => p.fullParticipation).map((p) => p.id)));

  const isMiniBoss = category === "Мини-РБ";
  const isPvP = mode === "PvP";

  function cancel() {
    setEditing(false);
    setError(null);
    setBossKey(fields.bossKey ?? "");
    setBossKillConfirmed(fields.bossKillConfirmed);
    setKillCount(String(fields.killCount || 1));
    setPvpResult(fields.pvpResult ?? "");
    setPvpGuildRaid(fields.pvpGuildRaid);
    setGuildDefense(fields.guildDefense);
    setOrganizerPlayerId(fields.organizerPlayerId ?? "");
    setRaidLeaderPlayerId(fields.raidLeaderPlayerId ?? "");
    setFullIds(new Set(roster.filter((p) => p.fullParticipation).map((p) => p.id)));
  }

  function toggleFull(id: string) {
    setFullIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bossKey: bossKey || null,
          bossKillConfirmed,
          killCount: Number(killCount) || 1,
          pvpResult: pvpResult || null,
          pvpGuildRaid,
          guildDefense,
          organizerPlayerId: organizerPlayerId || null,
          raidLeaderPlayerId: raidLeaderPlayerId || null,
          fullParticipantIds: [...fullIds],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Что-то пошло не так.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером.");
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin && !editing) {
    // Для не-админа показываем только то, что уже подтверждено, без формы.
    const notes: string[] = [];
    if (fields.bossKillConfirmed && fields.bossKey) {
      notes.push(`Убийство: ${BOSS_LABELS[fields.bossKey] ?? fields.bossKey}${fields.killCount > 1 ? ` ×${fields.killCount}` : ""}`);
    }
    if (fields.pvpResult) notes.push(`Результат: ${fields.pvpResult}`);
    if (fields.organizerName) notes.push(`Организатор: ${fields.organizerName}`);
    if (fields.raidLeaderName) notes.push(`Рейд-лидер: ${fields.raidLeaderName}`);
    if (notes.length === 0) return null;
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Trophy size={14} className="text-muted" /> Для достижений
        </h3>
        <ul className="space-y-1 text-xs text-muted">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Trophy size={14} className="text-muted" /> Для достижений
        </h3>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground/80 hover:bg-surface-2 hover:text-foreground"
          >
            <Pencil size={12} /> Отметить
          </button>
        )}
      </div>

      {!editing ? (
        <p className="text-xs text-muted">
          Отметьте подтверждённые факты: убийство босса, результат PvP, организатора, рейд-лидера и полное участие.
          Ничего из этого не выводится автоматически из посещения.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          {isMiniBoss || mode === "PvE" ? (
            <fieldset className="space-y-2 rounded-md border border-border p-2.5">
              <legend className="px-1 text-xs font-medium text-muted">Убийство босса</legend>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={bossKey}
                  onChange={(e) => setBossKey(e.target.value)}
                  className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs"
                >
                  <option value="">Без указания босса</option>
                  {Object.keys(BOSS_ALIASES).map((k) => (
                    <option key={k} value={k}>
                      {BOSS_LABELS[k] ?? k}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={bossKillConfirmed} onChange={(e) => setBossKillConfirmed(e.target.checked)} />
                  Убийство подтверждено
                </label>
                {isMiniBoss && (
                  <label className="flex items-center gap-1.5 text-xs">
                    Убийств за рейд:
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={killCount}
                      onChange={(e) => setKillCount(e.target.value)}
                      className="w-16 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs"
                    />
                  </label>
                )}
              </div>
              <p className="text-[11px] text-muted">
                Один рейд — одно посещение, но может дать несколько убийств (актуально для мини-РБ).
              </p>
            </fieldset>
          ) : null}

          {isPvP && (
            <fieldset className="space-y-2 rounded-md border border-border p-2.5">
              <legend className="px-1 text-xs font-medium text-muted">PvP</legend>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={pvpResult}
                  onChange={(e) => setPvpResult(e.target.value)}
                  className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs"
                >
                  <option value="">Результат не указан</option>
                  <option value="Победа">Победа</option>
                  <option value="Поражение">Поражение</option>
                </select>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={pvpGuildRaid} onChange={(e) => setPvpGuildRaid(e.target.checked)} />
                  Гильдейский рейд
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={guildDefense} onChange={(e) => setGuildDefense(e.target.checked)} />
                  Защита гильдии
                </label>
              </div>
            </fieldset>
          )}

          <fieldset className="space-y-2 rounded-md border border-border p-2.5">
            <legend className="px-1 text-xs font-medium text-muted">Организация</legend>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                Организатор:
                <select
                  value={organizerPlayerId}
                  onChange={(e) => setOrganizerPlayerId(e.target.value)}
                  className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs"
                >
                  <option value="">Не указан</option>
                  {roster.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                Рейд-лидер:
                <select
                  value={raidLeaderPlayerId}
                  onChange={(e) => setRaidLeaderPlayerId(e.target.value)}
                  className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs"
                >
                  <option value="">Не указан</option>
                  {roster.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-2 rounded-md border border-border p-2.5">
            <legend className="px-1 text-xs font-medium text-muted">Полное участие</legend>
            {roster.length === 0 ? (
              <p className="text-xs text-muted">В составе никого нет.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {roster.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs"
                  >
                    <input type="checkbox" checked={fullIds.has(p.id)} onChange={() => toggleFull(p.id)} />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted">Досидел до конца, а не просто зашёл и вышел.</p>
          </fieldset>

          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:opacity-90 disabled:opacity-60"
            >
              Сохранить
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
