"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Переопределения статических подписей для клиентских компонентов.
 *
 * Серверные компоненты читают их напрямую через designText() из
 * lib/design/resolve.ts. Клиентские не могут обратиться к серверу в рендере,
 * поэтому карта подписей один раз спускается из layout в AppShell и дальше
 * раздаётся через этот контекст.
 */
const DesignTextContext = createContext<Record<string, string>>({});

export function DesignTextProvider({
  texts,
  children,
}: {
  texts: Record<string, string>;
  children: ReactNode;
}) {
  return <DesignTextContext.Provider value={texts}>{children}</DesignTextContext.Provider>;
}

/** Подпись с учётом переопределения; fallback — строка из кода. */
export function useDesignText(id: string, fallback: string): string {
  const texts = useContext(DesignTextContext);
  return texts[id] ?? fallback;
}

/** Вся карта — когда нужно несколько подписей сразу. */
export function useDesignTexts(): Record<string, string> {
  return useContext(DesignTextContext);
}
