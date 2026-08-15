import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";

const seedPlayers = [
  { name: "Amagami", role: "Милик", level: 9, xp: 4975 },
  { name: "Boop", role: "Хил", level: 8, xp: 4210 },
  { name: "Estq", role: "Милик", level: 10, xp: 5460 },
  { name: "Harwester", role: "Лучник", level: 7, xp: 3680 },
  { name: "Khinaar", role: "Хил", level: 12, xp: 7375 },
  { name: "Neverq", role: "Танк", level: 11, xp: 6860 },
  { name: "Neneverq", role: "Хил", level: 11, xp: 6375 },
  { name: "Yupi", role: "Танк", level: 10, xp: 5460 },
  { name: "Sorvin", role: "Маг", level: 6, xp: 2980 },
  { name: "Latrys", role: "Лучник", level: 9, xp: 4720 },
];

const seedActivities = [
  { name: "АГЛ", participants: 13 },
  { name: "Разъяренный Морфеос", participants: 11 },
  { name: "Логово Вирма", participants: 15 },
  { name: "Страж Бездны", participants: 9 },
  { name: "АГЛ", participants: 14 },
];

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.log("ADMIN_USERNAME / ADMIN_PASSWORD не заданы — пропускаю создание админа.");
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash, role: "admin" },
    create: { username, passwordHash, role: "admin" },
  });

  console.log(`Админ готов: ${user.username}`);
}

async function seedGuildData() {
  const existingPlayers = await prisma.player.count();
  if (existingPlayers > 0) {
    console.log("Игроки уже есть в базе — пропускаю сид состава/активностей.");
    return;
  }

  const createdPlayers = await Promise.all(
    seedPlayers.map((p) =>
      prisma.player.create({
        data: { name: p.name, role: p.role, level: p.level, xp: p.xp },
      })
    )
  );

  for (const a of seedActivities) {
    const roster = createdPlayers.slice(0, a.participants % createdPlayers.length || createdPlayers.length);
    await prisma.activity.create({
      data: {
        name: a.name,
        participants: { create: roster.map((p) => ({ playerId: p.id })) },
      },
    });
  }

  console.log(`Засеяно ${createdPlayers.length} игроков и ${seedActivities.length} активностей.`);
}

async function main() {
  await seedAdmin();
  await seedGuildData();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
