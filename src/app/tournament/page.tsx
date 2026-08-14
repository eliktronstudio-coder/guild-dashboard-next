import { getAllTournaments } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import TournamentsList from "@/components/admin/TournamentsList";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

function dateLabel(status: string, startDate: Date, endDate: Date | null) {
  if (status === "Регистрация") return `старт ${dateFmt.format(startDate)}`;
  if (status === "Идёт") return endDate ? `до ${dateFmt.format(endDate)}` : `с ${dateFmt.format(startDate)}`;
  return endDate ? `${dateFmt.format(startDate)} – ${dateFmt.format(endDate)}` : dateFmt.format(startDate);
}

export default async function TournamentPage() {
  const [tournaments, user] = await Promise.all([getAllTournaments(), getCurrentUser()]);

  return (
    <TournamentsList
      tournaments={tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        teams: t.teams,
        dateLabel: dateLabel(t.status, t.startDate, t.endDate),
      }))}
      isAdmin={user?.role === "admin"}
    />
  );
}
