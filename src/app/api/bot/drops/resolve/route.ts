import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findBestMatch, normalizeName } from "@/lib/nameMatch";

/** Discord показывает не больше 25 вариантов в одном списке. */
const MAX_CANDIDATES = 25;

function isAuthorized(request: NextRequest) {
  const secret = process.env.BOT_API_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Разбирает распознанные названия дропа по реестру.
 *
 * Отдельный случай — семейства предметов: со скрина читается «Эссенция ярости»,
 * а в реестре их пять (х1000 … х12500). Однозначно выбрать нельзя, поэтому
 * такие названия возвращаются списком вариантов, чтобы человек указал нужный
 * в Discord. Количество при этом берётся со скрина и не переспрашивается.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const names: string[] = Array.isArray(body?.names)
    ? body.names
        .filter((n: unknown): n is string => typeof n === "string")
        .map((n: string) => n.trim())
        .filter((n: string) => n.length > 0 && n.length <= 60)
    : [];

  const catalog = await prisma.dropCatalogItem.findMany({ select: { id: true, name: true } });

  const results = names.map((input) => {
    const normalized = normalizeName(input);

    // Предметы одного семейства: название из реестра начинается с распознанного.
    const family = catalog.filter((c) => {
      const name = normalizeName(c.name);
      if (name === normalized || !name.startsWith(normalized)) return false;
      // Дальше должен идти разделитель, иначе «Эссенция уж» цепляла бы «Эссенция ужаса».
      return !/[\p{L}\p{N}]/u.test(name[normalized.length] ?? " ");
    });
    if (family.length > 1) {
      return {
        input,
        matched: null,
        candidates: family.slice(0, MAX_CANDIDATES).map((c) => ({ id: c.id, name: c.name })),
      };
    }

    const matched = findBestMatch(input, catalog) ?? family[0] ?? null;
    return { input, matched: matched ? { id: matched.id, name: matched.name } : null, candidates: [] };
  });

  return NextResponse.json({ results });
}
