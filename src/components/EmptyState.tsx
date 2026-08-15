import { Inbox } from "lucide-react";

export default function EmptyState({
  title = "Нет данных за выбранный период",
  hint = "Попробуйте изменить период или дождитесь первой активности.",
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <Inbox size={22} className="text-muted-2" />
      <p className="text-sm font-medium text-foreground/80">{title}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}
