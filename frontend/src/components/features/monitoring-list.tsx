import type { MonitoringRead } from "@/lib/api";

function fullDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

interface MonitoringListProps {
  items: MonitoringRead[];
}

export function MonitoringList({ items }: MonitoringListProps) {
  if (items.length === 0) return null;

  return (
    <ul className="space-y-6">
      {items.map((monitoring) => (
        <li
          key={monitoring.id}
          className="grid gap-2 sm:grid-cols-[auto_1fr] sm:gap-5"
        >
          <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-gold">
            {fullDate(monitoring.visit_date)}
          </span>
          <div>
            {monitoring.notes ? (
              <p className="text-sm leading-relaxed text-moss">{monitoring.notes}</p>
            ) : null}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {monitoring.seedling_count != null ? (
                <span className="font-mono text-xs text-forest">
                  {monitoring.seedling_count.toLocaleString("pt-BR")} mudas
                </span>
              ) : null}
              {monitoring.avg_height != null ? (
                <span className="font-mono text-xs text-forest">
                  {monitoring.avg_height.toLocaleString("pt-BR")} m médios
                </span>
              ) : null}
              {Object.keys(monitoring.species_data ?? {}).map((species) => (
                <span
                  key={species}
                  className="rounded-full border border-forest/10 bg-forest/5 px-2 py-0.5 text-[11px] text-forest"
                >
                  {species}
                </span>
              ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
