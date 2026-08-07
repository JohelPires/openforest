"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  STATUS_LABEL,
  type Area,
  type Monitoring,
  type RestorationStatus,
} from "@/lib/mock-data";
import { Reveal } from "@/components/reveal";
import { HorizonLine } from "@/components/features/horizon-line";
import { PhotoThumb } from "@/components/features/photo-thumb";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;

function toMs(date: string): number {
  return new Date(`${date}T12:00:00`).getTime();
}

function currentMs(): number {
  return Date.now();
}

const MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function shortDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return `${MONTHS[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`;
}

function fullDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const STATUS_DOT: Record<RestorationStatus, string> = {
  plantio_recente: "border-gold bg-gold",
  em_restauracao: "border-moss bg-moss",
  recuperada: "border-forest bg-forest",
};

const STATUS_BADGE: Record<RestorationStatus, string> = {
  plantio_recente: "border-gold/30 bg-gold/15 text-forest",
  em_restauracao: "border-forest/15 bg-sage/35 text-forest",
  recuperada: "border-forest/20 bg-forest/10 text-forest",
};

function MonitoringList({ area }: { area: Area }) {
  return (
    <ul className="space-y-6">
      {area.monitorings.map((monitoring) => (
        <li key={monitoring.id} className="grid gap-3 sm:grid-cols-[auto_1fr] sm:gap-5">
          <div className="flex gap-2 sm:flex-col">
            {monitoring.photos.length > 0 ? (
              monitoring.photos.slice(0, 2).map((photo) => (
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
          <div>
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-gold">
                {fullDate(monitoring.date)}
              </span>
              <span className="text-xs text-moss/70">· {monitoring.author}</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-moss">
              {monitoring.notes}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="font-mono text-xs text-forest">
                {monitoring.seedling_count.toLocaleString("pt-BR")} mudas
              </span>
              <span className="font-mono text-xs text-forest">
                {monitoring.avg_height.toLocaleString("pt-BR")} m médios
              </span>
              {monitoring.species.map((species) => (
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

interface BandProps {
  area: Area;
  expanded: boolean;
  onToggle: () => void;
  yearMarks: { year: number; left: number }[];
  pct: (ms: number) => number;
}

function Band({ area, expanded, onToggle, yearMarks, pct }: BandProps) {
  return (
    <section className="rounded-2xl border border-forest/10 bg-cream p-6 shadow-sm shadow-forest/5 sm:p-8">
      <div className="md:grid md:grid-cols-[240px_1fr] md:gap-8">
        <div className="md:pr-2">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
            {area.biome}
          </p>
          <h3 className="font-heading mt-1.5 text-2xl leading-tight tracking-tight text-forest">
            {area.name}
          </h3>
          <span
            className={cn(
              "mt-3 inline-block rounded-full border px-2.5 py-1 text-[11px] font-medium",
              STATUS_BADGE[area.restoration_status]
            )}
          >
            {STATUS_LABEL[area.restoration_status]}
          </span>
          <ul className="mt-4 space-y-1 font-mono text-xs text-moss/85">
            <li>
              {area.size_hectares} ha ·{" "}
              {area.seedlings.toLocaleString("pt-BR")} mudas
            </li>
            <li>{area.survival_rate}% de sobrevivência</li>
            <li>desde {new Date(`${area.started_at}T12:00:00`).getFullYear()}</li>
          </ul>
        </div>

        <div className="mt-7 md:mt-0">
          <div className="relative h-16">
            {yearMarks.filter((mark) => mark.left > 0.5 && mark.left < 99.5).map(
              (mark) => (
                <span
                  key={mark.year}
                  aria-hidden="true"
                  className="absolute top-0 h-full w-px border-l border-dashed border-forest/10"
                  style={{ left: `${mark.left}%` }}
                />
              )
            )}
            <span
              aria-hidden="true"
              className="absolute left-0 right-0 top-1/2 h-px bg-forest/15"
            />
            <span
              aria-hidden="true"
              className="absolute top-0 h-full border-l border-dashed border-gold/50"
              style={{ left: "100%" }}
            />

            {area.monitorings.map((monitoring, index) => (
              <button
                key={monitoring.id}
                type="button"
                onClick={onToggle}
                aria-label={`${area.name}, visita de ${fullDate(monitoring.date)}. ${
                  expanded ? "Recolher detalhes." : "Ver detalhes."
                }`}
                className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                style={{ left: `${pct(toMs(monitoring.date))}%` }}
              >
                <span
                  className={cn(
                    "block rounded-full border-2 shadow-sm transition-transform duration-200 group-hover:scale-125",
                    STATUS_DOT[area.restoration_status],
                    index === area.monitorings.length - 1
                      ? "h-4 w-4 border-cream ring-2 ring-forest/20"
                      : "h-3 w-3 border-cream"
                  )}
                />
                <span className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.1em] text-moss/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                  {shortDate(monitoring.date)}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-moss transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-300",
                expanded && "rotate-180"
              )}
              aria-hidden="true"
            />
            {expanded
              ? "Recolher"
              : `${area.monitorings.length} visita${
                  area.monitorings.length === 1 ? "" : "s"
                } registrada${area.monitorings.length === 1 ? "" : "s"}`}
          </button>

          <div
            className={cn(
              "grid transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="overflow-hidden">
              <div className="mt-5 border-t border-forest/10 pt-5">
                <blockquote className="mb-6 border-l-2 border-gold/50 pl-3 text-sm leading-relaxed text-moss/80">
                  Objetivo: {area.goal}
                </blockquote>
                <MonitoringList area={area} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface AreaTimelineProps {
  areas: Area[];
  eyebrow?: string;
  title?: string;
  description?: string;
  className?: string;
}

export function AreaTimeline({
  areas,
  eyebrow = "Perfil de monitoramento",
  title = "Suas áreas, ao longo do tempo",
  description = "Cada faixa é uma área. Os pontos são visitas de monitoramento plotadas na mesma régua de tempo — veja o ritmo da recuperação lado a lado.",
  className,
}: AreaTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const time = useMemo(() => {
    if (areas.length === 0) return null;
    const nowMs = currentMs();
    const startMs = Math.min(...areas.map((area) => toMs(area.started_at)));
    const spanMs = Math.max(nowMs - startMs, DAY_MS);
    const pct = (ms: number): number => {
      const value = Math.min(100, Math.max(0, ((ms - startMs) / spanMs) * 100));
      return Number(value.toFixed(3));
    };
    const yearMarks: { year: number; left: number }[] = [];
    for (
      let year = new Date(startMs).getFullYear();
      year <= new Date(nowMs).getFullYear();
      year++
    ) {
      yearMarks.push({ year, left: pct(new Date(year, 0, 1).getTime()) });
    }
    return { startMs, nowMs, pct, yearMarks };
  }, [areas]);

  function toggleArea(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  if (!time) return null;

  const latestMonitoring = areas.reduce<Monitoring | null>((latest, area) => {
    const areaLatest = area.monitorings[area.monitorings.length - 1];
    if (!areaLatest) return latest;
    if (!latest) return areaLatest;
    return toMs(areaLatest.date) > toMs(latest.date) ? areaLatest : latest;
  }, null);

  return (
    <section
      aria-labelledby="strata-title"
      className={cn("scroll-mt-24", className)}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
            {eyebrow}
          </p>
          <h2
            id="strata-title"
            className="font-heading mt-3 text-2xl leading-[1.1] tracking-tight text-forest sm:text-3xl"
          >
            {title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-moss">
            {description}
          </p>
        </div>

        <ul
          aria-label="Legenda de status"
          className="flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          {(
            [
              ["plantio_recente", "Plantio recente"],
              ["em_restauracao", "Em restauração"],
              ["recuperada", "Recuperada"],
            ] as [RestorationStatus, string][]
          ).map(([status, label]) => (
            <li key={status} className="flex items-center gap-1.5 text-xs text-moss/80">
              <span
                aria-hidden="true"
                className={cn(
                  "inline-block h-2.5 w-2.5 rounded-full border-2 border-cream shadow-sm",
                  STATUS_DOT[status]
                )}
              />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 hidden md:grid md:grid-cols-[240px_1fr] md:gap-8">
        <div />
        <div className="relative h-5">
          {time.yearMarks.filter((mark) => mark.left > 2 && mark.left < 98).map(
            (mark) => (
              <div
                key={mark.year}
                className="absolute top-0 -translate-x-1/2"
                style={{ left: `${mark.left}%` }}
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-moss/50">
                  {mark.year}
                </span>
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-full h-1.5 w-px -translate-x-1/2 bg-forest/20"
                />
              </div>
            )
          )}
          <span className="absolute right-0 top-0 font-mono text-[9px] uppercase tracking-[0.14em] text-gold">
            hoje
          </span>
        </div>
      </div>

      <div className="mt-2 space-y-8">
        {areas.map((area, index) => (
          <Reveal key={area.id} delay={index * 80}>
            <div className="space-y-1.5">
              <Band
                area={area}
                expanded={expandedId === area.id}
                onToggle={() => toggleArea(area.id)}
                yearMarks={time.yearMarks}
                pct={time.pct}
              />
              {index < areas.length - 1 ? (
                <HorizonLine className="mx-1" />
              ) : null}
            </div>
          </Reveal>
        ))}
      </div>

      {latestMonitoring ? (
        <p className="mt-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-moss/50">
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-gold" />
          Última atividade registrada em {fullDate(latestMonitoring.date)}
        </p>
      ) : null}
    </section>
  );
}
