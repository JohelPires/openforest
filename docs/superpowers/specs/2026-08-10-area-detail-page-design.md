# Design — Página de detalhes da área

Data: 2026-08-10

## Contexto

Hoje as áreas aparecem como faixas expansíveis na régua de tempo do detalhe do projeto
(`project-areas.tsx` → `AreaTimeline`). Não existe página dedicada de área. O usuário quer
que, ao clicar em uma área, abra uma página com todos os detalhes da área e todos os
monitoramentos em uma lista paginada.

O backend já está pronto para isso:

- `GET /areas/{area_id}` → `AreaRead` (inclui `goal` e `recent_monitorings`).
- `GET /areas/{area_id}/monitorings?offset=&limit=` → `Paginated<MonitoringRead>`
  (padrão `{items, total, offset, limit}`).

Não há mudanças necessárias no backend. Escopo restrito ao frontend.

## Escopo

### Rota e entrada

- Nova rota client-component: `/painel/projetos/[id]/areas/[areaId]`.
  Mesmo padrão de `projetos/[id]/page.tsx`: React Query + `useParams` do `next/navigation`.
- Entrada: em `area-timeline.tsx`, o `<h3>` com o nome da área dentro de cada `Band`
  passa a ser um `Link` para `/painel/projetos/${area.project_id}/areas/${area.id}`.
  O toggle de expandir/recolher continua funcionando como hoje.
- Breadcrumb: `['Projetos', nomeDoProjeto, nomeDaÁrea]`. O nome do projeto é buscado via
  `GET /projects/{project_id}` apenas para o label. O link "Voltar" usa `area.project_id`.

### API client (`src/lib/api.ts`)

- Adicionar `goal?: string | null` ao tipo `AreaRead` (o backend já retorna).
- Novos helpers tipados:
  - `getArea(areaId: string): Promise<AreaRead>` → `GET /areas/{area_id}`
  - `listAreaMonitorings(areaId: string, offset: number, limit: number): Promise<Paginated<MonitoringRead>>`
    → `GET /areas/{area_id}/monitorings?offset=&limit=`

### Módulo compartilhado de status

- Novo `src/lib/status.ts` com `STATUS_LABEL`, `STATUS_BADGE` e `STATUS_DOT`
  (movidos de `mock-data.ts` e `area-timeline.tsx`, sem mudança de conteúdo).
- `area-timeline.tsx` passa a importar desse módulo; a página de detalhe também.
  Evita duplicar o mapeamento de status em dois lugares.

### Composição da página

Ordem de cima para baixo:

1. Link "Voltar" → `/painel/projetos/[project_id]`.
2. Header: eyebrow "Área", título = `area.name`, badge de status
   (mesma lógica já usada na timeline).
3. `dl` de detalhes: Início (`created_at`, formatado pt-BR), Bioma, Tamanho (ha),
   Objetivo (exibido somente se presente).
4. Seção "Monitoramentos": contador "X visitas registradas" + lista paginada.

Estados:

- **Loading**: skeleton de pulso (padrão da página de projeto).
- **Erro**: alerta com botão "Tentar novamente" (`refetch`).
- **Sem monitoramentos**: estado vazio com convite, no padrão visual do
  `ProjectAreas`.

### Lista paginada (server-side)

- Page size `limit = 10`.
- Estado local `offset` na página. `page = offset / limit`.
- Query key do React Query: `['area-monitorings', areaId, offset]` — refetch ao mudar.
- Novo componente `src/components/features/monitoring-list.tsx`:
  - Recebe `items: MonitoringRead[]`.
  - Cada item: data completa pt-BR, notas, "X mudas", "X m médios" e chips de espécies
    (`species_data`).
  - Mesmo visual da lista expandida da timeline, sem fotos/autor (não existem no backend).
- Controles de paginação (na página, não no componente de lista):
  - Botões "Anterior" / "Próxima", desabilitados nos limites.
  - Rótulo "Página X de Y".
  - `totalPages = ceil(total / limit)`.

### Fora de escopo (YAGNI)

- Exibir `coordinates`.
- Refatorar a timeline para reusar `monitoring-list.tsx`.
- Página de lista `/painel/areas` (continua como está).
- Novos endpoints ou mudanças no backend.

## Testes

- `tests/components/MonitoringList.test.tsx`: renderiza data, notas, mudas, altura e espécies.
- Paginação: botões "Anterior"/"Próxima" atualizam o `offset`/página e respeitam os limites.
- `AreaTimeline.test.tsx` / `ProjectAreas.test.tsx`: cobertura do link do nome da área
  (o `<a>` aponta para a rota da área). Os testes existentes de renderização continuam válidos.

## Padrões a seguir

- RSC por padrão; `'use client'` quando necessário (a página é client component, como o
  detalhe do projeto).
- React Query para fetching; `apiFetch` com `auth: true`.
- Tailwind utility classes; paleta atual (`forest`, `moss`, `gold`, `cream`, `soil`, `mist`).
- Prettier/ESLint do projeto.
