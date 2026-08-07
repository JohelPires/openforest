"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useUser } from "@/components/features/user-provider";
import { ProjectCard } from "@/components/features/project-card";
import {
  NewProjectDialog,
  type NewProjectInput,
} from "@/components/features/new-project-dialog";
import { createProject, listProjects } from "@/lib/api";
import type { UserRole } from "@/lib/api";

const CAN_CREATE_ROLES: UserRole[] = ["admin", "manager"];

export function ProjectsSection() {
  const queryClient = useQueryClient();
  const { organization, loading: userLoading } = useUser();

  const orgId = organization?.id;
  const canCreate = Boolean(
    orgId && organization?.role && CAN_CREATE_ROLES.includes(organization.role),
  );
  const queryKey = ["projects", orgId ?? "all"] as const;

  const { data, isPending, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => listProjects(orgId),
    enabled: !userLoading,
  });

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  if (userLoading || isPending) {
    return <ProjectSkeletons />;
  }

  if (isError) {
    return <ProjectError onRetry={() => refetch()} />;
  }

  const projects = data?.items ?? [];
  const empty = projects.length === 0;

  return (
    <section aria-label="Lista de projetos" className="space-y-6">
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {canCreate ? (
          <li>
            <NewProjectDialog
              onCreate={async (input: NewProjectInput) => {
                await mutation.mutateAsync({
                  organization_id: organization!.id,
                  ...input,
                });
              }}
            />
          </li>
        ) : null}
        {projects.map((project) => (
          <li key={project.id}>
            <ProjectCard project={project} />
          </li>
        ))}
      </ul>

      {empty ? (
        <p className="mx-auto max-w-md text-center text-sm leading-relaxed text-moss/80">
          {canCreate
            ? "Seu primeiro projeto ainda não existe — comece criando uma restauração."
            : "Nenhum projeto cadastrado na sua organização até o momento."}
        </p>
      ) : null}
    </section>
  );
}

function ProjectSkeletons() {
  return (
    <div
      role="status"
      aria-label="Carregando projetos"
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col rounded-2xl border border-forest/10 bg-cream p-6 shadow-sm shadow-forest/5"
        >
          <span className="h-3 w-16 animate-pulse rounded-full bg-forest/10" />
          <span className="mt-4 h-6 w-3/4 animate-pulse rounded-md bg-forest/10" />
          <span className="mt-3 h-3 w-full animate-pulse rounded-full bg-forest/8" />
          <span className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-forest/8" />
          <div className="mt-auto flex gap-4 pt-6">
            <span className="h-3 w-20 animate-pulse rounded-full bg-forest/8" />
            <span className="h-3 w-24 animate-pulse rounded-full bg-forest/8" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectError({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      role="alert"
      className="rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-12 text-center"
    >
      <h2 className="font-heading text-xl tracking-tight text-forest">
        Não foi possível carregar os projetos
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-moss">
        Verifique sua conexão e tente novamente.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 hover:shadow-lg hover:shadow-forest/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Tentar novamente
      </button>
    </section>
  );
}
