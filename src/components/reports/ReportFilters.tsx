import { ROLES } from "@/lib/roles";
import { value, type ReportParams } from "@/lib/report-filters";
export default function ReportFilters({
  params,
  archives,
}: {
  params: ReportParams;
  archives: { id: string; label: string }[];
}) {
  const field =
    "mt-1 block min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
  return (
    <form
      className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
      method="get"
    >
      <label className="text-xs text-muted">
        Период
        <select
          name="period"
          defaultValue={value(params.period) || "current"}
          className={field}
        >
          <option value="current">Текущий расчётный</option>
          <option value="previous">Предыдущий расчётный</option>
          <option value="7">Последние 7 дней</option>
          <option value="30">Последние 30 дней</option>
          <option value="custom">Произвольный диапазон</option>
        </select>
      </label>
      <label className="text-xs text-muted">
        Категория посещаемости
        <select
          name="category"
          defaultValue={value(params.category)}
          className={field}
        >
          <option value="">Все активности</option>
          {["Прайм", "Мини-РБ", "PvE", "PvP"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted">
        Начало диапазона
        <input
          name="from"
          type="date"
          defaultValue={value(params.from)}
          className={field}
        />
      </label>
      <label className="text-xs text-muted">
        Конец диапазона
        <input
          name="to"
          type="date"
          defaultValue={value(params.to)}
          className={field}
        />
      </label>
      <label className="text-xs text-muted">
        Архив
        <select
          name="archive"
          defaultValue={value(params.archive)}
          className={field}
        >
          <option value="">Живые данные</option>
          {archives.map((a) => (
            <option value={a.id} key={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted">
        Поиск игрока
        <input
          name="q"
          maxLength={80}
          defaultValue={value(params.q)}
          className={field}
        />
      </label>
      <label className="text-xs text-muted">
        Класс
        <select name="role" defaultValue={value(params.role)} className={field}>
          <option value="">Все классы</option>
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted">
        Рейтинг
        <select
          name="sort"
          defaultValue={value(params.sort) || "attendance"}
          className={field}
        >
          {[
            ["attendance", "Общая посещаемость"],
            ["prime", "Прайм"],
            ["miniRb", "Мини-РБ"],
            ["pvp", "PvP"],
            ["salary", "Начисления"],
            ["attended", "Количество участий"],
            ["kills", "Убийства"],
            ["honor", "Честь"],
          ].map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button className="min-h-11 rounded-lg bg-accent px-5 text-sm font-semibold text-background">
          Применить
        </button>
        <a href="?" className="text-sm text-muted underline">
          Сбросить
        </a>
      </div>
    </form>
  );
}
