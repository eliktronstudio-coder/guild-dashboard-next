import { NextRequest, NextResponse } from "next/server";
import { createWorker } from "tesseract.js";
import { requireAdmin } from "@/lib/auth";

const MAX_SIZE_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не получен." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Файл слишком большой (максимум 8 МБ)." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Загрузите изображение." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const worker = await createWorker(["eng", "rus"]);
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "Не удалось распознать изображение." }, { status: 500 });
  } finally {
    await worker.terminate();
  }
}
