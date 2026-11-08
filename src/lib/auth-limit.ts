import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
/** Shared by workers through SQLite; does not trust a caller-supplied IP header. */
export async function consumeAuthAttempt(username: string, now = Date.now()) {
  const windowMs = 15 * 60 * 1000;
  const accountKey =
    "auth-limit:account:" +
    createHash("sha256").update(username.toLocaleLowerCase("en")).digest("hex");
  return prisma.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: "auth-limit:lock" },
      create: { key: "auth-limit:lock", value: "1" },
      update: { value: "1" },
    });
    for (const [key, maximum] of [
      ["auth-limit:global", 500],
      [accountKey, 10],
    ] as const) {
      const entry = await tx.appSetting.findUnique({ where: { key } });
      const previous = entry
        ? (JSON.parse(entry.value) as { start: number; count: number })
        : null;
      const state =
        previous && now - previous.start < windowMs
          ? previous
          : { start: now, count: 0 };
      if (state.count >= maximum)
        return Math.max(1, Math.ceil((state.start + windowMs - now) / 1000));
      state.count++;
      await tx.appSetting.upsert({
        where: { key },
        create: { key, value: JSON.stringify(state) },
        update: { value: JSON.stringify(state) },
      });
    }
    await tx.appSetting.deleteMany({
      where: {
        key: { startsWith: "auth-limit:account:" },
        updatedAt: { lt: new Date(now - 86400000) },
      },
    });
    return 0;
  });
}
