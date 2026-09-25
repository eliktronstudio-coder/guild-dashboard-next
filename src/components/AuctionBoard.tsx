"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { Search, ImageOff, Gavel, Crown, Timer } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import AuctionWinners, { type Winner } from "@/components/AuctionWinners";
import { formatRemaining } from "@/lib/auctionTime";

type CatalogItem = { id: string; name: string; imageUrl: string | null };
type HistoryEntry = { id: string; name: string; amount: number; kind: string; at: string | Date };

type Auction = {
  id: string;
  itemName: string;
  itemImageUrl: string | null;
  startingBid: number;
  step: number;
  currentBid: number;
  leaderPlayerId: string | null;
  leaderName: string | null;
  hasTimer: boolean;
  /** Остаток, посчитанный сервером. Null — торги без ограничения времени. */
  remainingMs: number | null;
  expired: boolean;
  history: HistoryEntry[];
};

const numberFmt = new Intl.NumberFormat("ru-RU");
const timeFmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Как часто подтягиваем состояние торгов с сервера. */
const POLL_MS = 2000;

export default function AuctionBoard({
  initialAuction,
  initialWinners,
  isAdmin,
  me,
  catalog,
}: {
  initialAuction: Auction | null;
  initialWinners: Winner[];
  isAdmin: boolean;
  /** Игрок, привязанный к учётной записи. Null — ставить нельзя. */
  me: { id: string; name: string } | null;
  catalog: CatalogItem[];
}) {
  const [auction, setAuction] = useState<Auction | null>(initialAuction);
  const [winners, setWinners] = useState<Winner[]>(initialWinners);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [itemId, setItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [startingBid, setStartingBid] = useState("100");
  const [step, setStep] = useState("50");
  const [durDays, setDurDays] = useState("0");
  const [durHours, setDurHours] = useState("0");
  const [durMinutes, setDurMinutes] = useState("2");
  const [useTimer, setUseTimer] = useState(true);

  // Остаток тикаем локально между опросами, чтобы счётчик шёл плавно, но
  // источник правды — сервер: каждые две секунды значение перезаписывается
  // его ответом, поэтому часы участника на отсчёт не влияют.
  const [remaining, setRemaining] = useState<number | null>(initialAuction?.remainingMs ?? null);

  useEffect(() => {
    setRemaining(auction?.remainingMs ?? null);
  }, [auction?.remainingMs, auction?.id]);

  useEffect(() => {
    if (remaining === null) return;
    const t = setInterval(() => setRemaining((r) => (r === null ? null : Math.max(0, r - 1000))), 1000);
    return () => clearInterval(t);
  }, [remaining === null]);

  // Пока участник жмёт кнопку, опрос не должен подменить цену под руками —
  // иначе ставка ушла бы с уже неактуальным expectedBid и отклонилась.
  const busyRef = useRef(false);
  busyRef.current = busy;

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    try {
      const res = await fetch("/api/auction", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setAuction(data.auction ?? null);
      if (Array.isArray(data.winners)) setWinners(data.winners);
    } catch {
      // Сеть моргнула — просто ждём следующего опроса, состояние не трогаем.
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const filteredCatalog = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return q ? catalog.filter((c) => c.name.toLowerCase().includes(q)) : catalog;
  }, [catalog, itemSearch]);

  // Дни/часы/минуты складываем в секунды. Пустое поле — ноль, чтобы
  // «0 д 0 ч 30 м» не превращалось в NaN из-за незаполненных дней.
  const durationSec =
    (Number(durDays) || 0) * 86400 + (Number(durHours) || 0) * 3600 + (Number(durMinutes) || 0) * 60;

  const selectedItem = catalog.find((c) => c.id === itemId) ?? null;
  const iAmLeader = !!(auction && me && auction.leaderPlayerId === me.id);
  // Считаем от локального тика, а не от ответа сервера, чтобы кнопки гасли
  // ровно в ноль, не дожидаясь следующего опроса.
  const timeIsUp = !!auction?.hasTimer && remaining !== null && remaining <= 0;

  async function send(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Не удалось выполнить действие.");
      return res.ok;
    } catch {
      setError("Нет связи с сервером.");
      return false;
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  /** То же, что send, но возвращает тело ответа — нужно для итога торгов. */
  async function sendJson(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось выполнить действие.");
        return null;
      }
      return data as { winner: string | null; soldFor: number };
    } catch {
      setError("Нет связи с сервером.");
      return null;
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  const start = () =>
    send("/api/auction", {
      method: "POST",
      body: JSON.stringify({
        catalogItemId: itemId,
        startingBid: Number(startingBid),
        step: Number(step),
        durationSec: useTimer ? durationSec : null,
      }),
    });

  const finish = async () => {
    if (
      !confirm(
        "Завершить торги? Лидер станет победителем, а его ставка уйдёт в казну как продажа Прайма и распределится между участниками."
      )
    ) {
      return;
    }
    const res = await sendJson("/api/auction", { method: "DELETE" });
    if (!res) return;
    setNotice(
      res.soldFor > 0
        ? `Торги завершены. Победитель — ${res.winner}. В казну Прайма добавлено ${numberFmt.format(res.soldFor)} золота.`
        : "Торги завершены. Ставок не было — в казну ничего не добавлено."
    );
  };

  const bid = () =>
    auction && send("/api/auction/bid", { method: "POST", body: JSON.stringify({ expectedBid: auction.currentBid }) });

  const skip = () => send("/api/auction/bid", { method: "POST", body: JSON.stringify({ action: "skip" }) });

  const shiftTime = (deltaSec: number) =>
    send("/api/auction", { method: "PATCH", body: JSON.stringify({ deltaSec }) });
  const dropTimer = () => send("/api/auction", { method: "PATCH", body: JSON.stringify({ durationSec: null }) });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Аукцион</h1>
        <p className="text-sm text-muted">
          {isAdmin
            ? "Выберите предмет из реестра дропа, задайте стартовую ставку и шаг. Участники ставят сами со своих устройств."
            : "Ставьте сами: цена обновляется у всех одновременно."}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}
      {notice && (
        <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">{notice}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* ——— Лот и управление ——— */}
          <div className="rounded-lg border border-border bg-surface p-4">
            {auction ? (
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border border-border bg-surface-2">
                  {auction.itemImageUrl ? (
                    <Image src={auction.itemImageUrl} alt={auction.itemName} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted">
                      <ImageOff size={18} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">Лот</p>
                  <p className="truncate text-base font-semibold">{auction.itemName}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    старт {numberFmt.format(auction.startingBid)} · шаг {numberFmt.format(auction.step)}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={finish}
                    disabled={busy}
                    className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-60"
                  >
                    Завершить торги
                  </button>
                )}
              </div>
            ) : isAdmin ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Поиск предмета из реестра дропа…"
                    className="w-full rounded-md border border-border bg-surface-2 py-1.5 pl-8 pr-3 text-sm"
                  />
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {filteredCatalog.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-muted">Ничего не найдено.</p>
                  ) : (
                    filteredCatalog.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setItemId(c.id)}
                        className={clsx(
                          "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors",
                          itemId === c.id ? "border-accent bg-accent/10" : "border-transparent hover:bg-surface-2"
                        )}
                      >
                        <span className="relative h-7 w-7 flex-shrink-0 overflow-hidden rounded border border-border bg-surface-2">
                          {c.imageUrl ? (
                            <Image src={c.imageUrl} alt="" fill className="object-cover" unoptimized />
                          ) : (
                            <span className="flex h-full items-center justify-center text-muted">
                              <ImageOff size={12} />
                            </span>
                          )}
                        </span>
                        <span className="truncate">{c.name}</span>
                      </button>
                    ))
                  )}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs text-muted">
                    Стартовая ставка
                    <input
                      type="number"
                      min={0}
                      value={startingBid}
                      onChange={(e) => setStartingBid(e.target.value)}
                      className="mt-1 block w-32 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm text-foreground"
                    />
                  </label>
                  <label className="text-xs text-muted">
                    Шаг ставки
                    <input
                      type="number"
                      min={1}
                      value={step}
                      onChange={(e) => setStep(e.target.value)}
                      className="mt-1 block w-32 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm text-foreground"
                    />
                  </label>
                  <div className="text-xs text-muted">
                    Время торгов
                    <div className="mt-1 flex items-end gap-2">
                      {(
                        [
                          ["дни", durDays, setDurDays],
                          ["часы", durHours, setDurHours],
                          ["мин", durMinutes, setDurMinutes],
                        ] as const
                      ).map(([label, value, setValue]) => (
                        <label key={label} className="flex flex-col gap-0.5">
                          <input
                            type="number"
                            min={0}
                            value={value}
                            disabled={!useTimer}
                            onChange={(e) => setValue(e.target.value)}
                            className="w-20 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
                          />
                          <span className="text-center text-[11px]">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 pb-2 text-xs text-muted">
                    <input type="checkbox" checked={!useTimer} onChange={(e) => setUseTimer(!e.target.checked)} />
                    без таймера
                  </label>
                  <button
                    type="button"
                    onClick={start}
                    disabled={!selectedItem || busy || (useTimer && durationSec <= 0)}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Начать торги
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState title="Торги не идут" hint="Дождитесь, пока ГМ выставит лот." />
            )}
          </div>

          {/* ——— Цена и кнопки участника ——— */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted">Текущая ставка</p>
                <p className="mt-0.5 font-heading text-3xl font-bold tabular-nums">
                  {auction ? numberFmt.format(auction.currentBid) : "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">Лидирует</p>
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium">
                  {auction?.leaderName ? (
                    <>
                      <Crown size={14} className="text-amber-500" />
                      {auction.leaderName}
                    </>
                  ) : (
                    <span className="text-muted">ставок нет</span>
                  )}
                </p>
              </div>
            </div>

            {auction?.hasTimer && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2">
                <span
                  className={clsx(
                    "inline-flex items-center gap-2 font-mono text-2xl font-bold tabular-nums",
                    remaining !== null && remaining <= 10000 ? "text-danger" : "text-foreground"
                  )}
                >
                  <Timer size={18} className="text-muted" />
                  {remaining !== null && remaining > 0 ? formatRemaining(remaining) : "время вышло"}
                </span>
                {isAdmin && (
                  <span className="flex flex-wrap items-center gap-1.5">
                    {/* Шаг правки от секунд до часа: торги бывают и на две
                        минуты, и на несколько суток. */}
                    {(
                      [
                        ["−10 м", -600],
                        ["−30 с", -30],
                        ["+30 с", 30],
                        ["+10 м", 600],
                        ["+1 ч", 3600],
                      ] as const
                    ).map(([label, delta]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => shiftTime(delta)}
                        disabled={busy}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface disabled:opacity-60"
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={dropTimer}
                      disabled={busy}
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface disabled:opacity-60"
                    >
                      снять таймер
                    </button>
                  </span>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={bid}
                disabled={!auction || !me || busy || iAmLeader || timeIsUp}
                className="rounded-lg bg-success px-4 py-4 text-base font-semibold text-white transition-opacity disabled:opacity-40"
              >
                <span className="inline-flex items-center gap-2">
                  <Gavel size={18} />
                  Ставка{auction ? ` · ${numberFmt.format(auction.currentBid + auction.step)}` : ""}
                </span>
              </button>
              <button
                type="button"
                onClick={skip}
                disabled={!auction || !me || busy || timeIsUp}
                className="rounded-lg bg-danger px-4 py-4 text-base font-semibold text-white transition-opacity disabled:opacity-40"
              >
                Skip
              </button>
            </div>

            {!me && (
              <p className="mt-3 text-xs text-muted">
                Ваша учётная запись не привязана к игроку в составе — ставить нельзя, торги видно только для просмотра.
              </p>
            )}
            {timeIsUp && (
              <p className="mt-3 text-xs text-danger">
                Время вышло — ставки больше не принимаются.
                {isAdmin ? " Добавьте время или завершите торги." : " Ждите решения ГМ."}
              </p>
            )}
            {!timeIsUp && iAmLeader && <p className="mt-3 text-xs text-success">Ваша ставка сейчас лучшая — ждите ответа других.</p>}
          </div>
        </div>

        {/* ——— Последние ставки ——— */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Последние ставки</h2>
          {!auction || auction.history.length === 0 ? (
            <p className="mt-2 text-xs text-muted">Пока нет ставок.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {auction.history.map((h) => (
                <li key={h.id} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className={clsx("truncate", h.kind === "skip" && "text-muted")}>
                    {h.name}
                    {h.kind === "skip" ? " — пропуск" : ""}
                  </span>
                  <span className="flex-shrink-0 font-mono tabular-nums">
                    {h.kind === "skip" ? "—" : numberFmt.format(h.amount)}
                  </span>
                  <span className="flex-shrink-0 text-[11px] text-muted">{timeFmt.format(new Date(h.at))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <AuctionWinners winners={winners} />
    </div>
  );
}
