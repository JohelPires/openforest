"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { deleteProject } from "@/lib/api";

interface DeleteProjectDialogProps {
  projectId: string;
  projectName: string;
  onDeleted: () => void;
}

export function DeleteProjectDialog({
  projectId,
  projectName,
  onDeleted,
}: DeleteProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setError(null);
      setPending(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setPending(true);

    try {
      await deleteProject(projectId);
      onDeleted();
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível excluir o projeto. Tente novamente.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Trigger
        aria-label="Excluir projeto"
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-destructive/20 bg-cream px-3.5 text-sm font-medium text-destructive transition-colors hover:border-destructive/40 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist sm:px-4"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Excluir</span>
      </AlertDialog.Trigger>

      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-soil/50 backdrop-blur-sm" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-forest/10 bg-cream p-7 shadow-2xl shadow-soil/25 sm:p-9">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>

          <p className="mt-6 font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Cuidado
          </p>
          <AlertDialog.Title className="font-heading mt-3 text-3xl leading-[1.1] tracking-tight text-forest">
            Excluir o projeto “{projectName}”?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-3 text-sm leading-relaxed text-moss">
            O projeto, as áreas de restauração e os monitoramentos vinculados
            serão removidos. Essa ação não pode ser desfeita.
          </AlertDialog.Description>

          {error ? (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-relaxed text-destructive"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:justify-end">
            <AlertDialog.Close
              disabled={pending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-forest/15 bg-cream px-5 text-sm font-medium text-forest transition-colors hover:border-forest/30 hover:bg-forest/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-60"
            >
              Cancelar
            </AlertDialog.Close>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-destructive px-5 text-sm font-medium text-cream transition-all duration-300 hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-60"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Excluindo...
                </>
              ) : (
                "Excluir projeto"
              )}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
