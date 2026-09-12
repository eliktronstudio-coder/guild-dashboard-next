import { NextResponse, type NextRequest } from "next/server";

/**
 * Кладёт текущий путь и строку запроса в заголовки: корневой layout —
 * серверный компонент и сам по себе адреса не знает, а он нужен, чтобы
 * подставить оформление именно этой страницы (src/lib/design/registry.ts)
 * и понять, открыт ли предпросмотр черновика.
 *
 * Начиная с Next.js 16 это соглашение называется proxy, а не middleware.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-design-pathname", request.nextUrl.pathname);
  headers.set("x-design-search", request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Статику и картинки обходим стороной — заголовки им не нужны.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
