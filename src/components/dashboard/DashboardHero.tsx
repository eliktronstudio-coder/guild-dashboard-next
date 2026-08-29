import Image from "next/image";

/** Photographic hero band behind the dashboard header and KPI row. */
export default function DashboardHero() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -inset-x-4 -top-6 -z-10 h-[280px] overflow-hidden sm:-inset-x-6">
      <Image
        src="/dashboard/hero-banner.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-40"
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(var(--art-scrim),0) 0%, rgba(var(--art-scrim),0.15) 30%, rgba(var(--art-scrim),0.6) 60%, var(--background) 100%)",
        }}
      />
    </div>
  );
}
