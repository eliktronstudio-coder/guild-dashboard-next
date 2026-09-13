/**
 * Напоминания об активностях в Discord.
 *
 * Расписание берётся с сайта (/api/bot/schedule), а не дублируется здесь:
 * правка времён в src/lib/schedule.ts сразу отражается на уведомлениях.
 *
 * Время в расписании — по МСК. Считаем его из UTC, поэтому часовой пояс
 * сервера ни на что не влияет.
 */

/** Канал, куда идут напоминания. Переопределяется переменной окружения. */
const NOTIFY_CHANNEL_ID = process.env.DISCORD_NOTIFY_CHANNEL_ID || "1168236622882557992";

/** За сколько минут до начала предупреждать. */
const LEAD_MINUTES = Number(process.env.NOTIFY_LEAD_MINUTES || 15);

/** Какие активности анонсировать; остальные пропускаем. */
const WATCHED = (process.env.NOTIFY_ACTIVITIES || "Алтарь")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const CHECK_INTERVAL_MS = 30_000;
const SCHEDULE_REFRESH_MS = 60 * 60 * 1000;

const DAY_NAMES = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

/** Текущее время по МСК, выведенное из UTC. */
function mskNow(now = new Date()) {
  const msk = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return {
    day: msk.getUTCDay(),
    minutes: msk.getUTCHours() * 60 + msk.getUTCMinutes(),
    dateKey: msk.toISOString().slice(0, 10),
  };
}

function formatTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Сколько минут от «сейчас» до слота, с учётом перехода через неделю.
 * Возвращает 0…10079.
 */
function minutesUntil(slot, now) {
  const WEEK = 7 * 24 * 60;
  const nowAbs = now.day * 24 * 60 + now.minutes;
  const slotAbs = slot.day * 24 * 60 + slot.minutes;
  return (slotAbs - nowAbs + WEEK) % WEEK;
}

function buildMessage(slot) {
  return [
    `@everyone **${slot.name}** через ${LEAD_MINUTES} минут — в ${formatTime(slot.minutes)} по МСК.`,
    `Собираемся заранее, ${DAY_NAMES[slot.day]}.`,
  ].join("\n");
}

/**
 * Запускает фоновые напоминания.
 *
 * Дубли исключены отметкой «дата + слот»: даже если проверка попадёт в окно
 * дважды, второе срабатывание отсеется. Отметки старше суток выбрасываем,
 * чтобы множество не росло бесконечно.
 */
function startNotifier(client, { siteApiUrl, botSecret, log = console }) {
  let slots = [];
  const sent = new Map(); // ключ -> отметка времени

  async function refreshSchedule() {
    try {
      const res = await fetch(`${siteApiUrl}/api/bot/schedule`, {
        headers: { Authorization: `Bearer ${botSecret}` },
      });
      if (!res.ok) throw new Error(`сайт ответил ${res.status}`);
      const data = await res.json();
      const all = Array.isArray(data.slots) ? data.slots : [];
      slots = all.filter((s) => WATCHED.includes(s.name));
      log.log(
        `Напоминания: расписание обновлено, отслеживаем ${slots.length} слотов (${WATCHED.join(", ")}).`
      );
    } catch (e) {
      log.error("Напоминания: не удалось получить расписание —", e.message);
    }
  }

  async function resolveChannel() {
    try {
      return await client.channels.fetch(NOTIFY_CHANNEL_ID);
    } catch (e) {
      log.error(`Напоминания: канал ${NOTIFY_CHANNEL_ID} недоступен —`, e.message);
      return null;
    }
  }

  async function tick() {
    if (slots.length === 0) return;
    const now = mskNow();

    for (const slot of slots) {
      const left = minutesUntil(slot, now);
      // Окно чуть шире шага проверки, иначе слот можно перескочить.
      if (left > LEAD_MINUTES || left < LEAD_MINUTES - 1) continue;

      const key = `${now.dateKey}:${slot.day}:${slot.minutes}:${slot.name}`;
      if (sent.has(key)) continue;
      sent.set(key, Date.now());

      const channel = await resolveChannel();
      if (!channel || typeof channel.send !== "function") continue;

      try {
        await channel.send({
          content: buildMessage(slot),
          allowedMentions: { parse: ["everyone"] },
        });
        log.log(`Напоминания: отправлено про «${slot.name}» в ${formatTime(slot.minutes)} МСК.`);
      } catch (e) {
        log.error("Напоминания: не удалось отправить —", e.message);
        // Снимаем отметку: следующая проверка попробует ещё раз, пока окно не ушло.
        sent.delete(key);
      }
    }

    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const [key, at] of sent) if (at < dayAgo) sent.delete(key);
  }

  void refreshSchedule();
  setInterval(() => void refreshSchedule(), SCHEDULE_REFRESH_MS);
  setInterval(() => void tick(), CHECK_INTERVAL_MS);

  return {
    /** Ручная проверка: показывает ближайший слот и шлёт пробное сообщение. */
    async test({ ping = false } = {}) {
      if (slots.length === 0) await refreshSchedule();
      const now = mskNow();
      const upcoming = slots
        .map((s) => ({ ...s, left: minutesUntil(s, now) }))
        .sort((a, b) => a.left - b.left)[0];

      const channel = await resolveChannel();
      if (!channel || typeof channel.send !== "function") {
        return { ok: false, error: `канал ${NOTIFY_CHANNEL_ID} недоступен боту` };
      }

      const perms = channel.permissionsFor(client.user);
      const canSend = perms?.has("SendMessages") ?? false;
      const canPingEveryone = perms?.has("MentionEveryone") ?? false;

      const lines = [
        "**Проверка напоминаний**",
        upcoming
          ? `Ближайшее: **${upcoming.name}**, ${DAY_NAMES[upcoming.day]} в ${formatTime(upcoming.minutes)} МСК — через ${upcoming.left} мин.`
          : "Отслеживаемых активностей в расписании нет.",
        `Предупреждаю за ${LEAD_MINUTES} мин. Отслеживаю: ${WATCHED.join(", ")}.`,
        canPingEveryone
          ? "Право упоминать @everyone есть — в бою пинг сработает."
          : "⚠️ Нет права «Упоминать @everyone» в этом канале — пинг не сработает, выдайте его боту.",
      ];

      await channel.send({
        content: lines.join("\n"),
        // По умолчанию пинг подавляем: проверка не должна дёргать весь сервер.
        allowedMentions: ping ? { parse: ["everyone"] } : { parse: [] },
      });

      return { ok: true, canSend, canPingEveryone, upcoming: upcoming ?? null };
    },
  };
}

module.exports = { startNotifier, mskNow, minutesUntil, formatTime, NOTIFY_CHANNEL_ID, LEAD_MINUTES, WATCHED };
