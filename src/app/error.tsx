"use client";
export default function ErrorState({ reset }: { reset: () => void }) {
  return (
    <section
      role="alert"
      className="space-y-4 rounded-xl border border-danger/40 bg-surface p-6"
    >
      <h2 className="text-xl font-semibold">Не удалось загрузить данные</h2>
      <p className="text-sm text-muted">
        Попробуйте ещё раз. Если ошибка повторяется, сообщите администратору.
      </p>
      <button
        onClick={reset}
        className="min-h-11 rounded-lg border border-accent px-4 text-accent"
      >
        Повторить
      </button>
    </section>
  );
}
