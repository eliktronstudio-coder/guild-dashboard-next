import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { isFullAdminRole, canManageActivitiesRole } from "./accountRoles";
import { prisma } from "./prisma";

const SESSION_COOKIE = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string;
  username: string;
  role: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ username: payload.username, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string" || typeof payload.username !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return { sub: payload.sub, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Secure cookies are only stored by browsers over HTTPS. The site currently
    // runs on plain HTTP, so this must stay false until TLS is set up — flip via
    // COOKIE_SECURE=true once there's a real domain + certificate.
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;

  // Роль читаем из БД, а не из JWT: иначе смена роли админом не действует,
  // пока пользователь сам не перелогинится.
  const user = await prisma.user.findUnique({ where: { id: session.sub }, select: { role: true } });
  if (!user) return null;

  return { ...session, role: user.role };
}

export async function requireAdmin(): Promise<SessionPayload | null> {
  const user = await getCurrentUser();
  if (!user || !isFullAdminRole(user.role)) return null;
  return user;
}

// Админ, ГМ — и дополнительно РЛ, но только для управления активностями.
export async function requireActivitiesManager(): Promise<SessionPayload | null> {
  const user = await getCurrentUser();
  if (!user || !canManageActivitiesRole(user.role)) return null;
  return user;
}
