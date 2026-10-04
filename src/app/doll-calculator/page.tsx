import { ExternalLink } from "lucide-react";

const CALC_URL = "https://aje-calc.h1n.ru";

export default function DollCalculatorPage() {
  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-3 lg:h-[calc(100vh-6rem)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Калькулятор куклы</h1>
          <p className="text-sm text-muted">
            Полный расчёт характеристик персонажа: экипировка, комплекты, боевая мощь.
          </p>
        </div>
        <a
          href={CALC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          Открыть в отдельной вкладке
          <ExternalLink size={12} />
        </a>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface">
        <iframe
          src={CALC_URL}
          title="Калькулятор куклы ArcheAge"
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          loading="lazy"
        />
      </div>
    </div>
  );
}
