import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { placeBid, skipTurn, type BidOutcome } from "@/lib/auction";

const ERRORS: Record<Exclude<BidOutcome & { ok: false }, { ok: true }>["reason"], { message: string; status: number }> = {
  "no-auction": { message: "Торги не идут.", status: 404 },
  finished: { message: "Торги уже завершены.", status: 409 },
  stale: { message: "Кто-то успел поставить раньше — цена изменилась.", status: 409 },
  "already-leading": { message: "Вы и так лидируете.", status: 409 },
  expired: { message: "Время торгов вышло — ставки больше не принимаются.", status: 409 },
};

/**
 * Ставка или пропуск от имени игрока, привязанного к учётной записи.
 *
 * Ставит сам участник со своего устройства, поэтому имя берётся из сессии, а
 * не из тела запроса: иначе любой мог бы поставить за другого.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role === "random") {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }

  const player = await prisma.player.findUnique({
    where: { userId: user.sub },
    select: { id: true, name: true },
  });
  if (!player) {
    return NextResponse.json(
      { error: "Ваша учётная запись не привязана к игроку в составе — ставить нельзя." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const action = body?.action === "skip" ? "skip" : "bid";

  let outcome: BidOutcome;
  if (action === "skip") {
    outcome = await skipTurn({ playerId: player.id, name: player.name });
  } else {
    const expectedBid = Number(body?.expectedBid);
    if (!Number.isFinite(expectedBid)) {
      return NextResponse.json({ error: "Некорректные данные." }, { status: 400 });
    }
    outcome = await placeBid({ playerId: player.id, name: player.name, expectedBid });
  }

  if (!outcome.ok) {
    const e = ERRORS[outcome.reason];
    return NextResponse.json({ error: e.message }, { status: e.status });
  }

  return NextResponse.json({ ok: true, amount: outcome.amount });
}
