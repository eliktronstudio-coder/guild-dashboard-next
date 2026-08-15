"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

// SSR has no access to localStorage/DOM; the inline anti-FOUC script in layout.tsx
// already stamps the real value on <html> before hydration, so this only needs to
// match what the server actually rendered (always "dark") to avoid a mismatch.
function getServerSnapshot(): Theme {
  return "dark";
}

function setTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("theme", next);
  } catch {
    // localStorage may be unavailable (private mode) — theme just won't persist.
  }
  listeners.forEach((callback) => callback());
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      aria-label={theme === "light" ? "Включить тёмную тему" : "Включить светлую тему"}
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-border text-muted hover:bg-surface-2 hover:text-foreground"
    >
      {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}
