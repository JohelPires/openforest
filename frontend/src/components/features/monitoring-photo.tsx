"use client";

import { useEffect, useState } from "react";
import { ImageOff, RefreshCw } from "lucide-react";
import { downloadPhoto, type PhotoRead } from "@/lib/api";

interface MonitoringPhotoProps {
  photo: PhotoRead;
}

export function MonitoringPhoto({ photo }: MonitoringPhotoProps) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [src, setSrc] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [prevPhotoId, setPrevPhotoId] = useState(photo.id);

  if (prevPhotoId !== photo.id) {
    setPrevPhotoId(photo.id);
    setState("loading");
    setSrc(null);
  }

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    downloadPhoto(photo.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id, attempt]);

  if (state === "error") {
    return (
      <figure className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-forest/20 bg-mist/40 text-moss">
        <ImageOff className="h-6 w-6" aria-hidden="true" />
        <button
          type="button"
          onClick={() => {
            setState("loading");
            setSrc(null);
            setAttempt((n) => n + 1);
          }}
          className="inline-flex items-center gap-1 text-[11px] font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Tentar novamente
        </button>
      </figure>
    );
  }

  if (state === "loading" || !src) {
    return (
      <figure
        role="status"
        aria-label="Carregando foto"
        className="aspect-square animate-pulse rounded-xl bg-forest/10"
      />
    );
  }

  return (
    <figure className="overflow-hidden rounded-xl border border-forest/10 bg-mist">
      <img
        src={src}
        alt={photo.original_filename ?? "Foto da visita"}
        className="aspect-square w-full object-cover"
      />
      {photo.original_filename ? (
        <figcaption className="truncate border-t border-forest/10 bg-cream px-2 py-1.5 text-[10px] text-moss">
          {photo.original_filename}
        </figcaption>
      ) : null}
    </figure>
  );
}
