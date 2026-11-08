import { consumeAuthAttempt } from "@/lib/auth-limit";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username =
    typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || username.length > 32 || !password || password.length > 128) {
    return NextResponse.json(
      { error: "Введите логин и пароль." },
      { status: 400 },
    );
  }

  const retryAfter = await consumeAuthAttempt(username);
  if (retryAfter)
    return NextResponse.json(
      { error: "Слишком много попыток. Повторите позже." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Неверный логин или пароль." },
      { status: 401 },
    );
  }

  await setSessionCookie({
    sub: user.id,
    username: user.username,
    role: user.role,
  });

  return NextResponse.json({ username: user.username, role: user.role });
}
