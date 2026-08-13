"use client";

import { RefreshCw, X } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { useInfiniteQuery } from "@tanstack/react-query";
import { listMonitoringPhotos } from "@/lib/api";
import { MonitoringPhoto } from "@/components/features/monitoring-photo";
import type { MonitoringListItem } from "@/components/features/monitoring-list";

const PAGE_SIZE = 100;

function formatFullDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

interface MonitoringDetailDialogProps {
  monitoring: MonitoringListItem;
  areaName: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

export function MonitoringDetailDialog({
  monitoring,
  areaName,
  open,
  onOpenChange,
}: MonitoringDetailDialogProps) {
  const photosQuery = useInfiniteQuery({
    queryKey: ["monitoring-photos", monitoring.id],
    queryFn: ({ pageParam }) =>
      listMonitoringPhotos(monitoring.id, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.offset + lastPage.limit < lastPage.total
        ? lastPage.offset + lastPage.limit
        : undefined,
    enabled: open,
  });

  const photos = photosQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const hasNext = photosQuery.hasNextPage;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-soil/50 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(92vw,640px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-forest/10 bg-cream p-7 shadow-2xl shadow-soil/25 sm:p-9">
          <Dialog.Title className="sr-only">
            Monitoramento de {formatFullDate(monitoring.visit_date)}
          </Dialog.Title>
          <Dialog.Close className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-forest/10 bg-mist/60 text-moss transition-colors hover:border-forest/30 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream">
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Fechar</span>
          </Dialog.Close>

          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Monitoramento
          </p>
          <h2 className="font-heading mt-3 text-3xl leading-[1.1] tracking-tight text-forest">
            {formatFullDate(monitoring.visit_date)}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-moss">
            Área · {areaName}
          </p>

          {monitoring.notes ? (
            <p className="mt-5 text-sm leading-relaxed text-moss">
              {monitoring.notes}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {monitoring.seedling_count != null ? (
              <span className="font-mono text-sm text-forest">
                {monitoring.seedling_count.toLocaleString("pt-BR")} mudas
              </span>
            ) : null}
            {monitoring.avg_height != null ? (
              <span className="font-mono text-sm text-forest">
                {monitoring.avg_height.toLocaleString("pt-BR")} m médios
              </span>
            ) : null}
            {Object.keys(monitoring.species_data ?? {}).map((species) => (
              <span
                key={species}
                className="rounded-full border border-forest/10 bg-forest/5 px-2 py-0.5 text-[11px] text-forest"
              >
                {species}
              </span>
            ))}
          </div>

          <div className="mt-7">
            <h3 className="font-heading text-lg tracking-tight text-forest">
              Fotos da visita
            </h3>

            {photosQuery.isPending ? (
              <div
                role="status"
                aria-label="Carregando fotos"
                className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
              >
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="aspect-square animate-pulse rounded-xl bg-forest/10"
                  />
                ))}
              </div>
            ) : photosQuery.isError ? (
              <div
                role="alert"
                className="mt-4 rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-8 text-center"
              >
                <p className="font-heading text-base tracking-tight text-forest">
                  Não foi possível carregar as fotos
                </p>
                <button
                  type="button"
                  onClick={() => photosQuery.refetch()}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Tentar novamente
                </button>
              </div>
            ) : photos.length === 0 ? (
              <p className="mt-4 text-sm leading-relaxed text-moss/70">
                Nenhuma foto anexada a esta visita.
              </p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((photo) => (
                    <MonitoringPhoto key={photo.id} photo={photo} />
                  ))}
                </div>
                {hasNext ? (
                  <button
                    type="button"
                    onClick={() => photosQuery.fetchNextPage()}
                    className="mt-5 inline-flex h-9 items-center gap-2 rounded-full border border-forest/15 bg-cream px-4 text-sm font-medium text-forest transition-colors hover:border-forest/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
                  >
                    Carregar mais fotos
                  </button>
                ) : null}
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
