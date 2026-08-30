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
  DISCORD_RENAME_CHANNEL_ID,
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
  if (!DISCORD_RENAME_CHANNEL_ID) {
    console.log("DISCORD_RENAME_CHANNEL_ID не задан — переименования отключены.");
    return;
  }
  const renameChannel = client.channels.cache.get(DISCORD_RENAME_CHANNEL_ID);
  if (!renameChannel) {
    console.error(`Канал ренеймов ${DISCORD_RENAME_CHANNEL_ID} не найден у бота.`);
    return;
  }
  // Каналы, которые боту не видны, всё равно попадают в кэш — само наличие
  // канала ничего не доказывает, нужны конкретные права.
  const perms = renameChannel.permissionsFor(client.user);
  const missing = ["ViewChannel", "ReadMessageHistory", "SendMessages", "AddReactions"].filter((x) => !perms?.has(x));
  if (missing.length > 0) {
    console.error(
      `Каналу ренеймов «${renameChannel.name}» не хватает прав: ${missing.join(", ")}. ` +
        "Переименования работать не будут."
    );
  } else {
    console.log(`Слушаю канал ренеймов «${renameChannel.name}» (${DISCORD_RENAME_CHANNEL_ID})`);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (DISCORD_RENAME_CHANNEL_ID && message.channelId === DISCORD_RENAME_CHANNEL_ID) {
    await handleRename(message);
    return;
  }
  if (message.channelId !== DISCORD_CHANNEL_ID) return;

  const images = [...message.attachments.values()].filter((a) => (a.contentType || "").startsWith("image/"));
  const rosterImage = images[0];
  const dropImage = images[1]; // второй скрин в том же сообщении = дроп
  if (!rosterImage) return;

  const activityName = message.content.trim();
  if (!activityName) {
    await message.reply("Напишите название активности текстом вместе со скрином.");
    return;
  }

  try {
    await message.react("⏳");

    const { buffer: rosterBuffer, mediaType: rosterMediaType } = await downloadImage(rosterImage);
    const names = await extractNicknames(rosterBuffer.toString("base64"), rosterMediaType);

    let dropItems = [];
    let dropBuffer, dropMediaType;
    if (dropImage) {
      ({ buffer: dropBuffer, mediaType: dropMediaType } = await downloadImage(dropImage));
      dropItems = await extractDrops(dropBuffer.toString("base64"), dropMediaType);
    }

    const { category, mode } = await askActivityOptions(message);

    const screenshotDataUrl =
      rosterBuffer.byteLength <= MAX_IMAGE_BYTES ? `data:${rosterMediaType};base64,${rosterBuffer.toString("base64")}` : undefined;
    const dropScreenshotDataUrl =
      dropBuffer && dropBuffer.byteLength <= MAX_IMAGE_BYTES ? `data:${dropMediaType};base64,${dropBuffer.toString("base64")}` : undefined;

    const res = await fetch(`${SITE_API_URL}/api/bot/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${BOT_API_SECRET}` },
      body: JSON.stringify({
        name: activityName,
        category,
        mode,
        participants: names,
        drops: dropItems,
        screenshot: screenshotDataUrl,
        dropScreenshot: dropScreenshotDataUrl,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Сайт вернул ошибку (${res.status})`);

    await message.reactions.resolve("⏳")?.users.remove(client.user.id).catch(() => {});
    await message.react("✅");

    const matchedList = data.matched.map((m) => m.playerName).join(", ") || "—";
    const unmatchedList = data.unmatched.join(", ") || "—";
    let reply =
      `Активность «${data.activity.name}» (${data.activity.category}, ${data.activity.mode}) создана.\n` +
      `Распознано ников: ${names.length}\n` +
      `Найдены в составе: ${matchedList}\n` +
      `Не найдены (добавлены как гости): ${unmatchedList}\n`;
    if (dropImage) {
      const dropMatchedList = data.drops.matched.map((d) => `${d.quantity}✕${d.catalogName}`).join(", ") || "—";
      const dropUnmatchedList = data.drops.unmatched.join(", ") || "—";
      reply +=
        `Дроп добавлен в инвентарь: ${dropMatchedList}\n` +
        `Не найдено в реестре дропа (добавьте вручную): ${dropUnmatchedList}\n`;
    }
    reply += "Проверьте и донастройте активность на сайте.";
    await message.reply(reply);
  } catch (err) {
    console.error("Ошибка обработки сообщения:", err);
    await message.reactions.resolve("⏳")?.users.remove(client.user.id).catch(() => {});
    await message.react("❌");
    await message.reply(`Не получилось создать активность: ${err.message}`);
  }
});

const MAX_NICK = 40; // должно совпадать с /api/bot/players/rename
const ARROW_RE = /^(.+?)\s*(?:->|=>|→|–|—)\s*(.+)$/;
const HYPHEN_RE = /^(\S+)\s*-\s*(\S+)$/;

/**
 * Разбирает «СтарыйНик - НовыйНик». Стрелку можно окружать чем угодно, а
 * простой дефис считается разделителем только когда с обеих сторон одно слово —
 * иначе обычная фраза вроде «кто-нибудь тут?» была бы принята за переименование.
 */
function parseRename(content) {
  const text = content.trim();
  const match = text.match(ARROW_RE) || text.match(HYPHEN_RE);
  if (!match) return null;
  const from = match[1].trim();
  const to = match[2].trim();
  if (!from || !to || from.length > MAX_NICK || to.length > MAX_NICK) return null;
  return { from, to };
}

/** Одно сообщение может содержать несколько переименований — по одному на строку. */
function parseRenames(content) {
  return content
    .split("\n")
    .map((line) => parseRename(line))
    .filter(Boolean);
}

/**
 * «СтарыйНик - НовыйНик» в канале ренеймов переименовывает игрока на сайте.
 */
async function handleRename(message) {
  const pairs = parseRenames(message.content);
  if (pairs.length === 0) return;

  const results = [];
  for (const { from, to } of pairs) {
    try {
      const res = await fetch(`${SITE_API_URL}/api/bot/players/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${BOT_API_SECRET}` },
        body: JSON.stringify({ from, to }),
      });
      const data = await res.json();
      if (!res.ok) {
        results.push({ ok: false, text: `«${from}» → «${to}»: ${data?.error || `ошибка ${res.status}`}` });
        continue;
      }
      const extra = data.renamedGuestEntries ? ` (+${data.renamedGuestEntries} в активностях)` : "";
      results.push({ ok: true, text: `«${data.player.from}» → «${data.player.to}»${extra}` });
    } catch (err) {
      console.error("Ошибка переименования:", err);
      results.push({ ok: false, text: `«${from}» → «${to}»: ${err.message}` });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  await message.react(okCount === results.length ? "✅" : okCount === 0 ? "❌" : "⚠️");
  await message.reply(results.map((r) => `${r.ok ? "✅" : "❌"} ${r.text}`).join("\n"));
}

async function askActivityOptions(message) {
  const categoryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("category_prime").setLabel("Прайм").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("category_mini").setLabel("Мини-РБ").setStyle(ButtonStyle.Secondary)
  );
  const modeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("mode_pve").setLabel("PvE").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("mode_pvp").setLabel("PvP").setStyle(ButtonStyle.Danger)
  );
  const prompt = await message.reply({ content: "Тип активности и режим?", components: [categoryRow, modeRow] });

  return new Promise((resolve) => {
    let category = null;
    let mode = null;
    const collector = prompt.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
      filter: (i) => i.user.id === message.author.id,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId.startsWith("category_")) {
        category = interaction.customId === "category_prime" ? "Прайм" : "Мини-РБ";
      } else {
        mode = interaction.customId === "mode_pvp" ? "PvP" : "PvE";
      }
      if (category && mode) {
        await interaction.update({ content: `Тип: ${category}, режим: ${mode} ✅`, components: [] });
        collector.stop("done");
      } else {
        await interaction.update({
          content: `Тип: ${category ?? "не выбран"}, режим: ${mode ?? "не выбран"}`,
          components: [categoryRow, modeRow],
        });
      }
    });

    collector.on("end", (_collected, reason) => {
      if (reason !== "done") {
        prompt
          .edit({ content: `Время выбора вышло. Тип: ${category ?? "Мини-РБ"}, режим: ${mode ?? "PvE"}.`, components: [] })
          .catch(() => {});
      }
      resolve({ category: category ?? "Мини-РБ", mode: mode ?? "PvE" });
    });
  });
}

async function downloadImage(attachment) {
  const res = await fetch(attachment.url);
  if (!res.ok) throw new Error(`Не удалось скачать скрин (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  // Discord иногда присылает contentType, не совпадающий с реальным форматом файла
  // (например помечает webp то, что по факту png) — определяем по сигнатуре байтов.
  const mediaType = sniffMediaType(buffer) || attachment.contentType || "image/png";
  return { buffer, mediaType };
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

async function extractDrops(base64, mediaType) {
  const res = await fetch(`${VISION_PROXY_URL}/extract-drops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${VISION_PROXY_SECRET}` },
    body: JSON.stringify({ image: base64, mediaType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Прокси вернул ошибку (${res.status})`);
  return Array.isArray(data.items) ? data.items : [];
}

client.login(DISCORD_BOT_TOKEN);
