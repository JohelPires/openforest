"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, Satellite } from "lucide-react";
import type { AreaRead } from "@/lib/api";
import { isPolygonGeometry, polygonBounds } from "@/lib/geo";

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Tiles © Esri — Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    },
  },
  layers: [{ id: "esri", type: "raster", source: "esri" }],
};

interface AreaMapProps {
  area: AreaRead;
}

export function AreaMap({ area }: AreaMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const polygon = isPolygonGeometry(area.coordinates) ? area.coordinates : null;

  useEffect(() => {
    if (!polygon || !containerRef.current) return;

    maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: SATELLITE_STYLE,
      attributionControl: {},
    });

    map.on("load", () => {
      map.addSource("area", {
        type: "geojson",
        data: { type: "Feature", geometry: polygon, properties: {} },
      });
      map.addLayer({
        id: "area-fill",
        type: "fill",
        source: "area",
        paint: { "fill-color": "#1d4d3b", "fill-opacity": 0.3 },
      });
      map.addLayer({
        id: "area-outline",
        type: "line",
        source: "area",
        paint: { "line-color": "#c4a76c", "line-width": 2 },
      });
      map.fitBounds(polygonBounds(polygon), { padding: 48, maxZoom: 18 });
    });

    return () => {
      map.remove();
    };
  }, [polygon]);

  return (
    <section aria-labelledby="satellite-title" className="max-w-6xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Imagem de satélite
          </p>
          <h2
            id="satellite-title"
            className="font-heading mt-3 text-2xl leading-[1.1] tracking-tight text-forest sm:text-3xl"
          >
            Visão de satélite
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-moss">
            O perímetro desta área sobre a imagem orbital.
          </p>
        </div>
        {polygon ? (
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-forest">
            <Satellite className="h-3.5 w-3.5" aria-hidden="true" />
            Polígono registrado
          </span>
        ) : null}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-forest/10 bg-cream shadow-sm shadow-forest/5">
        {polygon ? (
          <div
            ref={containerRef}
            role="region"
            aria-label={`Mapa da área ${area.name}`}
            className="relative aspect-[16/11] w-full sm:aspect-[16/8]"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest/8 text-forest">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="font-heading text-lg tracking-tight text-forest">
              Mapa da área em breve
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-moss/70">
              coordenadas em breve
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-forest/10 bg-cream px-5 py-3.5 sm:px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-moss/70">
            {area.biome ?? "Bioma não informado"} ·{" "}
            {area.size_hectares != null
              ? `${area.size_hectares.toLocaleString("pt-BR")} ha`
              : "Tamanho não informado"}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-moss/70">
            {polygon ? "polígono registrado" : "polígono não registrado"}
          </span>
        </div>
      </div>
    </section>
  );
}
