const tournaments = [
  { id: 1, name: "Кубок гильдий · Осень", status: "Идёт", teams: 8, date: "до 20 августа" },
  { id: 2, name: "Арена 3х3", status: "Регистрация", teams: 5, date: "старт 25 августа" },
  { id: 3, name: "Летний турнир", status: "Завершён", teams: 12, date: "1–14 июля" },
];

const statusColor: Record<string, string> = {
  "Идёт": "text-accent",
  "Регистрация": "text-success",
  "Завершён": "text-muted",
};

export default function TournamentPage() {
  return (
    <div className="space-y-3">
      {tournaments.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between rounded-lg border border-border bg-surface p-4"
        >
          <div>
            <p className="text-sm font-medium">{t.name}</p>
            <p className="mt-1 text-xs text-muted">{t.teams} команд · {t.date}</p>
          </div>
          <span className={`text-xs font-medium ${statusColor[t.status]}`}>{t.status}</span>
        </div>
      ))}
    </div>
  );
}
