import { getCurrentUser } from "@/lib/auth";
import { isFullAdminRole } from "@/lib/accountRoles";
import { getDropCatalog } from "@/lib/queries";
import { getActiveAuction } from "@/lib/auction";
import { prisma } from "@/lib/prisma";
import EmptyState from "@/components/EmptyState";
import AuctionBoard from "@/components/AuctionBoard";

/**
 * Объяснение вместо страницы торгов.
 *
 * Раньше здесь стоял redirect("/dashboard"): человек жал «Аукцион» и молча
 * оказывался на Статистике. Остальной сайт читается и без входа, поэтому
 * участники не догадывались, что просто не залогинены, — со стороны это
 * выглядело как сломанная вкладка.
 */
function Notice({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Аукцион</h1>
      <div className="rounded-lg border border-border bg-surface">
        <EmptyState title={title} hint={hint} />
      </div>
    </div>
  );
}

export default async function AuctionPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Notice
        title="Войдите, чтобы видеть торги"
        hint="Нажмите «Войти» вверху страницы. Остальные разделы сайта открыты и без входа, а торги — нет: ставка делается от вашего имени."
      />
    );
  }

  if (user.role === "random") {
    return (
      <Notice
        title="Доступ ещё не открыт"
        hint="Администратор пока не назначил вашей учётной записи роль в гильдии. Напишите ГМ — после этого торги станут доступны."
      />
    );
  }

  const isAdmin = isFullAdminRole(user.role);

  // Ставить может только тот, чья учётная запись привязана к игроку состава:
  // имя ставки берётся отсюда, а не из формы, иначе можно было бы поставить
  // за другого.
  const [auction, player, catalog] = await Promise.all([
    getActiveAuction(),
    prisma.player.findUnique({ where: { userId: user.sub }, select: { id: true, name: true } }),
    isAdmin ? getDropCatalog() : Promise.resolve([]),
  ]);

  return (
    <AuctionBoard
      initialAuction={auction}
      isAdmin={isAdmin}
      me={player}
      catalog={catalog.map((c) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl }))}
    />
  );
}
