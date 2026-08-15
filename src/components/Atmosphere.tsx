export default function Atmosphere() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 900px 700px at -5% 0%, var(--violet) 0%, transparent 60%)," +
            "radial-gradient(ellipse 800px 600px at 105% 100%, var(--ember) 0%, transparent 55%)",
          opacity: "calc(var(--atmosphere-opacity) * 1.4)",
        }}
      />
      <div
        className="absolute right-0 top-0 hidden h-full w-[38vw] max-w-2xl bg-cover bg-[position:80%_20%] lg:block"
        style={{
          backgroundImage: "url(/images/atmosphere.png)",
          opacity: "var(--atmosphere-opacity)",
          filter: "blur(18px) saturate(1.1)",
          maskImage: "linear-gradient(to left, black 30%, transparent 95%)",
          WebkitMaskImage: "linear-gradient(to left, black 30%, transparent 95%)",
        }}
      />
      <div className="absolute inset-0" style={{ background: "var(--background)", opacity: 0.35 }} />
    </div>
  );
}
