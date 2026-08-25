const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const sharp = require("sharp");

const { ANTHROPIC_API_KEY, VISION_PROXY_SECRET, PORT = 3001 } = process.env;

if (!ANTHROPIC_API_KEY || !VISION_PROXY_SECRET) {
  console.error("Не заданы ANTHROPIC_API_KEY / VISION_PROXY_SECRET.");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const app = express();
app.use(express.json({ limit: "5mb" }));

async function askVision(image, mediaType, prompt) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  const text = response.content.find((c) => c.type === "text")?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  return JSON.parse(jsonMatch[0]);
}

function requireAuth(req, res) {
  if (req.headers.authorization !== `Bearer ${VISION_PROXY_SECRET}`) {
    res.status(403).json({ error: "Нет доступа." });
    return false;
  }
  return true;
}

function readImageBody(req, res) {
  const { image, mediaType } = req.body || {};
  if (typeof image !== "string" || !image || typeof mediaType !== "string" || !mediaType.startsWith("image/")) {
    res.status(400).json({ error: "Нужны image (base64) и mediaType." });
    return null;
  }
  return { image, mediaType };
}

app.post("/extract-names", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const body = readImageBody(req, res);
  if (!body) return;

  try {
    const parsed = await askVision(
      body.image,
      body.mediaType,
      "На скрине список участников игровой активности (MMO-гильдия). " +
        "Выпиши все игровые ники участников, которые видишь на скрине, и укажи расположение каждого ника " +
        "на изображении: x, y — координаты левого верхнего угла текста ника, w, h — ширина и высота area " +
        "с ником, всё в процентах от размеров всего изображения (числа от 0 до 100). " +
        "Игнорируй элементы интерфейса, заголовки, кнопки, названия активности/локации — только ники игроков. " +
        'Ответь строго JSON без пояснений в формате {"names": [{"name": "ник1", "x": 12.5, "y": 30.2, "w": 8, "h": 3}]}. ' +
        'Если ников нет — {"names": []}.'
    );
    const names = Array.isArray(parsed?.names)
      ? parsed.names
          .filter((n) => n && typeof n.name === "string" && n.name.trim())
          .map((n) => ({
            name: n.name.trim(),
            x: Number(n.x),
            y: Number(n.y),
            w: Number(n.w),
            h: Number(n.h),
          }))
      : [];
    res.json({ names });
  } catch (err) {
    console.error("Ошибка распознавания ников:", err);
    res.status(502).json({ error: err.message || "Ошибка запроса к Anthropic." });
  }
});

app.post("/extract-drops", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const body = readImageBody(req, res);
  if (!body) return;

  try {
    const parsed = await askVision(
      body.image,
      body.mediaType,
      "На скрине список дропа (предметов), полученных в игровой активности (MMO-гильдия). " +
        "Выпиши каждый предмет и его количество. Игнорируй элементы интерфейса, кнопки, золото/валюту, " +
        "если это не отдельный именованный трофей. " +
        'Ответь строго JSON без пояснений в формате {"items": [{"name": "предмет", "quantity": 1}]}. ' +
        'Если предметов нет — {"items": []}.'
    );
    const items = Array.isArray(parsed?.items)
      ? parsed.items
          .filter((i) => i && typeof i.name === "string" && i.name.trim())
          .map((i) => ({ name: i.name.trim(), quantity: Math.max(1, Math.round(Number(i.quantity) || 1)) }))
      : [];
    res.json({ items });
  } catch (err) {
    console.error("Ошибка распознавания дропа:", err);
    res.status(502).json({ error: err.message || "Ошибка запроса к Anthropic." });
  }
});

// Обводит красными рамками указанные области на полном скрине (для ников,
// которых не удалось сопоставить с составом гильдии) и возвращает PNG.
app.post("/draw-boxes", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const { image, boxes } = req.body || {};
  if (typeof image !== "string" || !image) {
    return res.status(400).json({ error: "Нужен image (base64)." });
  }
  const validBoxes = Array.isArray(boxes)
    ? boxes.filter(
        (b) => b && [b.x, b.y, b.w, b.h].every((n) => typeof n === "number" && Number.isFinite(n))
      )
    : [];
  if (validBoxes.length === 0) {
    return res.status(400).json({ error: "Нужен непустой список boxes с координатами." });
  }

  try {
    const buffer = Buffer.from(image, "base64");
    const base = sharp(buffer);
    const meta = await base.metadata();
    const width = meta.width || 1000;
    const height = meta.height || 1000;

    const rects = validBoxes
      .map((b) => {
        const x = Math.max(0, (b.x / 100) * width - 4);
        const y = Math.max(0, (b.y / 100) * height - 4);
        const w = (b.w / 100) * width + 8;
        const h = (b.h / 100) * height + 8;
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#ff2d55" stroke-width="4" rx="3" />`;
      })
      .join("");
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;

    const outBuffer = await base.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
    res.json({ image: outBuffer.toString("base64") });
  } catch (err) {
    console.error("Ошибка отрисовки рамок:", err);
    res.status(502).json({ error: err.message || "Ошибка отрисовки." });
  }
});

app.get("/", (_req, res) => res.send("guild-vision-proxy OK"));

app.listen(PORT, () => console.log(`vision-proxy слушает порт ${PORT}`));
