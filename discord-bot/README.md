# Guild Discord Bot (тестовая версия)

Слушает один Discord-канал. Если сообщение содержит картинку и текст —
текст берётся как название активности, картинка отправляется в Claude
(vision) для распознавания ников участников, затем на сайт летит
`POST /api/bot/activities`, создающий активность с найденными участниками
и гостями (для нераспознанных/несовпавших ников).

## Настройка

1. Скопировать `.env.example` в `.env` и заполнить:
   - `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID` — см. ниже.
   - `ANTHROPIC_API_KEY` — ключ Anthropic API (console.anthropic.com).
   - `BOT_API_SECRET` — любая случайная строка, та же должна быть в `.env`
     основного сайта (`BOT_API_SECRET=...`).
   - `SITE_API_URL` — обычно `http://localhost:3000` (бот и сайт на одном сервере).
2. `npm install`
3. `npm start` (или через pm2 — см. ниже).

## Создание Discord-бота (если ещё нет)

1. https://discord.com/developers/applications → New Application.
2. Слева Bot → Reset Token → скопировать в `DISCORD_BOT_TOKEN`.
3. Там же включить **Message Content Intent** (без этого бот не увидит текст
   сообщений и картинки).
4. OAuth2 → URL Generator → scope `bot`, права `Read Messages/View Channels`,
   `Send Messages`, `Read Message History`, `Add Reactions` → перейти по
   сгенерированной ссылке и добавить бота на сервер.
5. Включить режим разработчика в Discord (Настройки → Расширенные), затем
   правый клик по нужному каналу → «Копировать ID» → `DISCORD_CHANNEL_ID`.

## Запуск на сервере (pm2)

```bash
cd /var/www/guild-dashboard-next/discord-bot
npm install
pm2 start index.js --name guild-discord-bot
pm2 save
```
