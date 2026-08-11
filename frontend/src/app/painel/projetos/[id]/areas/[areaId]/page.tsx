"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  RefreshCw,
  Ruler,
} from "lucide-react";
import { apiFetch, getArea, listAreaMonitorings, type ProjectRead } from "@/lib/api";
import { STATUS_BADGE, STATUS_LABEL } from "@/lib/status";
import { useBreadcrumb } from "@/components/features/painel-breadcrumb";
import { MonitoringList } from "@/components/features/monitoring-list";
import { SatelliteView } from "@/components/features/satellite-view";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

interface PaginationControlsProps {
  total: number;
  offset: number;
  pageSize: number;
  onOffsetChange: (offset: number) => void;
}

function PaginationControls({
  total,
  offset,
  pageSize,
  onOffsetChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.floor(offset / pageSize) + 1;
  const canPrev = offset > 0;
  const canNext = offset + pageSize < total;

  return (
    <nav
      aria-label="Paginação de monitoramentos"
      className="mt-8 flex items-center justify-between gap-3"
    >
      <button
        type="button"
        onClick={() => onOffsetChange(Math.max(0, offset - pageSize))}
        disabled={!canPrev}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest/15 bg-cream px-4 text-sm font-medium text-forest transition-colors hover:border-forest/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Anterior
      </button>
      <span className="font-mono text-xs text-moss">
        Página {page} de {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onOffsetChange(offset + pageSize)}
        disabled={!canNext}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest/15 bg-cream px-4 text-sm font-medium text-forest transition-colors hover:border-forest/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist disabled:cursor-not-allowed disabled:opacity-40"
      >
        Próxima
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}

export default function AreaDetailPage() {
  const params = useParams<{ id: string; areaId: string }>();
  const [offset, setOffset] = useState(0);

  const areaQuery = useQuery({
    queryKey: ["area", params.areaId],
    queryFn: () => getArea(params.areaId),
  });

  const projectQuery = useQuery({
    queryKey: ["project", params.id],
    queryFn: () => apiFetch<ProjectRead>(`/projects/${params.id}`, { auth: true }),
  });

  const monitoringsQuery = useQuery({
    queryKey: ["area-monitorings", params.areaId, offset],
    queryFn: () => listAreaMonitorings(params.areaId, offset, PAGE_SIZE),
  });

  const area = areaQuery.data;

  useBreadcrumb(
    area
      ? ["Projetos", projectQuery.data?.name ?? "Projeto", area.name]
      : ["Projetos", "Área"],
  );

  if (areaQuery.isPending) {
    return (
      <div role="status" aria-label="Carregando área" className="max-w-6xl space-y-4">
        <div className="h-4 w-24 animate-pulse rounded-full bg-forest/10" />
        <div className="h-8 w-1/2 animate-pulse rounded-md bg-forest/10" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-forest/8" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-forest/8" />
      </div>
    );
  }

  if (areaQuery.isError || !area) {
    return (
      <div
        role="alert"
        className="max-w-6xl rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-12 text-center"
      >
        <h1 className="font-heading text-xl tracking-tight text-forest">
          Não foi possível carregar a área
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-moss">
          Verifique sua conexão e tente novamente.
        </p>
        <button
          type="button"
          onClick={() => areaQuery.refetch()}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const startLabel = formatDate(area.created_at);
  const total = monitoringsQuery.data?.total;

  return (
    <div className="max-w-6xl space-y-8">
      <Link
        href={`/painel/projetos/${area.project_id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-moss transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar para o projeto
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Área
          </p>
          <h1 className="font-heading mt-3 text-3xl leading-[1.05] tracking-tight text-forest sm:text-4xl">
            {area.name}
          </h1>
        </div>
        <span
          className={cn(
            "inline-block rounded-full border px-2.5 py-1 text-[11px] font-medium",
            STATUS_BADGE[area.restoration_status],
          )}
        >
          {STATUS_LABEL[area.restoration_status]}
        </span>
      </header>

      <SatelliteView area={area} />

      {area.goal ? (
        <section className="max-w-6xl rounded-2xl border border-forest/10 bg-cream p-6 shadow-sm shadow-forest/5 sm:p-8">
          <h2 className="font-heading text-xl tracking-tight text-forest">Objetivo</h2>
          <p className="mt-2 text-sm leading-relaxed text-moss">{area.goal}</p>
        </section>
      ) : null}

      <dl className="grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2">
        {startLabel ? (
          <div className="rounded-2xl border border-forest/10 bg-cream px-5 py-4 shadow-sm shadow-forest/5">
            <dt className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              Início
            </dt>
            <dd className="mt-2 text-sm font-medium text-forest">{startLabel}</dd>
          </div>
        ) : null}
        {area.biome ? (
          <div className="rounded-2xl border border-forest/10 bg-cream px-5 py-4 shadow-sm shadow-forest/5">
            <dt className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Bioma
            </dt>
            <dd className="mt-2 text-sm font-medium text-forest">{area.biome}</dd>
          </div>
        ) : null}
        {area.size_hectares != null ? (
          <div className="rounded-2xl border border-forest/10 bg-cream px-5 py-4 shadow-sm shadow-forest/5">
            <dt className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
              <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
              Tamanho
            </dt>
            <dd className="mt-2 text-sm font-medium text-forest">
              {area.size_hectares.toLocaleString("pt-BR")} ha
            </dd>
          </div>
        ) : null}
      </dl>

      <section aria-labelledby="monitorings-title" className="scroll-mt-24">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Campo
          </p>
          <h2
            id="monitorings-title"
            className="font-heading mt-3 text-2xl leading-[1.1] tracking-tight text-forest sm:text-3xl"
          >
            Monitoramentos
          </h2>
          {total != null ? (
            <p className="mt-3 text-sm leading-relaxed text-moss">
              {total} visita{total === 1 ? "" : "s"} registrada{total === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        <div className="mt-6">
          {monitoringsQuery.isPending ? (
            <div
              role="status"
              aria-label="Carregando monitoramentos"
              className="space-y-4"
            >
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-forest/5" />
              ))}
            </div>
          ) : monitoringsQuery.isError ? (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center"
            >
              <p className="font-heading text-lg tracking-tight text-forest">
                Não foi possível carregar os monitoramentos
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-moss">
                Verifique sua conexão e tente novamente.
              </p>
              <button
                type="button"
                onClick={() => monitoringsQuery.refetch()}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Tentar novamente
              </button>
            </div>
          ) : monitoringsQuery.data.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-forest/20 bg-cream/60 px-6 py-10 text-center">
              <h3 className="font-heading mt-5 text-xl tracking-tight text-forest">
                Nenhuma visita registrada
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-moss">
                As visitas de campo desta área aparecem aqui, ordenadas da mais
                recente para a mais antiga.
              </p>
            </div>
          ) : (
            <>
              <MonitoringList items={monitoringsQuery.data.items} />
              <PaginationControls
                total={monitoringsQuery.data.total}
                offset={offset}
                pageSize={PAGE_SIZE}
                onOffsetChange={setOffset}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
