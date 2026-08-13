# Design — Mapa real da área com MapLibre GL

**Data:** 2026-08-13
**Status:** Aprovado

## Contexto

O backend passou a gravar polígonos GeoJSON em `Area.coordinates` (geometry pura:
`{ "type": "Polygon", "coordinates": [[[lng, lat], ...]] }`, ordem `[lng, lat]` conforme o
padrão GeoJSON). O swagger (`http://localhost:8000/openapi.json`) expõe `coordinates` como
objeto opaco (`additionalProperties: true`), então a estrutura real foi confirmada com o
usuário.

No frontend, a "visão de satélite" (`src/components/features/satellite-view.tsx`) é um SVG
decorativo com polígono hardcoded e rótulo "polígono aproximado". O contrato já possui o
campo `coordinates` em `AreaRead`/`AreaCreate` (`src/lib/api.ts`), mas nunca é interpretado
como geometria.

## Objetivo

Substituir o mock visual por um mapa MapLibre GL com basemap de satélite (Esri World
Imagery), plotando o polígono real de `area.coordinates` na página de detalhe da área.

## Decisões

| Decisão | Escolha |
| ------- | ------- |
| Formato do `coordinates` | Geometry pura `{ type: "Polygon", coordinates: [[[lng,lat]...]] }` |
| Ordem dos pontos | `[lng, lat]` (padrão GeoJSON) |
| Biblioteca de mapa | `maplibre-gl` v6 (uso direto, sem wrapper React) |
| Basemap | Raster Esri World Imagery (atribuição obrigatória) |
| Escopo | Somente a página de detalhe da área |

## Arquitetura

1. **`src/lib/geo.ts`** (novo, funções puras) — tipos e helpers de geometria:
   - `type PolygonGeometry = { type: "Polygon"; coordinates: number[][][] }`
     (usar `type` alias, não `interface`, para manter assignability a
     `Record<string, unknown>` no mock `Area.coordinates` via index signature implícita)
   - `isPolygonGeometry(value: unknown): value is PolygonGeometry` — type guard que valida
     `type === "Polygon"`, ring com ≥ 4 pontos e números finitos
   - `polygonBounds(polygon): [west, south, east, north]` — bbox para `fitBounds`

2. **`src/components/features/area-map.tsx`** (novo, `"use client"`) — substitui
   `satellite-view.tsx`:
   - Sem polígono válido → estado vazio com "coordenadas em breve" (mesmo visual)
   - Com polígono → seção "Imagem de satélite" com `h2` "Visão de satélite" (restaura o
     heading comentado), badge "Polígono registrado", e `MapLibre Map` montado em um
     `<div ref>` via `useEffect`
   - No evento `load` do mapa: `addSource("area", { type: "geojson", data: Feature })`,
     `addLayer` fill (verde floresta) + line (dourada), `fitBounds(polygonBounds(...))`
   - Cleanup com `map.remove()`
   - Estilo inline v8 com fonte raster Esri + atribuição; importa
     `maplibre-gl/dist/maplibre-gl.css`

3. **`src/lib/api.ts`** — tipar `AreaRead.coordinates` e `AreaCreate.coordinates` como
   `PolygonGeometry | null`.

4. **`src/app/painel/projetos/[id]/areas/[areaId]/page.tsx`** — trocar `<SatelliteView/>`
   por `<AreaMap/>`; remover `satellite-view.tsx`.

## Dependências

- `maplibre-gl` (v6.3.0, `npm install`). `@types/geojson` é dependência transitiva do
  pacote.

## Testes

- **`tests/lib/geo.test.ts`** — `isPolygonGeometry` (válido, null, type errado, ring curto,
  coordenadas não finitas) e `polygonBounds` (bbox correta).
- **`tests/components/AreaMap.test.tsx`** — com `vi.mock("maplibre-gl")` (Map fake gravando
  `addSource`/`addLayer`/`fitBounds`; jsdom não tem WebGL):
  - sem coordenadas → fallback "coordenadas em breve", nenhum Map criado
  - com polígono → Map criado, source com a Feature correta, layer fill/line, `fitBounds`
    com a bbox certa
  - geometry inválida → fallback
- **`tests/components/AreaDetailPage.test.tsx`** — atualizar o teste "pré-visualização":
  heading "Visão de satélite" (antes o `h2` estava comentado), mantém "Mata Atlântica · 42
  ha" e "coordenadas em breve"; remover asserção do badge "Pré-visualização". O fixture sem
  coordenadas cobre o fallback (o caso com polígono é coberto pelo `AreaMap.test.tsx`, sem
  necessidade de mock do MapLibre na página).

## Fora de escopo (YAGNI)

- Dashboard (`AREAS` mock em `painel/page.tsx`), `caderno-campo`, `registration-dialog`
- Listagem de áreas do projeto (`project-areas.tsx`)
- Desenho de polígono na criação de área

## Verificação

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Checagem manual em `npm run dev` com backend rodando: área com polígono → mapa com satélite
e contorno; área sem polígono → fallback "coordenadas em breve".

## Riscos

- MapLibre no jsdom requer mock (sem WebGL) — coberto nos testes.
- Tiles Esri exigem atribuição — incluída na fonte do estilo.
- `maplibre-gl` em Next.js: montado apenas no cliente (`useEffect`); validar `npm run build`
  para o bundling do worker.
