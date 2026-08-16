import { Inbox } from "lucide-react";
import clsx from "clsx";
import JapaneseCrest from "./dashboard/JapaneseCrest";
import JapaneseWavePattern from "./dashboard/JapaneseWavePattern";

export default function EmptyState({
  title = "Нет данных за выбранный период",
  hint = "Попробуйте изменить период или дождитесь первой активности.",
  variant = "default",
}: {
  title?: string;
  hint?: string;
  variant?: "default" | "dashboard";
}) {
  if (variant === "dashboard") {
    return (
      <div className="relative flex flex-col items-center justify-center gap-2 overflow-hidden px-4 py-10 text-center">
        <JapaneseWavePattern className="left-0 bottom-0 h-16 w-24 text-accent" opacity={0.035} />
        <JapaneseWavePattern className="right-0 bottom-0 h-16 w-24 text-accent" opacity={0.035} />
        <span className="relative flex h-12 w-12 items-center justify-center text-accent-dim">
          <JapaneseCrest size={48} className="absolute inset-0" />
          <Inbox size={16} className="relative" />
        </span>
        <p className={clsx("text-sm font-medium text-foreground/80")}>{title}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <Inbox size={22} className="text-muted-2" />
      <p className="text-sm font-medium text-foreground/80">{title}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}
