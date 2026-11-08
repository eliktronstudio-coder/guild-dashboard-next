import Link from "next/link";
import { requireGuildMember } from "@/lib/access";
import { getAllPlayers, getPlayerPeriodPaidMap } from "@/lib/queries";
import { isFullAdminRole } from "@/lib/accountRoles";
import { getActivePeriodId } from "@/lib/period";
import { value, positivePage, type ReportParams } from "@/lib/report-filters";
import { ROLES } from "@/lib/roles";
import PlayersTable from "@/components/admin/PlayersTable";
import Pagination from "@/components/reports/Pagination";
export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<ReportParams>;
}) {
  const user = await requireGuildMember();
  const params = await searchParams;
  const periodId = await getActivePeriodId();
  const [players, paid] = await Promise.all([
    getAllPlayers(),
    getPlayerPeriodPaidMap(periodId),
  ]);
  const search = value(params.q).slice(0, 80).toLocaleLowerCase("ru");
  const sort = value(params.sort);
  const selected = players
    .filter(
      (p) =>
        isFullAdminRole(user.role) ||
        (sort !== "salary" && value(params.debt) !== "yes") ||
        p.userId === user.sub,
    )
    .filter(
      (p) =>
        (!search || p.name.toLocaleLowerCase("ru").includes(search)) &&
        (!value(params.role) || p.role === value(params.role)) &&
        (value(params.debt) !== "yes" || p.salary > (paid.get(p.id) ?? 0)) &&
        (value(params.min) !== "20" || p.attendancePct >= 20) &&
        (value(params.pvp) !== "yes" || p.pvpCount > 0),
    )
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "ru");
      const field =
        (
          {
            prime: "attendancePctPrime",
            miniRb: "attendancePctMiniRb",
            pvp: "pvpCount",
            salary: "salary",
          } as const
        )[sort as "prime" | "miniRb" | "pvp" | "salary"] ?? "attendancePct";
      return b[field] - a[field] || a.name.localeCompare(b.name, "ru");
    });
  const pages = Math.max(1, Math.ceil(selected.length / 25));
  const page = positivePage(value(params.page), pages);
  const visible = selected.slice((page - 1) * 25, page * 25).map((p) => {
    const finance = isFullAdminRole(user.role) || p.userId === user.sub;
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      attendancePct: p.attendancePct,
      attendancePctPrime: p.attendancePctPrime,
      attendancePctMiniRb: p.attendancePctMiniRb,
      pvpCount: p.pvpCount,
      salaryCoefficient: p.salaryCoefficient,
      canViewFinance: finance,
      salary: finance ? p.salary : 0,
      salaryPrime: finance ? p.salaryPrime : 0,
      salaryMiniRb: finance ? p.salaryMiniRb : 0,
      paidPeriod: finance ? (paid.get(p.id) ?? 0) : 0,
      userId: p.userId === user.sub ? user.sub : null,
    };
  });
  const input =
    "mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm";
  return (
    <div className="space-y-4">
      <h2 className="font-heading text-xl">
        Состав гильдии · {selected.length}
      </h2>
      <form
        className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
        method="get"
      >
        <label className="text-xs text-muted">
          Игровой ник
          <input
            name="q"
            defaultValue={value(params.q)}
            maxLength={80}
            className={input}
          />
        </label>
        <label className="text-xs text-muted">
          Класс
          <select
            name="role"
            defaultValue={value(params.role)}
            className={input}
          >
            <option value="">Все классы</option>
            {ROLES.map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Сортировка
          <select name="sort" defaultValue={sort} className={input}>
            {[
              ["attendance", "Посещаемость"],
              ["name", "Имя"],
              ["prime", "Прайм"],
              ["miniRb", "Мини-РБ"],
              ["pvp", "PvP"],
              ["salary", "Начисления"],
            ].map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name="debt"
              value="yes"
              defaultChecked={value(params.debt) === "yes"}
            />
            Есть задолженность
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name="min"
              value="20"
              defaultChecked={value(params.min) === "20"}
            />
            Посещаемость от 20%
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name="pvp"
              value="yes"
              defaultChecked={value(params.pvp) === "yes"}
            />
            Есть PvP
          </label>
        </div>
        <div className="flex items-center gap-4">
          <button className="min-h-11 rounded-lg bg-accent px-5 text-sm text-background">
            Применить
          </button>
          <Link href="/players" className="text-sm text-muted underline">
            Сбросить
          </Link>
        </div>
      </form>
      <PlayersTable
        players={visible}
        isAdmin={isFullAdminRole(user.role)}
        currentUserId={user.sub}
        serverFiltered
      />
      <Pagination page={page} pages={pages} params={params} />
    </div>
  );
}
