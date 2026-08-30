"use client";

import { useSyncExternalStore } from "react";
import { DAY_NAMES, formatCountdown, formatSlotTime, mskNow, upcomingSlots } from "@/lib/schedule";

/** Enough slots to scroll through; only the first few are visible at rest. */
const SHOWN = 14;
const TICK_MS = 15_000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, TICK_MS);
  return () => clearInterval(id);
}

/** Clock bucketed to the tick, so a render pass always sees one stable value. */
function getSnapshot() {
  const t = Date.now();
  return t - (t % TICK_MS);
}

/** Day header for a slot: "Сегодня" / "Завтра" / weekday name, relative to MSK. */
function dayLabel(slotDay: number, todayDay: number) {
  if (slotDay === todayDay) return "Сегодня";
  if (slotDay === (todayDay + 1) % 7) return "Завтра";
  return DAY_NAMES[slotDay];
}

export default function SchedulePanel() {
  // null on the server: the countdown depends on the current time, which the
  // server and the browser would disagree on during hydration.
  const nowMs = useSyncExternalStore(subscribe, getSnapshot, () => null);

  if (nowMs === null) {
    return <div className="min-h-[196px] max-h-[320px] flex-1" aria-hidden="true" />;
  }

  const now = new Date(nowMs);
  const today = mskNow(now).day;
  const slots = upcomingSlots(now, SHOWN);

  return (
    <div className="scroll-slim max-h-[320px] min-h-[196px] flex-1 space-y-[5px] overflow-y-auto pr-2">
      {slots.map((slot, i) => (
        <div key={`${slot.day}-${slot.minutes}-${slot.name}`}>
          {(i === 0 || slot.day !== slots[i - 1].day) && (
            <p className="px-1 pb-1 pt-2 text-[11px] uppercase tracking-wider text-muted-2 first:pt-0">
              {dayLabel(slot.day, today)}
            </p>
          )}
          <div className="flex min-h-[92px] items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3">
            <span className="flex-shrink-0 font-heading text-[22px] font-bold tabular-nums text-accent">
              {formatSlotTime(slot.minutes)}
            </span>
            {/* Stacked: at one-third column width a single line leaves the name
                only ~55px, which truncates even short boss names. */}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-foreground">{slot.name}</span>
              <span className="mt-1 block truncate text-[15px] text-muted">
                {slot.inMinutes <= 0 ? "сейчас" : `через ${formatCountdown(slot.inMinutes)}`}
              </span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
