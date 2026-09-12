import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeSnippet } from "@/lib/design/snippets";

/** Сохранённые блоки: список и создание. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const rows = await prisma.designSnippet.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, payload: true, createdAt: true },
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt.toISOString(),
      // Отдаём нормализованным: сохранённая заготовка могла быть создана до
      // изменения реестра, и мусор из неё в редактор попадать не должен.
      payload: normalizeSnippet(r.payload),
    })),
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { name?: string; payload?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.replace(/[<>]/g, "").trim().slice(0, 80) : "";
  if (!name) return NextResponse.json({ error: "Укажите название блока." }, { status: 400 });

  const normalized = normalizeSnippet(body?.payload);
  if (!normalized) return NextResponse.json({ error: "Нечего сохранять." }, { status: 400 });

  const created = await prisma.designSnippet.create({
    data: { name, payload: JSON.stringify(normalized), createdBy: admin.username },
    select: { id: true, name: true, createdAt: true },
  });

  return NextResponse.json({
    item: { id: created.id, name: created.name, createdAt: created.createdAt.toISOString(), payload: normalized },
  });
}
