import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActivitiesManager } from "@/lib/auth";
import { BOSS_ALIASES } from "@/lib/achievements/catalog";
import { applyFullParticipation, applyRosterDiff } from "@/lib/activityRoster";

const STATUSES = ["К выплате", "Выплачено", "Отменено"];
const CATEGORIES = ["Мини-РБ", "Прайм"];
const MODES = ["PvE", "PvP"];
const DIFFICULTIES = ["Обычная", "Героическая"];
const PVP_RESULTS = ["Победа", "Поражение"];
const BOSS_KEYS = Object.keys(BOSS_ALIASES);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireActivitiesManager();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};

  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 60) {
      return NextResponse.json({ error: "Укажите название активности (до 60 символов)." }, { status: 400 });
    }
    data.name = name;
  }
  if (body?.date !== undefined) {
    const date = typeof body.date === "string" && body.date ? new Date(body.date) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Неверная дата." }, { status: 400 });
    }
    data.date = date;
  }
  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Неверный статус." }, { status: 400 });
    data.status = body.status;
  }
  if (body?.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) return NextResponse.json({ error: "Неверный вид." }, { status: 400 });
    data.category = body.category;
  }
  if (body?.mode !== undefined) {
    if (!MODES.includes(body.mode)) return NextResponse.json({ error: "Неверный режим." }, { status: 400 });
    data.mode = body.mode;
  }
  if (body?.difficulty !== undefined) {
    if (!DIFFICULTIES.includes(body.difficulty))
      return NextResponse.json({ error: "Неверная сложность." }, { status: 400 });
    data.difficulty = body.difficulty;
  }
  if (body?.isNight !== undefined) {
    data.isNight = Boolean(body.isNight);
  }
  if (body?.perAttendanceValue !== undefined) {
    const value = Number(body.perAttendanceValue);
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: "Неверная сумма за посещение." }, { status: 400 });
    }
    data.perAttendanceValue = value;
  }
  if (body?.weight !== undefined) {
    const value = Number(body.weight);
    if (!Number.isFinite(value) || value < 0 || value > 10) {
      return NextResponse.json({ error: "Коэффициент должен быть от 0 до 10." }, { status: 400 });
    }
    data.weight = value;
  }

  /*
   * Поля для достижений. Каждое — явное подтверждение конкретного факта, а
   * не вывод из посещения: участие в рейде не значит, что босс убит, а
   * присутствие на PvP не значит победу. Пустая строка/undefined снимает
   * отметку, а не игнорируется — иначе поле нельзя было бы очистить.
   */
  if (body?.bossKey !== undefined) {
    const value = body.bossKey === null || body.bossKey === "" ? null : String(body.bossKey);
    if (value !== null && !BOSS_KEYS.includes(value)) {
      return NextResponse.json({ error: "Неизвестный ключ босса." }, { status: 400 });
    }
    data.bossKey = value;
  }
  if (body?.bossKillConfirmed !== undefined) {
    data.bossKillConfirmed = Boolean(body.bossKillConfirmed);
  }
  if (body?.killCount !== undefined) {
    const value = Math.round(Number(body.killCount));
    if (!Number.isFinite(value) || value < 1 || value > 50) {
      return NextResponse.json({ error: "Число убийств должно быть от 1 до 50." }, { status: 400 });
    }
    data.killCount = value;
  }
  if (body?.pvpResult !== undefined) {
    const value = body.pvpResult === null || body.pvpResult === "" ? null : String(body.pvpResult);
    if (value !== null && !PVP_RESULTS.includes(value)) {
      return NextResponse.json({ error: "Результат PvP: «Победа», «Поражение» или не указан." }, { status: 400 });
    }
    data.pvpResult = value;
  }
  if (body?.pvpGuildRaid !== undefined) data.pvpGuildRaid = Boolean(body.pvpGuildRaid);
  if (body?.guildDefense !== undefined) data.guildDefense = Boolean(body.guildDefense);
  if (body?.organizerPlayerId !== undefined) {
    data.organizerPlayerId = body.organizerPlayerId === null || body.organizerPlayerId === "" ? null : String(body.organizerPlayerId);
  }
  if (body?.raidLeaderPlayerId !== undefined) {
    data.raidLeaderPlayerId =
      body.raidLeaderPlayerId === null || body.raidLeaderPlayerId === "" ? null : String(body.raidLeaderPlayerId);
  }

  const participantIds: string[] | null = Array.isArray(body?.participantIds)
    ? body.participantIds.filter((pid: unknown): pid is string => typeof pid === "string")
    : null;

  // Полное участие отмечается по конкретным игрокам из текущего состава —
  // список тех, кому проставляем true; остальные из состава получают false.
  const fullParticipantIds: string[] | null = Array.isArray(body?.fullParticipantIds)
    ? body.fullParticipantIds.filter((pid: unknown): pid is string => typeof pid === "string")
    : null;

  const activity = await prisma.$transaction(async (tx) => {
    // Диф вместо "удалить всё и создать заново": состав активности часто
    // правят уже после того, как кому-то отметили полное участие или
    // убийство босса — полное удаление строк стирало бы fullParticipation у
    // всех, кто остался в составе, при каждой правке ростера.
    if (participantIds !== null) await applyRosterDiff(tx, id, participantIds);
    if (fullParticipantIds !== null) await applyFullParticipation(tx, id, fullParticipantIds);

    return tx.activity.update({ where: { id }, data });
  });

  return NextResponse.json(activity);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireActivitiesManager();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  // DropItem.activity — onDelete: SetNull, поэтому дроп сам по себе не удалится
  // вместе с активностью и осядет в инвентаре без привязки. Удаляем явно.
  await prisma.$transaction([
    prisma.dropItem.deleteMany({ where: { activityId: id } }),
    prisma.activity.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
