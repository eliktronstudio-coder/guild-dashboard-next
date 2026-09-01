import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchNames } from "@/lib/nameMatch";

const MAX_IMAGE_BYTES = 800_000;
const MAX_PARTICIPANTS = 60;
const MAX_DROPS = 60;
const MAX_SCREENSHOTS_PER_KIND = 6; // как в /api/activities
const SCREENSHOT_KINDS = ["roster", "drop"];

function isAuthorized(request: NextRequest) {
  const secret = process.env.BOT_API_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

const CATEGORIES = ["Мини-РБ", "Прайм"];
const MODES = ["PvE", "PvP"];

// Тестовая интеграция с Discord-ботом: бот присылает название активности,
// список ников (со скрина ростера) и опционально список предметов (со
// скрина дропа), оба распознанных ИИ. Ники и предметы сверяются с составом
// гильдии / реестром дропа — совпавшее применяется, остальное уходит на
// ручную проверку (гости / ничего не создаётся), чтобы не приписать
// активность не тому игроку и не выдумать цену на неизвестный предмет.
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const category = typeof body?.category === "string" && CATEGORIES.includes(body.category) ? body.category : CATEGORIES[0];
  const mode = typeof body?.mode === "string" && MODES.includes(body.mode) ? body.mode : MODES[0];
  const screenshots: { kind: string; imageUrl: string }[] = Array.isArray(body?.screenshots)
    ? body.screenshots
        .filter((s: unknown): s is { kind: unknown; imageUrl: unknown } => typeof s === "object" && s !== null)
        .map((s: { kind: unknown; imageUrl: unknown }) => ({
          kind: typeof s.kind === "string" ? s.kind : "",
          imageUrl: typeof s.imageUrl === "string" ? s.imageUrl : "",
        }))
        .filter((s: { kind: string; imageUrl: string }) => SCREENSHOT_KINDS.includes(s.kind) && s.imageUrl)
    : [];
  const participantNames: string[] = Array.isArray(body?.participants)
    ? body.participants
        .filter((n: unknown): n is string => typeof n === "string")
        .map((n: string) => n.trim())
        .filter((n: string) => n.length > 0 && n.length <= 40)
    : [];
  const dropEntries: { name: string; quantity: number }[] = Array.isArray(body?.drops)
    ? body.drops
        .filter((d: unknown): d is { name: unknown; quantity: unknown } => typeof d === "object" && d !== null)
        .map((d: { name: unknown; quantity: unknown }) => ({
          name: typeof d.name === "string" ? d.name.trim() : "",
          quantity: Math.max(1, Math.round(Number(d.quantity) || 1)),
        }))
        .filter((d: { name: string; quantity: number }) => d.name.length > 0 && d.name.length <= 60)
    : [];

  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Укажите название активности (до 60 символов)." }, { status: 400 });
  }
  if (participantNames.length > MAX_PARTICIPANTS) {
    return NextResponse.json({ error: `Слишком много участников (максимум ${MAX_PARTICIPANTS}).` }, { status: 400 });
  }
  if (dropEntries.length > MAX_DROPS) {
    return NextResponse.json({ error: `Слишком много предметов (максимум ${MAX_DROPS}).` }, { status: 400 });
  }
  if (screenshots.some((s) => !s.imageUrl.startsWith("data:image/") || s.imageUrl.length > MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: "Скрин слишком большой или неверного формата." }, { status: 400 });
  }
  for (const kind of SCREENSHOT_KINDS) {
    if (screenshots.filter((s) => s.kind === kind).length > MAX_SCREENSHOTS_PER_KIND) {
      return NextResponse.json({ error: `Максимум ${MAX_SCREENSHOTS_PER_KIND} скринов на раздел.` }, { status: 400 });
    }
  }

  const allPlayers = await prisma.player.findMany({ select: { id: true, name: true } });
  const players = matchNames(participantNames, allPlayers);

  const catalogItems = dropEntries.length
    ? await prisma.dropCatalogItem.findMany({ select: { id: true, name: true, price: true } })
    : [];
  const drops = matchNames(
    dropEntries.map((d) => d.name),
    catalogItems
  );
  const quantityByInput = new Map(dropEntries.map((d) => [d.name, d.quantity]));

  // Куда падает дроп: с Мини-РБ активности — сразу на склад ХД, с Прайм —
  // в Общий инвентарь (та же логика, что и в /api/drops при ручном добавлении).
  const warehouse = category === "Мини-РБ" ? "ХД" : "Общий";

  const activity = await prisma.activity.create({
    data: {
      name,
      category,
      mode,
      addedByUserId: null,
      participants: { create: players.matched.map((m) => ({ playerId: m.item.id })) },
      guests: { create: players.unmatched.map((n) => ({ name: n })) },
      screenshots: { create: screenshots },
      drops: {
        create: drops.matched.map((m) => ({
          item: m.item.name,
          value: m.item.price,
          quantity: quantityByInput.get(m.input) ?? 1,
          catalogItemId: m.item.id,
          warehouse,
          category,
        })),
      },
    },
  });

  return NextResponse.json(
    {
      activity: { id: activity.id, name: activity.name, category: activity.category, mode: activity.mode },
      matched: players.matched.map((m) => ({ input: m.input, playerName: m.item.name })),
      unmatched: players.unmatched,
      drops: {
        matched: drops.matched.map((m) => ({ input: m.input, catalogName: m.item.name, quantity: quantityByInput.get(m.input) ?? 1 })),
        unmatched: drops.unmatched,
      },
    },
    { status: 201 }
  );
}
