# Página de Detalhes da Área Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao clicar em uma área na régua de tempo do projeto, abrir uma página com todos os detalhes da área e os monitoramentos em lista paginada (server-side).

**Architecture:** Página client-component em `/painel/projetos/[id]/areas/[areaId]` usando React Query (mesmo padrão de `projetos/[id]/page.tsx`). Busca a área via `GET /areas/{area_id}`, o projeto (para breadcrumb) via `GET /projects/{project_id}` e os monitoramentos paginados via `GET /areas/{area_id}/monitorings?offset=&limit=`. Lista de monitoramentos renderizada por componente dedicado `monitoring-list.tsx`; controles de paginação ficam na página. O mapeamento de status é movido para módulo compartilhado `src/lib/status.ts`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, TanStack Query 5, TailwindCSS, lucide-react, vitest + @testing-library/react.

## Global Constraints

- Não alterar o backend (já está paginado e com `goal`/`recent_monitorings` em `AreaRead`).
- Seguir `AGENTS-FRONTEND.md` e o aviso do `AGENTS.md` sobre Next 16 (rotas dinâmicas): em Client Components usar `useParams` de `next/navigation` (o padrão já usado em `projetos/[id]/page.tsx`); `params` como Promise só vale para Server Components.
- Componentes em PascalCase em arquivo homônimo; `'use client'` apenas quando necessário; imports na ordem React → Next → libs → internos.
- Tailwind utility classes exclusivamente; paleta existente (`forest`, `moss`, `gold`, `cream`, `soil`, `mist`, `sage`).
- Dados de API via `apiFetch<T>(path, { auth: true })` com caminhos relativos `/api/v1/...`.
- Testes com vitest + @testing-library/react em `tests/`; mocks de `@/lib/api` via `vi.mock`.
- Comandos de verificação (rodar no `frontend/`): `npm test`, `npm run lint`, `npm run typecheck`.
- Indentação dos arquivos novos: 2 espaços (padrão de `area-timeline.tsx`/`project-areas.tsx`).

---

### Task 1: Módulo compartilhado de status

Extrai `RestorationStatus`, `STATUS_LABEL`, `STATUS_BADGE` e `STATUS_DOT` para `src/lib/status.ts`, removendo as definições duplicadas de `mock-data.ts` e `area-timeline.tsx`. Sem mudança de comportamento — a verificação é a suíte existente continuar passando.

**Files:**
- Create: `frontend/src/lib/status.ts`
- Modify: `frontend/src/lib/mock-data.ts:1-5` e `frontend/src/lib/mock-data.ts:466-471`
- Modify: `frontend/src/components/features/area-timeline.tsx:3-14`, `:44-56`

**Interfaces:**
- Consumes: nada.
- Produces: `src/lib/status.ts` exporta `type RestorationStatus` e os consts `STATUS_LABEL`, `STATUS_BADGE`, `STATUS_DOT`, todos `Record<RestorationStatus, string>`. `mock-data.ts` continua exportando `RestorationStatus` (re-export) e `Area`, `Monitoring`, `AREAS`, etc. sem `STATUS_LABEL`.

- [ ] **Step 1: Criar `src/lib/status.ts`**

```ts
export type RestorationStatus =
  | "planned"
  | "active"
  | "completed"
  | "cancelled";

export const STATUS_LABEL: Record<RestorationStatus, string> = {
  planned: "Planejada",
  active: "Em restauração",
  completed: "Recuperada",
  cancelled: "Cancelada",
};

export const STATUS_BADGE: Record<RestorationStatus, string> = {
  planned: "border-gold/30 bg-gold/15 text-forest",
  active: "border-forest/15 bg-sage/35 text-forest",
  completed: "border-forest/20 bg-forest/10 text-forest",
  cancelled: "border-soil/30 bg-soil/15 text-moss",
};

export const STATUS_DOT: Record<RestorationStatus, string> = {
  planned: "border-gold bg-gold",
  active: "border-moss bg-moss",
  completed: "border-forest bg-forest",
  cancelled: "border-soil bg-soil",
};
```

- [ ] **Step 2: Remover a definição local de `RestorationStatus` de `mock-data.ts`**

Substituir as linhas 1-5:

```ts
export type RestorationStatus =
  | "planned"
  | "active"
  | "completed"
  | "cancelled";
```

por (importa do módulo novo e mantém o export público para os consumidores existentes):

```ts
import { type RestorationStatus } from "./status";

export type { RestorationStatus };
```

- [ ] **Step 3: Remover `STATUS_LABEL` de `mock-data.ts`**

Apagar o bloco `export const STATUS_LABEL: Record<RestorationStatus, string> = {...}` (linhas 466-471).

- [ ] **Step 4: Atualizar imports de `area-timeline.tsx`**

Substituir o bloco de imports atual:

```ts
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
```

por:

```ts
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { type Area, type Monitoring } from "@/lib/mock-data";
import {
  STATUS_BADGE,
  STATUS_DOT,
  STATUS_LABEL,
  type RestorationStatus,
} from "@/lib/status";
import { Reveal } from "@/components/reveal";
import { HorizonLine } from "@/components/features/horizon-line";
import { PhotoThumb } from "@/components/features/photo-thumb";
import { cn } from "@/lib/utils";
```

- [ ] **Step 5: Remover `STATUS_DOT` e `STATUS_BADGE` de `area-timeline.tsx`**

Apagar as definições locais:

```ts
const STATUS_DOT: Record<RestorationStatus, string> = {
  planned: "border-gold bg-gold",
  active: "border-moss bg-moss",
  completed: "border-forest bg-forest",
  cancelled: "border-soil bg-soil",
};

const STATUS_BADGE: Record<RestorationStatus, string> = {
  planned: "border-gold/30 bg-gold/15 text-forest",
  active: "border-forest/15 bg-sage/35 text-forest",
  completed: "border-forest/20 bg-forest/10 text-forest",
  cancelled: "border-soil/30 bg-soil/15 text-moss",
};
```

- [ ] **Step 6: Verificar**

Run: `npm test` e `npm run lint` e `npm run typecheck` (no `frontend/`)
Expected: todos os testes existentes passam (incluindo `AreaTimeline.test.tsx` e `ProjectAreas.test.tsx`); lint e typecheck sem erros.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/status.ts frontend/src/lib/mock-data.ts frontend/src/components/features/area-timeline.tsx
git commit -m "refactor: mapeamento de status em módulo compartilhado"
```

---

### Task 2: API client — `goal` em `AreaRead`, `getArea` e `listAreaMonitorings`

Adiciona ao `src/lib/api.ts` os helpers tipados para a página de detalhe da área.

**Files:**
- Modify: `frontend/src/lib/api.ts:208-219` (área de tipos) e fim do arquivo (funções)
- Test: `frontend/tests/lib/api.test.ts`

**Interfaces:**
- Consumes: `apiFetch<T>`, `Paginated<T>`, `MonitoringRead`, `AreaRead` (já existem em `src/lib/api.ts`).
- Produces: `getArea(areaId: string): Promise<AreaRead>` e `listAreaMonitorings(areaId: string, offset: number, limit: number): Promise<Paginated<MonitoringRead>>`. `AreaRead` ganha `goal?: string | null`.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao fim de `tests/lib/api.test.ts` (e incluir `getArea`, `listAreaMonitorings` no bloco de import do topo do arquivo):

```ts
describe("área e monitoramentos", () => {
  const area = {
    id: "area-1",
    project_id: "proj-1",
    name: "Borrazóis",
    goal: "Reconectar o fragmento florestal.",
    size_hectares: 42,
    biome: "Mata Atlântica",
    restoration_status: "active",
    created_at: "2024-05-01T00:00:00Z",
    updated_at: "2024-05-01T00:00:00Z",
  };

  beforeEach(() => {
    setSession(
      { access_token: "abc", refresh_token: "def", token_type: "bearer" },
      true,
    );
  });

  it("busca uma área por id com autorização", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(area), { status: 200 })),
    );

    await expect(getArea("area-1")).resolves.toEqual(area);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/v1/areas/area-1");
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe(
      "Bearer abc",
    );
  });

  it("lista monitoramentos paginados de uma área", async () => {
    const body = {
      items: [
        {
          id: "mon-1",
          area_id: "area-1",
          visit_date: "2024-06-01",
          created_at: "2024-06-01T00:00:00Z",
          updated_at: "2024-06-01T00:00:00Z",
        },
      ],
      total: 12,
      offset: 10,
      limit: 10,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
    );

    const result = await listAreaMonitorings("area-1", 10, 10);

    expect(result).toEqual(body);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/v1/areas/area-1/monitorings?offset=10&limit=10");
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- tests/lib/api.test.ts`
Expected: FAIL — `getArea` não é uma função / não é exportada (erro de import).

- [ ] **Step 3: Implementar**

Em `src/lib/api.ts`:

1. Adicionar `goal?: string | null` ao `AreaRead` (após `name`):

```ts
export interface AreaRead {
  id: string;
  project_id: string;
  name: string;
  goal?: string | null;
  size_hectares?: number | null;
  biome?: string | null;
  coordinates?: Record<string, unknown> | null;
  restoration_status: RestorationStatus;
  recent_monitorings?: MonitoringRead[];
  created_at: string;
  updated_at: string;
}
```

2. Adicionar ao fim do arquivo:

```ts
export function getArea(areaId: string): Promise<AreaRead> {
  return apiFetch<AreaRead>(`/areas/${areaId}`, { auth: true });
}

export function listAreaMonitorings(
  areaId: string,
  offset: number,
  limit: number,
): Promise<Paginated<MonitoringRead>> {
  return apiFetch<Paginated<MonitoringRead>>(
    `/areas/${areaId}/monitorings?offset=${offset}&limit=${limit}`,
    { auth: true },
  );
}
```

- [ ] **Step 4: Rodar o teste para verificar que passa**

Run: `npm test -- tests/lib/api.test.ts`
Expected: PASS (16 testes).

- [ ] **Step 5: Verificação geral + Commit**

Run: `npm run lint` e `npm run typecheck`
Expected: sem erros.

```bash
git add frontend/src/lib/api.ts frontend/tests/lib/api.test.ts
git commit -m "feat: helpers de API para área e monitoramentos paginados"
```

---

### Task 3: Componente `MonitoringList`

Lista os monitoramentos (`MonitoringRead[]`) com data completa, notas, mudas, altura média e chips de espécies. Não contém paginação (a página controla). Retorna `null` quando a lista é vazia.

**Files:**
- Create: `frontend/src/components/features/monitoring-list.tsx`
- Test: `frontend/tests/components/MonitoringList.test.tsx`

**Interfaces:**
- Consumes: `type MonitoringRead` de `@/lib/api`.
- Produces: `export function MonitoringList({ items }: { items: MonitoringRead[] }): JSX.Element | null` — usado pela página na Task 4.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/components/MonitoringList.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MonitoringList } from "@/components/features/monitoring-list";
import type { MonitoringRead } from "@/lib/api";

const items: MonitoringRead[] = [
  {
    id: "mon-1",
    area_id: "area-1",
    visit_date: "2024-06-01",
    notes: "Plantio concluído no quadrante 1.",
    seedling_count: 980,
    avg_height: 0.4,
    species_data: { Aroeira: {}, Angico: {} },
    created_at: "2024-06-01T10:00:00Z",
    updated_at: "2024-06-01T10:00:00Z",
  },
];

describe("MonitoringList", () => {
  afterEach(cleanup);

  it("renderiza data, notas, mudas, altura e espécies", () => {
    render(<MonitoringList items={items} />);
    expect(screen.getByText(/1 de junho de 2024/)).toBeInTheDocument();
    expect(screen.getByText(/Plantio concluído no quadrante 1/i)).toBeInTheDocument();
    expect(screen.getByText("980 mudas")).toBeInTheDocument();
    expect(screen.getByText("0,4 m médios")).toBeInTheDocument();
    expect(screen.getByText("Aroeira")).toBeInTheDocument();
    expect(screen.getByText("Angico")).toBeInTheDocument();
  });

  it("não renderiza nada quando a lista está vazia", () => {
    const { container } = render(<MonitoringList items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- tests/components/MonitoringList.test.tsx`
Expected: FAIL — módulo não encontrado / componente não exportado.

- [ ] **Step 3: Implementar**

Criar `src/components/features/monitoring-list.tsx`:

```tsx
import type { MonitoringRead } from "@/lib/api";

function fullDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

interface MonitoringListProps {
  items: MonitoringRead[];
}

export function MonitoringList({ items }: MonitoringListProps) {
  if (items.length === 0) return null;

  return (
    <ul className="space-y-6">
      {items.map((monitoring) => (
        <li
          key={monitoring.id}
          className="grid gap-2 sm:grid-cols-[auto_1fr] sm:gap-5"
        >
          <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-gold">
            {fullDate(monitoring.visit_date)}
          </span>
          <div>
            {monitoring.notes ? (
              <p className="text-sm leading-relaxed text-moss">{monitoring.notes}</p>
            ) : null}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {monitoring.seedling_count != null ? (
                <span className="font-mono text-xs text-forest">
                  {monitoring.seedling_count.toLocaleString("pt-BR")} mudas
                </span>
              ) : null}
              {monitoring.avg_height != null ? (
                <span className="font-mono text-xs text-forest">
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
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Rodar o teste para verificar que passa**

Run: `npm test -- tests/components/MonitoringList.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/features/monitoring-list.tsx frontend/tests/components/MonitoringList.test.tsx
git commit -m "feat: lista de monitoramentos reutilizável"
```

---

### Task 4: Página de detalhes da área com monitoramentos paginados

Cria a rota client-component `/painel/projetos/[id]/areas/[areaId]`. Busca área, projeto (breadcrumb) e monitoramentos paginados; renderiza detalhes, lista e controles Anterior/Próxima com estados de loading, erro e vazio.

**Files:**
- Create: `frontend/src/app/painel/projetos/[id]/areas/[areaId]/page.tsx`
- Test: `frontend/tests/components/AreaDetailPage.test.tsx`

**Interfaces:**
- Consumes: `getArea`, `listAreaMonitorings`, `apiFetch`, `type ProjectRead` de `@/lib/api`; `STATUS_BADGE`, `STATUS_LABEL` de `@/lib/status`; `MonitoringList` da Task 3; `useBreadcrumb` de `@/components/features/painel-breadcrumb`; `cn` de `@/lib/utils`.
- Produces: `export default function AreaDetailPage()` — rota consumida pelo link da Task 5.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/components/AreaDetailPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AreaDetailPage from "@/app/painel/projetos/[id]/areas/[areaId]/page";
import type { AreaRead, MonitoringRead, ProjectRead } from "@/lib/api";

const { getAreaMock, listAreaMonitoringsMock, apiFetchMock } = vi.hoisted(() => ({
  getAreaMock: vi.fn(),
  listAreaMonitoringsMock: vi.fn(),
  apiFetchMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "proj-1", areaId: "area-1" }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getArea: getAreaMock,
    listAreaMonitorings: listAreaMonitoringsMock,
    apiFetch: apiFetchMock,
  };
});

const project: ProjectRead = {
  id: "proj-1",
  organization_id: "org-1",
  name: "Corredor do Ribeirão",
  description: null,
  goal: null,
  start_date: null,
  responsible: null,
  created_at: "2024-05-01T00:00:00Z",
  updated_at: "2024-05-01T00:00:00Z",
};

const area: AreaRead = {
  id: "area-1",
  project_id: "proj-1",
  name: "Borrazóis",
  goal: "Reconectar o fragmento florestal.",
  size_hectares: 42,
  biome: "Mata Atlântica",
  restoration_status: "active",
  recent_monitorings: [],
  created_at: "2024-05-01T00:00:00Z",
  updated_at: "2024-05-01T00:00:00Z",
};

const monitoring = (id: string, visitDate: string): MonitoringRead => ({
  id,
  area_id: "area-1",
  visit_date: visitDate,
  notes: `Visita ${id}`,
  seedling_count: 100,
  avg_height: 1,
  species_data: { Aroeira: {} },
  created_at: `${visitDate}T10:00:00Z`,
  updated_at: `${visitDate}T10:00:00Z`,
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AreaDetailPage />
    </QueryClientProvider>,
  );
}

describe("AreaDetailPage", () => {
  beforeEach(() => {
    getAreaMock.mockReset();
    listAreaMonitoringsMock.mockReset();
    apiFetchMock.mockReset();
  });

  afterEach(cleanup);

  it("renderiza os detalhes da área e a primeira página de monitoramentos", async () => {
    apiFetchMock.mockResolvedValue(project);
    getAreaMock.mockResolvedValue(area);
    listAreaMonitoringsMock.mockResolvedValue({
      items: [monitoring("mon-1", "2024-06-01"), monitoring("mon-2", "2024-07-01")],
      total: 2,
      offset: 0,
      limit: 10,
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Borrazóis" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mata Atlântica")).toBeInTheDocument();
    expect(screen.getByText("42 ha")).toBeInTheDocument();
    expect(screen.getByText(/Reconectar o fragmento florestal/)).toBeInTheDocument();
    expect(await screen.findByText(/Visita mon-1/)).toBeInTheDocument();
    expect(screen.getByText(/Visita mon-2/)).toBeInTheDocument();
    expect(screen.getByText("2 visitas registradas")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Voltar para o projeto/ }),
    ).toHaveAttribute("href", "/painel/projetos/proj-1");
  });

  it("navega para a próxima página e busca com novo offset", async () => {
    apiFetchMock.mockResolvedValue(project);
    getAreaMock.mockResolvedValue(area);
    listAreaMonitoringsMock.mockResolvedValue({
      items: [monitoring("mon-1", "2024-06-01")],
      total: 12,
      offset: 0,
      limit: 10,
    });

    renderPage();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Próxima/ }));

    expect(listAreaMonitoringsMock).toHaveBeenLastCalledWith("area-1", 10, 10);
    expect(await screen.findByText("Página 2 de 2")).toBeInTheDocument();
  });

  it("desabilita Anterior na primeira página e Próxima na última", async () => {
    apiFetchMock.mockResolvedValue(project);
    getAreaMock.mockResolvedValue(area);
    listAreaMonitoringsMock.mockResolvedValue({
      items: [monitoring("mon-1", "2024-06-01")],
      total: 12,
      offset: 0,
      limit: 10,
    });

    renderPage();

    const user = userEvent.setup();
    expect(await screen.findByRole("button", { name: /Anterior/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Próxima/ }));

    expect(await screen.findByRole("button", { name: /Próxima/ })).toBeDisabled();
  });

  it("mostra estado vazio quando não há monitoramentos", async () => {
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
      await screen.findByText("Nenhuma visita registrada"),
    ).toBeInTheDocument();
  });

  it("mostra erro quando a área não carrega", async () => {
    apiFetchMock.mockResolvedValue(project);
    getAreaMock.mockRejectedValue(new Error("falha de rede"));
    listAreaMonitoringsMock.mockResolvedValue({ items: [], total: 0, offset: 0, limit: 10 });

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível carregar a área/i,
    );
  });

  it("mostra erro na lista de monitoramentos com retry", async () => {
    apiFetchMock.mockResolvedValue(project);
    getAreaMock.mockResolvedValue(area);
    listAreaMonitoringsMock.mockRejectedValue(new Error("falha de rede"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível carregar os monitoramentos/i,
    );
    expect(
      screen.getByRole("button", { name: /Tentar novamente/ }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- tests/components/AreaDetailPage.test.tsx`
Expected: FAIL — módulo `page.tsx` não existe.

- [ ] **Step 3: Implementar**

Criar `src/app/painel/projetos/[id]/areas/[areaId]/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  RefreshCw,
  Ruler,
} from "lucide-react";
import { apiFetch, getArea, listAreaMonitorings, type ProjectRead } from "@/lib/api";
import { STATUS_BADGE, STATUS_LABEL } from "@/lib/status";
import { useBreadcrumb } from "@/components/features/painel-breadcrumb";
import { MonitoringList } from "@/components/features/monitoring-list";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

interface PaginationControlsProps {
  total: number;
  offset: number;
  pageSize: number;
  onOffsetChange: (offset: number) => void;
}

function PaginationControls({
  total,
  offset,
  pageSize,
  onOffsetChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.floor(offset / pageSize) + 1;
  const canPrev = offset > 0;
  const canNext = offset + pageSize < total;

  return (
    <nav
      aria-label="Paginação de monitoramentos"
      className="mt-8 flex items-center justify-between gap-3"
    >
      <button
        type="button"
        onClick={() => onOffsetChange(Math.max(0, offset - pageSize))}
        disabled={!canPrev}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest/15 bg-cream px-4 text-sm font-medium text-forest transition-colors hover:border-forest/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Anterior
      </button>
      <span className="font-mono text-xs text-moss">
        Página {page} de {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onOffsetChange(offset + pageSize)}
        disabled={!canNext}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest/15 bg-cream px-4 text-sm font-medium text-forest transition-colors hover:border-forest/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist disabled:cursor-not-allowed disabled:opacity-40"
      >
        Próxima
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}

export default function AreaDetailPage() {
  const params = useParams<{ id: string; areaId: string }>();
  const [offset, setOffset] = useState(0);

  const areaQuery = useQuery({
    queryKey: ["area", params.areaId],
    queryFn: () => getArea(params.areaId),
  });

  const projectQuery = useQuery({
    queryKey: ["project", params.id],
    queryFn: () => apiFetch<ProjectRead>(`/projects/${params.id}`, { auth: true }),
  });

  const monitoringsQuery = useQuery({
    queryKey: ["area-monitorings", params.areaId, offset],
    queryFn: () => listAreaMonitorings(params.areaId, offset, PAGE_SIZE),
  });

  const area = areaQuery.data;

  useBreadcrumb(
    area
      ? ["Projetos", projectQuery.data?.name ?? "Projeto", area.name]
      : ["Projetos", "Área"],
  );

  if (areaQuery.isPending) {
    return (
      <div role="status" aria-label="Carregando área" className="max-w-6xl space-y-4">
        <div className="h-4 w-24 animate-pulse rounded-full bg-forest/10" />
        <div className="h-8 w-1/2 animate-pulse rounded-md bg-forest/10" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-forest/8" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-forest/8" />
      </div>
    );
  }

  if (areaQuery.isError || !area) {
    return (
      <div
        role="alert"
        className="max-w-6xl rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-12 text-center"
      >
        <h1 className="font-heading text-xl tracking-tight text-forest">
          Não foi possível carregar a área
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-moss">
          Verifique sua conexão e tente novamente.
        </p>
        <button
          type="button"
          onClick={() => areaQuery.refetch()}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const startLabel = formatDate(area.created_at);
  const total = monitoringsQuery.data?.total;

  return (
    <div className="max-w-6xl space-y-8">
      <Link
        href={`/painel/projetos/${area.project_id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-moss transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar para o projeto
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Área
          </p>
          <h1 className="font-heading mt-3 text-3xl leading-[1.05] tracking-tight text-forest sm:text-4xl">
            {area.name}
          </h1>
        </div>
        <span
          className={cn(
            "inline-block rounded-full border px-2.5 py-1 text-[11px] font-medium",
            STATUS_BADGE[area.restoration_status],
          )}
        >
          {STATUS_LABEL[area.restoration_status]}
        </span>
      </header>

      {area.goal ? (
        <section className="max-w-6xl rounded-2xl border border-forest/10 bg-cream p-6 shadow-sm shadow-forest/5 sm:p-8">
          <h2 className="font-heading text-xl tracking-tight text-forest">Objetivo</h2>
          <p className="mt-2 text-sm leading-relaxed text-moss">{area.goal}</p>
        </section>
      ) : null}

      <dl className="grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2">
        {startLabel ? (
          <div className="rounded-2xl border border-forest/10 bg-cream px-5 py-4 shadow-sm shadow-forest/5">
            <dt className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              Início
            </dt>
            <dd className="mt-2 text-sm font-medium text-forest">{startLabel}</dd>
          </div>
        ) : null}
        {area.biome ? (
          <div className="rounded-2xl border border-forest/10 bg-cream px-5 py-4 shadow-sm shadow-forest/5">
            <dt className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Bioma
            </dt>
            <dd className="mt-2 text-sm font-medium text-forest">{area.biome}</dd>
          </div>
        ) : null}
        {area.size_hectares != null ? (
          <div className="rounded-2xl border border-forest/10 bg-cream px-5 py-4 shadow-sm shadow-forest/5">
            <dt className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
              <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
              Tamanho
            </dt>
            <dd className="mt-2 text-sm font-medium text-forest">
              {area.size_hectares.toLocaleString("pt-BR")} ha
            </dd>
          </div>
        ) : null}
      </dl>

      <section aria-labelledby="monitorings-title" className="scroll-mt-24">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Campo
          </p>
          <h2
            id="monitorings-title"
            className="font-heading mt-3 text-2xl leading-[1.1] tracking-tight text-forest sm:text-3xl"
          >
            Monitoramentos
          </h2>
          {total != null ? (
            <p className="mt-3 text-sm leading-relaxed text-moss">
              {total} visita{total === 1 ? "" : "s"} registrada{total === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        <div className="mt-6">
          {monitoringsQuery.isPending ? (
            <div
              role="status"
              aria-label="Carregando monitoramentos"
              className="space-y-4"
            >
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-forest/5" />
              ))}
            </div>
          ) : monitoringsQuery.isError ? (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center"
            >
              <p className="font-heading text-lg tracking-tight text-forest">
                Não foi possível carregar os monitoramentos
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-moss">
                Verifique sua conexão e tente novamente.
              </p>
              <button
                type="button"
                onClick={() => monitoringsQuery.refetch()}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Tentar novamente
              </button>
            </div>
          ) : monitoringsQuery.data.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-forest/20 bg-cream/60 px-6 py-10 text-center">
              <h3 className="font-heading mt-5 text-xl tracking-tight text-forest">
                Nenhuma visita registrada
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-moss">
                As visitas de campo desta área aparecem aqui, ordenadas da mais
                recente para a mais antiga.
              </p>
            </div>
          ) : (
            <>
              <MonitoringList items={monitoringsQuery.data.items} />
              <PaginationControls
                total={monitoringsQuery.data.total}
                offset={offset}
                pageSize={PAGE_SIZE}
                onOffsetChange={setOffset}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Rodar o teste para verificar que passa**

Run: `npm test -- tests/components/AreaDetailPage.test.tsx`
Expected: PASS (6 testes).

- [ ] **Step 5: Verificação geral + Commit**

Run: `npm test`, `npm run lint`, `npm run typecheck`
Expected: suíte completa passando; lint e typecheck sem erros.

```bash
git add "frontend/src/app/painel/projetos/[id]/areas/[areaId]/page.tsx" frontend/tests/components/AreaDetailPage.test.tsx
git commit -m "feat: página de detalhes da área com monitoramentos paginados"
```

---

### Task 5: Link do nome da área na régua do projeto

Torna o nome da área (dentro de cada `Band` da `AreaTimeline`) um link para a página de detalhes. Preserva o `<h3>` para não quebrar semântica/testes existentes.

**Files:**
- Modify: `frontend/src/components/features/area-timeline.tsx:3-4` (import) e `:130-132` (nome da área)
- Test: `frontend/tests/components/AreaTimeline.test.tsx`

**Interfaces:**
- Consumes: rota `/painel/projetos/[id]/areas/[areaId]` da Task 4; `area.project_id` e `area.id` do tipo `Area` (mock-data).
- Produces: `Band` com o nome da área como `Link`; nada novo consumido por outras tasks.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao fim do `describe("AreaTimeline", ...)` em `tests/components/AreaTimeline.test.tsx`:

```tsx
  it("torna o nome da área um link para a página da área", () => {
    render(<AreaTimeline areas={areas} />);
    const link = screen.getByRole("link", { name: "Borrazóis" });
    expect(link).toHaveAttribute(
      "href",
      "/painel/projetos/proj-restauracao-norte/areas/area-a",
    );
  });
```

`areas[0]` é `{ id: "area-a", project_id: "proj-restauracao-norte", name: "Borrazóis", ... }`.

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- tests/components/AreaTimeline.test.tsx`
Expected: FAIL — nenhum link com nome "Borrazóis" encontrado.

- [ ] **Step 3: Implementar**

Em `src/components/features/area-timeline.tsx`:

1. Adicionar import de `Link` de `next/link` (depois de `import { ChevronDown } from "lucide-react";`):

```tsx
import Link from "next/link";
```

2. Substituir o heading do nome da área (atualmente):

```tsx
          <h3 className="font-heading mt-1.5 text-2xl leading-tight tracking-tight text-forest">
            {area.name}
          </h3>
```

por:

```tsx
          <Link
            href={`/painel/projetos/${area.project_id}/areas/${area.id}`}
            className="mt-1.5 inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
          >
            <h3 className="font-heading text-2xl leading-tight tracking-tight text-forest transition-colors hover:text-forest/80">
              {area.name}
            </h3>
          </Link>
```

- [ ] **Step 4: Rodar o teste para verificar que passa**

Run: `npm test -- tests/components/AreaTimeline.test.tsx`
Expected: PASS (5 testes) — os testes antigos de heading continuam passando porque o `<h3>` foi preservado.

- [ ] **Step 5: Verificação geral + Commit**

Run: `npm test`, `npm run lint`, `npm run typecheck`
Expected: suíte completa passando (incluindo `ProjectAreas.test.tsx`); sem erros.

```bash
git add frontend/src/components/features/area-timeline.tsx frontend/tests/components/AreaTimeline.test.tsx
git commit -m "feat: nome da área linka para a página de detalhes"
```
