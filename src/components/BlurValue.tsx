import type { ReactNode } from "react";

// Точечный блюр одного значения (ячейка таблицы, цифра в карточке) —
// без оверлея-подписи, в отличие от BlurGate: для мелких значений
// внутри таблиц подпись на каждой строке была бы избыточной.
export default function BlurValue({ blurred, children }: { blurred: boolean; children: ReactNode }) {
  if (!blurred) return <>{children}</>;
  return (
    <span aria-hidden="true" className="pointer-events-none select-none blur-sm">
      {children}
    </span>
  );
}
