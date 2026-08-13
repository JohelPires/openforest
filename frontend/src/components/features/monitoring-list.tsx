import type { MonitoringRead } from "@/lib/api";
import { ChevronRight } from "lucide-react";
import { PhotoThumb } from "@/components/features/photo-thumb";

const MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function fullDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function shortLabel(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return `${MONTHS[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`;
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export interface MonitoringPhoto {
  id: string;
  label: string;
  tone: number;
}

export interface MonitoringListItem extends MonitoringRead {
  author?: string | null;
  photos?: MonitoringPhoto[] | null;
}

function mockPhotos(item: MonitoringListItem): MonitoringPhoto[] {
  const seed = hashCode(item.id);
  const tone = seed % 4;
  const label = shortLabel(item.visit_date);
  const count = (seed % 2) + 1;
  return Array.from({ length: count }, (_, index) => ({
    id: `${item.id}::thumb-${index}`,
    label,
    tone: tone + index,
  }));
}

interface MonitoringListProps {
  items: MonitoringListItem[];
  onSelect?: (item: MonitoringListItem) => void;
}

export function MonitoringList({ items, onSelect }: MonitoringListProps) {
  if (items.length === 0) return null;

  return (
    <ul className="space-y-6">
      {items.map((monitoring) => {
        const photos =
          monitoring.photos !== undefined && monitoring.photos !== null
            ? monitoring.photos
            : mockPhotos(monitoring);

        const inner = (
          <>
            <div className="flex gap-2 sm:flex-col">
              {photos.length > 0 ? (
                photos.slice(0, 2).map((photo) => (
                  <PhotoThumb
                    key={photo.id}
                    tone={photo.tone}
                    label={photo.label}
                    className="h-14 w-14 shrink-0 sm:h-16 sm:w-16"
                  />
                ))
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-forest/20 font-mono text-[9px] uppercase tracking-wide text-moss/50">
                  sem foto
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-gold">
                  {fullDate(monitoring.visit_date)}
                </span>
                {monitoring.author ? (
                  <span className="text-xs text-moss/70">
                    · {monitoring.author}
                  </span>
                ) : null}
              </div>
              {monitoring.notes ? (
                <p className="mt-1.5 text-sm leading-relaxed text-moss">
                  {monitoring.notes}
                </p>
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
              {onSelect ? (
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-moss transition-colors group-hover:text-forest">
                  Ver detalhes
                  <ChevronRight
                    className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              ) : null}
            </div>
          </>
        );

        if (!onSelect) {
          return (
            <li
              key={monitoring.id}
              className="grid gap-3 sm:grid-cols-[auto_1fr] sm:gap-5"
            >
              {inner}
            </li>
          );
        }

        return (
          <li key={monitoring.id}>
            <button
              type="button"
              onClick={() => onSelect(monitoring)}
              aria-haspopup="dialog"
              className="group grid w-full gap-3 rounded-2xl border border-transparent p-1 text-left transition-colors hover:border-forest/10 hover:bg-forest/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist sm:grid-cols-[auto_1fr] sm:gap-5"
            >
              {inner}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
