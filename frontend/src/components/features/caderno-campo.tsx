import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AREAS } from "@/lib/mock-data";
import { PhotoThumb } from "@/components/features/photo-thumb";

const MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function fullDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const RECENT = AREAS.flatMap((area) =>
  area.monitorings.map((monitoring) => ({ ...monitoring, areaName: area.name }))
)
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  .slice(0, 5);

export function CadernoCampo() {
  return (
    <section aria-labelledby="caderno-title" className="scroll-mt-24">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Caderno de campo
          </p>
          <h2
            id="caderno-title"
            className="font-heading mt-3 text-2xl leading-[1.1] tracking-tight text-forest sm:text-3xl"
          >
            Anotações recentes
          </h2>
        </div>
        <Link
          href="/painel/monitoramentos"
          className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-moss transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
        >
          Ver todas
          <ArrowRight
            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>

      <div className="mt-7 divide-y divide-forest/10 rounded-2xl border border-forest/10 bg-cream shadow-sm shadow-forest/5">
        {RECENT.map((entry) => (
          <article key={entry.id} className="flex flex-col gap-3 px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-gold">
                  {fullDate(entry.date)}
                </span>
                <span className="text-xs text-moss/70">
                  {entry.areaName} · {entry.author}
                </span>
              </div>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-moss/50 sm:inline">
                {MONTHS[new Date(`${entry.date}T12:00:00`).getMonth()]}/
                {String(new Date(`${entry.date}T12:00:00`).getFullYear()).slice(2)}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm leading-relaxed text-moss">{entry.notes}</p>
              {entry.photos.length > 0 ? (
                <div className="flex shrink-0 gap-1.5">
                  {entry.photos.slice(0, 2).map((photo) => (
                    <PhotoThumb
                      key={photo.id}
                      tone={photo.tone}
                      label={photo.label}
                      className="h-12 w-12"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
