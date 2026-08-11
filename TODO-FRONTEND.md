# Frontend TODO

Decisões de fundação: Next.js (latest) · Tailwind v4 · shadcn · Proxy via rewrites
Tokens JWT em localStorage com refresh automático · react-hook-form + zod · TanStack Query · Sonner

## Sprint 0 — Setup e Scaffold

- [x] Instalar skills (globais):
   - [x] `npx skills add shadcn/ui@shadcn -g -y`
   - [x] `npx skills add wshobson/agents@nextjs-app-router-patterns -g -y`
   - [x] `npx skills add heygen-com/hyperframes@tailwind -g -y`
   - [x] `npx skills add anthropics/skills@frontend-design -g -y`
   - [x] `npx skills add vercel-labs/agent-skills@web-design-guidelines -g -y`
   - [x] `npx skills add addyosmani/web-quality-skills@accessibility -g -y`
   - [x] `npx skills add vercel-labs/agent-skills@writing-guidelines -g -y`
   - [x] `npx skills add coreyhaines31/marketingskills@copywriting -g -y`
- [x] Criar worktree/branch isolada para o frontend
- [x] `create-next-app` em `frontend/` (TypeScript, App Router, `src/`, Tailwind v4, ESLint, Prettier)
- [x] `npx shadcn init` (alias `@/*`, tema OpenForest verde/terra) — `components.json` + `globals.css` com o tema
- [x] `next.config.ts` com rewrites (`/api/:path*` → backend) — via `src/proxy.ts` (NextResponse.rewrite) + `skipProxyUrlNormalize`
- [x] `.env.local` + `.env.example` (`BACKEND_URL`, sem secrets)
- [x] Setup vitest + jsdom + @testing-library/react + msw
- [x] GitHub Actions: lint + typecheck + test + build

## Sprint 1 — API Client e Tipos

- [x] `src/lib/api.ts` (fetch wrapper, base URL relativa `/api/v1`)
- [x] Refresh automático em 401 — retry único após refresh (sem fila de retry / evitação de corrida de refresh)
- [x] Tipos em `src/types/` (User, Token, Organization, Project, Area,
      Monitoring, Paginated<T>, RestorationStatus, UserOrganizationRole) — vivem em `src/lib/api.ts`, `src/lib/status.ts` e `src/lib/mock-data.ts` (não há pasta `src/types/`)
- [x] Parser de erro `{detail:[{msg,type}]}` → mensagens pt-BR — erros exibidos inline (`role="alert"`); Sonner ainda não usado
- [x] QueryClientProvider (TanStack Query)
- [x] Testes da lib de API — `tests/lib/api.test.ts` com fetch stub (`vi.stubGlobal`); msw instalado, mas não usado

## Sprint 2 — Autenticação

- [x] AuthProvider (context + localStorage) — `UserProvider` + `src/lib/auth.ts` (localStorage/sessionStorage)
- [x] `login` / `register` / `logout` / `refresh` + persistência
- [x] Página `/auth/login` — form manual (`useState`); sem shadcn Form / react-hook-form / zod
- [x] Página `/auth/register` — idem
- [x] `middleware.ts` protegendo rotas privadas (redirect `/auth/login`) — `src/proxy.ts` (Next.js 16 renomeou `middleware.ts` → `proxy.ts`)
- [x] Testes de auth — `LoginForm`, `RegisterForm`, `UserMenu` + `tests/lib/api.test.ts`

## Sprint 3 — Layout e Navegação

- [x] Layout raiz (fontes, metadata, lang pt-BR)
- [x] Header/Navbar + sidebar responsiva — `Sidebar` + `PainelShell` (sheet mobile)
- [x] Home pública — landing page em `src/app/page.tsx`
- [ ] Placeholder `/dashboard` consumindo `GET /api/v1/projects` — a rota é `/painel` (dashboard com mock-data); projetos reais ficam em `/painel/projetos`
- [x] Estados de loading (skeleton), empty e error — sem Sonner (erros inline)

## Sprint 4 — Componentes shadcn base

> A implementação foi por componentes customizados em `src/components/features/` + primitivos `@base-ui/react` (Dialog, AlertDialog, Menu, Avatar, Button) + `Button` shadcn (estilo base-nova). Não há a coleção shadcn listada abaixo em `src/components/ui/`.

- [ ] button, input, label, form, card, dialog, dropdown-menu, table,
      badge, select, separator, skeleton, avatar, sheet, sonner — apenas `button` existe em `src/components/ui/`
- [ ] Testes de componentes base — só `Button.test.tsx`; os demais testes cobrem componentes de features

## Sprint 5 — Docs e Qualidade

- [x] Atualizar `AGENTS-FRONTEND.md` (Tailwind v4, proxy, libs, vitest)
- [ ] ADR: proxy rewrites, tokens localStorage, libs auxiliares, Tailwind v4
- [ ] Atualizar `ROADMAP.md` (checkboxes M0 frontend) — ainda sem checkboxes
- [x] lint + typecheck + testes passando

## Fora de escopo (M1 em diante)

- [ ] CRUD de organizations/projects/areas/monitoring — projetos já com CRUD (criar/editar/excluir); áreas e monitoramentos apenas leitura (lista + detalhe); organizations sem tela
- [ ] Upload de fotos — input mock no caderno de campo, sem chamada à API
- [ ] Dashboard em tempo real (WebSocket) — sensores simulados com `setInterval` + mock-data
