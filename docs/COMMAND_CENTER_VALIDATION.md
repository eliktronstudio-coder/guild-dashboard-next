# Проверка реконструкции XD

Дата: 9 ноября 2026 (Екатеринбург). Проверена локальная рабочая версия ветки `codex/xd-command-center`. Исходный commit: `e2a6a99`.

## Результаты

| Проверка | Результат и практическая граница |
| --- | --- |
| `npm run typecheck` | Пройдено: Next route typegen и TypeScript |
| `npm test` | **244 / 244**, без пропусков и ошибок. Все базы временные SQLite |
| `npm run build` | Пройдено: production webpack build, существующие и новые маршруты |
| `npm run check` | Пройдено: объединённые typecheck → test → build |
| ESLint изменённых application-модулей | Пройдено, правила не отключались |
| Полный ESLint | **Не пройден**: 27 исходных ошибок в шести старых модулях. Сравнение с исходными версиями тех же файлов дало те же 27 ошибок |
| `git diff --check` | Пройдено |
| HTTP на production-сборке | Пройдено на отдельной временной базе; настоящие route handlers и Prisma, без подмены БД ответами |
| Chromium | 6 разделов × 6 ширин × 2 темы; без горизонтального переполнения страницы, pageerror и обнаруженных hydration-ошибок |
| Реальный VPS / рабочая база / production TLS | Не проверены; миграции и деплой на сервере не выполнялись |

## Обязательные расчёты

Существующие и новые тесты проверяют:

- Прайм 70/30, Мини-РБ 100%, отсутствие двойного учёта смешанной продажи.
- Общую и взвешенную посещаемость, полную таблицу коэффициентов, отсутствие двойного участия, исключение отменённых, будущих и запланированных событий.
- Порог зарплаты 20%, индивидуальные коэффициенты, метод наибольшего остатка, отсутствие искусственного распределения при нулевом числе подходящих получателей.
- Стабильность чужой доли при выплате одному игроку; повтор выплаты и отмены не создаёт повторного денежного эффекта.
- Прежние архивные сценарии, снимок имени/процентов/зарплаты после изменения профиля, отделение живой и архивной казны.
- Продажу с реальным конкурентным обращением к SQLite, возврат складского остатка и сохранение исходной денежной записи при отмене.
- Общую функцию категорий для графика и казны: смешанная продажа 100 отражается как 25 + 75, а не 100 + 100.
- Безопасные CSV, даты, пагинацию, скрытие панелей, persistent-ограничение входа.

Исходные тесты падали на подготовке несуществующего SQLite-файла; теперь тестовый helper создаёт пустой файл до `prisma migrate deploy`. Чистая функция границ периода отделена от импорта Prisma, чтобы тесты могли задать временный URL до подключения. Старые проверки не отключены. Два ожидания тестов аукциона обновлены под явно требуемое сохранение исходной операции и её компенсации вместо удаления денежной истории.

## HTTP/браузерная приёмка

`python3 scripts/verify-command-center.py` самостоятельно создаёт временную БД, применяет миграции, добавляет вымышленные записи и запускает production Next на случайном loopback-порту. Проверены:

1. Гость и random: закрытые страницы, HTML/RSC и API не отдают данные гильдии; статистический и финансовый CSV запрещены.
2. Вход выставляет HttpOnly / SameSite=Lax / Secure cookie.
3. РЛ не может продавать или создавать финансовый дроп через активность; участник не может проводить выплату.
4. Продажа через HTTP с повторным Idempotency-Key списывает остаток один раз.
5. Выплата через HTTP не повторяется и не меняет рассчитанную долю другого игрока; отмена работает.
6. Убийство босса не подтверждается автоматически; повторяющийся участник не создаёт две строки состава.
7. Активность/игрок с историей не удаляются; главный PATCH и дочерний guest endpoint архивной активности запрещены.
8. Отмена продажи сохраняет исходную операцию и создаёт одну обратную запись, включая повтор запроса.
9. CSV защищает формулы и не содержит паролей; некорректные даты отклоняются. Персональные выплаты не попадают в журнал/экспорт обычного участника.
10. `/dashboard`, `/statistics`, `/activities`, `/players`, `/treasury`, `/payments` на 360/390/768/1024/1440/1920 px в тёмной и светлой теме.
11. Поиск в аналитике и составе меняет фактические строки; скрытие панели сохраняется после reload; сброс возвращает панель; переключатель темы работает.

Локальные скриншоты: `/workspace/xd-review-artifacts/dashboard-1440.png`, `statistics-1440.png`, `players-360.png`, `dashboard-light.png`. Эти изображения содержат исключительно вымышленные данные стенда. Проверка не означает приёмку каждой кнопки старого редактора, сторонних калькуляторов и бота.

## Оставшийся исходный lint

- `AuctionBoard.tsx`: 2 ошибки React hooks.
- `GearRankCalculator.tsx`: 1 ошибка React hooks.
- `design/CropDialog.tsx`: 15 ошибок использования refs при render.
- `design/DesignEditor.tsx`: 5 ошибок hooks/refs/useMemo.
- `design/MediaLibrary.tsx`: 1 ошибка hooks.
- `design/PreviewFrame.tsx`: 3 ошибки refs.

Эти компоненты не переписаны в рамках реконструкции пяти разделов. Полную готовность к эксплуатации не следует выводить из успешной сборки.

## Миграции и публикация

Добавлена одна миграция `20261109000100_treasury_reversals`: nullable `reversalOfId` + уникальный индекс. Все прежние миграции сохранены; на тестовых базах применяется полный набор. На рабочем сервере сначала нужна проверенная копия SQLite, затем штатная добавочная миграция — без reset/seed и без замены БД. HTTPS обязателен для production Secure cookies.

Перед публикацией остаются установление фактической версии VPS, восстановление рабочей копии в изоляции и живая ролевая приёмка. Новая CI-конфигурация выполняет проверки PR; деплой в неё не включён согласно последнему ТЗ.

## Изменённые файлы

- `.github/workflows/check.yml`
- `.gitignore`
- `README.md`
- `docs/COMMAND_CENTER_AUDIT.md`
- `docs/COMMAND_CENTER_REQUIREMENTS.md`
- `docs/COMMAND_CENTER_VALIDATION.md`
- `package.json`
- `prisma/migrations/20261109000100_treasury_reversals/migration.sql`
- `prisma/schema.prisma`
- `scripts/create-review-fixture.ts`
- `scripts/verify-command-center.py`
- `src/app/access/page.tsx`
- `src/app/achievements/page.tsx`
- `src/app/activities/[id]/page.tsx`
- `src/app/activities/page.tsx`
- `src/app/activity-banners/page.tsx`
- `src/app/api/activities/[id]/guests/[guestId]/route.ts`
- `src/app/api/activities/[id]/guests/route.ts`
- `src/app/api/activities/[id]/route.ts`
- `src/app/api/activities/[id]/screenshots/[screenshotId]/route.ts`
- `src/app/api/activities/[id]/screenshots/route.ts`
- `src/app/api/activities/route.ts`
- `src/app/api/activity-banners/[id]/media/route.ts`
- `src/app/api/auction/[id]/route.ts`
- `src/app/api/auction/bid/route.ts`
- `src/app/api/auction/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/drops/[id]/route.ts`
- `src/app/api/drops/sell/route.ts`
- `src/app/api/payments/[id]/route.ts`
- `src/app/api/players/[id]/builds/[buildId]/route.ts`
- `src/app/api/players/[id]/builds/route.ts`
- `src/app/api/players/[id]/pinned-achievements/route.ts`
- `src/app/api/players/[id]/route.ts`
- `src/app/api/players/route.ts`
- `src/app/api/statistics/export/route.ts`
- `src/app/api/treasury/export/route.ts`
- `src/app/api/treasury/transactions/[id]/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/app/archeage/page.tsx`
- `src/app/archive/[id]/page.tsx`
- `src/app/archive/page.tsx`
- `src/app/auction/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/design/page.tsx`
- `src/app/doll-calculator/page.tsx`
- `src/app/drop-catalog/page.tsx`
- `src/app/error.tsx`
- `src/app/globals.css`
- `src/app/loading.tsx`
- `src/app/page.tsx`
- `src/app/payments/page.tsx`
- `src/app/players/[id]/page.tsx`
- `src/app/players/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/rb-purchase/page.tsx`
- `src/app/statistics/page.tsx`
- `src/app/treasury/page.tsx`
- `src/app/users/page.tsx`
- `src/components/BottomNav.tsx`
- `src/components/Header.tsx`
- `src/components/Sidebar.tsx`
- `src/components/admin/ActivitiesList.tsx`
- `src/components/admin/PlayersTable.tsx`
- `src/components/admin/SellDropForm.tsx`
- `src/components/admin/TreasuryPanel.tsx`
- `src/components/dashboard/ActivityRow.tsx`
- `src/components/dashboard/CustomizableGrid.tsx`
- `src/components/players/PlayerProfileView.tsx`
- `src/components/reports/AnalyticsChart.tsx`
- `src/components/reports/Pagination.tsx`
- `src/components/reports/ReportFilters.tsx`
- `src/lib/access.ts`
- `src/lib/activity-mutation.ts`
- `src/lib/activityOptions.ts`
- `src/lib/archive.ts`
- `src/lib/attendance.ts`
- `src/lib/auction.ts`
- `src/lib/auth-limit.ts`
- `src/lib/auth.ts`
- `src/lib/dashboardLayout.ts`
- `src/lib/guests.ts`
- `src/lib/ledger-filters.ts`
- `src/lib/nav.ts`
- `src/lib/payoutLedger.ts`
- `src/lib/period-bounds.ts`
- `src/lib/period.ts`
- `src/lib/queries.ts`
- `src/lib/report-filters.ts`
- `src/lib/sales.ts`
- `src/lib/statistics.ts`
- `src/lib/treasury-reversal.ts`
- `src/lib/treasury-split.ts`
- `tests/achievements-progress.test.ts`
- `tests/activity-roster.test.ts`
- `tests/archive-payout.test.ts`
- `tests/archive-roster.test.ts`
- `tests/archive-treasury.test.ts`
- `tests/auction.test.ts`
- `tests/command-center.test.ts`
- `tests/design-store.test.ts`
- `tests/payout-stability.test.ts`
- `tests/payout.test.ts`
- `tests/period-archive.test.ts`
- `tests/period.test.ts`
- `tests/prepare-database.ts`
- `tests/treasury-split.test.ts`

## Подготовка публикации по запросу пользователя

Добавлен `scripts/deployment_backup.py`: согласованная SQLite backup API копия с WAL, проверка целостности, восстановление в отдельный временный файл и сверка схемы/числа строк. Копия и манифест создаются с правами 600; существующий файл никогда не перезаписывается. Четыре отдельные Python-проверки прошли: WAL, отказ перезаписи, отказ для чужой схемы, запрет копии поверх источника. Они добавлены в CI.

Деплой пока не выполнен: в GitHub Actions доступен TIMEWEB_SSH_PRIVATE_KEY, но отсутствует TIMEWEB_SSH_KNOWN_HOSTS. Диагностический workflow в служебной ветке дополнительного репозитория остановился до входа на VPS. Запрошена публичная запись сервера из уже проверенного known_hosts пользователя. Приватный ключ не запрашивался и не извлекался из GitHub.
