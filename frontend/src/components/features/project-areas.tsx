import { Map } from "lucide-react";
import { AreaTimeline } from "@/components/features/area-timeline";
import { projectAreas } from "@/lib/mock-data";

interface ProjectAreasProps {
  projectId: string;
}

export function ProjectAreas({ projectId }: ProjectAreasProps) {
  const areas = projectAreas(projectId);

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
