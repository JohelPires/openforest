# AGENTS.md Monorepo Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update AGENTS.md to reflect monorepo structure and create AGENTS-FRONTEND.md with frontend conventions.

**Architecture:** Two independent files: AGENTS.md (backend/monorepo overview) updated in-place, AGENTS-FRONTEND.md (frontend conventions) created fresh. Cross-references link them and point to ARCHITECTURE.md, ROADMAP.md, CONTRIBUTING.md for shared documentation.

**Tech Stack:** Backend → FastAPI, SQLModel, PostgreSQL, Redis, JWT, pytest+httpx, uv, Ruff, mypy, Alembic. Frontend → Next.js 15 (App Router), React 19, TypeScript strict, TailwindCSS, npm, vitest+testing-library, ESLint+Prettier.

## Global Constraints

- AGENTS.md retains fastapi skill in its Skills section
- AGENTS-FRONTEND.md does NOT include fastapi skill
- All file paths use monorepo-root-relative paths (e.g., `backend/src/openforest/api/`)
- Frontend conventions follow Next.js 15 App Router patterns (RSC by default, 'use client' only when needed)
- Frontend uses npm (not pnpm) as README was overridden by user preference
- Cross-references use relative paths (e.g., `AGENTS-FRONTEND.md`)

---

### Task 1: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: existing AGENTS.md content, approved design spec
- Produces: updated AGENTS.md with monorepo overview and cross-references

- [ ] **Step 1: Read current AGENTS.md**

Run: Confirm the file exists and review its current content.

- [ ] **Step 2: Write updated AGENTS.md**

Replace the existing content with the updated version:

```markdown
# OpenForest

## Project Overview

OpenForest é uma plataforma open source para monitoramento colaborativo de projetos de restauração ambiental. Este repositório é um monorepo contendo:

- **`backend/`** — API FastAPI (veja seções abaixo)
- **`frontend/`** — Interface Next.js (veja `AGENTS-FRONTEND.md`)
- **`infrastructure/`** — Docker, CI/CD, deploy

Documentos complementares:
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Arquitetura do sistema
- [`ROADMAP.md`](./ROADMAP.md) — Roadmap de milestones
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Guia de contribuição

### User Personas

- **ONG** — acompanha centenas de áreas restauradas
- **Prefeitura** — métricas agregadas (ex: árvores plantadas)
- **Pesquisador** — exporta dados brutos para análise
- **Voluntário** — registra fotos e observações em campo
- **Proprietário rural** — acompanha indicadores da própria área

### MVP Scope

- Cadastro de projetos
- Cadastro de áreas
- Upload de fotos
- Coleta de dados em campo (espécies, mudas, GPS)
- Sensores simulados (temperatura, umidade, qualidade do ar, chuva, luminosidade)
- Dashboard em tempo real

## Tech Stack

| Camada        | Tecnologia                          |
|---------------|-------------------------------------|
| Framework     | FastAPI                             |
| ORM           | SQLModel (sobre SQLAlchemy + Pydantic) |
| Banco         | PostgreSQL                          |
| Cache/Realtime| Redis                               |
| Autenticação  | JWT (access + refresh token)        |
| Testes        | pytest + httpx (TestClient)         |
| Pacotes       | uv                                  |
| Lint          | Ruff                                |
| Type check    | mypy                                |
| Migrações     | Alembic (via SQLModel)              |

> Para o stack do frontend, veja `AGENTS-FRONTEND.md`.

## Project Structure

```
openforest/
├── backend/
│   └── src/openforest/api/
│       ├── main.py                 # FastAPI app, lifespan, router includes
│       ├── config.py               # pydantic-settings (BaseSettings)
│       ├── models/                 # SQLModel table models (DB mapping)
│       │   ├── __init__.py
│       │   ├── base.py             # Base model com id, created_at, updated_at
│       │   ├── project.py
│       │   ├── area.py
│       │   └── ...
│       ├── schemas/                # Pydantic request/response schemas
│       │   ├── __init__.py
│       │   ├── project.py
│       │   ├── area.py
│       │   └── ...
│       ├── routers/                # APIRouters por domínio
│       │   ├── __init__.py
│       │   ├── projects.py
│       │   ├── areas.py
│       │   └── ...
│       ├── dependencies/           # Depends reutilizáveis
│       │   ├── __init__.py
│       │   ├── auth.py             # CurrentUserDep, get_current_user
│       │   └── database.py         # SessionDep, get_session
│       ├── services/               # Lógica de negócio
│       │   ├── __init__.py
│       │   ├── project_service.py
│       │   └── ...
│       └── infrastructure/         # Conexões externas (DB, cache, fila, storage)
│           ├── __init__.py
│           ├── database.py         # engine, session factory
│           ├── redis.py
│           └── storage.py          # Upload de fotos (S3/local)
├── frontend/                       → veja AGENTS-FRONTEND.md
├── infrastructure/                 → Docker, CI/CD, deploy
├── docs/
│   └── superpowers/
│       ├── plans/
│       └── specs/
├── README.md
├── ARCHITECTURE.md
├── ROADMAP.md
└── CONTRIBUTING.md
```

## Commands

```bash
# Subir tudo (Docker Compose)
docker compose up

# Servidor de desenvolvimento (backend)
fastapi dev

# Servidor de produção
fastapi run

# Testes
pytest                          # Todos os testes
pytest -x                       # Para no primeiro erro
pytest --cov=backend/src/openforest/api  # Com cobertura
pytest -k "test_projects"       # Filtrar por nome

# Lint e formatação
ruff check backend/src/
ruff format backend/src/ --check
ruff format backend/src/

# Type checking
mypy backend/src/

# Dependências
uv add <package>
uv sync
uv lock

# Migrações (Alembic via SQLModel)
alembic revision --autogenerate -m "descrição"
alembic upgrade head
```

## Coding Conventions

### Imports

```python
from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
```

### Annotated para parâmetros e dependências

Sempre usar `Annotated` para `Path`, `Query`, `Header`, `Depends`:

```python
SessionDep = Annotated[Session, Depends(get_session)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]

@router.get("/")
def list_projects(
    session: SessionDep,
    current_user: CurrentUserDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Sequence[Project]:
    ...
```

### Sync vs Async

- **Sync (def)** por padrão, a menos que o endpoint dependa de lib async
- **Async (async def)** apenas quando chamar libs async (redis, httpx, etc.)
- Bloqueio em função async quebra performance — nunca misturar

### Tipagem

- Sempre declarar return type em endpoints e funções
- `Sequence[T]` para listas (import de `collections.abc`)
- `| None` (Python 3.10+) em vez de `Optional[T]`

### Naming

- **Modelos SQLModel:** singular (`Project`, `Area`)
- **Tabelas:** snake_case plural (SQLModel infere)
- **Schemas Pydantic:** `ProjectCreate`, `ProjectRead`, `ProjectUpdate`
- **Routers:** prefixo plural, tags em português
- **Variáveis:** snake_case

### Erros

```python
raise HTTPException(
    status_code=404,
    detail=[{"msg": "Projeto não encontrado", "type": "not_found"}],
)
```

Usar lista de objetos de erro com `type` padronizado.

## Database Conventions

### SQLModel

- Models em `models/`, cada um em seu arquivo
- Schemas de request/response em `schemas/` — separados dos models de DB
- `table=True` em models de banco; sem `table` para schemas

### Base Model

```python
from uuid import UUID, uuid4
from datetime import datetime, timezone
from sqlmodel import Field, SQLModel

class Base(SQLModel):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
```

### Migrations

- Alembic configurado via SQLModel
- `alembic revision --autogenerate` após cada alteração em models
- Revisões revisadas antes de aplicar

## API Design

### Routers

- Um `APIRouter` por domínio, declarado com `prefix` e `tags` no router

```python
router = APIRouter(prefix="/projects", tags=["projetos"])
```

### Response Patterns

- Preferir **return type** em vez de `response_model`
- Usar `response_model` apenas quando o schema público difere do retorno interno
- FastAPI serializa via Pydantic (lado Rust) — não usar ORJSONResponse

### Error Format

```json
{
  "detail": [
    {"msg": "Projeto não encontrado", "type": "not_found"},
    {"msg": "ID inválido", "type": "validation_error"}
  ]
}
```

### Versioning

Versão via prefixo `/v1/` nos routers. Adicionar `/v2/` quando necessário sem quebrar `/v1/`.

## Authentication

### JWT Flow

- **Access token:** 15 minutos
- **Refresh token:** 7 dias
- Algoritmo: HS256
- Senhas: bcrypt (`passlib`)

### Dependencies

```python
CurrentUserDep = Annotated[User, Depends(get_current_user)]
```

Get current user decodifica JWT do header `Authorization: Bearer <token>` e busca no DB.

### Endpoints

- `POST /v1/auth/register` — criar conta
- `POST /v1/auth/login` — retorna access + refresh token
- `POST /v1/auth/refresh` — novo access token via refresh token
- `POST /v1/auth/logout` — invalidar refresh token

## Testing

### Setup

pytest + httpx TestClient. Fixtures globais em `conftest.py`.

### Fixtures

```python
@pytest.fixture
def session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

@pytest.fixture
def client(session):
    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as c:
        yield c

@pytest.fixture
def auth_headers(client):
    response = client.post("/v1/auth/login", json={"email": "test@test.com", "password": "123"})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

### Structure

- Testes organizados por domínio: `test_projects.py`, `test_areas.py`, etc.
- Um arquivo por domínio ou grupo de endpoints relacionados
- `conftest.py` por diretório se necessário (drills down)

## Environment & Config

```python
# backend/src/openforest/api/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql://localhost:5432/openforest"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    storage_backend: str = "local"   # "local" | "s3"
    storage_path: str = "./uploads"

    model_config = {"env_file": ".env"}

settings = Settings()
```

### .env.example

```
DATABASE_URL=postgresql://localhost:5432/openforest
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=change-me
STORAGE_BACKEND=local
STORAGE_PATH=./uploads
```

## Skills

- `fastapi` — FastAPI conventions (installed locally)
```

- [ ] **Step 3: Verify the file**

Run: Confirm AGENTS.md has the updated content.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md with monorepo structure and cross-references"
```

---

### Task 2: Create AGENTS-FRONTEND.md

**Files:**
- Create: `AGENTS-FRONTEND.md`

**Interfaces:**
- Consumes: approved design spec for frontend conventions
- Produces: AGENTS-FRONTEND.md as the single source of truth for frontend AI agents

- [ ] **Step 1: Write AGENTS-FRONTEND.md**

```markdown
# OpenForest Frontend

## Project Overview

Este arquivo cobre as convenções do frontend OpenForest. Para backend, veja `AGENTS.md`.

OpenForest é uma plataforma open source para monitoramento colaborativo de projetos de restauração ambiental.

### MVP Scope (Frontend)

- Interface de cadastro e gerenciamento de projetos
- Visualização de áreas restauradas
- Upload de fotos
- Dashboard com indicadores em tempo real
- Coleta de dados em campo

## Tech Stack

| Camada           | Tecnologia                               |
|------------------|------------------------------------------|
| Framework        | Next.js 15 (App Router)                  |
| UI Library       | React 19                                 |
| Linguagem        | TypeScript (strict mode)                 |
| Estilização      | TailwindCSS                              |
| Pacotes          | npm                                      |
| Testes           | vitest + @testing-library/react          |
| Lint             | ESLint                                   |
| Formatação       | Prettier                                 |

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # App Router (páginas e layouts)
│   │   ├── layout.tsx          # Layout raiz
│   │   ├── page.tsx            # Home
│   │   ├── projects/           # Projetos
│   │   │   ├── page.tsx        # Lista
│   │   │   └── [id]/           # Detalhe
│   │   ├── areas/              # Áreas
│   │   ├── dashboard/          # Dashboard
│   │   └── auth/               # Login/Register
│   ├── components/             # Componentes reutilizáveis
│   │   ├── ui/                 # Componentes de UI genéricos
│   │   └── features/           # Componentes específicos de domínio
│   ├── lib/                    # Utilitários e API client
│   │   ├── api.ts              # Cliente HTTP para o backend
│   │   └── utils.ts            # Funções auxiliares
│   ├── types/                  # Tipos TypeScript compartilhados
│   └── middleware.ts            # Next.js middleware (auth, redirect)
├── public/                     # Assets estáticos
├── tests/                      # Testes
│   ├── components/
│   └── lib/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── eslint.config.mjs
└── .prettierrc
```

## Commands

```bash
# Dev server
npm run dev

# Build de produção
npm run build

# Lint
npm run lint

# Formatação
npm run format

# Testes
npm test                    # Todos os testes
npm run test:watch          # Watch mode
npm run test:coverage       # Com cobertura
```

## Coding Conventions

### Componentes

- **React Server Components (RSC)** por padrão
- `'use client'` apenas quando necessário (event handlers, hooks, estado)
- Componentes em PascalCase, arquivos com mesmo nome do componente

```typescript
// src/components/ui/Button.tsx
interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}

export function Button({ children, variant = "primary" }: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`}>
      {children}
    </button>
  );
}
```

### Server Components (Data Fetching)

```typescript
// src/app/projects/page.tsx
import { api } from "@/lib/api";

interface Project {
  id: string;
  name: string;
}

export default async function ProjectsPage() {
  const projects = await api.get<Project[]>("/v1/projects");
  return (
    <ul>
      {projects.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}
```

### Client Components

```typescript
// src/components/features/ProjectForm.tsx
"use client";

import { useState } from "react";

export function ProjectForm() {
  const [name, setName] = useState("");
  // ...
}
```

### Estilização

- TailwindCSS utility classes exclusivamente
- Sem CSS modules, styled-components, ou arquivos .css avulsos
- Para temas: usar variáveis CSS no `tailwind.config.ts`

```typescript
// Sempre inline no JSX
export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border p-4 shadow-sm">{children}</div>;
}
```

### Tipagem

- TypeScript strict mode habilitado
- Preferir `interface` sobre `type` para props e objetos
- `type` para uniões e utilitários

```typescript
interface User {
  id: string;
  email: string;
}

type Status = "active" | "inactive" | "pending";
```

### Naming

| Item             | Convention        | Exemplo                |
|------------------|-------------------|------------------------|
| Componentes      | PascalCase        | `ProjectCard`          |
| Funções          | camelCase         | `formatDate()`         |
| Arquivos de componente | PascalCase | `ProjectCard.tsx`      |
| Arquivos de utilidade  | camelCase | `api.ts`, `utils.ts`   |
| Pastas (rota)    | kebab-case        | `/project-settings`    |
| Pastas (código)  | camelCase         | `src/lib/`, `src/types/` |

### Imports

```typescript
// Ordem: React → Next → libs → internos
import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
```

## API Integration

### Base URL

- Desenvolvimento: `http://localhost:8000`
- Produção: definido via `NEXT_PUBLIC_API_URL`

### Client Example

```typescript
// src/lib/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};
```

### Autenticação

- Token JWT armazenado em cookie HTTP-only (via backend)
- Ou header `Authorization: Bearer <token>` para chamadas client-side
- Middleware Next.js para redirecionar rotas protegidas

## Environment Variables

```
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## Testing

### Setup

vitest + @testing-library/react.

```typescript
// tests/setup.ts
import "@testing-library/jest-dom/vitest";
```

### Fixtures

```typescript
// tests/helpers.tsx
import { render, type RenderOptions } from "@testing-library/react";
import { type ReactElement } from "react";

function customRender(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { ...options });
}

export { customRender as render };
```

### Test Example

```typescript
// tests/components/Button.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });
});
```

## Skills

- `nextjs` — Next.js conventions (if available)
- `tailwind` — TailwindCSS conventions (if available)
```

- [ ] **Step 2: Verify the file**

Run: Confirm AGENTS-FRONTEND.md was created successfully.

- [ ] **Step 3: Commit**

```bash
git add AGENTS-FRONTEND.md
git commit -m "docs: create AGENTS-FRONTEND.md with frontend conventions"
```

---

### Task 3: Final Verification

**Files:** none (verification only)

- [ ] **Step 1: Verify cross-references**

Check that AGENTS.md references AGENTS-FRONTEND.md and vice-versa.

- [ ] **Step 2: Verify AGENTS.md frontmatter/title**

Run: Ensure the first line/title of both files is correct.

- [ ] **Step 3: Final commit if needed**

```bash
git add -A
git commit -m "docs: finalize AGENTS.md and AGENTS-FRONTEND.md cross-references"
```
```

- [ ] **Step 3: Write AGENTS-FRONTEND.md**

Create the file with the complete content from Step 1.

- [ ] **Step 4: Commit**

```bash
git add AGENTS-FRONTEND.md
git commit -m "docs: create AGENTS-FRONTEND.md with frontend conventions"
```
