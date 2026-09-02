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
  StringSelectMenuBuilder,
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
const MAX_IMAGES = 12; // по 6 на раздел, столько принимает /api/bot/activities
const MAX_NICK = 40; // должно совпадать с /api/bot/players/rename

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
  if (images.length === 0) return;

  const activityName = message.content.trim();
  if (!activityName) {
    await message.reply("Напишите название активности текстом вместе со скрином.");
    return;
  }
  if (images.length > MAX_IMAGES) {
    await message.reply(`Слишком много скринов: ${images.length}. Максимум ${MAX_IMAGES} за раз.`);
    return;
  }

  try {
    await message.react("⏳");

    // Каждый скрин классифицируется отдельно, поэтому порядок вложений не важен
    // и скринов состава/дропа может быть сколько угодно.
    const shots = [];
    for (const image of images) {
      const { buffer, mediaType } = await downloadImage(image);
      const base64 = buffer.toString("base64");
      const extracted = await extractFromImage(base64, mediaType);
      shots.push({ buffer, mediaType, base64, ...extracted });
    }

    const rosterShots = shots.filter((s) => s.kind === "roster");
    const dropShots = shots.filter((s) => s.kind === "drop");
    const unknownCount = shots.length - rosterShots.length - dropShots.length;

    const names = dedupeNames(rosterShots.flatMap((s) => s.names));
    const dropItems = mergeItems(dropShots.flatMap((s) => s.items));

    const canonicalNames = await fetchActivityNames();
    const { name, category, mode } = await askActivityOptions(message, activityName, canonicalNames);

    const screenshots = shots
      .filter((s) => s.kind !== "unknown" && s.buffer.byteLength <= MAX_IMAGE_BYTES)
      .map((s) => ({ kind: s.kind, imageUrl: `data:${s.mediaType};base64,${s.base64}` }));

    const res = await fetch(`${SITE_API_URL}/api/bot/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${BOT_API_SECRET}` },
      body: JSON.stringify({
        name,
        category,
        mode,
        participants: names,
        drops: dropItems,
        screenshots,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Сайт вернул ошибку (${res.status})`);

    await message.reactions.resolve("⏳")?.users.remove(client.user.id).catch(() => {});
    await message.react("✅");

    const matchedList = data.matched.map((m) => m.playerName).join(", ") || "—";
    const unmatchedList = data.unmatched.join(", ") || "—";
    const lines = [
      `Активность «${data.activity.name}» (${data.activity.category}, ${data.activity.mode}) создана.`,
      `Скринов: состав — ${rosterShots.length}, дроп — ${dropShots.length}` +
        (unknownCount ? `, не распознано — ${unknownCount}` : ""),
      `Распознано ников: ${names.length}`,
      `Найдены в составе: ${matchedList}`,
      `Не найдены (добавлены как гости): ${unmatchedList}`,
    ];
    if (dropShots.length > 0) {
      const dropMatchedList = data.drops.matched.map((d) => `${d.quantity}✕${d.catalogName}`).join(", ") || "—";
      const dropUnmatchedList = data.drops.unmatched.join(", ") || "—";
      lines.push(`Дроп добавлен в инвентарь: ${dropMatchedList}`);
      lines.push(`Не найдено в реестре дропа (добавьте вручную): ${dropUnmatchedList}`);
    }
    lines.push("Проверьте и донастройте активность на сайте.");
    await message.reply(lines.join("\n"));
  } catch (err) {
    console.error("Ошибка обработки сообщения:", err);
    await message.reactions.resolve("⏳")?.users.remove(client.user.id).catch(() => {});
    await message.react("❌");
    await message.reply(`Не получилось создать активность: ${err.message}`);
  }
});

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

/**
 * Один шаг подтверждения: название из фиксированного списка + тип + режим.
 * Название берётся списком, а не из текста сообщения — иначе одна и та же
 * активность заводится как «морф», «Морф» и «МОРФ».
 */
async function askActivityOptions(message, typedName, names) {
  const categoryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("category_prime").setLabel("Прайм").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("category_mini").setLabel("Мини-РБ").setStyle(ButtonStyle.Secondary)
  );
  const modeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("mode_pve").setLabel("PvE").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("mode_pvp").setLabel("PvP").setStyle(ButtonStyle.Danger)
  );

  const suggested = suggestName(typedName, names);
  let name = suggested ?? (names.length === 0 ? typedName : null);

  const buildNameRow = (selected) =>
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("activity_name")
        .setPlaceholder("Выберите активность")
        .addOptions(
          names.slice(0, 25).map((n) => ({ label: n.slice(0, 100), value: n.slice(0, 100), default: n === selected }))
        )
    );

  const rows = names.length > 0 ? [buildNameRow(name), categoryRow, modeRow] : [categoryRow, modeRow];
  const summary = () =>
    `Активность: ${name ?? "не выбрана"} · тип: ${category ?? "не выбран"} · режим: ${mode ?? "не выбран"}`;

  let category = null;
  let mode = null;

  const prompt = await message.reply({ content: summary(), components: rows });

  return new Promise((resolve) => {
    const collector = prompt.createMessageComponentCollector({
      time: 120_000,
      filter: (i) => i.user.id === message.author.id,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.isStringSelectMenu()) {
        name = interaction.values[0];
      } else if (interaction.customId.startsWith("category_")) {
        category = interaction.customId === "category_prime" ? "Прайм" : "Мини-РБ";
      } else {
        mode = interaction.customId === "mode_pvp" ? "PvP" : "PvE";
      }

      const done = name && category && mode;
      await interaction.update({
        content: done ? `${summary()} ✅` : summary(),
        components: done ? [] : names.length > 0 ? [buildNameRow(name), categoryRow, modeRow] : [categoryRow, modeRow],
      });
      if (done) collector.stop("done");
    });

    collector.on("end", (_collected, reason) => {
      if (reason !== "done") {
        prompt.edit({ content: `Время выбора вышло. ${summary()}`, components: [] }).catch(() => {});
      }
      resolve({
        name: name ?? typedName,
        category: category ?? "Мини-РБ",
        mode: mode ?? "PvE",
      });
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

/** Канонический список названий активностей; пустой список = откат на текст сообщения. */
async function fetchActivityNames() {
  try {
    const res = await fetch(`${SITE_API_URL}/api/bot/activity-names`, {
      headers: { Authorization: `Bearer ${BOT_API_SECRET}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.names) ? data.names : [];
  } catch (err) {
    console.error("Не удалось получить список активностей:", err);
    return [];
  }
}

/** Подсказывает вариант из списка по тому, что человек написал в сообщении. */
function suggestName(typed, names) {
  const norm = (v) => v.trim().toLowerCase();
  const t = norm(typed);
  if (!t) return null;
  return (
    names.find((n) => norm(n) === t) ??
    names.find((n) => t.startsWith(norm(n)) || norm(n).startsWith(t)) ??
    null
  );
}

// Anthropic блокирует запросы с IP этого VPS, поэтому распознавание идёт через
// отдельный прокси на Render (US), а не напрямую. Прокси заодно определяет,
// что на скрине — состав или дроп.
async function extractFromImage(base64, mediaType) {
  const res = await fetch(`${VISION_PROXY_URL}/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${VISION_PROXY_SECRET}` },
    body: JSON.stringify({ image: base64, mediaType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Прокси вернул ошибку (${res.status})`);
  return {
    kind: data.kind === "roster" || data.kind === "drop" ? data.kind : "unknown",
    names: Array.isArray(data.names) ? data.names : [],
    items: Array.isArray(data.items) ? data.items : [],
  };
}

/** Один и тот же игрок может попасть на два скрина состава. */
function dedupeNames(names) {
  const seen = new Set();
  const out = [];
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name.trim());
  }
  return out;
}

/** Скрины дропа обычно продолжают друг друга, поэтому количества складываются. */
function mergeItems(items) {
  const byName = new Map();
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key);
    if (existing) existing.quantity += item.quantity;
    else byName.set(key, { name: item.name.trim(), quantity: item.quantity });
  }
  return [...byName.values()];
}

client.login(DISCORD_BOT_TOKEN);
