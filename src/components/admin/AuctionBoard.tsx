"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Search, ImageOff, Gavel, X } from "lucide-react";
import EmptyState from "@/components/EmptyState";

type Player = { id: string; name: string };
type CatalogItem = { id: string; name: string; imageUrl: string | null };
type BidEntry = { id: string; name: string; amount: number; time: string };

const numberFmt = new Intl.NumberFormat("ru-RU");

export default function AuctionBoard({ players, catalog }: { players: Player[]; catalog: CatalogItem[] }) {
  const [itemId, setItemId] = useState<string>("");
  const [itemSearch, setItemSearch] = useState("");
  const [startingBid, setStartingBid] = useState("100");
  const [step, setStep] = useState("50");
  const [currentBid, setCurrentBid] = useState<number | null>(null);
  const [history, setHistory] = useState<BidEntry[]>([]);

  const [participants, setParticipants] = useState<string[]>([]);
  const [customName, setCustomName] = useState("");
  const [activeName, setActiveName] = useState<string | null>(null);

  const selectedItem = catalog.find((c) => c.id === itemId) ?? null;

  const filteredCatalog = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return q ? catalog.filter((c) => c.name.toLowerCase().includes(q)) : catalog;
  }, [catalog, itemSearch]);

  const availableRoster = useMemo(
    () => players.filter((p) => !participants.includes(p.name)),
    [players, participants]
  );

  function startAuction() {
    if (!selectedItem) return;
    const start = Math.max(0, Math.round(Number(startingBid) || 0));
    setCurrentBid(start);
    setHistory([]);
  }

  function resetAuction() {
    setCurrentBid(null);
    setHistory([]);
    setActiveName(null);
  }

  function addParticipant(name: string) {
    const trimmed = name.trim();
    if (!trimmed || participants.includes(trimmed)) return;
    setParticipants((prev) => [...prev, trimmed]);
  }

  function removeParticipant(name: string) {
    setParticipants((prev) => prev.filter((n) => n !== name));
    if (activeName === name) setActiveName(null);
  }

  function placeBid() {
    if (currentBid === null || !activeName) return;
    const stepValue = Math.max(1, Math.round(Number(step) || 0));
    const nextBid = currentBid + stepValue;
    setCurrentBid(nextBid);
    setHistory((prev) => [
      { id: `${Date.now()}-${Math.random()}`, name: activeName, amount: nextBid, time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) },
      ...prev,
    ].slice(0, 7));
  }

  function skip() {
    if (!activeName) return;
    setHistory((prev) => [
      { id: `${Date.now()}-${Math.random()}`, name: `${activeName} — пропуск`, amount: currentBid ?? 0, time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) },
      ...prev,
    ].slice(0, 7));
  }

  const auctionStarted = currentBid !== null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Аукцион</h1>
        <p className="text-sm text-muted">
          Выберите предмет из реестра дропа, задайте стартовую ставку и шаг, соберите участников и ведите торги.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Левая колонка: выбор предмета и настройки */}
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4 lg:col-span-1">
          <h2 className="text-sm font-semibold">Лот</h2>

          {selectedItem ? (
            <div className="flex items-center gap-3 rounded-md border border-border bg-surface-2 p-2.5">
              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-surface">
                {selectedItem.imageUrl ? (
                  <Image src={selectedItem.imageUrl} alt={selectedItem.name} fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-2">
                    <ImageOff size={18} />
                  </div>
                )}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{selectedItem.name}</span>
              <button
                type="button"
                onClick={() => {
                  setItemId("");
                  resetAuction();
                }}
                className="flex-shrink-0 rounded-md p-1 text-muted hover:bg-surface hover:text-foreground"
                title="Сменить лот"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Поиск предмета из реестра дропа…"
                  className="w-full rounded-md border border-border bg-surface-2 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-accent"
                />
              </div>
              <ul className="max-h-[220px] divide-y divide-border overflow-y-auto rounded-md border border-border">
                {filteredCatalog.length === 0 ? (
                  <li className="p-3 text-sm text-muted">Ничего не найдено.</li>
                ) : (
                  filteredCatalog.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setItemId(c.id)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2"
                      >
                        <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded bg-surface-2">
                          {c.imageUrl ? (
                            <Image src={c.imageUrl} alt={c.name} fill className="object-cover" unoptimized />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-2">
                              <ImageOff size={14} />
                            </div>
                          )}
                        </div>
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}

          <label className="block text-xs text-muted">
            Стартовая ставка
            <input
              type="number"
              min={0}
              value={startingBid}
              onChange={(e) => setStartingBid(e.target.value)}
              disabled={auctionStarted}
              className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-60"
            />
          </label>
          <label className="block text-xs text-muted">
            Шаг ставки
            <input
              type="number"
              min={1}
              value={step}
              onChange={(e) => setStep(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>

          {!auctionStarted ? (
            <button
              type="button"
              onClick={startAuction}
              disabled={!selectedItem}
              className="w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-50"
            >
              Начать торги
            </button>
          ) : (
            <button
              type="button"
              onClick={resetAuction}
              className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground/80 hover:bg-surface-2"
            >
              Сбросить торги
            </button>
          )}
        </div>

        {/* Центр: текущая ставка и кнопки */}
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface p-6 lg:col-span-1">
          <Gavel size={22} className="text-muted" />
          <div className="text-center">
            <p className="text-xs text-muted">Текущая ставка</p>
            <p className="font-mono text-4xl font-bold text-accent-bright">
              {currentBid === null ? "—" : numberFmt.format(currentBid)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted">Сейчас ходит</p>
            <p className="text-base font-semibold">{activeName ?? "не выбран"}</p>
          </div>

          <div className="grid w-full grid-cols-2 gap-3">
            <button
              type="button"
              onClick={placeBid}
              disabled={!auctionStarted || !activeName}
              className="rounded-lg bg-jade px-4 py-6 text-lg font-bold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ставка
            </button>
            <button
              type="button"
              onClick={skip}
              disabled={!auctionStarted || !activeName}
              className="rounded-lg bg-danger px-4 py-6 text-lg font-bold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Skip
            </button>
          </div>

          {/* Последние ставки */}
          <div className="w-full rounded-md border border-border bg-surface-2 p-2.5">
            <p className="mb-1.5 text-xs text-muted">Последние ставки</p>
            {history.length === 0 ? (
              <p className="text-xs text-muted-2">Пока нет ставок.</p>
            ) : (
              <ul className="space-y-1">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between text-xs">
                    <span className="min-w-0 truncate text-foreground/90">{h.name}</span>
                    <span className="flex flex-shrink-0 items-center gap-2 font-mono text-muted">
                      {numberFmt.format(h.amount)}
                      <span className="text-muted-2">{h.time}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Правая колонка: участники */}
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4 lg:col-span-1">
          <h2 className="text-sm font-semibold">Участники</h2>

          <div className="flex gap-2">
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addParticipant(customName);
                  setCustomName("");
                }
              }}
              placeholder="Вписать ник…"
              className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => {
                addParticipant(customName);
                setCustomName("");
              }}
              className="flex-shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-foreground/80 hover:bg-surface-2"
            >
              Добавить
            </button>
          </div>

          {availableRoster.length > 0 && (
            <details className="rounded-md border border-border">
              <summary className="cursor-pointer px-3 py-2 text-xs text-muted hover:text-foreground">
                Добавить из состава ({availableRoster.length})
              </summary>
              <ul className="max-h-[160px] divide-y divide-border overflow-y-auto">
                {availableRoster.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addParticipant(p.name)}
                      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-surface-2"
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {participants.length === 0 ? (
            <EmptyState title="Нет участников" hint="Впишите ник или добавьте из состава." />
          ) : (
            <ul className="max-h-[320px] space-y-1 overflow-y-auto">
              {participants.map((name) => (
                <li key={name}>
                  <div
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                      activeName === name
                        ? "border-accent bg-accent/10 text-foreground"
                        : "border-border bg-surface-2 text-foreground/90"
                    }`}
                  >
                    <button type="button" onClick={() => setActiveName(name)} className="min-w-0 flex-1 truncate text-left">
                      {name}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeParticipant(name)}
                      className="flex-shrink-0 rounded p-1 text-muted hover:bg-surface hover:text-danger"
                      title="Убрать"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
