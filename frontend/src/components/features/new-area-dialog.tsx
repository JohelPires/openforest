"use client";

import { useRef, useState, type FormEvent } from "react";
import { ChevronDown, Loader2, Plus, X } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { type RestorationStatus } from "@/lib/status";
import {
  inputClasses,
  labelClasses,
} from "@/components/features/project-form-fields";

export interface NewAreaInput {
  name: string;
  goal?: string | null;
  size_hectares?: number | null;
  biome?: string | null;
  restoration_status?: RestorationStatus;
}

const BIOMES = [
  "Amazônia",
  "Caatinga",
  "Cerrado",
  "Mata Atlântica",
  "Pampa",
  "Pantanal",
] as const;

function parseSize(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

interface NewAreaDialogProps {
  onCreate: (input: NewAreaInput) => Promise<void>;
  variant?: "band" | "button";
}

export function NewAreaDialog({ onCreate, variant = "band" }: NewAreaDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

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

    const input: NewAreaInput = {
      name: String(form.get("name") ?? "").trim(),
      goal: String(form.get("goal") ?? "").trim() || null,
      biome: String(form.get("biome") ?? "").trim() || null,
      size_hectares: parseSize(form.get("size_hectares")),
      restoration_status:
        (form.get("status") as RestorationStatus) || "planned",
    };

    if (!input.name) {
      setError("Dê um nome à área.");
      return;
    }

    setError(null);
    setPending(true);

    try {
      await onCreate(input);
      setOpen(false);
      formRef.current?.reset();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível criar a área. Tente novamente.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      {variant === "band" ? (
        <Dialog.Trigger
          aria-label="Cadastrar primeira área"
          className="group mt-7 flex w-full items-center gap-5 rounded-2xl border border-dashed border-gold/45 bg-gold/5 px-5 py-5 text-left transition-colors duration-300 hover:border-gold/70 hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-cream sm:px-6"
        >
          <span aria-hidden="true" className="relative h-8 min-w-[7rem] flex-1">
            <span className="absolute left-0 right-0 top-1/2 h-px bg-forest/20" />
            <span className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gold/60 bg-cream text-forest shadow-sm transition-transform duration-300 group-hover:scale-110">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </span>
          </span>
          <span className="flex flex-col items-start gap-0.5">
            <span className="font-heading text-lg leading-tight tracking-tight text-forest">
              Cadastrar primeira área
            </span>
            <span className="text-xs leading-relaxed text-moss sm:text-sm">
              Ela abre a régua de monitoramento deste projeto.
            </span>
          </span>
        </Dialog.Trigger>
      ) : (
        <Dialog.Trigger
          aria-label="Criar nova área"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest/15 bg-cream px-3.5 text-sm font-medium text-forest transition-colors hover:border-forest/30 hover:bg-forest/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist sm:px-4"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Nova área</span>
        </Dialog.Trigger>
      )}

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-soil/50 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-forest/10 bg-cream p-7 shadow-2xl shadow-soil/25 sm:p-9">
          <Dialog.Title className="sr-only">Criar nova área</Dialog.Title>
          <Dialog.Close className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-forest/10 bg-mist/60 text-moss transition-colors hover:border-forest/30 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream">
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Fechar</span>
          </Dialog.Close>

          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Projeto
          </p>
          <h2 className="font-heading mt-3 text-3xl leading-[1.1] tracking-tight text-forest">
            Nova área
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-moss">
            Nomeie o trecho de restauração e conte como ele será. A área entra
            na régua de monitoramento do projeto, e você completa os detalhes de
            campo depois.
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
            <div>
              <label htmlFor="area-name" className={labelClasses}>
                Nome da área
              </label>
              <input
                id="area-name"
                name="name"
                type="text"
                required
                placeholder="Ex.: Mata ciliar do ribeirão"
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="area-goal" className={labelClasses}>
                Objetivo
              </label>
              <input
                id="area-goal"
                name="goal"
                type="text"
                placeholder="O que essa área precisa recuperar?"
                className={inputClasses}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="area-biome" className={labelClasses}>
                  Bioma
                </label>
                <div className="relative">
                  <select
                    id="area-biome"
                    name="biome"
                    defaultValue=""
                    className={`${inputClasses} appearance-none pr-10`}
                  >
                    <option value="">Selecione o bioma</option>
                    {BIOMES.map((biome) => (
                      <option key={biome} value={biome}>
                        {biome}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-moss/60"
                    aria-hidden="true"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="area-size" className={labelClasses}>
                  Tamanho (ha)
                </label>
                <input
                  id="area-size"
                  name="size_hectares"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Ex.: 12,5"
                  className={inputClasses}
                />
              </div>
            </div>

            <div>
              <label htmlFor="area-status" className={labelClasses}>
                Status
              </label>
              <div className="relative">
                <select
                  id="area-status"
                  name="status"
                  defaultValue="planned"
                  className={`${inputClasses} appearance-none pr-10`}
                >
                  {(
                    [
                      ["planned", "Planejada"],
                      ["active", "Em restauração"],
                      ["completed", "Recuperada"],
                      ["cancelled", "Cancelada"],
                    ] as [RestorationStatus, string][]
                  ).map(([status, label]) => (
                    <option key={status} value={status}>
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-moss/60"
                  aria-hidden="true"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse items-stretch gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-moss/70">
                A área entra na régua de monitoramento do projeto.
              </p>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-forest px-6 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 hover:shadow-lg hover:shadow-forest/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Criando...
                  </>
                ) : (
                  "Criar área"
                )}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
