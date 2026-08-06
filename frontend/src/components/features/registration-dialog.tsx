"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Check, Plus, X } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { AREAS } from "@/lib/mock-data";

const inputClasses =
  "h-11 w-full rounded-xl border border-forest/15 bg-mist/40 px-3.5 text-sm text-forest placeholder:text-moss/40 transition-shadow duration-300 focus:border-forest focus:bg-cream focus:outline-none focus:ring-4 focus:ring-forest/15";

const labelClasses = "mb-1.5 block text-sm font-medium text-forest";

export function RegistrationDialog() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSubmitted(false);
      setFileName(null);
    }
  }

  useEffect(() => {
    if (!submitted) return;
    const id = window.setTimeout(() => setOpen(false), 1100);
    return () => window.clearTimeout(id);
  }, [submitted]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gold/60 bg-cream/60 px-3 text-sm font-medium text-forest transition-all duration-300 hover:border-gold hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-mist sm:px-4"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Novo registro</span>
        <span className="sm:hidden">Registrar</span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-soil/50 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(92vw,600px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-forest/10 bg-cream p-7 shadow-2xl shadow-soil/25 sm:p-9">
          <Dialog.Title className="sr-only">
            Novo registro de monitoramento
          </Dialog.Title>
          <Dialog.Close className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-forest/10 bg-mist/60 text-moss transition-colors hover:border-forest/30 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream">
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Fechar</span>
          </Dialog.Close>

          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Caderno de campo
          </p>
          <h2 className="font-heading mt-3 text-3xl leading-[1.1] tracking-tight text-forest">
            Novo registro
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-moss">
            Anote a visita como faria no campo — a data e as mudas contadas
            alimentam a linha do tempo da área.
          </p>

          {submitted ? (
            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-forest/15 bg-forest/5 px-5 py-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-cream">
                <Check className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium text-forest">
                Registro salvo na área selecionada.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="reg-area" className={labelClasses}>
                    Área
                  </label>
                  <select id="reg-area" name="area" required className={inputClasses} defaultValue={AREAS[0].id}>
                    {AREAS.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name} · {area.biome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-date" className={labelClasses}>
                    Data da visita
                  </label>
                  <input
                    id="reg-date"
                    name="date"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className={inputClasses}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-responsible" className={labelClasses}>
                  Responsável
                </label>
                <input
                  id="reg-responsible"
                  name="responsible"
                  type="text"
                  autoComplete="name"
                  placeholder="Quem fez a visita"
                  required
                  className={inputClasses}
                />
              </div>

              <div>
                <label htmlFor="reg-notes" className={labelClasses}>
                  Notas de campo
                </label>
                <textarea
                  id="reg-notes"
                  name="notes"
                  rows={4}
                  placeholder="O que você observou nesta visita?"
                  className={`${inputClasses} ruled-lines h-32 resize-none py-3 leading-[27px]`}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div>
                  <label htmlFor="reg-seedlings" className={labelClasses}>
                    Mudas contadas
                  </label>
                  <input
                    id="reg-seedlings"
                    name="seedlings"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="0"
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label htmlFor="reg-height" className={labelClasses}>
                    Altura média
                  </label>
                  <div className="relative">
                    <input
                      id="reg-height"
                      name="height"
                      type="number"
                      min={0}
                      step={0.1}
                      inputMode="decimal"
                      placeholder="0,0"
                      className={`${inputClasses} pr-10`}
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-moss/60">
                      m
                    </span>
                  </div>
                </div>
                <div>
                  <label htmlFor="reg-species" className={labelClasses}>
                    Espécies
                  </label>
                  <input
                    id="reg-species"
                    name="species"
                    type="text"
                    placeholder="Aroeira, Ipê…"
                    className={inputClasses}
                  />
                </div>
              </div>

              <div>
                <span className={labelClasses}>Fotos da visita</span>
                <input
                  ref={fileInputRef}
                  id="reg-photos"
                  name="photos"
                  type="file"
                  multiple
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setFileName(
                      file
                        ? file.name
                        : event.target.files?.length
                          ? `${event.target.files.length} arquivos`
                          : null
                    );
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-forest/25 bg-mist/40 text-sm font-medium text-moss transition-colors hover:border-forest/40 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  {fileName ?? "Anexar fotos"}
                </button>
              </div>

              <div className="flex flex-col-reverse items-stretch gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-moss/70">
                  O registro entra na linha do tempo da área escolhida.
                </p>
                <button
                  type="submit"
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-forest px-6 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 hover:shadow-lg hover:shadow-forest/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                >
                  Salvar registro
                </button>
              </div>
            </form>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
