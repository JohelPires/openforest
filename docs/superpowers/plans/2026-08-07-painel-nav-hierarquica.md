# Reestruturação Hierárquica da Navegação do Painel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Expressar a hierarquia Organização → Projeto → Área → Monitoramento no painel por contexto: sidebar reduzida ao topo da hierarquia, régua de monitoramento reutilizável (visual idêntico) e breadcrumb hierárquico.

**Architecture:** Extrair de `strata-core.tsx` o componente presentacional reutilizável `AreaTimeline` (dados via prop `areas`, eixo de tempo derivado dos dados, zero mudança visual). Navegação por contexto: sidebar passa a listar só Visão geral + Projetos (raiz) e Fotos + Configurações (acervo); o detalhe do projeto ganha a seção "Áreas" com a régua alimentada por mock; o breadcrumb é impulsionado por `BreadcrumbProvider` + hook `useBreadcrumb`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), TailwindCSS, vitest + @testing-library/react

## Global Constraints

- Sem novas dependências (npm).
- Componentes PascalCase, arquivo com o nome do componente; RSC por padrão, `"use client"` só quando necessário.
- `interface` para props/objetos; `type` para uniões.
- Estado vazio/erro como convite à ação, nunca quebrado.
- **A régua deve permanecer visualmente IDÊNTICA** — refactor sem mudança de design.
- Dados mock apenas (sem integração de API neste plano).
- Verificação em `frontend/`: `npm run lint`, `npm run typecheck`, `npm test`.
- Commits: `feat:` / `refactor:` / `test:` (padrão do repo).
- Fora de escopo (follow-ups): páginas de detalhe de Área/Monitoramento, Acervo de Fotos, Sensores, endpoints de fotos no backend, busca global, CTA context-aware.

---

## File Structure

### Files to Create
- `frontend/src/components/features/area-timeline.tsx` — régua reutilizável (Band, MonitoringList, eixo, legenda movidos de `strata-core.tsx`)
- `frontend/src/components/features/project-areas.tsx` — seção "Áreas" do detalhe do projeto (régua ou estado vazio)
- `frontend/src/components/features/painel-breadcrumb.tsx` — `BreadcrumbProvider`, `useBreadcrumb`, `useBreadcrumbSegments`
- `frontend/tests/components/AreaTimeline.test.tsx`
- `frontend/tests/components/ProjectAreas.test.tsx`
- `frontend/tests/components/Breadcrumb.test.tsx`
- `frontend/tests/components/Sidebar.test.tsx`
- `frontend/tests/lib/mock-data.test.ts`

### Files to Modify
- `frontend/src/lib/mock-data.ts` — `project_id` no `Area` + helper `projectAreas`
- `frontend/src/components/features/strata-core.tsx` — **deletar** (substituído por `area-timeline.tsx`)
- `frontend/src/app/painel/page.tsx` — usar `<AreaTimeline areas={AREAS} />`
- `frontend/src/components/features/painel-shell.tsx` — `BreadcrumbProvider` + breadcrumb hierárquico
- `frontend/src/app/painel/projetos/[id]/page.tsx` — breadcrumb + seção de áreas
- `frontend/src/components/features/sidebar.tsx` — nav reduzida

---

### Task 1: Mock data — associação projeto → área

**Files:**
- Modify: `frontend/src/lib/mock-data.ts`
- Test: `frontend/tests/lib/mock-data.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `Area.project_id: string`, `DEMO_PROJECT_IDS`, `projectAreas(projectId: string): Area[]`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/mock-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AREAS, projectAreas } from "@/lib/mock-data";

describe("projectAreas", () => {
  it("retorna as áreas associadas ao projeto", () => {
    const areas = projectAreas("proj-restauracao-norte");
    expect(areas.length).toBeGreaterThan(0);
    expect(areas.every((a) => a.project_id === "proj-restauracao-norte")).toBe(true);
  });

  it("retorna lista vazia para projeto sem áreas", () => {
    expect(projectAreas("proj-inexistente")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/mock-data.test.ts`
Expected: FAIL (`projectAreas` não existe)

- [ ] **Step 3: Implement**

In `src/lib/mock-data.ts`:

1. Add `project_id` to the `Area` interface (after `id`):
```ts
export interface Area {
  id: string;
  project_id: string;
  name: string;
```
2. Add `project_id` to each of the 5 area objects:
   - `area-borrazois`, `area-lagoa-funda`, `area-riacho-limpo` → `project_id: "proj-restauracao-norte"` (Mata Atlântica)
   - `area-serra-verde`, `area-cabeceira` → `project_id: "proj-restauracao-sul"` (Cerrado)
3. Add after the `AREAS` array (before `SENSORS`):
```ts
export const DEMO_PROJECT_IDS = [
  "proj-restauracao-norte",
  "proj-restauracao-sul",
] as const;

export function projectAreas(projectId: string): Area[] {
  return AREAS.filter((area) => area.project_id === projectId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/mock-data.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock-data.ts tests/lib/mock-data.test.ts
git commit -m "feat: associa áreas mockadas a projetos"
```

---

### Task 2: Extrair a régua reutilizável `AreaTimeline`

**Files:**
- Create: `frontend/src/components/features/area-timeline.tsx`
- Delete: `frontend/src/components/features/strata-core.tsx`
- Modify: `frontend/src/app/painel/page.tsx`
- Test: `frontend/tests/components/AreaTimeline.test.tsx`

**Interfaces:**
- Consumes: `Area`, `Monitoring`, `RestorationStatus`, `STATUS_LABEL` (de `@/lib/mock-data`)
- Produces: `AreaTimeline({ areas: Area[]; eyebrow?; title?; description?; className? })` — renderiza `null` quando `areas` está vazio

- [ ] **Step 1: Write the failing test**

Create `tests/components/AreaTimeline.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AreaTimeline } from "@/components/features/area-timeline";
import type { Area } from "@/lib/mock-data";

vi.mock("@/components/reveal", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const areas: Area[] = [
  {
    id: "area-a",
    project_id: "proj-restauracao-norte",
    name: "Borrazóis",
    biome: "Mata Atlântica",
    size_hectares: 42,
    restoration_status: "em_restauracao",
    started_at: "2019-04-12",
    goal: "Reconectar o fragmento florestal.",
    seedlings: 3180,
    survival_rate: 91,
    monitorings: [
      {
        id: "mon-1",
        date: "2019-06-20",
        author: "Carla Nunes",
        notes: "Plantio de 980 mudas concluído.",
        seedling_count: 980,
        avg_height: 0.4,
        species: ["Aroeira", "Angico"],
        photos: [],
      },
    ],
  },
  {
    id: "area-b",
    project_id: "proj-restauracao-norte",
    name: "Serra Verde",
    biome: "Cerrado",
    size_hectares: 18,
    restoration_status: "plantio_recente",
    started_at: "2025-01-15",
    goal: "Recuperar a encosta.",
    seedlings: 920,
    survival_rate: 84,
    monitorings: [],
  },
];

describe("AreaTimeline", () => {
  afterEach(cleanup);

  it("renderiza uma faixa por área com o título", () => {
    render(<AreaTimeline areas={areas} />);
    expect(screen.getByRole("heading", { name: "Borrazóis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Serra Verde" })).toBeInTheDocument();
    expect(screen.getByText("Suas áreas, ao longo do tempo")).toBeInTheDocument();
  });

  it("renderiza null quando não há áreas", () => {
    const { container } = render(<AreaTimeline areas={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("expande a lista de visitas da área", async () => {
    const user = userEvent.setup();
    render(<AreaTimeline areas={areas} />);
    await user.click(screen.getByRole("button", { name: /1 visita registrada/ }));
    expect(screen.getByText(/Plantio de 980 mudas concluído/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/AreaTimeline.test.tsx`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Create `area-timeline.tsx`**

Conteúdo integral (movido de `strata-core.tsx`, com dados via prop e eixo derivado em `useMemo`; visual idêntico):

```tsx
"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  STATUS_LABEL,
  type Area,
  type Monitoring,
  type RestorationStatus,
} from "@/lib/mock-data";
import { Reveal } from "@/components/reveal";
import { HorizonLine } from "@/components/features/horizon-line";
import { PhotoThumb } from "@/components/features/photo-thumb";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;

function toMs(date: string): number {
  return new Date(`${date}T12:00:00`).getTime();
}

const MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function shortDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return `${MONTHS[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`;
}

function fullDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const STATUS_DOT: Record<RestorationStatus, string> = {
  plantio_recente: "border-gold bg-gold",
  em_restauracao: "border-moss bg-moss",
  recuperada: "border-forest bg-forest",
};

const STATUS_BADGE: Record<RestorationStatus, string> = {
  plantio_recente: "border-gold/30 bg-gold/15 text-forest",
  em_restauracao: "border-forest/15 bg-sage/35 text-forest",
  recuperada: "border-forest/20 bg-forest/10 text-forest",
};

function MonitoringList({ area }: { area: Area }) {
  return (
    <ul className="space-y-6">
      {area.monitorings.map((monitoring) => (
        <li key={monitoring.id} className="grid gap-3 sm:grid-cols-[auto_1fr] sm:gap-5">
          <div className="flex gap-2 sm:flex-col">
            {monitoring.photos.length > 0 ? (
              monitoring.photos.slice(0, 2).map((photo) => (
                <PhotoThumb
                  key={photo.id}
                  tone={photo.tone}
                  label={photo.label}
                  className="h-14 w-14 shrink-0 sm:h-16 sm:w-16"
                />
              ))
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-forest/20 font-mono text-[9px] uppercase tracking-wide text-moss/50">
                sem foto
              </span>
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-gold">
                {fullDate(monitoring.date)}
              </span>
              <span className="text-xs text-moss/70">· {monitoring.author}</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-moss">
              {monitoring.notes}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="font-mono text-xs text-forest">
                {monitoring.seedling_count.toLocaleString("pt-BR")} mudas
              </span>
              <span className="font-mono text-xs text-forest">
                {monitoring.avg_height.toLocaleString("pt-BR")} m médios
              </span>
              {monitoring.species.map((species) => (
                <span
                  key={species}
                  className="rounded-full border border-forest/10 bg-forest/5 px-2 py-0.5 text-[11px] text-forest"
                >
                  {species}
                </span>
              ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

interface BandProps {
  area: Area;
  expanded: boolean;
  onToggle: () => void;
  yearMarks: { year: number; left: number }[];
  pct: (ms: number) => number;
}

function Band({ area, expanded, onToggle, yearMarks, pct }: BandProps) {
  return (
    <section className="rounded-2xl border border-forest/10 bg-cream p-6 shadow-sm shadow-forest/5 sm:p-8">
      <div className="md:grid md:grid-cols-[240px_1fr] md:gap-8">
        <div className="md:pr-2">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
            {area.biome}
          </p>
          <h3 className="font-heading mt-1.5 text-2xl leading-tight tracking-tight text-forest">
            {area.name}
          </h3>
          <span
            className={cn(
              "mt-3 inline-block rounded-full border px-2.5 py-1 text-[11px] font-medium",
              STATUS_BADGE[area.restoration_status]
            )}
          >
            {STATUS_LABEL[area.restoration_status]}
          </span>
          <ul className="mt-4 space-y-1 font-mono text-xs text-moss/85">
            <li>
              {area.size_hectares} ha ·{" "}
              {area.seedlings.toLocaleString("pt-BR")} mudas
            </li>
            <li>{area.survival_rate}% de sobrevivência</li>
            <li>desde {new Date(`${area.started_at}T12:00:00`).getFullYear()}</li>
          </ul>
        </div>

        <div className="mt-7 md:mt-0">
          <div className="relative h-16">
            {yearMarks.filter((mark) => mark.left > 0.5 && mark.left < 99.5).map(
              (mark) => (
                <span
                  key={mark.year}
                  aria-hidden="true"
                  className="absolute top-0 h-full w-px border-l border-dashed border-forest/10"
                  style={{ left: `${mark.left}%` }}
                />
              )
            )}
            <span
              aria-hidden="true"
              className="absolute left-0 right-0 top-1/2 h-px bg-forest/15"
            />
            <span
              aria-hidden="true"
              className="absolute top-0 h-full border-l border-dashed border-gold/50"
              style={{ left: "100%" }}
            />

            {area.monitorings.map((monitoring, index) => (
              <button
                key={monitoring.id}
                type="button"
                onClick={onToggle}
                aria-label={`${area.name}, visita de ${fullDate(monitoring.date)}. ${
                  expanded ? "Recolher detalhes." : "Ver detalhes."
                }`}
                className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                style={{ left: `${pct(toMs(monitoring.date))}%` }}
              >
                <span
                  className={cn(
                    "block rounded-full border-2 shadow-sm transition-transform duration-200 group-hover:scale-125",
                    STATUS_DOT[area.restoration_status],
                    index === area.monitorings.length - 1
                      ? "h-4 w-4 border-cream ring-2 ring-forest/20"
                      : "h-3 w-3 border-cream"
                  )}
                />
                <span className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.1em] text-moss/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                  {shortDate(monitoring.date)}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-moss transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-300",
                expanded && "rotate-180"
              )}
              aria-hidden="true"
            />
            {expanded
              ? "Recolher"
              : `${area.monitorings.length} visita${
                  area.monitorings.length === 1 ? "" : "s"
                } registrada${area.monitorings.length === 1 ? "" : "s"}`}
          </button>

          <div
            className={cn(
              "grid transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="overflow-hidden">
              <div className="mt-5 border-t border-forest/10 pt-5">
                <blockquote className="mb-6 border-l-2 border-gold/50 pl-3 text-sm leading-relaxed text-moss/80">
                  Objetivo: {area.goal}
                </blockquote>
                <MonitoringList area={area} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface AreaTimelineProps {
  areas: Area[];
  eyebrow?: string;
  title?: string;
  description?: string;
  className?: string;
}

export function AreaTimeline({
  areas,
  eyebrow = "Perfil de monitoramento",
  title = "Suas áreas, ao longo do tempo",
  description = "Cada faixa é uma área. Os pontos são visitas de monitoramento plotadas na mesma régua de tempo — veja o ritmo da recuperação lado a lado.",
  className,
}: AreaTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const time = useMemo(() => {
    if (areas.length === 0) return null;
    const nowMs = Date.now();
    const startMs = Math.min(...areas.map((area) => toMs(area.started_at)));
    const spanMs = Math.max(nowMs - startMs, DAY_MS);
    const pct = (ms: number): number => {
      const value = Math.min(100, Math.max(0, ((ms - startMs) / spanMs) * 100));
      return Number(value.toFixed(3));
    };
    const yearMarks: { year: number; left: number }[] = [];
    for (
      let year = new Date(startMs).getFullYear();
      year <= new Date(nowMs).getFullYear();
      year++
    ) {
      yearMarks.push({ year, left: pct(new Date(year, 0, 1).getTime()) });
    }
    return { startMs, nowMs, pct, yearMarks };
  }, [areas]);

  function toggleArea(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  if (!time) return null;

  const latestMonitoring = areas.reduce<Monitoring | null>((latest, area) => {
    const areaLatest = area.monitorings[area.monitorings.length - 1];
    if (!areaLatest) return latest;
    if (!latest) return areaLatest;
    return toMs(areaLatest.date) > toMs(latest.date) ? areaLatest : latest;
  }, null);

  return (
    <section
      aria-labelledby="strata-title"
      className={cn("scroll-mt-24", className)}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
            {eyebrow}
          </p>
          <h2
            id="strata-title"
            className="font-heading mt-3 text-2xl leading-[1.1] tracking-tight text-forest sm:text-3xl"
          >
            {title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-moss">
            {description}
          </p>
        </div>

        <ul
          aria-label="Legenda de status"
          className="flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          {(
            [
              ["plantio_recente", "Plantio recente"],
              ["em_restauracao", "Em restauração"],
              ["recuperada", "Recuperada"],
            ] as [RestorationStatus, string][]
          ).map(([status, label]) => (
            <li key={status} className="flex items-center gap-1.5 text-xs text-moss/80">
              <span
                aria-hidden="true"
                className={cn(
                  "inline-block h-2.5 w-2.5 rounded-full border-2 border-cream shadow-sm",
                  STATUS_DOT[status]
                )}
              />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 hidden md:grid md:grid-cols-[240px_1fr] md:gap-8">
        <div />
        <div className="relative h-5">
          {time.yearMarks.filter((mark) => mark.left > 2 && mark.left < 98).map(
            (mark) => (
              <div
                key={mark.year}
                className="absolute top-0 -translate-x-1/2"
                style={{ left: `${mark.left}%` }}
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-moss/50">
                  {mark.year}
                </span>
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-full h-1.5 w-px -translate-x-1/2 bg-forest/20"
                />
              </div>
            )
          )}
          <span className="absolute right-0 top-0 font-mono text-[9px] uppercase tracking-[0.14em] text-gold">
            hoje
          </span>
        </div>
      </div>

      <div className="mt-2 space-y-8">
        {areas.map((area, index) => (
          <Reveal key={area.id} delay={index * 80}>
            <div className="space-y-1.5">
              <Band
                area={area}
                expanded={expandedId === area.id}
                onToggle={() => toggleArea(area.id)}
                yearMarks={time.yearMarks}
                pct={time.pct}
              />
              {index < areas.length - 1 ? (
                <HorizonLine className="mx-1" />
              ) : null}
            </div>
          </Reveal>
        ))}
      </div>

      {latestMonitoring ? (
        <p className="mt-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-moss/50">
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-gold" />
          Última atividade registrada em {fullDate(latestMonitoring.date)}
        </p>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Delete `strata-core.tsx` and update the dashboard**

1. `git rm src/components/features/strata-core.tsx`
2. In `src/app/painel/page.tsx`, replace the import `import { StrataCore } from "@/components/features/strata-core";` with:
```tsx
import { AreaTimeline } from "@/components/features/area-timeline";
import { AREAS } from "@/lib/mock-data";
```
3. Replace `<StrataCore />` with `<AreaTimeline areas={AREAS} />`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/components/AreaTimeline.test.tsx`
Expected: PASS

- [ ] **Step 6: Verify lint, typecheck, full suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add -A src/app/painel/page.tsx src/components/features/area-timeline.tsx src/components/features/strata-core.tsx tests/components/AreaTimeline.test.tsx
git commit -m "refactor: régua de monitoramento reutilizável (AreaTimeline)"
```

---

### Task 3: Breadcrumb hierárquico

**Files:**
- Create: `frontend/src/components/features/painel-breadcrumb.tsx`
- Modify: `frontend/src/components/features/painel-shell.tsx`
- Test: `frontend/tests/components/Breadcrumb.test.tsx`

**Interfaces:**
- Produces: `BreadcrumbProvider`, `useBreadcrumb(segments: string[])`, `useBreadcrumbSegments(): string[]`

- [ ] **Step 1: Write the failing test**

Create `tests/components/Breadcrumb.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  BreadcrumbProvider,
  useBreadcrumb,
  useBreadcrumbSegments,
} from "@/components/features/painel-breadcrumb";

function Probe({ segments }: { segments: string[] }) {
  useBreadcrumb(segments);
  return null;
}

function Trail() {
  const segments = useBreadcrumbSegments();
  return (
    <nav aria-label="breadcrumb">
      {segments.map((segment) => (
        <span key={segment}>{segment}</span>
      ))}
    </nav>
  );
}

function Shell() {
  return (
    <BreadcrumbProvider>
      <Probe segments={["Projetos", "Corredor do Ribeirão"]} />
      <Trail />
    </BreadcrumbProvider>
  );
}

describe("BreadcrumbProvider", () => {
  afterEach(cleanup);

  it("expõe os segmentos registrados pelo hook", async () => {
    render(<Shell />);
    expect(await screen.findByText("Corredor do Ribeirão")).toBeInTheDocument();
    expect(screen.getByText("Projetos")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/Breadcrumb.test.tsx`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Create `painel-breadcrumb.tsx`**

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface BreadcrumbContextValue {
  segments: string[];
  setSegments: (segments: string[]) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

const join = (segments: string[]): string => segments.join("\u0000");

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [segments, setState] = useState<string[]>([]);

  const setSegments = useCallback((next: string[]) => {
    setState((prev) => (join(prev) === join(next) ? prev : next));
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ segments, setSegments }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb(segments: string[]) {
  const context = useContext(BreadcrumbContext);
  const key = join(segments);

  useEffect(() => {
    if (context) context.setSegments(key === "" ? [] : key.split("\u0000"));
  }, [context, key]);
}

export function useBreadcrumbSegments(): string[] {
  const context = useContext(BreadcrumbContext);
  return context?.segments ?? [];
}
```

- [ ] **Step 4: Integrate no `painel-shell.tsx`**

1. Add imports:
```tsx
import {
  BreadcrumbProvider,
  useBreadcrumbSegments,
} from "@/components/features/painel-breadcrumb";
```
2. Add a helper component (top-level, after `sectionLabel`):
```tsx
function BreadcrumbNav({ pathname }: { pathname: string }) {
  const segments = useBreadcrumbSegments();

  return (
    <nav aria-label="Trilha de navegação" className="flex min-w-0 items-center gap-2 text-sm">
      {segments.length > 0 ? (
        segments.map((segment, index) => (
          <Fragment key={`${segment}-${index}`}>
            {index > 0 ? (
              <span className="text-moss/40" aria-hidden="true">
                /
              </span>
            ) : null}
            <span
              className={
                index === segments.length - 1
                  ? "truncate font-medium text-forest"
                  : "truncate text-moss/70"
              }
            >
              {segment}
            </span>
          </Fragment>
        ))
      ) : (
        <span className="truncate font-medium text-forest">
          {sectionLabel(pathname)}
        </span>
      )}
    </nav>
  );
}
```
3. Import `Fragment` from React: `import { Fragment, useState, type ReactNode } from "react";`
4. In `ShellInner`, wrap the outer `<div className="min-h-screen bg-mist">` (and everything inside it) with `<BreadcrumbProvider>`.
5. Replace the existing `<nav aria-label="Trilha de navegação" ...>` block (lines 71–85) with:
```tsx
<BreadcrumbNav pathname={pathname} />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/components/Breadcrumb.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/features/painel-breadcrumb.tsx src/components/features/painel-shell.tsx tests/components/Breadcrumb.test.tsx
git commit -m "feat: breadcrumb hierárquico no painel"
```

---

### Task 4: Seção "Áreas" no detalhe do projeto

**Files:**
- Create: `frontend/src/components/features/project-areas.tsx`
- Modify: `frontend/src/app/painel/projetos/[id]/page.tsx`
- Test: `frontend/tests/components/ProjectAreas.test.tsx`

**Interfaces:**
- Consumes: `projectAreas(projectId)` (Task 1), `AreaTimeline` (Task 2), `useBreadcrumb` (Task 3)
- Produces: `ProjectAreas({ projectId: string })`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ProjectAreas.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectAreas } from "@/components/features/project-areas";

vi.mock("@/components/reveal", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("ProjectAreas", () => {
  afterEach(cleanup);

  it("renderiza a régua com as áreas do projeto demo", () => {
    render(<ProjectAreas projectId="proj-restauracao-norte" />);
    expect(screen.getByRole("heading", { name: "Áreas do projeto" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Borrazóis" })).toBeInTheDocument();
  });

  it("mostra convite vazio para projeto sem áreas", () => {
    render(<ProjectAreas projectId="proj-sem-areas" />);
    expect(
      screen.getByText("As áreas deste projeto aparecem aqui"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Áreas do projeto" }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/ProjectAreas.test.tsx`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Create `project-areas.tsx`**

```tsx
import { Map } from "lucide-react";
import { AreaTimeline } from "@/components/features/area-timeline";
import { projectAreas } from "@/lib/mock-data";

interface ProjectAreasProps {
  projectId: string;
}

export function ProjectAreas({ projectId }: ProjectAreasProps) {
  const areas = projectAreas(projectId);

  if (areas.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-forest/20 bg-cream/60 px-6 py-10 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-forest/8 text-forest">
          <Map className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="font-heading mt-5 text-xl tracking-tight text-forest">
          As áreas deste projeto aparecem aqui
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-moss">
          Cadastre as áreas de restauração do projeto e elas entram na régua de
          monitoramento, com as visitas de campo ao longo do tempo.
        </p>
      </section>
    );
  }

  return (
    <AreaTimeline
      areas={areas}
      eyebrow="Restauração"
      title="Áreas do projeto"
      description="Cada faixa é uma área deste projeto. Os pontos são visitas de monitoramento plotadas na mesma régua de tempo."
    />
  );
}
```

- [ ] **Step 4: Integrar no detalhe do projeto**

Modify `src/app/painel/projetos/[id]/page.tsx`:

1. Add imports:
```tsx
import { useBreadcrumb } from "@/components/features/painel-breadcrumb";
import { ProjectAreas } from "@/components/features/project-areas";
```
2. **Right after the `useQuery(...)` block and BEFORE any early return** (Rules of Hooks — the page has `if (isPending) return ...`), add:
```tsx
useBreadcrumb(data ? ["Projetos", data.name] : ["Projetos"]);
```
3. Replace the `<p className="rounded-2xl border border-dashed ...">A página de detalhe com áreas e métricas do projeto está em construção.</p>` block (current lines 137–139) with:
```tsx
<ProjectAreas projectId={params.id} />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/components/ProjectAreas.test.tsx`
Expected: PASS

- [ ] **Step 6: Lint + typecheck + suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add src/components/features/project-areas.tsx src/app/painel/projetos/[id]/page.tsx tests/components/ProjectAreas.test.tsx
git commit -m "feat: seção de áreas no detalhe do projeto"
```

---

### Task 5: Sidebar hierárquica por contexto

**Files:**
- Modify: `frontend/src/components/features/sidebar.tsx`
- Test: `frontend/tests/components/Sidebar.test.tsx`

**Interfaces:**
- Consumes: nada novo
- Produces: sidebar com grupos "Monitoramento" (Visão geral, Projetos) e "Acervo" (Fotos, Configurações)

- [ ] **Step 1: Write the failing test**

Create `tests/components/Sidebar.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/features/sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/painel/projetos",
}));

vi.mock("@/components/features/user-provider", () => ({
  useUser: () => ({
    organization: { id: "org-1", name: "Instituto Folha Verde", role: "manager" },
    user: null,
  }),
}));

describe("Sidebar", () => {
  afterEach(cleanup);

  it("mostra a navegação hierárquica por contexto", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /Visão geral/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Projetos/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Fotos/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configurações/ })).toBeInTheDocument();
  });

  it("não lista Áreas, Monitoramentos e Sensores no nível raiz", () => {
    render(<Sidebar />);
    expect(screen.queryByRole("link", { name: /Áreas/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Monitoramentos/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Sensores/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/Sidebar.test.tsx`
Expected: FAIL (Áreas/Monitoramentos/Sensores ainda presentes)

- [ ] **Step 3: Implement**

Modify `src/components/features/sidebar.tsx`:

1. Replace the icon import line (keep `Sprout`, still used by the logo):
```tsx
import { FolderTree, Images, LayoutDashboard, Settings, Sprout } from 'lucide-react'
```
2. Replace `MONITORING_NAV`:
```tsx
const MONITORING_NAV = [
   { href: '/painel', label: 'Visão geral', icon: LayoutDashboard },
   { href: '/painel/projetos', label: 'Projetos', icon: FolderTree },
]
```
3. Keep `ARCHIVE_NAV` (Fotos, Configurações) sem alteração.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/Sidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Lint + typecheck + suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/components/features/sidebar.tsx tests/components/Sidebar.test.tsx
git commit -m "feat: sidebar hierárquica por contexto"
```

---

### Task 6: Verificação final

**Files:** nenhum

- [ ] **Step 1: Suíte completa**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass

- [ ] **Step 2: Verificação manual**

Run: `npm run dev`

1. Acesse `/painel`: a régua aparece idêntica ao antes.
2. A sidebar mostra só Visão geral, Projetos, Fotos, Configurações.
3. Abra um projeto: breadcrumb mostra "Projetos / <nome>"; a seção "Áreas do projeto" mostra o convite vazio (projetos reais usam UUID, sem áreas mock).
4. Para ver a régua em um projeto: edite o `project_id` de uma área mock em `src/lib/mock-data.ts` para o UUID do projeto criado, recarregue a página.
5. Em mobile, o sheet lateral usa a mesma sidebar reduzida.

- [ ] **Step 3: Correções (se houver)**

Se a verificação manual ou o lint apontarem problemas, corrija e refaça `npm run lint && npm run typecheck && npm test`.

- [ ] **Step 4: Commit final (se houver mudanças)**

```bash
git add -A
git commit -m "fix: ajustes finais da navegação hierárquica"
```

---

## Follow-ups (fora deste plano)

Página de detalhe de Área, página de detalhe de Monitoramento (com comparação antes/depois), Acervo de Fotos (lightbox/filtros), Sensores por área, endpoints de fotos no backend, busca global, CTA context-aware, wiring real de API substituindo mock.
