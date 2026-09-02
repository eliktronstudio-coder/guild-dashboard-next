const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");

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

const PROMPT =
  "Это скрин из MMO-игры, относящийся к активности гильдии. Он может быть одного из двух видов:\n" +
  '- "roster" — список участников активности (игровые ники людей);\n' +
  '- "drop" — список полученного дропа (предметы и их количество).\n' +
  "Определи вид скрина и выпиши его содержимое.\n" +
  "Для roster: все игровые ники участников. Игнорируй элементы интерфейса, заголовки, кнопки, " +
  "названия активности и локации — только ники игроков.\n" +
  "Для drop: каждый предмет и его количество. Игнорируй элементы интерфейса, кнопки и золото/валюту, " +
  "если это не отдельный именованный трофей.\n" +
  "Если это лог событий (например, «Игрок получает предмет: [Название]») и одно и то же " +
  "название встречается в нескольких СТРОКАХ лога — это разные вхождения (возможно, разные " +
  "конкретные предметы с одинаковым отображаемым названием, например разные уровни эссенции). " +
  "Выпиши КАЖДУЮ такую строку отдельным элементом массива items с quantity: 1. " +
  "НЕ суммируй одинаковые названия из разных строк лога в один элемент с большим quantity. " +
  "Суммарное quantity больше 1 указывай только если оно написано явно при одном предмете " +
  "(например, «Эссенция ярости x5» или «5 шт.»).\n" +
  'Ответь строго JSON без пояснений: {"kind": "roster", "names": ["ник1"], "items": []} ' +
  'или {"kind": "drop", "names": [], "items": [{"name": "предмет", "quantity": 1}]}. ' +
  'Если не удалось определить вид — {"kind": "unknown", "names": [], "items": []}.';

/** Классифицирует скрин и вытаскивает содержимое за один запрос к модели. */
app.post("/extract", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const body = readImageBody(req, res);
  if (!body) return;

  try {
    const parsed = await askVision(body.image, body.mediaType, PROMPT);
    const kind = parsed?.kind === "roster" || parsed?.kind === "drop" ? parsed.kind : "unknown";
    const names = Array.isArray(parsed?.names)
      ? parsed.names.filter((n) => typeof n === "string" && n.trim()).map((n) => n.trim())
      : [];
    const items = Array.isArray(parsed?.items)
      ? parsed.items
          .filter((i) => i && typeof i.name === "string" && i.name.trim())
          .map((i) => ({ name: i.name.trim(), quantity: Math.max(1, Math.round(Number(i.quantity) || 1)) }))
      : [];
    res.json({ kind, names, items });
  } catch (err) {
    console.error("Ошибка распознавания:", err);
    res.status(502).json({ error: err.message || "Ошибка запроса к Anthropic." });
  }
});

app.get("/", (_req, res) => res.send("guild-vision-proxy OK"));

app.listen(PORT, () => console.log(`vision-proxy слушает порт ${PORT}`));
