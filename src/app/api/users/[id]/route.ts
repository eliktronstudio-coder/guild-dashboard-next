import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { ACCOUNT_ROLES, isFullAdminRole } from "@/lib/accountRoles";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};

  if (body?.role !== undefined) {
    const role = typeof body.role === "string" ? body.role : "";
    if (!ACCOUNT_ROLES.includes(role as (typeof ACCOUNT_ROLES)[number])) {
      return NextResponse.json({ error: "Неверная роль." }, { status: 400 });
    }
    if (id === admin.sub && !isFullAdminRole(role)) {
      return NextResponse.json({ error: "Нельзя снять админку с самого себя." }, { status: 400 });
    }
    data.role = role;
  }

  if (body?.newPassword !== undefined) {
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Пароль должен быть не короче 6 символов." }, { status: 400 });
    }
    data.passwordHash = await hashPassword(newPassword);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нечего сохранять." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, role: true, createdAt: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const { id } = await params;
  if (id === admin.sub) {
    return NextResponse.json({ error: "Нельзя удалить самого себя." }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
