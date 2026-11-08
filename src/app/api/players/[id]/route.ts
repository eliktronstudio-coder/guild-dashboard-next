import { isFullAdminRole } from "@/lib/accountRoles";
import { getApprovedUser } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ROLES } from "@/lib/roles";
import {
  getPlayerById,
  getPlayerActivityHistory,
  getPlayerPayments,
  getPlayerAttendanceChartData,
} from "@/lib/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApprovedUser();
  if (!user)
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const [player, activities, payments, attendanceChart] = await Promise.all([
    getPlayerById(id),
    getPlayerActivityHistory(id),
    getPlayerPayments(id),
    getPlayerAttendanceChartData(id),
  ]);
  if (!player)
    return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });

  const own = isFullAdminRole(user.role) || player.userId === user.sub;
  const safe = {
    id: player.id,
    name: player.name,
    role: player.role,
    attendancePct: player.attendancePct,
    attendancePctPrime: player.attendancePctPrime,
    attendancePctMiniRb: player.attendancePctMiniRb,
    pvpCount: player.pvpCount,
    ...(own
      ? {
          salary: player.salary,
          salaryPrime: player.salaryPrime,
          salaryMiniRb: player.salaryMiniRb,
        }
      : {}),
  };
  return NextResponse.json(
    {
      player: safe,
      activities,
      payments: own ? payments : [],
      attendanceChart,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const role = typeof body?.role === "string" ? body.role : "";
  const salaryCoefficient =
    body?.salaryCoefficient === undefined ? 1 : Number(body.salaryCoefficient);

  if (!name || name.length > 40) {
    return NextResponse.json(
      { error: "Укажите имя игрока (до 40 символов)." },
      { status: 400 },
    );
  }
  const conflicting = await prisma.player.findMany({
    select: { id: true, name: true },
  });
  if (
    conflicting.some(
      (player) =>
        player.name.normalize("NFKC").trim().toLocaleLowerCase("ru") ===
          name.normalize("NFKC").trim().toLocaleLowerCase("ru") &&
        player.id !== id,
    )
  )
    return NextResponse.json(
      { error: "Этот ник уже есть в составе." },
      { status: 409 },
    );
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Неверная роль." }, { status: 400 });
  }
  if (
    !Number.isFinite(salaryCoefficient) ||
    salaryCoefficient < 0 ||
    salaryCoefficient > 1.25
  ) {
    return NextResponse.json(
      { error: "Коэффициент должен быть от 0.0 до 1.25." },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = { name, role, salaryCoefficient };
  if (body?.level !== undefined) {
    const level = Number(body.level);
    if (!Number.isFinite(level) || level < 1 || level > 999) {
      return NextResponse.json({ error: "Неверный уровень." }, { status: 400 });
    }
    data.level = level;
  }
  if (body?.xp !== undefined) {
    const xp = Number(body.xp);
    if (!Number.isFinite(xp) || xp < 0) {
      return NextResponse.json({ error: "Неверный опыт." }, { status: 400 });
    }
    data.xp = xp;
  }

  const player = await prisma.player.update({
    where: { id },
    data,
  });

  return NextResponse.json(player);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;

  const player = await prisma.player.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          activities: true,
          payments: true,
          drops: true,
          archiveStats: true,
        },
      },
    },
  });
  if (!player)
    return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });
  if (Object.values(player._count).some((count) => count > 0))
    return NextResponse.json(
      {
        error:
          "У игрока есть история участия или финансов. Удаление запрещено.",
      },
      { status: 409 },
    );
  await prisma.player.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
