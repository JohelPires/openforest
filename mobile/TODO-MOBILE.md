# TODO — Mobile (OpenForest · Diagnóstico de Caficultura Regenerativa)

> Checklist operacional do app em `mobile/`. Rastreia o executável do plano em `docs/superpowers/plans/2026-09-05-caficultura-assessments-mobile.md`.
> Status globais: M0–PM6 em `MOBILE-ROADMAP.md`.

## Legenda

- `[ ]` não iniciado · `[~]` em andamento · `[x]` feito

---

## Fundação (PM0)

- [ ] Scaffold Expo SDK 53 (`npx create-expo-app@latest mobile --template default`)
- [ ] Land expo-router + estrutura de diretórios (`app/`, `src/api/`, `src/db/`, `src/sync/`, `src/i18n/`, `src/features/`)
- [ ] TypeScript strict + ESLint (eslint-config-expo) funcionando
- [ ] i18n `pt`/`es` com i18next (recursos por feature)
- [ ] Cliente HTTP (`src/api/client.ts`) com `ApiError`
- [ ] Auth: login/register/refresh/logout em `src/api/auth.ts` + `expo-secure-store`
- [ ] Layout raiz + tabs (Fincas · Diagnóstico · Plano · Perfil)
- [ ] `EXPO_PUBLIC_API_URL` em `.env.example`

## Offline core (PM1)

- [ ] `expo-sqlite` schema (template, dimension, indicator, indicator_level, local_area, local_assessment, local_score, pending_op)
- [ ] Repositórios locais (`src/db/repositories.ts`) — CRUD assessments/scores locais
- [ ] `pullCatalog()`: sincroniza templates + áreas no 1º login online
- [ ] `enqueue()` + `pending_op` (assessment_create, scores_replace, submit, photo)
- [ ] `runSync()` com NetInfo listener; retry com backoff
- [ ] Erros 4xx marcados como conflito (não retenta); 5xx/offline retenta
- [ ] Mapear LWW: resposta do servidor sobrescreve linha local (version)

## Diagnóstico MVP (PM2)

- [ ] Lista de fincas (áreas da org) — online via API, offline via cache
- [ ] Criar diagnóstico local para uma finca
- [ ] Formulário por dimensão (8 seções) com radio de 4 níveis
- [ ] Descrições dos níveis traduzidas do catálogo local
- [ ] Progresso X/41 por dimensão e total
- [ ] Bloquear submit com formulário incompleto (client-side) + validar no server
- [ ] Fluxo submit (volunteer) → validate (researcher)

## Resultado & Plano (PM3)

- [ ] `GET /assessments/{id}/result?lang=`: gráfico de barras por dimensão (Views)
- [ ] Badge de nível de transição (4 sistemas)
- [ ] Chips de prioridades críticas e avisos
- [ ] Lista de recomendações de práticas regenerativas
- [ ] Tela Plano derivada do resultado (checklist persistido = pós-MVP)

## Robustez offline (PM4)

- [ ] Fotos: expo-image-picker → cópia local → upload com retry
- [ ] Compressão leve de imagem
- [ ] Pontos de amostragem com GPS (expo-location) — 20×20 m
- [ ] Indicador visual de "pendente de sync" na lista
- [ ] EAS Update para OTA

## Produtor (PM5)

- [ ] Onboarding de finca em 3 passos
- [ ] Vinculação por convite/código à org do técnico
- [ ] Modo leitura do técnico + relatório compartilhável
- [ ] Lembrete local (manejo de sombra, época)

## Escala (PM6)

- [ ] Mapa da finca por lote com scores
- [ ] Histórico de diagnóstico por finca (evolução)
- [ ] Analytics por org/região + export CSV
- [ ] Integração com sensores (roadmap M4 OpenForest)
- [ ] Versionamento do template da guia (múltiplas versões)

## Qualidade & Integração

- [ ] Jest (jest-expo): testes de queue, repos, i18n lang
- [ ] Teste E2E de fluxo contra `/api/v1` (backend seed)
- [ ] Lint + typecheck limpos no CI
- [ ] `AGENTS-MOBILE.md` (ou seção em `AGENTS-FRONTEND.md`) com convenções do app
- [ ] Dependência: backend módulo `assessments` (ver plano/Tasks 1–5) — bloqueia PM1/PM2

## Bloqueadores conhecidos

- **Backend `assessments` ainda não implementado** — PM1/PM2 dependem de `GET /templates` e CRUD de diagnoses (Tasks 1–5 do plano).
- **Payload de `/auth/login` e `/auth/refresh`**: conferir nomes reais dos campos no `routers/auth.py` antes de fechar `src/api/auth.ts`.
- **`econ_*`/casos especiais do guia**: indicador `econ_marketing_channels` tem nota "Cuando aplique" e *actividad biológica* tem método A/B (lombrices / agua oxigenada) — decidir apresentação (apenas texto, sem distinção de método por ora).