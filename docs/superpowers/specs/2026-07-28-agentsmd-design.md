# Design: AGENTS.md for OpenForest API

## Context

Greenfield FastAPI project. Only infrastructure present: FastAPI skill installed, empty AGENTS.md. Need a comprehensive AGENTS.md as the single source of truth for AI agents working on the project.

## Requirements

- Must cover: project overview, tech stack, project structure, commands, coding conventions, database conventions, API design patterns, authentication strategy, testing patterns, environment/config
- Must be consistent with installed FastAPI skill
- Must reflect confirmed decisions: FastAPI + SQLModel + PostgreSQL, JWT auth, pytest + httpx, uv + Ruff + mypy

## Structure (Approved)

1. **Project Overview** — mission, personas, MVP scope
2. **Tech Stack** — confirmed stack with versions/notes
3. **Project Structure** — directory tree with annotations
4. **Commands** — run, test, lint, format, typecheck, migrations, dependencies
5. **Coding Conventions** — imports, typing, async/sync, naming, error handling
6. **Database Conventions** — SQLModel patterns, migration strategy, naming, required fields
7. **API Design** — routers, response patterns, error format, versioning
8. **Authentication** — JWT flow, dependencies, password hashing
9. **Testing** — test structure, fixtures, factories, coverage
10. **Environment & Config** — pydantic-settings, .env.example

## Key Design Decisions

- Use `src/openforest/api/` layout (src-layout) for clean packaging
- SQLModel models in `models/`, Pydantic schemas in `schemas/` (separate request/response from DB)
- Services layer between routers and infrastructure for testability
- Dependencies layer (`dependencies/`) for reusable Depends
- JWT access token (15min) + refresh token (7d)
- pytest with `TestClient` from httpx, not `FastAPI.test_client()`
- One `APIRouter` per domain, with prefix and tags
- Sync endpoints by default, async only with async libs
- All tables get `id` (UUID), `created_at`, `updated_at`

## Out of Scope for AGENTS.md

- Detailed API endpoint docs (will be in OpenAPI schema)
- Deployment configuration
- Frontend conventions

## Self-Review Checklist

- [x] Placeholders? None
- [x] Contradictions? None
- [x] Scope? Focused on AGENTS.md content
- [x] Ambiguity? All decisions explicit
