import { payments } from "@/lib/mock-data";

const numberFmt = new Intl.NumberFormat("ru-RU");

const statusColor: Record<string, string> = {
  "Выплачено": "text-success",
  "Ожидает": "text-accent",
  "Отклонено": "text-danger",
};

export default function PaymentsPage() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
            <th className="px-4 py-3 font-medium">Игрок</th>
            <th className="px-4 py-3 font-medium">Сумма</th>
            <th className="px-4 py-3 font-medium">Статус</th>
            <th className="px-4 py-3 font-medium">Дата</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {payments.map((p) => (
            <tr key={p.id} className="hover:bg-surface-2">
              <td className="px-4 py-3 font-medium">{p.player}</td>
              <td className="px-4 py-3">{numberFmt.format(p.amount)} золота</td>
              <td className={`px-4 py-3 ${statusColor[p.status]}`}>{p.status}</td>
              <td className="px-4 py-3 text-muted">{p.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
