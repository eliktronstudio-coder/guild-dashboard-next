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

app.post("/extract-names", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${VISION_PROXY_SECRET}`) {
    return res.status(403).json({ error: "Нет доступа." });
  }

  const { image, mediaType } = req.body || {};
  if (typeof image !== "string" || !image || typeof mediaType !== "string" || !mediaType.startsWith("image/")) {
    return res.status(400).json({ error: "Нужны image (base64) и mediaType." });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            {
              type: "text",
              text:
                "На скрине список участников игровой активности (MMO-гильдия). " +
                "Выпиши все игровые ники участников, которые видишь на скрине. " +
                "Игнорируй элементы интерфейса, заголовки, кнопки, названия активности/локации — только ники игроков. " +
                'Ответь строго JSON без пояснений в формате {"names": ["ник1", "ник2"]}. Если ников нет — {"names": []}.',
            },
          ],
        },
      ],
    });

    const text = response.content.find((c) => c.type === "text")?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const names = jsonMatch ? JSON.parse(jsonMatch[0]).names : [];
    res.json({ names: Array.isArray(names) ? names.filter((n) => typeof n === "string" && n.trim()) : [] });
  } catch (err) {
    console.error("Ошибка распознавания:", err);
    res.status(502).json({ error: err.message || "Ошибка запроса к Anthropic." });
  }
});

app.get("/", (_req, res) => res.send("guild-vision-proxy OK"));

app.listen(PORT, () => console.log(`vision-proxy слушает порт ${PORT}`));
