# Design: AGENTS.md Monorepo Update

## Context

OpenForest is now a monorepo with `backend/`, `frontend/`, and `infrastructure/` directories. The existing `AGENTS.md` only covers the backend API. New documentation files exist (`ARCHITECTURE.md`, `ROADMAP.md`, `CONTRIBUTING.md`). The project needs updated AI agent guidance files reflecting the full scope.

## Scope

- Update `AGENTS.md` to reflect the monorepo structure and backend conventions
- Create `AGENTS-FRONTEND.md` for frontend conventions
- Cross-reference between them and with existing doc files

## Non-Goals

- No infrastructure-specific AGENTS file (infra conventions covered in ARCHITECTURE.md)
- No changes to existing code or project scaffolding
- No changes to ARCHITECTURE.md, ROADMAP.md, or CONTRIBUTING.md

## Decisions

### AGENTS.md (Backend)

- **Tech Stack**: FastAPI, SQLModel, PostgreSQL, Redis, JWT, pytest+httpx, uv, Ruff, mypy, Alembic
- **Project Structure**: Paths updated to `backend/src/openforest/api/` layout
- **Commands**: Docker Compose added for full stack; backend commands retain with `workdir: backend/` note
- **Conventions**: Unchanged from existing AGENTS.md (imports, Annotated, sync-vs-async, naming, errors, SQLModel base, JWT, testing patterns, config)
- **Cross-references**: Links to ARCHITECTURE.md, ROADMAP.md, AGENTS-FRONTEND.md
- **Skills**: fastapi skill retained

### AGENTS-FRONTEND.md (Frontend)

- **Tech Stack**: Next.js 15 (App Router), React 19, TypeScript strict, TailwindCSS, npm, vitest + testing-library, ESLint + Prettier
- **Project Structure**: `src/` layout with `app/` (routes), `components/`, `lib/`, `types/`
- **Commands**: npm run dev/build/lint/format/test
- **Conventions**: RSC by default, PascalCase components, Tailwind utilities, Server Components for data fetching
- **API Integration**: Backend at localhost:8000, prefix `/api/v1/`, auth via Authorization header

## Files to Create/Modify

1. **Modify**: `AGENTS.md` — update project overview, tech stack, structure, commands, add cross-references
2. **Create**: `AGENTS-FRONTEND.md` — full frontend conventions document

## Self-Review Checklist

- [x] Placeholders? None
- [x] Contradictions? None
- [x] Scope? Focused on AGENTS.md and AGENTS-FRONTEND.md content
- [x] Ambiguity? All decisions explicit
