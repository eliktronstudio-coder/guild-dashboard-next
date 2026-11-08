import { prisma } from "@/lib/prisma";
import { computeAttendanceMaps, isCountedActivity } from "@/lib/attendance";
import { resolveAttendanceFund } from "@/lib/activityWeights";
import { getActivePeriod, computePeriodBounds } from "@/lib/period";
import { getAllPlayers, getFinancialRange } from "@/lib/queries";
import {
  parseDay,
  positivePage,
  value,
  type ReportParams,
} from "@/lib/report-filters";
import { isFullAdminRole } from "@/lib/accountRoles";
import type { SessionPayload } from "@/lib/auth";

export async function getStatistics(
  params: ReportParams,
  viewer: SessionPayload,
  exportAll = false,
) {
  const active = await getActivePeriod();
  const archives = await prisma.archive.findMany({
    orderBy: { dateFrom: "desc" },
    select: { id: true, label: true, dateFrom: true, dateTo: true },
  });
  const preset = ["current", "previous", "7", "30", "custom"].includes(
    value(params.period),
  )
    ? value(params.period)
    : "current";
  const category = ["Прайм", "Мини-РБ", "PvE", "PvP"].includes(
    value(params.category),
  )
    ? value(params.category)
    : "";
  const archive = archives.find((item) => item.id === value(params.archive));
  let from = active.startDate;
  let to = active.endDate;
  if (preset === "previous")
    ({ startDate: from, endDate: to } = computePeriodBounds(
      new Date(active.startDate.getTime() - 1),
    ));
  if (preset === "7" || preset === "30") {
    to = new Date();
    to.setUTCHours(0, 0, 0, 0);
    to.setUTCDate(to.getUTCDate() + 1);
    from = new Date(to.getTime() - Number(preset) * 86400000);
  }
  let error: string | null =
    value(params.archive) && !archive ? "Архив не найден." : null;
  if (preset === "custom") {
    const start = parseDay(value(params.from));
    const end = parseDay(value(params.to));
    if (
      !start ||
      !end ||
      start > end ||
      end.getTime() - start.getTime() > 365 * 86400000
    )
      error = "Укажите корректный диапазон до 366 дней.";
    else {
      from = start;
      to = new Date(end.getTime() + 86400000);
    }
  }
  if (archive) {
    from = archive.dateFrom;
    to = new Date(archive.dateTo.getTime() + 1);
    error = null;
  }
  const date = { gte: from, lt: to };
  // Select only scalars needed for calculations: never load images, passwords or tokens.
  const [activities, livePlayers, snapshots, transactions] = await Promise.all([
    prisma.activity.findMany({
      where: { archiveId: archive?.id ?? null, date },
      select: {
        id: true,
        name: true,
        category: true,
        mode: true,
        weight: true,
        status: true,
        date: true,
        pvpResult: true,
        participants: {
          select: { playerId: true, pvpKills: true, honorPoints: true },
        },
      },
      orderBy: { date: "asc" },
    }),
    getAllPlayers(),
    archive
      ? prisma.archivePlayerStat.findMany({ where: { archiveId: archive.id } })
      : [],
    prisma.treasuryTransaction.findMany({
      where: { archiveId: archive?.id ?? null, date },
      select: { date: true, amount: true },
    }),
  ]);
  const finance = await getFinancialRange(from, to, archive?.id ?? null);
  const counted = activities.filter((activity) => isCountedActivity(activity));
  const selected = counted.filter(
    (activity) =>
      !category ||
      (category === "PvP" || category === "PvE"
        ? activity.mode === category
        : resolveAttendanceFund(activity.name, activity.mode) === category),
  );
  const maps = computeAttendanceMaps(selected);
  const pvp = selected.filter((activity) => activity.mode === "PvP");
  const participants = new Set(
    selected.flatMap((activity) =>
      activity.participants.map((p) => p.playerId),
    ),
  );
  const daily = new Map<
    string,
    {
      date: string;
      count: number;
      prime: number;
      miniRb: number;
      income: number;
      expense: number;
    }
  >();
  const makeDay = (key: string) => ({
    date: key,
    count: 0,
    prime: 0,
    miniRb: 0,
    income: 0,
    expense: 0,
  });
  if (to.getTime() - from.getTime() <= 370 * 86400000) {
    for (
      let day = new Date(from);
      day < to;
      day = new Date(day.getTime() + 86400000)
    ) {
      const key = day.toISOString().slice(0, 10);
      daily.set(key, makeDay(key));
    }
  } else {
    // Long archives use sparse observed dates, without dropping later observations.
    for (const key of [
      ...new Set(
        [...activities, ...transactions].map((row) =>
          row.date.toISOString().slice(0, 10),
        ),
      ),
    ].sort())
      daily.set(key, makeDay(key));
  }
  for (const activity of selected) {
    const entry = daily.get(activity.date.toISOString().slice(0, 10));
    if (!entry) continue;
    entry.count += activity.participants.length;
    entry[
      resolveAttendanceFund(activity.name, activity.mode) === "Прайм"
        ? "prime"
        : "miniRb"
    ] += activity.participants.length;
  }
  // Money is a separate date-filtered ledger: attendance category must not reclassify sales.
  for (const transaction of transactions) {
    const entry = daily.get(transaction.date.toISOString().slice(0, 10));
    if (entry) {
      if (transaction.amount >= 0) entry.income += transaction.amount;
      else entry.expense -= transaction.amount;
    }
  }
  const weekly = new Map<
    string,
    { date: string; count: number; prime: number; miniRb: number }
  >();
  for (const point of daily.values()) {
    const monday = new Date(point.date);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    const entry = weekly.get(key) ?? {
      date: key,
      count: 0,
      prime: 0,
      miniRb: 0,
    };
    entry.count += point.count;
    entry.prime += point.prime;
    entry.miniRb += point.miniRb;
    weekly.set(key, entry);
  }
  const source = archive
    ? snapshots.map((p) => ({
        id: p.playerId ?? p.id,
        name: p.playerName,
        role: p.role,
        userId:
          livePlayers.find((player) => player.id === p.playerId)?.userId ??
          null,
        attendancePct: p.attendancePct,
        attendancePctPrime: p.attendancePctPrime,
        attendancePctMiniRb: p.attendancePctMiniRb,
        pvpCount: p.pvpCount,
        salary: p.salaryPrime + p.salaryMiniRb,
        salaryPrime: p.salaryPrime,
        salaryMiniRb: p.salaryMiniRb,
      }))
    : livePlayers;
  const wholeCurrent = !archive && preset === "current";
  const rows = source.map((player) => {
    const stats = pvp.flatMap((a) =>
      a.participants.filter((p) => p.playerId === player.id),
    );
    const financial =
      isFullAdminRole(viewer.role) || player.userId === viewer.sub;
    // Archive attendance is the frozen snapshot; it must survive player renaming/deletion.
    const frozen = !!archive;
    const snapshot = snapshots.find((p) => (p.playerId ?? p.id) === player.id);
    return {
      id: player.id,
      profileId: archive ? snapshot?.playerId : player.id,
      name: player.name,
      role: player.role,
      attended: frozen
        ? (snapshot?.attended ?? 0)
        : (maps.attended.get(player.id) ?? 0),
      available: frozen
        ? (snapshot?.activitiesTotal ?? 0)
        : maps.totals.overall,
      attendance: frozen
        ? player.attendancePct
        : (maps.overall.get(player.id) ?? 0),
      prime: frozen
        ? player.attendancePctPrime
        : (maps.prime.get(player.id) ?? 0),
      miniRb: frozen
        ? player.attendancePctMiniRb
        : (maps.miniRb.get(player.id) ?? 0),
      pvp: frozen ? player.pvpCount : (maps.pvpCount.get(player.id) ?? 0),
      kills: stats.reduce((sum, p) => sum + p.pvpKills, 0),
      honor: stats.reduce((sum, p) => sum + p.honorPoints, 0),
      salary:
        financial && (wholeCurrent || !!archive)
          ? category === "Прайм"
            ? player.salaryPrime
            : category === "Мини-РБ"
              ? player.salaryMiniRb
              : player.salary
          : null,
    };
  });
  const sort = [
    "attendance",
    "prime",
    "miniRb",
    "pvp",
    "salary",
    "attended",
    "kills",
    "honor",
  ].includes(value(params.sort))
    ? (value(params.sort) as
        | "attendance"
        | "prime"
        | "miniRb"
        | "pvp"
        | "salary"
        | "attended"
        | "kills"
        | "honor")
    : "attendance";
  const search = value(params.q).slice(0, 80).toLocaleLowerCase("ru");
  const sorted = rows
    .filter(
      (p) =>
        (!search || p.name.toLocaleLowerCase("ru").includes(search)) &&
        (!value(params.role) || p.role === value(params.role)),
    )
    .sort(
      (a, b) =>
        (b[sort] ?? -1) - (a[sort] ?? -1) || a.name.localeCompare(b.name, "ru"),
    );
  const page = positivePage(
    value(params.page),
    Math.max(1, Math.ceil(sorted.length / 25)),
  );
  return {
    active,
    archives,
    archive,
    finance,
    preset,
    category,
    from,
    to,
    error,
    sort,
    page,
    total: sorted.length,
    totalPages: Math.max(1, Math.ceil(sorted.length / 25)),
    rows: exportAll ? sorted : sorted.slice((page - 1) * 25, page * 25),
    daily: [...daily.values()],
    weekly: [...weekly.values()],
    summary: {
      players: source.length,
      unique: participants.size,
      activities: selected.length,
      participations: selected.reduce(
        (sum, a) => sum + a.participants.length,
        0,
      ),
      average: selected.length
        ? Math.round(
            (selected.reduce((sum, a) => sum + a.participants.length, 0) /
              selected.length) *
              10,
          ) / 10
        : null,
      pvpActivities: pvp.length,
      pvpParticipations: pvp.reduce((sum, a) => sum + a.participants.length, 0),
      kills: pvp.reduce(
        (sum, a) => sum + a.participants.reduce((s, p) => s + p.pvpKills, 0),
        0,
      ),
      honor: pvp.reduce(
        (sum, a) => sum + a.participants.reduce((s, p) => s + p.honorPoints, 0),
        0,
      ),
      wins: pvp.filter((a) => a.pvpResult === "Победа").length,
      defeats: pvp.filter((a) => a.pvpResult === "Поражение").length,
      income: transactions.reduce((sum, t) => sum + Math.max(0, t.amount), 0),
      expense: transactions.reduce((sum, t) => sum + Math.max(0, -t.amount), 0),
    },
  };
}
