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

As personas se materializam como **papéis por organização** (ver [Authentication](#authentication)):

- **ONG** — papel `manager`: cria a organização (vira manager), gerencia membros, projetos e áreas
- **Prefeitura** — papel `viewer`/`researcher`: métricas agregadas (ex: árvores plantadas)
- **Pesquisador / técnico** — papel `researcher`: acesso completo aos dados da organização (projetos, áreas, monitoramentos, fotos, export)
- **Voluntário** — papel `volunteer`: registra fotos e observações em campo (cria monitoramentos, envia fotos)
- **Proprietário rural** — papel `viewer`: acompanha indicadores da própria área

> **Multi-tenant:** cada usuário pertence a exatamente uma organização. Todas as leituras e escritas são escopadas pelo servidor à organização do usuário (`CurrentOrgDep`). O admin global (`is_superuser`) ignora o escopo.

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

> Execute todos os comandos abaixo no diretório `backend/`.

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

# Seed de dados de desenvolvimento
uv run python scripts/seed.py            # popula dados realistas (idempotente)
uv run python scripts/seed.py --reset    # limpa o banco e popula do zero
uv run python scripts/seed.py --no-photos --password "outra-senha"
docker compose exec backend uv run python scripts/seed.py --reset  # via container
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
CurrentOrgDep = Annotated[UserOrganization, Depends(get_current_org)]
```

Get current user decodifica JWT do header `Authorization: Bearer <token>` e busca no DB. `get_current_org` resolve a organização única do usuário (403 se não vinculado).

### Roles & Multi-tenant Scoping

- **Admin global:** `User.is_superuser` — ignora todos os checks de organização
- **Papéis por organização:** `manager | researcher | volunteer | viewer`
- **Single-org:** cada usuário pertence a uma única organização; o servidor escopa toda leitura por ela (clientes nunca enviam tenant)
- Capacidade vem do **papel na org**, não da posse da linha (`created_by` é auditoria, não permissão)

```python
# Roteamento de permissões
require_org_role(UserOrganizationRole.manager, UserOrganizationRole.researcher)
require_superuser
require_area_role(area_id, UserOrganizationRole.volunteer)  # monitoramentos/fotos
```

### Endpoints

- `POST /v1/auth/register` — criar conta (usuário órfão, sem org; recebe 403 até ser vinculado)
- `POST /v1/auth/login` — retorna access + refresh token
- `POST /v1/auth/refresh` — novo access token via refresh token
- `POST /v1/auth/logout` — invalidar refresh token
- `POST /v1/organizations` — criar organização; vincula o criador como `manager` na mesma transação
- `GET/POST/PATCH/DELETE /v1/organizations/{id}/members` — gerenciar membros (manager/superuser); add de usuário de outra org retorna 409

## Testing

### Setup

pytest + httpx TestClient. Os testes rodam contra um banco PostgreSQL dedicado (`/openforest_test`, derivado de `settings.database_url`). O boilerplate de fixtures (`test_engine`, `create_tables`, `session`, `client`) é replicado por arquivo de teste — copie do arquivo sendo editado.

### Fixtures

```python
from urllib.parse import urlparse, urlunparse

import pytest
from sqlmodel import Session, SQLModel, create_engine

from openforest.api.config import settings

parsed = urlparse(settings.database_url)
test_db_url = urlunparse(parsed._replace(path="/openforest_test"))
test_engine = create_engine(test_db_url)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    SQLModel.metadata.create_all(test_engine)
    yield
    SQLModel.metadata.drop_all(test_engine)


@pytest.fixture
def session():
    connection = test_engine.connect()
    transaction = connection.begin()

    session = Session(bind=connection)

    session.begin_nested()

    def patched_commit():
        session.flush()
        session.begin_nested()

    session.commit = patched_commit

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(session):
    from openforest.api.infrastructure.database import get_session
    from openforest.api.main import app

    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Test User", "email": "test@test.com", "password": "secret123"},
    )
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
