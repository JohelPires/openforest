# OpenForest Mobile — Roadmap

> **Status:** Provisório (feito em fases incrementais). Alinhado ao `ROADMAP.md` do OpenForest (M3 Field Operations = offline/GPS/fotos; M4 Environmental Monitoring).
> **Cobre:** o app React Native em `mobile/` para o **Diagnóstico de Caficultura Sostenible y Regenerativa** (CATIE/GIZ 2025).
> **Complementa:** `docs/superpowers/plans/2026-09-05-caficultura-assessments-mobile.md` e `mobile/TODO-MOBILE.md`.

---

# Princípios

- **Offline-first é o requisito nº 1** — campo tem pouca conectividade; nada de tela bloqueada por rede.
- API-first: o app é só mais um consumidor de `/api/v1` (mesmos JWT, tenant, roles do web).
- i18n `pt`/`es` desde o início (conteúdo do guia é es; resto do projeto é pt).
- Fotos e diagnoses só vão ao servidor via **fila de sync** (sem requests "fire and forget").
- Simplicidade sobre otimização prematura (sem Redux, sem libs de estado; SQLite + hooks).

---

# Visão geral

| Milestone | Status | Entrega |
|-----------|--------|---------|
| PM0 — Fundação | Planejado | Scaffold Expo, router, i18n, auth |
| PM1 — Offline core | Planejado | SQLite, catálogo, fila de sync |
| PM2 — Diagnóstico MVP | Planejado | Formulário 8 dimensões = 41 indicadores, submit, validate |
| PM3 — Resultado & Plano | Planejado | Nível de transição, prioridades, recomendações |
| PM4 — Robustez offline | Planejado | Fotos offline, conflitos, retry inteligente |
| PM5 — Produtor (público) | Planejado | Onboarding simples, acesso por convite, sem técnico |
| PM6 — Escala | Planejado | Mapas por lote, multi-finca, analytics, integrações |

---

# PM0 — Fundação

- Scaffold **Expo SDK 53** + **expo-router** (file-based, espelha convenção do frontend).
- TypeScript strict; lint ESLint (eslint-config-expo).
- **Auth JWT**: login/register; refresh automático; tokens em `expo-secure-store`.
- **i18n** `i18next`: `pt`/`es`, recursos organizados por feature.
- Estrutura `src/api`, `src/db`, `src/sync`, `src/i18n`, `src/features`.
- Config via `EXPO_PUBLIC_API_URL`.

**Entregável:** app abre, loga contra `/api/v1`, navega pelas 4 tabs (Fincas, Diagnóstico, Plano, Perfil).

---

# PM1 — Offline core

- `expo-sqlite` local: tabelas `template/dimension/indicator/indicator_level/local_area/local_assessment/local_score/pending_op`.
- **Pull de catálogo**: templates + indicadores + áreas ficam em cache local na primeira carga online.
- **Push fila**: `pending_op` para `assessment_create`, `scores_replace`, `submit`, `photo`.
- `@react-native-community/netinfo` dispara `runSync()` ao reconectar.
- Versionamento LWW simples (servidor ganha em conflito).

**Entregável:** cria e edita um diagnóstico 100% offline; sync sozinho ao voltar a conexão.

---

# PM2 — Diagnóstico MVP

- Lista de fincas (áreas da org) + cria diagnose local.
- Formulário por dimensão: radio de 4 níveis por indicador com a descrição traduzida.
- Contagem de progresso (X/41), validação de preenchimento completo para submeter.
- Fluxo **submit** (produtor `volunteer`) → **validate** (técnico `researcher`).

**Entregável:** ciclo completo produtor→técnico com persistência offline.

---

# PM3 — Resultado & Plano

- `GET /assessments/{id}/result`: gráfico por dimensão (flat Views, sem lib de chart) + dados numéricos.
- Badges dos 4 sistemas de transição (Degenerativo → Regenerativo livre de insumos químicos).
- **Prioridades críticas** (indicadores nível 0 em finca nível 2/3) e avisos (nível ≤1 em finca nível 3).
- Recomendações de práticas regenerativas por dimensão fraca; plano inicial como derivado do resultado.

**Entregável:** finca recebe nível + o que melhorar + como melhorar.

---

# PM4 — Robustez offline

- **Fotos offline**: `expo-image-picker` → cópia local (`expo-file-system`) → upload com retry e backoff; compressão leve.
- **Conflitos**: tratamento explícito de 4xx (não retenta) vs 5xx/offline (retenta). Indicador de "pendente" na UI.
- **Pontos de amostragem** no campo com GPS (`expo-location`); validação de ≥3/ha como orientação.
- PWA/OTA: **EAS Update** para atualizações sem loja.

**Entregável:** diagnóstico completo (incl. fotos e pontos 20×20 m) feito no campo sem rede.

---

# PM5 — Produtor (público)

- Onboarding: registrar finca em 3 passos; vinculação por convite (link/código) à org do técnico.
- UI simplificada focada no produtor (números grandes, sem jargão técnico pesado).
- Modo "leitura" do técnico para assistência à distância (relatório compartilhável).
- Notificações locais de lembrete (ex.: época de manejo de sombra).

**Entregável:** um produtor sozinho completa o diagnóstico e recebe plano, sem ajuda técnica.

---

# PM6 — Escala

- Mapa da finca por lote (PostGIS / tiles) com scores por ponto.
- Histórico de diagnose por finca (evolução ano a ano → transição no tempo).
- Analytics agregados por org/região (export CSV).
- Alinhar com roadmap M4 do OpenForest: sensores simulados (temperatura/umidade) alimentando recomendações.
- Separação template→versões da guia.

**Entregável:** plataforma de diagnóstico regenerativa multi-finca, com evolução temporal.

---

# Critérios de prontidão (Definition of Done mobile)

- Roda offline do 1º ao último passo do diagnóstico (sem gracejos de rede).
- `npm run lint` + `npm run typecheck` limpos.
- Fluxo E2E validado contra `/api/v1` (seed + backend de teste).
- Strings de UI e conteúdo do guia traduzidos (`pt`/`es`).
- Sem segredos no app (tokens só em `SecureStore`).
- Docs atualizados (`AGENTS-MOBILE.md` ou seção no `AGENTS-FRONTEND.md`).

---

# Não-objetivos (por ora)

- Redux/MobX/estado global pesado (SQLite + hooks bastam).
- Charts com libs (plotar com Views até precisar).
- Offline 3-way merge (LWW é o suficiente no MVP).
- PWA do OpenForest substituindo o app (o app é o veículo offline; o PWA do M3 fica para o web).