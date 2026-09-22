import StatCard from "@/components/StatCard";
import PayoutSummaryTable from "@/components/admin/PayoutSummaryTable";
import PaymentsTable from "@/components/admin/PaymentsTable";
import PeriodPicker from "@/components/admin/PeriodPicker";
import BlurValue from "@/components/BlurValue";
import { getActivePeriod, daysUntilPeriodEnd } from "@/lib/period";
import {
  getAllPayments,
  getAllPlayers,
  getArchiveOptions,
  getArchivePayout,
  getPayoutStatusMap,
  getTreasuryBreakdown,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { isFullAdminRole } from "@/lib/accountRoles";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const numberFmt = new Intl.NumberFormat("ru-RU");

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const [{ period: requested }, activePeriod, user, archives] = await Promise.all([
    searchParams,
    getActivePeriod(),
    getCurrentUser(),
    getArchiveOptions(),
  ]);

  const isRandom = user?.role === "random";
  const isAdmin = isFullAdminRole(user?.role);

  // Выбранный архив принимаем только если он есть в списке — иначе чужой
  // ?period= в адресе показывал бы пустую страницу вместо текущего периода.
  const selectedArchiveId = requested && archives.some((a) => a.id === requested) ? requested : null;

  const picker = (
    <PeriodPicker current={activePeriod.label} archives={archives} selected={selectedArchiveId} />
  );

  /* ——— Закрытый период: всё из снимка архива ——— */
  if (selectedArchiveId) {
    const archive = await getArchivePayout(selectedArchiveId);
    if (!archive) return <div className="space-y-6">{picker}</div>;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3">
          <div className="text-sm">
            <span className="text-muted">Закрытый период: </span>
            <span className="font-medium">{archive.label}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <span className="h-2 w-2 rounded-full bg-muted" /> В архиве
          </span>
        </div>

        {picker}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <BlurValue blurred={isRandom}>
            <StatCard
              label="Сумма к выплате"
              value={`${numberFmt.format(archive.total)} золота`}
              hint="зафиксирована при архивации"
            />
          </BlurValue>
          <BlurValue blurred={isRandom}>
            <StatCard
              label="Уже выплачено"
              value={`${numberFmt.format(archive.paidTotal)} золота`}
              hint={`осталось ${numberFmt.format(archive.remaining)}`}
            />
          </BlurValue>
          <StatCard label="Получателей" value={String(archive.recipients)} hint="игроков с ненулевой долей" />
        </div>

        {!isRandom && (
          <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
            Суммы взяты из снимка, сделанного при архивации, и не пересчитываются: живая казна после архивации
            обнуляется. Выплата за закрытый период списывается из казны этого же периода и живой баланс не трогает.
          </div>
        )}

        <PayoutSummaryTable
          players={archive.players.map((p) => ({
            // Строки удалённых игроков остаются в архиве, но платить им уже
            // некому — id нет, переключатель для них отключается сам.
            id: p.id ?? p.statId,
            name: p.name,
            role: p.role,
            attendancePctPrime: p.attendancePctPrime,
            attendancePctMiniRb: p.attendancePctMiniRb,
            salary: p.salary,
            salaryPrime: p.id ? p.salaryPrime : 0,
            salaryMiniRb: p.id ? p.salaryMiniRb : 0,
          }))}
          totalPayout={archive.total}
          isRandom={isRandom}
          isAdmin={isAdmin}
          archiveId={archive.id}
          title="Состав и суммы за период"
          subtitle="Снимок на момент архивации: проценты и доли зафиксированы и не пересчитываются. Отметка «Выплата» списывает долю из казны этого же периода."
          paidStatus={archive.players.flatMap((p) =>
            p.id
              ? [...(p.paidPrime ? [`${p.id}:Прайм`] : []), ...(p.paidMiniRb ? [`${p.id}:Мини-РБ`] : [])]
              : []
          )}
        />
      </div>
    );
  }

  /* ——— Текущий период ——— */
  const period = activePeriod.id;
  const [payments, players, treasury, paidStatus] = await Promise.all([
    getAllPayments(),
    getAllPlayers(),
    getTreasuryBreakdown(),
    getPayoutStatusMap(period),
  ]);

  // Фиксировать зарплату отдельной кнопкой больше не нужно: доли считаются от
  // исходного фонда периода, а не от остатка казны, поэтому выплата одному
  // игроку не меняет суммы у остальных (см. distributionPools в queries.ts).
  const effective = players;

  const totalPayout = effective.reduce((sum, p) => sum + p.salary, 0);
  const recipients = effective.filter((p) => p.salary > 0).length;

  // Сколько уже фактически списано в этом периоде — нужно для сверки ниже:
  // после первой же выплаты остаток казны уменьшается, а totalPayout при
  // зафиксированной зарплате остаётся прежним, так что напрямую их сравнивать
  // уже нельзя.
  const paidThisPeriod = payments
    .filter((p) => p.source === "payout" && p.archiveMonth === period && p.status === "Выплачено")
    .reduce((sum, p) => sum + p.amount, 0);

  // Сверка: остаток казны обязан равняться тому, что ещё не выплачено.
  const pool = treasury.prime + treasury.miniRb;
  const undistributed = pool - (totalPayout - paidThisPeriod);

  const daysLeft = daysUntilPeriodEnd(activePeriod.endDate);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3">
        <div className="text-sm">
          <span className="text-muted">Текущий расчётный период: </span>
          <span className="font-medium">{activePeriod.label}</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
          <span className="h-2 w-2 rounded-full bg-success" /> Активный
          {daysLeft >= 0 ? ` · осталось ${daysLeft} дн.` : ""}
        </span>
      </div>

      {picker}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Конец периода"
          value={dateFmt.format(activePeriod.endDate)}
          hint={daysLeft >= 0 ? `через ${daysLeft} дн.` : "период завершён"}
        />
        <BlurValue blurred={isRandom}>
          <StatCard label="Сумма к выплате" value={`${numberFmt.format(totalPayout)} золота`} hint="расчётная сумма" />
        </BlurValue>
        <StatCard label="Получателей" value={String(recipients)} hint="игроков с ненулевой долей" />
      </div>

      {!isRandom && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            undistributed === 0 ? "border-border bg-surface text-muted" : "border-danger/40 bg-danger/10 text-danger"
          }`}
        >
          {undistributed === 0 ? (
            <>
              Сверка сошлась: остаток казны Прайма и Мини-РБ —{" "}
              <span className="font-mono tabular-nums text-foreground">{numberFmt.format(pool)}</span> золота —
              равен ещё не выплаченной части фонда. Если игрока удалить, его доля автоматически уйдёт остальным.
            </>
          ) : (
            <>
              Не сходится{" "}
              <span className="font-mono tabular-nums">{numberFmt.format(undistributed)}</span> золота. Это ошибка
              расчёта — сообщите разработчику.
            </>
          )}
        </div>
      )}

      {isAdmin && daysLeft >= 0 && daysLeft <= 1 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
          {daysLeft > 0
            ? `Расчётный период заканчивается через ${daysLeft} дн.`
            : "Расчётный период заканчивается сегодня."}
        </div>
      )}

      <PayoutSummaryTable
        players={effective.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          attendancePctPrime: p.attendancePctPrime,
          attendancePctMiniRb: p.attendancePctMiniRb,
          salary: p.salary,
          salaryPrime: p.salaryPrime,
          salaryMiniRb: p.salaryMiniRb,
        }))}
        totalPayout={totalPayout}
        isRandom={isRandom}
        isAdmin={isAdmin}
        paidStatus={[...paidStatus]}
      />

      <PaymentsTable
        payments={payments.map((p) => ({
          id: p.id,
          player: { id: p.player.id, name: p.player.name },
          amount: p.amount,
          status: p.status,
          date: dateFmt.format(p.date),
          dateISO: p.date.toISOString().slice(0, 10),
          source: p.source,
        }))}
        players={players.map((p) => ({ id: p.id, name: p.name }))}
        isAdmin={isAdmin}
        isRandom={isRandom}
      />
    </div>
  );
}
