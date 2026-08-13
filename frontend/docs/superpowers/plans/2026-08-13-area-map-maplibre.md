# Mapa Real da Área (MapLibre GL) — Plano de Implementação

> **Para agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa a tarefa. Steps usam checkbox (`- [ ]`).

**Goal:** Substituir o SVG decorativo `satellite-view.tsx` por um mapa MapLibre GL com basemap de satélite Esri, plotando o polígono GeoJSON real de `area.coordinates` na página de detalhe da área.

**Architecture:** Componente cliente `AreaMap` que, via `useEffect`, instancia `maplibregl.Map` (basemap raster Esri World Imagery) e adiciona uma GeoJSON source com o polígono da área (fill verde + line dourada) e `fitBounds`. Helpers puros de geometria em `src/lib/geo.ts` (type guard + bbox). Escopo: somente a página de detalhe da área.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, TailwindCSS, `maplibre-gl` v6, vitest + @testing-library/react.

## Global Constraints

- Trabalhar somente dentro de `frontend/` (o worktree do frontend não acessa o backend).
- `coordinates` é geometry pura GeoJSON: `{ type: "Polygon", coordinates: [[[lng, lat], ...]] }`, ordem `[lng, lat]`.
- Usar `type PolygonGeometry` (alias), NÃO `interface` — necessário para manter assignability a `Record<string, unknown>` do mock `Area.coordinates`.
- `maplibre-gl` deve ser mockado em testes (jsdom não tem WebGL).
- Basemap: raster Esri World Imagery com atribuição obrigatória.
- Commits em PT no estilo do repo: `feat:`, `fix:`, `chore:`, `docs:`.
- Rodar verificação completa antes de concluir cada tarefa quando aplicável: `npm run typecheck`, `npm run lint`, `npm test`.
- Não adicionar comentários ao código.

---

### Task 1: Instalar `maplibre-gl`

**Files:**
- Modify: `frontend/package.json`, `frontend/package-lock.json`

**Interfaces:**
- Produces: dependência `maplibre-gl` (^6.x) disponível para import em `frontend/src/components/features/area-map.tsx`.

- [ ] **Step 1: Instalar a dependência**

Run (no diretório `frontend/`):
```bash
npm install maplibre-gl
```

- [ ] **Step 2: Verificar instalação**

Run: `npm ls maplibre-gl`
Expected: `maplibre-gl@6.x.y` resolvido (dependência transitiva `@types/geojson` incluída).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: adicionar maplibre-gl"
```

---

### Task 2: Helpers de geometria (`src/lib/geo.ts`)

**Files:**
- Create: `frontend/src/lib/geo.ts`
- Test: `frontend/tests/lib/geo.test.ts`

**Interfaces:**
- Produces:
  - `export type PolygonGeometry = { type: "Polygon"; coordinates: number[][][] }`
  - `export function isPolygonGeometry(value: unknown): value is PolygonGeometry`
  - `export function polygonBounds(polygon: PolygonGeometry): [west: number, south: number, east: number, north: number]`
- Consumes: nada (módulo puro).

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/tests/lib/geo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isPolygonGeometry, polygonBounds } from "@/lib/geo";

describe("isPolygonGeometry", () => {
  it("aceita um polígono GeoJSON válido", () => {
    const polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-46.7, -23.5],
          [-46.6, -23.5],
          [-46.6, -23.4],
          [-46.7, -23.4],
          [-46.7, -23.5],
        ],
      ],
    };
    expect(isPolygonGeometry(polygon)).toBe(true);
  });

  it("rejeita valores não-objeto", () => {
    expect(isPolygonGeometry(null)).toBe(false);
    expect(isPolygonGeometry(undefined)).toBe(false);
    expect(isPolygonGeometry("polígono")).toBe(false);
  });

  it("rejeita geometry com tipo diferente", () => {
    expect(isPolygonGeometry({ type: "MultiPolygon", coordinates: [] })).toBe(false);
  });

  it("rejeita ring com menos de 4 pontos", () => {
    expect(
      isPolygonGeometry({
        type: "Polygon",
        coordinates: [
          [
            [-46.7, -23.5],
            [-46.6, -23.5],
            [-46.6, -23.4],
          ],
        ],
      }),
    ).toBe(false);
  });

  it("rejeita coordenadas não finitas", () => {
    expect(
      isPolygonGeometry({
        type: "Polygon",
        coordinates: [
          [
            [-46.7, -23.5],
            [-46.6, -23.5],
            [-46.6, NaN],
            [-46.7, -23.5],
          ],
        ],
      }),
    ).toBe(false);
  });
});

describe("polygonBounds", () => {
  it("calcula a bbox [west, south, east, north]", () => {
    const polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-46.7, -23.5],
          [-46.5, -23.6],
          [-46.6, -23.4],
          [-46.7, -23.5],
        ],
      ],
    };
    expect(polygonBounds(polygon)).toEqual([-46.7, -23.6, -46.5, -23.4]);
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run (no diretório `frontend/`): `npm test -- tests/lib/geo.test.ts`
Expected: FAIL — módulo `@/lib/geo` não encontrado.

- [ ] **Step 3: Implementar `src/lib/geo.ts`**

```ts
export type PolygonGeometry = {
  type: "Polygon";
  coordinates: number[][][];
};

const MIN_RING_POINTS = 4;

export function isPolygonGeometry(value: unknown): value is PolygonGeometry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<PolygonGeometry>;
  if (candidate.type !== "Polygon") return false;
  if (!Array.isArray(candidate.coordinates) || candidate.coordinates.length === 0) {
    return false;
  }
  return candidate.coordinates.every((ring) => {
    if (!Array.isArray(ring) || ring.length < MIN_RING_POINTS) return false;
    return ring.every((position) => {
      if (!Array.isArray(position) || position.length < 2) return false;
      return position.every((n) => typeof n === "number" && Number.isFinite(n));
    });
  });
}

export function polygonBounds(
  polygon: PolygonGeometry,
): [west: number, south: number, east: number, north: number] {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const ring of polygon.coordinates) {
    for (const [lng, lat] of ring) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }
  return [west, south, east, north];
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run (no diretório `frontend/`): `npm test -- tests/lib/geo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo.ts tests/lib/geo.test.ts
git commit -m "feat: helpers de geometria para polígonos GeoJSON"
```

---

### Task 3: Componente `AreaMap`

**Files:**
- Create: `frontend/src/components/features/area-map.tsx`
- Test: `frontend/tests/components/AreaMap.test.tsx`

**Interfaces:**
- Consumes:
  - `AreaRead` de `@/lib/api` (campo `coordinates?: Record<string, unknown> | null` nesta fase)
  - `isPolygonGeometry`, `polygonBounds` de `@/lib/geo`
  - `maplibregl` de `maplibre-gl`
- Produces: `export function AreaMap({ area }: { area: AreaRead })` — seção renderizada com fallback "coordenadas em breve" (sem polígono) ou mapa MapLibre (com polígono). Usado pela página em `frontend/src/app/painel/projetos/[id]/areas/[areaId]/page.tsx:178`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/tests/components/AreaMap.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AreaMap } from "@/components/features/area-map";
import type { AreaRead } from "@/lib/api";

const { mapInstances } = vi.hoisted(() => ({
  mapInstances: [] as Array<{
    on: ReturnType<typeof vi.fn>;
    addSource: ReturnType<typeof vi.fn>;
    addLayer: ReturnType<typeof vi.fn>;
    fitBounds: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("maplibre-gl", () => {
  class MockMap {
    on = vi.fn();
    addSource = vi.fn();
    addLayer = vi.fn();
    fitBounds = vi.fn();
    remove = vi.fn();
    constructor() {
      mapInstances.push(this);
    }
  }
  return { default: { Map: MockMap } };
});

function polygonArea(): AreaRead {
  return {
    id: "area-1",
    project_id: "proj-1",
    name: "Borrazóis",
    biome: "Mata Atlântica",
    size_hectares: 42,
    restoration_status: "active",
    coordinates: {
      type: "Polygon",
      coordinates: [
        [
          [-46.7, -23.5],
          [-46.5, -23.6],
          [-46.6, -23.4],
          [-46.7, -23.5],
        ],
      ],
    },
    created_at: "2024-05-01T00:00:00Z",
    updated_at: "2024-05-01T00:00:00Z",
  };
}

function triggerLoad(map: (typeof mapInstances)[number]) {
  const loadCall = map.on.mock.calls.find(([event]) => event === "load");
  expect(loadCall).toBeDefined();
  (loadCall?.[1] as () => void)?.();
}

describe("AreaMap", () => {
  beforeEach(() => {
    mapInstances.length = 0;
  });

  afterEach(cleanup);

  it("mostra fallback quando não há coordenadas", () => {
    render(<AreaMap area={{ ...polygonArea(), coordinates: null }} />);
    expect(screen.getByText("coordenadas em breve")).toBeInTheDocument();
    expect(mapInstances).toHaveLength(0);
  });

  it("cria o mapa com a feature GeoJSON do polígono", async () => {
    const area = polygonArea();
    render(<AreaMap area={area} />);

    const map = mapInstances[0];
    expect(map).toBeDefined();

    triggerLoad(map);

    expect(map.addSource).toHaveBeenCalledWith("area", {
      type: "geojson",
      data: { type: "Feature", geometry: area.coordinates, properties: {} },
    });
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ type: "fill" }));
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ type: "line" }));
    expect(map.fitBounds).toHaveBeenCalledWith(
      [-46.7, -23.6, -46.5, -23.4],
      expect.any(Object),
    );
  });

  it("mostra fallback quando a geometry é inválida", () => {
    render(
      <AreaMap
        area={{
          ...polygonArea(),
          coordinates: {
            type: "MultiPolygon",
            coordinates: [],
          } as unknown as AreaRead["coordinates"],
        }}
      />,
    );
    expect(screen.getByText("coordenadas em breve")).toBeInTheDocument();
    expect(mapInstances).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar os testes para ver falhar**

Run (no diretório `frontend/`): `npm test -- tests/components/AreaMap.test.tsx`
Expected: FAIL — `@/components/features/area-map` não encontrado.

- [ ] **Step 3: Implementar `src/components/features/area-map.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
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

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: SATELLITE_STYLE,
      attributionControl: true,
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
```

- [ ] **Step 4: Rodar os testes para ver passar**

Run (no diretório `frontend/`): `npm test -- tests/components/AreaMap.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Typecheck e lint**

Run (no diretório `frontend/`):
```bash
npm run typecheck
npm run lint
```
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/components/features/area-map.tsx tests/components/AreaMap.test.tsx
git commit -m "feat: mapa da área com MapLibre GL e polígono GeoJSON"
```

---

### Task 4: Tipar `coordinates`, trocar componente na página e remover mock

**Files:**
- Modify: `frontend/src/lib/api.ts` (linhas 243 e 255 — campos `coordinates` de `AreaRead` e `AreaCreate`)
- Modify: `frontend/src/app/painel/projetos/[id]/areas/[areaId]/page.tsx:20` e `:178`
- Delete: `frontend/src/components/features/satellite-view.tsx`
- Test: `frontend/tests/components/AreaDetailPage.test.tsx:111-131`

**Interfaces:**
- Consumes: `PolygonGeometry` de `@/lib/geo` (Task 2), `AreaMap` de `@/components/features/area-map` (Task 3).
- Produces: `AreaRead.coordinates?: PolygonGeometry | null` e `AreaCreate.coordinates?: PolygonGeometry | null` em `@/lib/api`.

- [ ] **Step 1: Tipar `coordinates` em `api.ts`**

Adicionar logo após a linha 4 (`export type { Token }`):

```ts
import type { PolygonGeometry } from "@/lib/geo";
```

E alterar os dois campos:

```ts
coordinates?: PolygonGeometry | null;
```

em `AreaRead` (linha 243) e `AreaCreate` (linha 255).

- [ ] **Step 2: Trocar `SatelliteView` por `AreaMap` na página**

Em `frontend/src/app/painel/projetos/[id]/areas/[areaId]/page.tsx`:
- Linha 20: trocar `import { SatelliteView } from "@/components/features/satellite-view";` por `import { AreaMap } from "@/components/features/area-map";`
- Linha 178: trocar `<SatelliteView area={area} />` por `<AreaMap area={area} />`

- [ ] **Step 3: Remover `satellite-view.tsx`**

Run (no diretório `frontend/`): `rm src/components/features/satellite-view.tsx`

- [ ] **Step 4: Atualizar o teste da página de detalhe**

Em `frontend/tests/components/AreaDetailPage.test.tsx`, substituir o teste "renderiza a pré-visualização da visão de satélite" (linhas 111-131) por:

```tsx
  it("renderiza a visão de satélite com fallback sem coordenadas", async () => {
    apiFetchMock.mockResolvedValue(project);
    getAreaMock.mockResolvedValue(area);
    listAreaMonitoringsMock.mockResolvedValue({
      items: [],
      total: 0,
      offset: 0,
      limit: 10,
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Visão de satélite" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Mata Atlântica · 42 ha/)).toBeInTheDocument();
    expect(screen.getByText("coordenadas em breve")).toBeInTheDocument();
  });
```

O fixture `area` (linhas 40-51) não tem `coordinates` — o fallback renderiza. O caso com polígono é coberto por `AreaMap.test.tsx`.

- [ ] **Step 5: Rodar os testes**

Run (no diretório `frontend/`):
```bash
npm test -- tests/components/AreaDetailPage.test.tsx tests/components/AreaMap.test.tsx tests/lib/geo.test.ts
```
Expected: PASS.

- [ ] **Step 6: Typecheck e lint**

Run (no diretório `frontend/`):
```bash
npm run typecheck
npm run lint
```
Expected: sem erros (confirma que `PolygonGeometry` é assignable ao `Record<string, unknown>` do mock em `project-areas.tsx:47`).

- [ ] **Step 7: Build de produção**

Run (no diretório `frontend/`): `npm run build`
Expected: build completo sem erros (valida o bundling do worker do MapLibre no Next.js; se houver erro específico do MapLibre/webpack, consultar `node_modules/next/dist/docs/` e ajustar `next.config.ts`).

- [ ] **Step 8: Commit**

```bash
git add src/lib/api.ts "src/app/painel/projetos/[id]/areas/[areaId]/page.tsx"
git rm src/components/features/satellite-view.tsx
git add tests/components/AreaDetailPage.test.tsx
git commit -m "feat: página da área usa o mapa real no lugar do mock"
```

---

## Verificação final

Run (no diretório `frontend/`):
```bash
npm run typecheck
npm run lint
npm test
npm run build
```
Expected: tudo verde.

Checagem manual (`npm run dev`, backend rodando em `http://localhost:8000`):
- Área com polígono → seção "Visão de satélite" com mapa de satélite Esri, contorno dourado e preenchimento verde sobre o polígono real.
- Área sem polígono → fallback "coordenadas em breve".
