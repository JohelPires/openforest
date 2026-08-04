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
- [ ] `npx shadcn init` (alias `@/*`, tema OpenForest verde/terra)
- [ ] `next.config.ts` com rewrites (`/api/:path*` → backend)
- [ ] `.env.local` + `.env.example` (`BACKEND_URL`, sem secrets)
- [ ] Setup vitest + jsdom + @testing-library/react + msw
- [ ] GitHub Actions: lint + typecheck + test + build

## Sprint 1 — API Client e Tipos

- [ ] `src/lib/api.ts` (fetch wrapper, base URL relativa `/api`)
- [ ] Refresh automático em 401 (fila de retry, evita corrida de refresh)
- [ ] Tipos em `src/types/` (User, Token, Organization, Project, Area,
      Monitoring, Paginated<T>, RestorationStatus, UserOrganizationRole)
- [ ] Parser de erro `{detail:[{msg,type}]}` → mensagens pt-BR + toast (Sonner)
- [ ] QueryClientProvider (TanStack Query)
- [ ] Testes da lib de API com msw

## Sprint 2 — Autenticação

- [ ] AuthProvider (context + localStorage)
- [ ] `login` / `register` / `logout` / `refresh` + persistência
- [ ] Página `/auth/login` (shadcn Form + react-hook-form + zod)
- [ ] Página `/auth/register`
- [ ] `middleware.ts` protegendo rotas privadas (redirect `/auth/login`)
- [ ] Testes de auth

## Sprint 3 — Layout e Navegação

- [ ] Layout raiz (fontes, metadata, lang pt-BR)
- [ ] Header/Navbar + sidebar responsiva
- [ ] Home pública
- [ ] Placeholder `/dashboard` consumindo `GET /api/v1/projects`
- [ ] Estados de loading (skeleton), empty e error (Sonner)

## Sprint 4 — Componentes shadcn base

- [ ] button, input, label, form, card, dialog, dropdown-menu, table,
      badge, select, separator, skeleton, avatar, sheet, sonner
- [ ] Testes de componentes base

## Sprint 5 — Docs e Qualidade

- [ ] Atualizar `AGENTS-FRONTEND.md` (Tailwind v4, shadcn, proxy, libs, vitest)
- [ ] ADR: proxy rewrites, tokens localStorage, libs auxiliares, Tailwind v4
- [ ] Atualizar `ROADMAP.md` (checkboxes M0 frontend)
- [ ] lint + typecheck + testes passando

## Fora de escopo (M1 em diante)

- [ ] CRUD de organizations/projects/areas/monitoring
- [ ] Upload de fotos
- [ ] Dashboard em tempo real (WebSocket)
