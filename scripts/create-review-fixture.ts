/** Invoked only by verify-command-center.py against its disposable SQLite database. */
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";
import { getActivePeriod } from "../src/lib/period";
const database = process.env.DATABASE_URL ?? "";
if (!database.includes("/xd-review-") || !process.env.XD_REVIEW_PASSWORD)
  throw new Error("Disposable review database required");
async function main() {
  const passwordHash = await bcrypt.hash(process.env.XD_REVIEW_PASSWORD!, 4);
  const users = [];
  for (const role of ["admin", "member", "rl", "random"])
    users.push(
      await prisma.user.create({
        data: { username: "review_" + role, passwordHash, role },
      }),
    );
  const players = [];
  for (let i = 0; i < 36; i++)
    players.push(
      await prisma.player.create({
        data: {
          name:
            i === 0
              ? "Проверка приватности"
              : i === 1
                ? "=1+1"
                : `Игрок ${String(i).padStart(2, "0")}`,
          role: ["Танк", "Хил", "Милик", "Лучник", "Маг"][i % 5],
          salaryCoefficient: i === 3 ? 0.5 : 1,
          userId: i < users.length ? users[i].id : null,
        },
      }),
    );
  const active = await getActivePeriod();
  const activities = [];
  for (let i = 0; i < 8; i++)
    activities.push(
      await prisma.activity.create({
        data: {
          name:
            i % 3 === 0 ? "АГЛ" : i % 3 === 1 ? "Разъярённый Левиафан" : "PvP",
          category: i % 3 === 0 ? "Мини-РБ" : "Прайм",
          mode: i % 3 === 2 ? "PvP" : "PvE",
          weight: i % 3 === 1 ? 1.5 : 1,
          status:
            i === 7 ? "Запланировано" : i === 6 ? "Отменено" : "К выплате",
          date: new Date(Date.now() - i * 3600000),
          periodId: active.id,
          bossKillConfirmed: false,
          participants: {
            create: players.slice(0, 12 + i).map((p) => ({
              playerId: p.id,
              pvpKills: i % 3 === 2 ? 2 : 0,
              honorPoints: i % 3 === 2 ? 150 : 0,
            })),
          },
        },
      }),
    );
  await prisma.treasuryTransaction.create({
    data: {
      description: "Доход Прайма",
      amount: 100000,
      category: "Прайм",
      periodId: active.id,
    },
  });
  await prisma.treasuryTransaction.create({
    data: {
      description: "Доход Мини-РБ",
      amount: 100000,
      category: "Мини-РБ",
      periodId: active.id,
    },
  });
  const drop = await prisma.dropItem.create({
    data: {
      item: "Тестовый меч",
      value: 1000,
      quantity: 3,
      warehouse: "ХД",
      category: "Прайм",
    },
  });
  const catalog = await prisma.dropCatalogItem.create({
    data: { name: "Реестр тестового меча", price: 1000 },
  });
  await prisma.activityScreenshot.create({
    data: {
      activityId: activities[0].id,
      kind: "roster",
      imageUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9N8AAAAASUVORK5CYII=",
    },
  });
  const archive = await prisma.archive.create({data:{label:'Архив стенда',dateFrom:new Date('2026-09-15'),dateTo:new Date('2026-10-14T23:59:59Z')}});
  const archivedActivity = await prisma.activity.create({data:{name:'Архивная активность',archiveId:archive.id,date:new Date('2026-09-20'),guests:{create:{name:'Архивный гость'}}}});
  console.log(
    JSON.stringify({
      playerId: players[0].id,
      memberPlayerId: players[1].id,
      activityId: activities[0].id,
      dropId: drop.id,
      catalogId: catalog.id,
    archivedActivityId: archivedActivity.id,
    }),
  );
}
main().finally(() => prisma.$disconnect());
