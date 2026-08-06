import { DASHBOARD_STATS } from "@/lib/mock-data";

export function StatRow() {
  return (
    <section
      aria-label="Indicadores"
      className="grid grid-cols-2 overflow-hidden rounded-2xl border border-forest/10 bg-cream shadow-sm shadow-forest/5 md:grid-cols-5"
    >
      {DASHBOARD_STATS.map((stat, index) => (
        <div
          key={stat.label}
          className={`flex flex-col px-5 py-6 ${
            index > 0 ? "border-l border-forest/10" : ""
          } ${index >= 2 ? "border-t border-forest/10 md:border-t-0" : ""}`}
        >
          <p className="font-heading text-3xl leading-none tracking-tight text-forest sm:text-4xl">
            {stat.value.toLocaleString("pt-BR")}
            {stat.suffix ? (
              <span className="font-heading ml-1 text-xl text-moss/70 sm:text-2xl">
                {stat.suffix}
              </span>
            ) : null}
          </p>
          <p className="mt-2.5 text-xs leading-snug text-moss/80">{stat.label}</p>
        </div>
      ))}
    </section>
  );
}
