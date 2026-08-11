"use client";

import { useRef, useState, type FormEvent } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { updateProject, type ProjectRead } from "@/lib/api";
import {
  ProjectFormFields,
  type ProjectFormDefaults,
} from "@/components/features/project-form-fields";

interface EditProjectDialogProps {
  project: ProjectRead;
  onUpdated: (updated: ProjectRead) => void;
}

export function EditProjectDialog({ project, onUpdated }: EditProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const defaults: ProjectFormDefaults = {
    name: project.name,
    goal: project.goal,
    description: project.description,
    start_date: project.start_date,
    responsible: project.responsible,
  };

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setError(null);
      setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const input = {
      name: String(form.get("name") ?? "").trim(),
      goal: String(form.get("goal") ?? "").trim() || null,
      description: String(form.get("description") ?? "").trim() || null,
      start_date: String(form.get("start_date") ?? "") || null,
      responsible: String(form.get("responsible") ?? "").trim() || null,
    };

    if (!input.name) {
      setError("Dê um nome ao projeto.");
      return;
    }

    setError(null);
    setPending(true);

    try {
      const updated = await updateProject(project.id, input);
      onUpdated(updated);
      setOpen(false);
      formRef.current?.reset();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar as alterações. Tente novamente.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger
        aria-label="Editar detalhes do projeto"
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest/15 bg-cream px-3.5 text-sm font-medium text-forest transition-colors hover:border-forest/30 hover:bg-forest/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist sm:px-4"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Editar</span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-soil/50 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-forest/10 bg-cream p-7 shadow-2xl shadow-soil/25 sm:p-9">
          <Dialog.Title className="sr-only">Editar detalhes do projeto</Dialog.Title>
          <Dialog.Close className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-forest/10 bg-mist/60 text-moss transition-colors hover:border-forest/30 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream">
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Fechar</span>
          </Dialog.Close>

          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Organização
          </p>
          <h2 className="font-heading mt-3 text-3xl leading-[1.1] tracking-tight text-forest">
            Editar projeto
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-moss">
            Ajuste os detalhes do projeto — nome, objetivo, descrição e
            responsável. As alterações valem para a organização inteira.
          </p>

          {error ? (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-relaxed text-destructive"
            >
              {error}
            </p>
          ) : null}

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            noValidate
            className="mt-7 space-y-5"
          >
            <ProjectFormFields idPrefix="edit-project" defaults={defaults} />

            <div className="flex flex-col-reverse items-stretch gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-moss/70">
                O nome atualiza o título e a navegação do projeto.
              </p>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-forest px-6 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 hover:shadow-lg hover:shadow-forest/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Salvando...
                  </>
                ) : (
                  "Salvar alterações"
                )}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
