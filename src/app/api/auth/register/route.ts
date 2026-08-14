import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { ROLES } from "@/lib/roles";

const GAME_ROLES = ROLES.filter((r) => r !== "Без роли");

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
  const role = typeof body?.role === "string" ? body.role : "";

  if (username.length < 3 || username.length > 32) {
    return NextResponse.json({ error: "Логин должен быть от 3 до 32 символов." }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return NextResponse.json(
      { error: "Логин может содержать только латинские буквы, цифры и подчёркивание." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Пароль должен быть не короче 6 символов." }, { status: 400 });
  }
  if (!nickname || nickname.length > 40) {
    return NextResponse.json({ error: "Укажите игровой ник (до 40 символов)." }, { status: 400 });
  }
  if (!GAME_ROLES.includes(role)) {
    return NextResponse.json({ error: "Выберите роль: Танк, Хил, Милик, Лучник или Маг." }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) {
    return NextResponse.json({ error: "Такой логин уже занят." }, { status: 409 });
  }

  const existingPlayer = await prisma.player.findFirst({
    where: { name: { equals: nickname } },
  });
  if (existingPlayer) {
    return NextResponse.json({ error: "Этот игровой ник уже занят в составе." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      player: { create: { name: nickname, role, level: 1, xp: 0, attendancePct: 0 } },
    },
  });

  await setSessionCookie({ sub: user.id, username: user.username, role: user.role });

  return NextResponse.json({ username: user.username, role: user.role });
}
