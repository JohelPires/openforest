# Detalhe de Monitoramento em Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir clicar em um monitoramento na página da área e abrir um dialog com todos os detalhes da visita e todas as fotos.

**Architecture:** A página da área mantém `selected: MonitoringListItem | null`. `MonitoringList` ganha prop `onSelect` e cada item vira um botão. O dialog (`@base-ui/react/dialog`) exibe os dados já presentes no item da lista (sem re-fetch) e busca as fotos via `useInfiniteQuery` em `GET /monitorings/{id}/photos`; cada foto é renderizada baixando o blob autenticado de `GET /photos/{id}/download`.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · TanStack Query · `@base-ui/react/dialog` · Tailwind v4 · vitest + @testing-library/react.

## Global Constraints

- Escopo **somente frontend** (`frontend/`). Nenhuma mudança no backend.
- TDD: escrever o teste que falha antes da implementação.
- Convenções do projeto: client components com `"use client"` quando usam hooks; React Query para fetching; `apiFetch` com `auth: true`; Tailwind utility classes; paleta `forest`, `moss`, `gold`, `cream`, `soil`, `mist`.
- Tipos: `interface` para props/objetos; `type` para uniões.
- Copiar exatamente os nomes de tipos/funções definidos nos blocos "Produces" das tasks — as tasks vizinhas dependem deles.
- Comandos (rodar em `frontend/`): testes `npm test -- <arquivo>`; typecheck `npm run typecheck`; lint `npm run lint`.
- Commit a cada task, no estilo do repo (`feat:`, `fix:`, `docs:`, `chore:`).
- Especificação de referência: `docs/superpowers/specs/2026-08-13-monitoring-detail-dialog-design.md`.

---

## File Structure

| Arquivo | Responsabilidade | Ação |
| --- | --- | --- |
| `src/lib/api.ts` | `PhotoRead`, `listMonitoringPhotos`, `downloadPhoto`, suporte a `responseType: "blob"` | Modificar |
| `src/components/features/monitoring-list.tsx` | Prop `onSelect` + itens clicáveis | Modificar |
| `src/components/features/monitoring-photo.tsx` | Baixa o blob da foto e renderiza `<img>` | Criar |
| `src/components/features/monitoring-detail-dialog.tsx` | Dialog com detalhes + grid de fotos | Criar |
| `src/app/painel/projetos/[id]/areas/[areaId]/page.tsx` | Estado `selected` + renderização do dialog | Modificar |
| `tests/lib/api.test.ts` | Testes dos novos helpers | Modificar |
| `tests/components/MonitoringList.test.tsx` | Testes de click/onSelect | Modificar |
| `tests/components/MonitoringPhoto.test.tsx` | Testes do componente de foto | Criar |
| `tests/components/MonitoringDetailDialog.test.tsx` | Testes do dialog | Criar |
| `tests/components/AreaDetailPage.test.tsx` | Teste de abertura do dialog na página | Modificar |

---

### Task 1: API client — `PhotoRead`, `listMonitoringPhotos`, `downloadPhoto`

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/tests/lib/api.test.ts`

**Interfaces:**
- Consumes: `ApiFetchOptions` existente (com `method`, `body`, `auth`, `retry`); `apiFetch<T>` existente.
- Produces:
  - `interface PhotoRead { id: string; monitoring_id: string; file_path: string; original_filename?: string | null; mime_type?: string | null; file_size?: number | null; width?: number | null; height?: number | null; created_at: string; updated_at: string }`
  - `function listMonitoringPhotos(monitoringId: string, offset?: number, limit?: number): Promise<Paginated<PhotoRead>>` — `GET /monitorings/{id}/photos?offset=&limit=`, `auth: true`.
  - `function downloadPhoto(photoId: string): Promise<Blob>` — `GET /photos/{id}/download`, `auth: true`, `responseType: "blob"`.
  - `ApiFetchOptions` ganha `responseType?: "json" | "blob"` (default `"json"`).

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/lib/api.test.ts`, adicionar `downloadPhoto` e `listMonitoringPhotos` ao import de `@/lib/api`:

```ts
import {
  ApiError,
  apiFetch,
  createArea,
  createProject,
  deleteProject,
  downloadPhoto,
  getArea,
  listAreaMonitorings,
  listMonitoringPhotos,
  listProjects,
  login,
  logout,
  me,
  projectAreas,
  updateProject,
} from "@/lib/api";
```

Adicionar no fim do arquivo:

```ts
describe("fotos de um monitoramento", () => {
  const photo = {
    id: "photo-1",
    monitoring_id: "mon-1",
    file_path: "/uploads/mon-1/visita.jpg",
    original_filename: "visita.jpg",
    mime_type: "image/jpeg",
    file_size: 2048,
    created_at: "2024-06-01T10:00:00Z",
    updated_at: "2024-06-01T10:00:00Z",
  };

  beforeEach(() => {
    setSession(
      { access_token: "abc", refresh_token: "def", token_type: "bearer" },
      true,
    );
  });

  it("lista fotos paginadas de um monitoramento com autorização", async () => {
    const body = { items: [photo], total: 1, offset: 0, limit: 100 };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
    );

    await expect(listMonitoringPhotos("mon-1")).resolves.toEqual(body);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/v1/monitorings/mon-1/photos?offset=0&limit=100");
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe(
      "Bearer abc",
    );
  });

  it("baixa a foto como blob com autorização", async () => {
    const blob = new Blob(["foto"], { type: "image/jpeg" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(blob, { status: 200 })),
    );

    const result = await downloadPhoto("photo-1");
    expect(result).toBeInstanceOf(Blob);
    expect(await result.text()).toBe("foto");

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/v1/photos/photo-1/download");
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe(
      "Bearer abc",
    );
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- tests/lib/api.test.ts`
Expected: FAIL — `listMonitoringPhotos`/`downloadPhoto` não são exportados de `@/lib/api`.

- [ ] **Step 3: Implementar no `src/lib/api.ts`**

Adicionar `responseType` em `ApiFetchOptions`:

```ts
interface ApiFetchOptions {
   method?: string
   body?: unknown
   auth?: boolean
   retry?: boolean
   responseType?: "json" | "blob"
}
```

Atualizar a assinatura de `apiFetch` e o retorno (o restante da função fica igual):

```ts
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
   const { method = 'GET', body, auth = false, retry = true, responseType = 'json' } = options
```

Substituir o final da função (linhas `if (response.status === 204) ...` e `return (await response.json()) as T`) por:

```ts
   if (response.status === 204) return undefined as T
   if (responseType === 'blob') return (await response.blob()) as unknown as T
   return (await response.json()) as T
```

Adicionar o tipo `PhotoRead` logo após `MonitoringRead` (após a linha ~235):

```ts
export interface PhotoRead {
  id: string;
  monitoring_id: string;
  file_path: string;
  original_filename?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  created_at: string;
  updated_at: string;
}
```

Adicionar no fim do arquivo, após `listAreaMonitorings`:

```ts
export function listMonitoringPhotos(
  monitoringId: string,
  offset = 0,
  limit = 100,
): Promise<Paginated<PhotoRead>> {
  return apiFetch<Paginated<PhotoRead>>(
    `/monitorings/${monitoringId}/photos?offset=${offset}&limit=${limit}`,
    { auth: true },
  );
}

export function downloadPhoto(photoId: string): Promise<Blob> {
  return apiFetch<Blob>(`/photos/${photoId}/download`, {
    auth: true,
    responseType: "blob",
  });
}
```

- [ ] **Step 4: Rodar o teste para verificar que passa**

Run: `npm test -- tests/lib/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts tests/lib/api.test.ts
git commit -m "feat: helpers de fotos do monitoramento na API"
```

---

### Task 2: `MonitoringList` — prop `onSelect` e itens clicáveis

**Files:**
- Modify: `frontend/src/components/features/monitoring-list.tsx`
- Test: `frontend/tests/components/MonitoringList.test.tsx`

**Interfaces:**
- Consumes: `MonitoringListItem` (interface já exportada do próprio arquivo).
- Produces: `function MonitoringList(props: { items: MonitoringListItem[]; onSelect?: (item: MonitoringListItem) => void })`. Sem `onSelect`, o markup é idêntico ao atual. Com `onSelect`, cada item é um `<button type="button">` com `aria-haspopup="dialog"`.

- [ ] **Step 1: Escrever os testes que falham**

Substituir `tests/components/MonitoringList.test.tsx` por:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("gera thumbs de foto mockados quando o payload não traz fotos", () => {
    const { container } = render(<MonitoringList items={items} />);
    const thumbs = container.querySelectorAll("figure");
    expect(thumbs.length).toBeGreaterThan(0);
    expect(screen.getAllByText("jun/24").length).toBeGreaterThan(0);
    expect(screen.queryByText("sem foto")).not.toBeInTheDocument();
  });

  it("mostra o placeholder sem foto quando a lista de fotos é vazia", () => {
    const item = { ...items[0], photos: [] };
    render(<MonitoringList items={[item]} />);
    expect(screen.getByText("sem foto")).toBeInTheDocument();
  });

  it("não renderiza nada quando a lista está vazia", () => {
    const { container } = render(<MonitoringList items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("sem onSelect não renderiza botões", () => {
    render(<MonitoringList items={items} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("chama onSelect ao clicar em um monitoramento", async () => {
    const onSelect = vi.fn();
    render(<MonitoringList items={items} onSelect={onSelect} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /1 de junho de 2024/ }));

    expect(onSelect).toHaveBeenCalledWith(items[0]);
    expect(screen.getByRole("button", { name: /Ver detalhes/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- tests/components/MonitoringList.test.tsx`
Expected: FAIL — os dois últimos testes falham (sem `onSelect` ainda não é suportado).

- [ ] **Step 3: Implementar no `src/components/features/monitoring-list.tsx`**

Substituir o arquivo inteiro por:

```tsx
import type { MonitoringRead } from "@/lib/api";
import { ChevronRight } from "lucide-react";
import { PhotoThumb } from "@/components/features/photo-thumb";

const MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function fullDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function shortLabel(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return `${MONTHS[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`;
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export interface MonitoringPhoto {
  id: string;
  label: string;
  tone: number;
}

export interface MonitoringListItem extends MonitoringRead {
  author?: string | null;
  photos?: MonitoringPhoto[] | null;
}

function mockPhotos(item: MonitoringListItem): MonitoringPhoto[] {
  const seed = hashCode(item.id);
  const tone = seed % 4;
  const label = shortLabel(item.visit_date);
  const count = (seed % 2) + 1;
  return Array.from({ length: count }, (_, index) => ({
    id: `${item.id}::thumb-${index}`,
    label,
    tone: tone + index,
  }));
}

interface MonitoringListProps {
  items: MonitoringListItem[];
  onSelect?: (item: MonitoringListItem) => void;
}

export function MonitoringList({ items, onSelect }: MonitoringListProps) {
  if (items.length === 0) return null;

  return (
    <ul className="space-y-6">
      {items.map((monitoring) => {
        const photos =
          monitoring.photos !== undefined && monitoring.photos !== null
            ? monitoring.photos
            : mockPhotos(monitoring);

        const inner = (
          <>
            <div className="flex gap-2 sm:flex-col">
              {photos.length > 0 ? (
                photos.slice(0, 2).map((photo) => (
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
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-gold">
                  {fullDate(monitoring.visit_date)}
                </span>
                {monitoring.author ? (
                  <span className="text-xs text-moss/70">
                    · {monitoring.author}
                  </span>
                ) : null}
              </div>
              {monitoring.notes ? (
                <p className="mt-1.5 text-sm leading-relaxed text-moss">
                  {monitoring.notes}
                </p>
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
              {onSelect ? (
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-moss transition-colors group-hover:text-forest">
                  Ver detalhes
                  <ChevronRight
                    className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              ) : null}
            </div>
          </>
        );

        if (!onSelect) {
          return (
            <li
              key={monitoring.id}
              className="grid gap-3 sm:grid-cols-[auto_1fr] sm:gap-5"
            >
              {inner}
            </li>
          );
        }

        return (
          <li key={monitoring.id}>
            <button
              type="button"
              onClick={() => onSelect(monitoring)}
              aria-haspopup="dialog"
              className="group grid w-full gap-3 rounded-2xl border border-transparent p-1 text-left transition-colors hover:border-forest/10 hover:bg-forest/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist sm:grid-cols-[auto_1fr] sm:gap-5"
            >
              {inner}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Rodar o teste para verificar que passa**

Run: `npm test -- tests/components/MonitoringList.test.tsx`
Expected: PASS (os 6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/features/monitoring-list.tsx tests/components/MonitoringList.test.tsx
git commit -m "feat: lista de monitoramentos clicável para abrir detalhes"
```

---

### Task 3: Componente `MonitoringPhoto`

**Files:**
- Create: `frontend/src/components/features/monitoring-photo.tsx`
- Test: `frontend/tests/components/MonitoringPhoto.test.tsx`

**Interfaces:**
- Consumes: `downloadPhoto(photoId: string): Promise<Blob>` (Task 1) e `PhotoRead` (Task 1).
- Produces: `function MonitoringPhoto(props: { photo: PhotoRead })`. Renderiza `<img>` com `alt = photo.original_filename ?? "Foto da visita"` e `src` de object URL. Estados: carregando (skeleton), erro (com botão "Tentar novamente"), pronto.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/components/MonitoringPhoto.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonitoringPhoto } from "@/components/features/monitoring-photo";
import type { PhotoRead } from "@/lib/api";

const { downloadPhotoMock } = vi.hoisted(() => ({ downloadPhotoMock: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, downloadPhoto: downloadPhotoMock };
});

const photo: PhotoRead = {
  id: "photo-1",
  monitoring_id: "mon-1",
  file_path: "/uploads/mon-1/visita.jpg",
  original_filename: "visita.jpg",
  mime_type: "image/jpeg",
  file_size: 2048,
  created_at: "2024-06-01T10:00:00Z",
  updated_at: "2024-06-01T10:00:00Z",
};

describe("MonitoringPhoto", () => {
  beforeEach(() => {
    downloadPhotoMock.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(cleanup);

  it("baixa a foto e renderiza como imagem", async () => {
    downloadPhotoMock.mockResolvedValue(new Blob(["foto"], { type: "image/jpeg" }));

    render(<MonitoringPhoto photo={photo} />);

    const img = await screen.findByRole("img", { name: "visita.jpg" });
    expect(img).toHaveAttribute("src", "blob:mock-url");
    expect(downloadPhotoMock).toHaveBeenCalledWith("photo-1");
  });

  it("mostra erro e permite tentar novamente", async () => {
    downloadPhotoMock
      .mockRejectedValueOnce(new Error("falha"))
      .mockResolvedValueOnce(new Blob(["foto"], { type: "image/jpeg" }));

    render(<MonitoringPhoto photo={photo} />);

    const retry = await screen.findByRole("button", { name: /Tentar novamente/ });
    const user = userEvent.setup();
    await user.click(retry);

    expect(await screen.findByRole("img", { name: "visita.jpg" })).toBeInTheDocument();
    expect(downloadPhotoMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- tests/components/MonitoringPhoto.test.tsx`
Expected: FAIL — módulo `@/components/features/monitoring-photo` não existe.

- [ ] **Step 3: Implementar o componente**

Criar `src/components/features/monitoring-photo.tsx`:

```tsx
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

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    setState("loading");
    setSrc(null);

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
          onClick={() => setAttempt((n) => n + 1)}
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
```

- [ ] **Step 4: Rodar o teste para verificar que passa**

Run: `npm test -- tests/components/MonitoringPhoto.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/features/monitoring-photo.tsx tests/components/MonitoringPhoto.test.tsx
git commit -m "feat: componente de foto de monitoramento"
```

---

### Task 4: Dialog de detalhes do monitoramento

**Files:**
- Create: `frontend/src/components/features/monitoring-detail-dialog.tsx`
- Test: `frontend/tests/components/MonitoringDetailDialog.test.tsx`

**Interfaces:**
- Consumes: `MonitoringListItem` (de `monitoring-list.tsx`, Task 2), `listMonitoringPhotos` (Task 1), `MonitoringPhoto` (Task 3).
- Produces:
  - `interface MonitoringDetailDialogProps { monitoring: MonitoringListItem; areaName: string; open: boolean; onOpenChange: (next: boolean) => void }`
  - `function MonitoringDetailDialog(props: MonitoringDetailDialogProps)`.
  - `const PAGE_SIZE = 100` (máximo aceito pelo backend).

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/components/MonitoringDetailDialog.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonitoringDetailDialog } from "@/components/features/monitoring-detail-dialog";
import type { MonitoringListItem } from "@/components/features/monitoring-list";
import type { PhotoRead } from "@/lib/api";

const { listMonitoringPhotosMock } = vi.hoisted(() => ({
  listMonitoringPhotosMock: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, listMonitoringPhotos: listMonitoringPhotosMock };
});

vi.mock("@/components/features/monitoring-photo", () => ({
  MonitoringPhoto: ({ photo }: { photo: PhotoRead }) => (
    <div data-testid="monitoring-photo">{photo.original_filename}</div>
  ),
}));

const monitoring: MonitoringListItem = {
  id: "mon-1",
  area_id: "area-1",
  visit_date: "2024-06-01",
  notes: "Plantio concluído no quadrante 1.",
  seedling_count: 980,
  avg_height: 0.4,
  species_data: { Aroeira: {}, Angico: {} },
  created_at: "2024-06-01T10:00:00Z",
  updated_at: "2024-06-01T10:00:00Z",
};

const photo = (id: string): PhotoRead => ({
  id,
  monitoring_id: "mon-1",
  file_path: `/uploads/mon-1/${id}.jpg`,
  original_filename: `${id}.jpg`,
  created_at: "2024-06-01T10:00:00Z",
  updated_at: "2024-06-01T10:00:00Z",
});

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <MonitoringDetailDialog
        monitoring={monitoring}
        areaName="Borrazóis"
        open
        onOpenChange={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("MonitoringDetailDialog", () => {
  beforeEach(() => {
    listMonitoringPhotosMock.mockReset();
  });

  afterEach(cleanup);

  it("renderiza notas, métricas e espécies do monitoramento", async () => {
    listMonitoringPhotosMock.mockResolvedValue({
      items: [],
      total: 0,
      offset: 0,
      limit: 100,
    });

    renderDialog();

    expect(await screen.findByText("980 mudas")).toBeInTheDocument();
    expect(screen.getByText("0,4 m médios")).toBeInTheDocument();
    expect(screen.getByText("Aroeira")).toBeInTheDocument();
    expect(screen.getByText("Angico")).toBeInTheDocument();
    expect(screen.getByText(/Plantio concluído no quadrante 1/i)).toBeInTheDocument();
    expect(screen.getByText("Área · Borrazóis")).toBeInTheDocument();
  });

  it("renderiza as fotos da visita em grade", async () => {
    listMonitoringPhotosMock.mockResolvedValue({
      items: [photo("p1"), photo("p2")],
      total: 2,
      offset: 0,
      limit: 100,
    });

    renderDialog();

    const thumbs = await screen.findAllByTestId("monitoring-photo");
    expect(thumbs).toHaveLength(2);
    expect(listMonitoringPhotosMock).toHaveBeenCalledWith("mon-1", 0, 100);
  });

  it("mostra o estado vazio quando não há fotos", async () => {
    listMonitoringPhotosMock.mockResolvedValue({
      items: [],
      total: 0,
      offset: 0,
      limit: 100,
    });

    renderDialog();

    expect(
      await screen.findByText("Nenhuma foto anexada a esta visita."),
    ).toBeInTheDocument();
  });

  it("mostra erro nas fotos e permite tentar novamente", async () => {
    listMonitoringPhotosMock
      .mockRejectedValueOnce(new Error("falha de rede"))
      .mockResolvedValueOnce({
        items: [photo("p1")],
        total: 1,
        offset: 0,
        limit: 100,
      });

    renderDialog();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível carregar as fotos/i,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Tentar novamente/ }));

    expect(await screen.findByTestId("monitoring-photo")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- tests/components/MonitoringDetailDialog.test.tsx`
Expected: FAIL — módulo `@/components/features/monitoring-detail-dialog` não existe.

- [ ] **Step 3: Implementar o dialog**

Criar `src/components/features/monitoring-detail-dialog.tsx`:

```tsx
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
```

- [ ] **Step 4: Rodar o teste para verificar que passa**

Run: `npm test -- tests/components/MonitoringDetailDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/features/monitoring-detail-dialog.tsx tests/components/MonitoringDetailDialog.test.tsx
git commit -m "feat: dialog de detalhes do monitoramento com fotos"
```

---

### Task 5: Integrar na página da área

**Files:**
- Modify: `frontend/src/app/painel/projetos/[id]/areas/[areaId]/page.tsx`
- Test: `frontend/tests/components/AreaDetailPage.test.tsx`

**Interfaces:**
- Consumes: `MonitoringDetailDialog` (Task 4) e `MonitoringListItem` (Task 2).

- [ ] **Step 1: Escrever o teste que falha**

Em `tests/components/AreaDetailPage.test.tsx`:

1. Adicionar o mock hoisted:

```tsx
const { getAreaMock, listAreaMonitoringsMock, apiFetchMock, listMonitoringPhotosMock } =
  vi.hoisted(() => ({
    getAreaMock: vi.fn(),
    listAreaMonitoringsMock: vi.fn(),
    apiFetchMock: vi.fn(),
    listMonitoringPhotosMock: vi.fn(),
  }));
```

2. Adicionar no `vi.mock("@/lib/api", ...)` o par `listMonitoringPhotos: listMonitoringPhotosMock`:

```tsx
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getArea: getAreaMock,
    listAreaMonitorings: listAreaMonitoringsMock,
    apiFetch: apiFetchMock,
    listMonitoringPhotos: listMonitoringPhotosMock,
  };
});
```

3. No `beforeEach`, resetar o novo mock:

```tsx
beforeEach(() => {
  getAreaMock.mockReset();
  listAreaMonitoringsMock.mockReset();
  apiFetchMock.mockReset();
  listMonitoringPhotosMock.mockReset();
});
```

4. Adicionar o teste de abertura do dialog:

```tsx
it("abre o dialog de detalhes ao clicar em um monitoramento", async () => {
  apiFetchMock.mockResolvedValue(project);
  getAreaMock.mockResolvedValue(area);
  listAreaMonitoringsMock.mockResolvedValue({
    items: [monitoring("mon-1", "2024-06-01")],
    total: 1,
    offset: 0,
    limit: 10,
  });
  listMonitoringPhotosMock.mockResolvedValue({
    items: [],
    total: 0,
    offset: 0,
    limit: 100,
  });

  renderPage();

  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: /1 de junho de 2024/ }),
  );

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Área · Borrazóis")).toBeInTheDocument();
  expect(screen.getByText("Nenhuma foto anexada a esta visita.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

Run: `npm test -- tests/components/AreaDetailPage.test.tsx`
Expected: FAIL — o novo teste falha (clicar não abre dialog; o botão não existe ainda).

- [ ] **Step 3: Implementar na página**

Em `src/app/painel/projetos/[id]/areas/[areaId]/page.tsx`:

1. Adicionar imports:

```tsx
import { MonitoringDetailDialog } from "@/components/features/monitoring-detail-dialog";
import type { MonitoringListItem } from "@/components/features/monitoring-list";
```

2. Adicionar estado logo após `const [offset, setOffset] = useState(0);`:

```tsx
const [selected, setSelected] = useState<MonitoringListItem | null>(null);
```

3. Passar `onSelect` ao `MonitoringList` (substituir a linha existente):

```tsx
<MonitoringList items={monitoringsQuery.data.items} onSelect={setSelected} />
```

4. Renderizar o dialog no fim do `<div>` raiz (após a `<section>` de monitoramentos, antes do fechamento do div):

```tsx
{selected ? (
  <MonitoringDetailDialog
    monitoring={selected}
    areaName={area.name}
    open
    onOpenChange={(next) => {
      if (!next) setSelected(null);
    }}
  />
) : null}
```

- [ ] **Step 4: Rodar o teste para verificar que passa**

Run: `npm test -- tests/components/AreaDetailPage.test.tsx`
Expected: PASS (todos os testes, incluindo o novo).

- [ ] **Step 5: Commit**

```bash
git add src/app/painel/projetos/[id]/areas/[areaId]/page.tsx tests/components/AreaDetailPage.test.tsx
git commit -m "feat: detalhe do monitoramento acessível na página da área"
```

---

### Task 6: Verificação global

**Files:** nenhum.

- [ ] **Step 1: Rodar a suíte completa**

Run: `npm test`
Expected: todos os testes PASS.

- [ ] **Step 2: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros de tipo.

- [ ] **Step 3: Rodar o lint**

Run: `npm run lint`
Expected: sem erros de lint (se houver, corrigir — ex.: `npm run lint` aponta arquivo/regra).

- [ ] **Step 4: Verificar que nada quebrou no dev**

Run: `npm run dev` e navegar para uma área com monitoramentos (`/painel/projetos/<id>/areas/<areaId>`). Clicar em um monitoramento e conferir: dialog abre, notas/métricas/espécies visíveis, fotos carregam (ou estado vazio), Esc/backdrop/X fecham.
