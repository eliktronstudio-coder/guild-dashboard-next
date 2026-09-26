/**
 * Локальные иконки достижений: по одной на каждую из 30 цепочек.
 *
 * Все рисуются currentColor, поэтому цвет задаёт редкость ступени, а не сама
 * иконка. Внешних файлов нет — это обычный SVG в разметке, ничего не грузится
 * по сети и не ломается при офлайне.
 */

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const PATHS: Record<string, React.ReactNode> = {
  /* ——— PvP ——— */
  "crossed-swords": (
    <>
      <path {...S} d="M4 4l10 10M20 4L10 14" />
      <path {...S} d="M3 17l3 3M18 17l3 3M6 20l-2 1 1-2M18 20l2 1-1-2" />
    </>
  ),
  "blood-blade": (
    <>
      <path {...S} d="M12 3l3 6-3 9-3-9z" />
      <path {...S} d="M9 19h6M12 19v2" />
      <circle {...S} cx="17" cy="16" r="1.6" />
    </>
  ),
  "honor-medal": (
    <>
      <circle {...S} cx="12" cy="14" r="5" />
      <path {...S} d="M9 3l2 5M15 3l-2 5" />
      <path {...S} d="M12 12l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" />
    </>
  ),
  "victory-banner": (
    <>
      <path {...S} d="M6 3v18" />
      <path {...S} d="M6 4h12l-3 4 3 4H6z" />
      <path {...S} d="M10 7h4" />
    </>
  ),
  brotherhood: (
    <>
      <path {...S} d="M8 4l4 1.5V11c0 2-1.7 3.4-4 4.5-2.3-1.1-4-2.5-4-4.5V5.5z" />
      <path {...S} d="M16 8l4 1.5V15c0 2-1.7 3.4-4 4.5-2.3-1.1-4-2.5-4-4.5V9.5z" />
    </>
  ),
  "tower-shield": (
    <>
      <path {...S} d="M12 3l7 2.5V13c0 4-3 6.6-7 8-4-1.4-7-4-7-8V5.5z" />
      <path {...S} d="M12 7v9M9 11h6" />
    </>
  ),

  /* ——— Рейдовые боссы ——— */
  kraken: (
    <>
      <path {...S} d="M12 4a4 4 0 014 4c0 2-1 3-1 4H9c0-1-1-2-1-4a4 4 0 014-4z" />
      <path {...S} d="M9 13c-1 3-3 4-5 4M11 13c-1 4-1 6-3 7M13 13c1 4 1 6 3 7M15 13c1 3 3 4 5 4" />
    </>
  ),
  leviathan: (
    <>
      <path {...S} d="M3 15c2-3 4 1 6-1s2-6 5-6 5 3 5 6" />
      <path {...S} d="M19 14c0 3-2 5-5 5s-4-1-5-2" />
      <circle {...S} cx="16" cy="9" r="0.8" />
    </>
  ),
  calidis: (
    <>
      <path {...S} d="M6 4l2 4M18 4l-2 4" />
      <path {...S} d="M12 7c3.3 0 6 2.5 6 5.5S15.3 19 12 19s-6-2.5-6-6.5S8.7 7 12 7z" />
      <path {...S} d="M10 12h.01M14 12h.01M9.5 16c1.5 1 3.5 1 5 0" />
    </>
  ),
  xanatos: (
    <>
      <path {...S} d="M4 12l5-3 2-4 3 3 6 1-3 4 2 5-6-1-4 3-1-5z" />
      <circle {...S} cx="13" cy="11" r="1" />
    </>
  ),
  "titan-skull": (
    <>
      <path {...S} d="M12 3c4 0 7 3 7 7 0 2.5-1.2 3.7-2 4.6V18H7v-3.4C6.2 13.7 5 12.5 5 10c0-4 3-7 7-7z" />
      <circle {...S} cx="9.5" cy="10" r="1.4" />
      <circle {...S} cx="14.5" cy="10" r="1.4" />
      <path {...S} d="M10 21v-3M14 21v-3" />
    </>
  ),
  "mini-boss": (
    <>
      <path {...S} d="M7 6l1.5 3M17 6l-1.5 3" />
      <circle {...S} cx="12" cy="14" r="5" />
      <path {...S} d="M10 13h.01M14 13h.01M10 17h4" />
    </>
  ),

  /* ——— Активность ——— */
  formation: (
    <>
      <path {...S} d="M5 7h14M5 12h14M5 17h14" />
      <circle {...S} cx="8" cy="7" r="1" />
      <circle {...S} cx="12" cy="12" r="1" />
      <circle {...S} cx="16" cy="17" r="1" />
    </>
  ),
  "small-squad": (
    <>
      <circle {...S} cx="8" cy="8" r="2.2" />
      <circle {...S} cx="16" cy="8" r="2.2" />
      <path {...S} d="M4 19c0-2.4 1.8-4 4-4s4 1.6 4 4M12 19c0-2.4 1.8-4 4-4s4 1.6 4 4" />
    </>
  ),
  "guild-life": (
    <>
      <path {...S} d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
      <path {...S} d="M12 8v7M8.5 11.5h7" />
    </>
  ),
  "calendar-days": (
    <>
      <rect {...S} x="4" y="6" width="16" height="14" rx="2" />
      <path {...S} d="M4 10h16M9 4v4M15 4v4" />
      <path {...S} d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
    </>
  ),
  "hourglass-full": (
    <>
      <path {...S} d="M7 3h10M7 21h10" />
      <path {...S} d="M8 3c0 4 4 5 4 9s-4 5-4 9M16 3c0 4-4 5-4 9s4 5 4 9" />
    </>
  ),

  /* ——— Помощь гильдии ——— */
  "war-horn": (
    <>
      <path {...S} d="M4 14c0-4 4-7 9-7l7-3v10l-7-3c-5 0-9 3-9 3z" />
      <path {...S} d="M7 15v3a2 2 0 004 0v-2" />
    </>
  ),
  galleon: (
    <>
      <path {...S} d="M3 17h18l-2 3H5z" />
      <path {...S} d="M12 3v11" />
      <path {...S} d="M12 5l6 3-6 2zM12 5L6 8l6 2z" />
    </>
  ),
  commander: (
    <>
      <path {...S} d="M6 12a6 6 0 0112 0v3H6z" />
      <path {...S} d="M12 6c0-2 1-3 3-3" />
      <path {...S} d="M7 18h10M9 15v3M15 15v3" />
    </>
  ),
  mentor: (
    <>
      <path {...S} d="M4 5h6a2 2 0 012 2v12a2 2 0 00-2-2H4z" />
      <path {...S} d="M20 5h-6a2 2 0 00-2 2v12a2 2 0 012-2h6z" />
    </>
  ),
  "helping-hand": (
    <>
      <path {...S} d="M8 13V6.5a1.5 1.5 0 013 0V12" />
      <path {...S} d="M11 11.5a1.5 1.5 0 013 0V13M14 12.5a1.5 1.5 0 013 0V16c0 3-2 5-5 5s-5-2-5-5v-3l-2 1" />
    </>
  ),

  /* ——— Золото ——— */
  "coin-pile": (
    <>
      <ellipse {...S} cx="12" cy="7" rx="6" ry="2.5" />
      <path {...S} d="M6 7v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7" />
      <path {...S} d="M6 11v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4" />
    </>
  ),
  "coin-prime": (
    <>
      <circle {...S} cx="12" cy="12" r="7" />
      <path {...S} d="M12 8l1.4 2.8 3.1.5-2.2 2.2.5 3.1-2.8-1.5-2.8 1.5.5-3.1-2.2-2.2 3.1-.5z" />
    </>
  ),
  "coin-mini": (
    <>
      <circle {...S} cx="9" cy="10" r="4" />
      <circle {...S} cx="15" cy="15" r="4" />
      <path {...S} d="M9 8.5v3M15 13.5v3" />
    </>
  ),
  "donation-chest": (
    <>
      <rect {...S} x="4" y="10" width="16" height="9" rx="1.5" />
      <path {...S} d="M4 13h16M12 10V6M9 8l3-3 3 3" />
      <circle {...S} cx="12" cy="15" r="1.2" />
    </>
  ),
  "reward-purse": (
    <>
      <path {...S} d="M8 8h8l2 5c0 4-2 6-6 6s-6-2-6-6z" />
      <path {...S} d="M9 8V6a3 3 0 016 0v2" />
      <path {...S} d="M12 12v4M10.5 13.5h3" />
    </>
  ),

  /* ——— Стаж ——— */
  "banner-loyalty": (
    <>
      <path {...S} d="M6 3v18" />
      <path {...S} d="M6 4h13v11H6z" />
      <path {...S} d="M12.5 7l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" />
    </>
  ),
  "veteran-prime": (
    <>
      <path {...S} d="M7 5c-2 3-2 9 0 13M17 5c2 3 2 9 0 13" />
      <path {...S} d="M12 8v8" />
    </>
  ),
  "veteran-mini": (
    <>
      <path {...S} d="M7 6c-2 3-2 8 0 12M17 6c2 3 2 8 0 12" />
      <path {...S} d="M10 10v4M14 10v4" />
    </>
  ),
};

export const ICON_KEYS = Object.keys(PATHS);

export default function AchievementIcon({
  name,
  size = 34,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const body = PATHS[name];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {body ?? <circle {...S} cx="12" cy="12" r="7" />}
    </svg>
  );
}
