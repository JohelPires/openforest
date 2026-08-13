# Design — Detalhe de monitoramento em dialog (página da área)

Data: 2026-08-13

## Contexto

Na página de detalhes da área (`/painel/projetos/[id]/areas/[areaId]`), os monitoramentos
aparecem em uma lista paginada (`MonitoringList`). O usuário quer clicar em um monitoramento
e ver todos os detalhes daquela visita — notas, métricas, espécies e **todas as fotos** —
sem sair do contexto da área.

O backend já expõe o necessário (verificado via OpenAPI rodando em `localhost:8000`):

- `GET /monitorings/{id}` → `MonitoringRead` (notas, mudas, altura, espécies).
- `GET /monitorings/{id}/photos?offset=&limit=` → `Paginated<PhotoRead>` (auth Bearer).
- `GET /photos/{id}/download` → binário da foto (auth Bearer).

Decisões já tomadas com o usuário:

- Interação: **dialog** sobre a página (padrão `@base-ui/react/dialog` já usado no projeto).
- Fonte dos dados: **detalhes vêm do item da lista** (mesmo `MonitoringRead`), sem re-fetch;
  apenas as **fotos são buscadas** no backend.
- Fotos: **reais** (não mais apenas placeholders mock).

Não há mudanças necessárias no backend. Escopo restrito ao frontend.

## Escopo

### API client (`src/lib/api.ts`)

- Novo `interface PhotoRead` espelhando o OpenAPI:

  ```ts
  interface PhotoRead {
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

- Novo helper tipado:

  ```ts
  function listMonitoringPhotos(
    monitoringId: string,
    offset?: number,
    limit?: number,
  ): Promise<Paginated<PhotoRead>>  // GET /monitorings/{id}/photos
  ```

- Estender `ApiFetchOptions` com `responseType?: "json" | "blob"` (default `"json"`).
  Em `"blob"`, `apiFetch` retorna `await response.blob()` — reusa a lógica de auth,
  refresh e retry já existente.

- Novo helper de download:

  ```ts
  function downloadPhoto(photoId: string): Promise<Blob>  // GET /photos/{id}/download
  ```

### Lista clicável (`src/components/features/monitoring-list.tsx`)

- Nova prop opcional `onSelect?: (item: MonitoringListItem) => void`.
- Com `onSelect`: cada `<li>` vira um `<button type="button">` com
  `aria-haspopup="dialog"`, `text-left` e `w-full` cobrindo o card, mais dica visual
  "Ver detalhes" e ícone `ChevronRight`. Acessível por teclado (Enter/Espaço).
- Sem `onSelect` (timeline mock em `area-timeline.tsx`): comportamento atual inalterado.

### Página da área (`src/app/painel/projetos/[id]/areas/[areaId]/page.tsx`)

- Novo estado local: `const [selected, setSelected] = useState<MonitoringListItem | null>(null)`.
- `MonitoringList` recebe `onSelect={setSelected}`.
- Renderiza `<MonitoringDetailDialog>` controlado quando `selected` existe
  (`open={selected !== null}`, `onOpenChange` limpa o estado, `areaName={area.name}`).

### Dialog de detalhe (`src/components/features/monitoring-detail-dialog.tsx`)

Client component usando `@base-ui/react/dialog`, no padrão do `edit-project-dialog.tsx`
(backdrop `bg-soil/50 backdrop-blur-sm`, popup `rounded-3xl border bg-cream shadow-2xl`,
botão fechar X no canto superior).

Props:

```ts
interface MonitoringDetailDialogProps {
  monitoring: MonitoringListItem;
  areaName: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}
```

Conteúdo, de cima para baixo:

1. Eyebrow "Monitoramento" (`font-mono uppercase tracking-[0.2em] text-gold`).
2. Título: data completa pt-BR (`toLocaleDateString("pt-BR", { day, month, year })`).
3. Sub: `Área · {areaName}` (`text-moss`).
4. Notas de campo (`text-sm leading-relaxed text-moss`), apenas se presentes.
5. Métricas: "X mudas", "X m médios" e chips de espécies (keys de `species_data`),
   com a mesma formatação já usada no `MonitoringList`.
6. Seção "Fotos da visita" com `useInfiniteQuery`:

   - `queryKey: ["monitoring-photos", monitoring.id]`
   - `queryFn: ({ pageParam }) => listMonitoringPhotos(monitoring.id, pageParam, PAGE_SIZE)`
   - `initialPageParam: 0`
   - `getNextPageParam`: `offset + limit < total ? offset + limit : undefined`
   - `PAGE_SIZE = 100` (máximo aceito pelo backend)
   - `enabled: open`

Estados da seção de fotos:

- **Carregando**: skeleton de pulso (`bg-forest/5`).
- **Erro**: alerta inline (borda `destructive`) com botão "Tentar novamente" (`refetch`).
- **Vazio**: "Nenhuma foto anexada a esta visita."
- **Com fotos**: grid `grid-cols-2 sm:grid-cols-3 gap-3` de `<MonitoringPhoto>` +
  botão "Carregar mais fotos" quando `hasNextPage` (honra "todas as fotos").

### Foto individual (`src/components/features/monitoring-photo.tsx`)

Client component. Recebe `photo: PhotoRead`.

- No mount: `downloadPhoto(photo.id)` → `URL.createObjectURL(blob)` → `<img>`.
- `<img>`: `alt={photo.original_filename ?? "Foto da visita"}`, `aspect-square object-cover rounded-xl`.
- Revoga a object URL no unmount (limpeza em `useEffect` cleanup).
- Skeleton enquanto carrega; fallback de erro com ícone e botão "Tentar novamente"
  (re-chama o download daquela foto).

## Testes

- `tests/lib/api.test.ts`: `listMonitoringPhotos` e `downloadPhoto` (blob) com fetch stub.
- `tests/components/MonitoringList.test.tsx`: ajustar queries ao wrapper `<button>`;
  novo caso "clica e chama `onSelect`"; caso "sem `onSelect` não há botão".
- `tests/components/MonitoringDetailDialog.test.tsx`: renderiza notas/métricas/espécies;
  grid de fotos (blob mock); estado vazio; estado de erro com retry.
- `tests/components/MonitoringPhoto.test.tsx`: blob → `<img>`; erro com retry.

Padrões de teste: `QueryClientProvider` + `vi.mock("@/lib/api")` como em
`AreaDetailPage.test.tsx`; `maplibre-gl` mockado quando necessário.

## Fora de escopo (YAGNI)

- Nome do autor (backend não retorna no `MonitoringRead`).
- Lightbox/visor fullscreen de fotos (apenas grid).
- Upload de fotos pelo dialog.
- Mudanças no comportamento do timeline mock (`area-timeline.tsx`).
- Mudanças no backend.

## Padrões a seguir

- Client components com `'use client'`; React Query para fetching; `apiFetch` com `auth: true`.
- Tailwind utility classes; paleta atual (`forest`, `moss`, `gold`, `cream`, `soil`, `mist`).
- Prettier/ESLint do projeto.
