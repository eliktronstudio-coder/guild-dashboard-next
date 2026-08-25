require("dotenv/config");
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

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
    // Discord иногда присылает contentType, не совпадающий с реальным форматом файла
    // (например помечает webp то, что по факту png) — определяем по сигнатуре байтов.
    const mediaType = sniffMediaType(imageBuffer) || image.contentType || "image/png";
    const base64 = imageBuffer.toString("base64");

    const names = await extractNicknames(base64, mediaType);
    const category = await askCategory(message);

    const screenshotDataUrl =
      imageBuffer.byteLength <= MAX_IMAGE_BYTES ? `data:${mediaType};base64,${base64}` : undefined;

    const res = await fetch(`${SITE_API_URL}/api/bot/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${BOT_API_SECRET}` },
      body: JSON.stringify({ name: activityName, category, participants: names, screenshot: screenshotDataUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Сайт вернул ошибку (${res.status})`);

    await message.reactions.resolve("⏳")?.users.remove(client.user.id).catch(() => {});
    await message.react("✅");

    const matchedList = data.matched.map((m) => m.playerName).join(", ") || "—";
    const unmatchedList = data.unmatched.join(", ") || "—";
    await message.reply(
      `Активность «${data.activity.name}» (${data.activity.category}) создана.\n` +
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

async function askCategory(message) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("category_prime").setLabel("Прайм").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("category_mini").setLabel("Мини-РБ").setStyle(ButtonStyle.Secondary)
  );
  const prompt = await message.reply({ content: "Тип активности?", components: [row] });

  try {
    const interaction = await prompt.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: 60_000,
      filter: (i) => i.user.id === message.author.id,
    });
    const category = interaction.customId === "category_prime" ? "Прайм" : "Мини-РБ";
    await interaction.update({ content: `Тип активности: ${category}`, components: [] });
    return category;
  } catch {
    await prompt.edit({ content: "Время выбора вышло, тип по умолчанию: Мини-РБ.", components: [] });
    return "Мини-РБ";
  }
}

function sniffMediaType(buffer) {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 6 && buffer.toString("ascii", 0, 3) === "GIF") {
    return "image/gif";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

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
