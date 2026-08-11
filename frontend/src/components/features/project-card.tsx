import Link from "next/link";
import { ArrowUpRight, CalendarDays, User } from "lucide-react";
import type { ProjectRead } from "@/lib/api";

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface ProjectCardProps {
  project: ProjectRead;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const dateLabel = formatDate(project.start_date);
  const excerpt = project.goal ?? project.description;

  return (
    <Link
      href={`/painel/projetos/${project.id}`}
      className="group flex h-full flex-col rounded-2xl border border-forest/10 bg-cream p-6 shadow-sm shadow-forest/5 transition-all duration-300 hover:-translate-y-0.5 hover:border-forest/25 hover:shadow-md hover:shadow-forest/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
    >
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
        Projeto
      </p>

      <div className="mt-4 flex items-start justify-between gap-3">
        <h3 className="font-heading text-2xl leading-tight tracking-tight text-forest">
          {project.name}
        </h3>
        <ArrowUpRight
          className="mt-1 h-4 w-4 shrink-0 text-moss/50 transition-colors duration-300 group-hover:text-forest"
          aria-hidden="true"
        />
      </div>

      {excerpt ? (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-moss">
          {excerpt}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-6 text-xs text-moss/80">
        {dateLabel ? (
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {dateLabel}
          </span>
        ) : null}
        {project.responsible ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
            <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{project.responsible}</span>
          </span>
        ) : null}
      </div>
    </Link>
  );
}
