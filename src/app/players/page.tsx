import Link from "next/link";
import { players } from "@/lib/mock-data";

const numberFmt = new Intl.NumberFormat("ru-RU");

export default function PlayersPage() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
            <th className="px-4 py-3 font-medium">Имя</th>
            <th className="px-4 py-3 font-medium">Роль</th>
            <th className="px-4 py-3 font-medium">Уровень</th>
            <th className="px-4 py-3 font-medium">XP</th>
            <th className="px-4 py-3 font-medium">Посещаемость</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {players.map((p) => (
            <tr key={p.id} className="hover:bg-surface-2">
              <td className="px-4 py-3">
                <Link href={`/players/${p.id}`} className="font-medium hover:text-accent">
                  {p.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted">{p.role}</td>
              <td className="px-4 py-3">{p.level}</td>
              <td className="px-4 py-3">{numberFmt.format(p.xp)}</td>
              <td className="px-4 py-3 text-accent">{p.attendancePct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
