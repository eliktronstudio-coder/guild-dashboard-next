require("dotenv/config");
const { Client, GatewayIntentBits, Partials, Events } = require("discord.js");

const {
  DISCORD_BOT_TOKEN,
  DISCORD_CHANNEL_ID,
  BOT_API_SECRET,
  SITE_API_URL = "http://localhost:3000",
  VISION_PROXY_URL,
  VISION_PROXY_SECRET,
} = process.env;

for (const [key, value] of Object.entries({
  DISCORD_BOT_TOKEN,
  DISCORD_CHANNEL_ID,
  BOT_API_SECRET,
  VISION_PROXY_URL,
  VISION_PROXY_SECRET,
})) {
  if (!value) {
    console.error(`Не задана переменная окружения ${key}. Заполните discord-bot/.env и перезапустите.`);
    process.exit(1);
  }
}

const MAX_IMAGE_BYTES = 800_000; // должно совпадать с лимитом на /api/bot/activities

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

// Anthropic блокирует запросы с IP этого VPS, поэтому распознавание ников
// идёт через отдельный прокси на Render (US), а не напрямую.
async function extractNicknames(base64, mediaType) {
  const res = await fetch(`${VISION_PROXY_URL}/extract-names`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${VISION_PROXY_SECRET}` },
    body: JSON.stringify({ image: base64, mediaType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Прокси вернул ошибку (${res.status})`);
  return Array.isArray(data.names) ? data.names : [];
}

client.login(DISCORD_BOT_TOKEN);
