require("dotenv/config");
const { Client, GatewayIntentBits, Partials, Events } = require("discord.js");
const Anthropic = require("@anthropic-ai/sdk");

const {
  DISCORD_BOT_TOKEN,
  DISCORD_CHANNEL_ID,
  ANTHROPIC_API_KEY,
  BOT_API_SECRET,
  SITE_API_URL = "http://localhost:3000",
} = process.env;

for (const [key, value] of Object.entries({
  DISCORD_BOT_TOKEN,
  DISCORD_CHANNEL_ID,
  ANTHROPIC_API_KEY,
  BOT_API_SECRET,
})) {
  if (!value) {
    console.error(`Не задана переменная окружения ${key}. Заполните discord-bot/.env и перезапустите.`);
    process.exit(1);
  }
}

const MAX_IMAGE_BYTES = 800_000; // должно совпадать с лимитом на /api/bot/activities

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel],
});

client.once(Events.ClientReady, () => {
  console.log(`Бот запущен как ${client.user.tag}, слушаю канал ${DISCORD_CHANNEL_ID}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.channelId !== DISCORD_CHANNEL_ID) return;

  const image = message.attachments.find((a) => (a.contentType || "").startsWith("image/"));
  if (!image) return;

  const activityName = message.content.trim();
  if (!activityName) {
    await message.reply("Напишите название активности текстом вместе со скрином.");
    return;
  }

  try {
    await message.react("⏳");

    const imageRes = await fetch(image.url);
    if (!imageRes.ok) throw new Error(`Не удалось скачать скрин (${imageRes.status})`);
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
    const mediaType = image.contentType || "image/png";
    const base64 = imageBuffer.toString("base64");

    const names = await extractNicknames(base64, mediaType);

    const screenshotDataUrl =
      imageBuffer.byteLength <= MAX_IMAGE_BYTES ? `data:${mediaType};base64,${base64}` : undefined;

    const res = await fetch(`${SITE_API_URL}/api/bot/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${BOT_API_SECRET}` },
      body: JSON.stringify({ name: activityName, participants: names, screenshot: screenshotDataUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Сайт вернул ошибку (${res.status})`);

    await message.reactions.resolve("⏳")?.users.remove(client.user.id).catch(() => {});
    await message.react("✅");

    const matchedList = data.matched.map((m) => m.playerName).join(", ") || "—";
    const unmatchedList = data.unmatched.join(", ") || "—";
    await message.reply(
      `Активность «${data.activity.name}» создана.\n` +
        `Распознано ников: ${names.length}\n` +
        `Найдены в составе: ${matchedList}\n` +
        `Не найдены (добавлены как гости): ${unmatchedList}\n` +
        `Проверьте и донастройте активность на сайте.`
    );
  } catch (err) {
    console.error("Ошибка обработки сообщения:", err);
    await message.reactions.resolve("⏳")?.users.remove(client.user.id).catch(() => {});
    await message.react("❌");
    await message.reply(`Не получилось создать активность: ${err.message}`);
  }
});

async function extractNicknames(base64, mediaType) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
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
  if (!jsonMatch) return [];
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed.names) ? parsed.names.filter((n) => typeof n === "string" && n.trim()) : [];
  } catch {
    return [];
  }
}

client.login(DISCORD_BOT_TOKEN);
