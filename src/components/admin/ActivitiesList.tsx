"use client";

import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, Image as ImageIcon, Loader2 } from "lucide-react";

type Activity = {
  id: string;
  name: string;
  date: string;
  participants: number;
};

type PlayerOption = { id: string; name: string; role: string };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatchingPlayers(text: string, players: PlayerOption[]) {
  return players.filter((p) => {
    const escaped = escapeRegExp(p.name);
    const re = new RegExp(`(^|[^a-zа-яё0-9])${escaped}([^a-zа-яё0-9]|$)`, "i");
    return re.test(text);
  });
}

export default function ActivitiesList({
  activities,
  players,
  isAdmin,
}: {
  activities: Activity[];
  players: PlayerOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayISO());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrNotice, setOcrNotice] = useState<string | null>(null);

  const knownActivityNames = [...new Set(activities.map((a) => a.name))];

  async function handleScreenshot(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrBusy(true);
    setOcrNotice(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/activities/ocr", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не удалось распознать скриншот.");
        return;
      }
      const matched = findMatchingPlayers(data.text as string, players);
      setSelected((prev) => {
        const next = new Set(prev);
        matched.forEach((p) => next.add(p.id));
        return next;
      });
      setOcrNotice(
        matched.length > 0
          ? `Распознано и отмечено: ${matched.map((p) => p.name).join(", ")}`
          : "Не удалось найти совпадений с составом. Отметьте участников вручную."
      );
    } catch {
      setError("Не удалось связаться с сервером.");
    } finally {
      setOcrBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cancel() {
    setAdding(false);
    setName("");
    setDate(todayISO());
    setSelected(new Set());
    setError(null);
    setOcrNotice(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, date, participantIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Что-то пошло не так.");
        setBusy(false);
        return;
      }
      cancel();
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить активность?")) return;
    setBusy(true);
    await fetch(`/api/activities/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90"
            >
              <Plus size={16} /> Добавить активность
            </button>
          )}

          {adding && (
            <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-surface p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted">Название</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={60}
                    list="activity-name-options"
                    placeholder="Выберите или введите новое"
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <datalist id="activity-name-options">
                    {knownActivityNames.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Дата</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs text-muted">Заполнить по скриншоту</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={ocrBusy}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-foreground/80 hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
                  >
                    {ocrBusy ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                    {ocrBusy ? "Распознаём…" : "Загрузить скриншот участников"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshot}
                    className="hidden"
                  />
                </div>
                {ocrNotice && <p className="mt-1.5 text-xs text-muted">{ocrNotice}</p>}
              </div>

              <div>
                <p className="mb-1.5 text-xs text-muted">Участники</p>
                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-md border border-border bg-surface-2 p-2">
                  {players.length === 0 && <p className="text-xs text-muted">Сначала добавьте игроков в состав.</p>}
                  {players.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelected(p.id)}
                        className="accent-accent"
                      />
                      {p.name} <span className="text-muted">· {p.role}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && <p className="text-xs text-danger">{error}</p>}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
                >
                  Создать
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
                >
                  <X size={14} /> Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">Все активности</h2>
        </div>
        <ul className="divide-y divide-border">
          {activities.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-surface-2">
              <Link href={`/activities/${a.id}`} className="flex-1">
                <span className="font-medium">{a.name}</span>
                <span className="ml-2 text-xs text-muted">{a.participants} участников</span>
              </Link>
              <span className="text-xs text-muted">{a.date}</span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  aria-label="Удалить"
                  className="ml-3 rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
          {activities.length === 0 && <li className="px-4 py-6 text-center text-muted">Пока нет активностей.</li>}
        </ul>
      </div>
    </div>
  );
}
