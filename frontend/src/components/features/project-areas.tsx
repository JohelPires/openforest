"use client";

import { useQuery } from "@tanstack/react-query";
import { Map } from "lucide-react";
import { AreaTimeline } from "@/components/features/area-timeline";
import { projectAreas, type AreaRead } from "@/lib/api";
import type { Area } from "@/lib/mock-data";

interface ProjectAreasProps {
  projectId: string;
}

function toTimelineArea(area: AreaRead): Area {
  return {
    id: area.id,
    project_id: area.project_id,
    name: area.name,
    biome: area.biome,
    size_hectares: area.size_hectares,
    restoration_status: area.restoration_status,
    coordinates: area.coordinates,
    goal: null,
    started_at: area.created_at.slice(0, 10),
    seedlings: 0,
    survival_rate: 0,
    monitorings: [],
    created_at: area.created_at,
    updated_at: area.updated_at,
  };
}

export function ProjectAreas({ projectId }: ProjectAreasProps) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["areas", projectId],
    queryFn: () => projectAreas(projectId),
  });

  if (isPending) {
    return (
      <div
        role="status"
        aria-label="Carregando áreas"
        className="space-y-4"
      >
        <div className="h-8 w-40 animate-pulse rounded-md bg-forest/10" />
        <div className="h-40 animate-pulse rounded-2xl bg-forest/5" />
      </div>
    );
  }

  if (isError) {
    return (
      <section
        role="alert"
        className="rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center"
      >
        <p className="font-heading text-lg tracking-tight text-forest">
          Não foi possível carregar as áreas do projeto
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-moss">
          Verifique sua conexão e tente novamente.
        </p>
      </section>
    );
  }

  const areas = (data ?? []).map(toTimelineArea);

  if (areas.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-forest/20 bg-cream/60 px-6 py-10 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-forest/8 text-forest">
          <Map className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="font-heading mt-5 text-xl tracking-tight text-forest">
          As áreas deste projeto aparecem aqui
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-moss">
          Cadastre as áreas de restauração do projeto e elas entram na régua de
          monitoramento, com as visitas de campo ao longo do tempo.
        </p>
      </section>
    );
  }

  return (
    <AreaTimeline
      areas={areas}
      eyebrow="Restauração"
      title="Áreas do projeto"
      description="Cada faixa é uma área deste projeto. Os pontos são visitas de monitoramento plotadas na mesma régua de tempo."
    />
  );
}
