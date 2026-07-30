# 🌳 OpenForest

> **An open-source platform for monitoring environmental restoration projects, field data collection, and ecological monitoring.**

![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/Python-3.12+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![Status](https://img.shields.io/badge/status-early_development-orange)

---

## Vision

Environmental restoration is becoming increasingly important worldwide, yet many organizations still rely on spreadsheets, disconnected tools, and proprietary software to monitor restoration projects.

OpenForest aims to provide a modern, open-source platform that enables organizations to manage restoration initiatives, collect field observations, monitor ecological indicators, and integrate environmental data through a scalable API-first architecture.

Our long-term vision is to become the reference open-source platform for environmental restoration management.

---

## Why OpenForest?

Current solutions often suffer from one or more of these problems:

- Closed-source software
- Vendor lock-in
- Poor integration capabilities
- Limited APIs
- Weak mobile support
- Lack of observability
- Difficult deployment
- High licensing costs

OpenForest addresses these limitations by providing a modern cloud-native architecture built with open technologies.

---

## Goals

- Monitor restoration projects
- Manage restoration sites
- Collect field observations
- Store ecological monitoring data
- Support sensor integrations
- Provide a public REST API
- Enable future GIS integrations
- Support offline-first clients
- Be fully open source

---

# Features (Roadmap)

## Phase 1

- Project management
- Restoration areas
- Field monitoring
- Species registry
- Photo uploads
- REST API
- Authentication
- Dashboard

---

## Phase 2

- Offline synchronization
- Sensor integration
- Notifications
- Background workers
- File processing
- Caching
- Search

---

## Phase 3

- AI-assisted ecological reports
- Satellite imagery
- Drone imagery
- Time-series analysis
- Public data portal
- GIS integrations
- Mobile application

---

# Architecture

OpenForest follows a **Modular Monolith** architecture.

Instead of prematurely adopting microservices, each business domain is isolated into independent modules while remaining within a single deployable application.

```
                Next.js Frontend
                       │
                       ▼
                 FastAPI Backend
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   PostgreSQL       Redis          MinIO
        │
        ▼
 OpenTelemetry
        │
        ▼
 Prometheus
        │
        ▼
     Grafana
```

The architecture is intentionally designed to evolve gradually into distributed services as the project grows.

---

# Technology Stack

## Backend

- FastAPI
- Python
- SQLModel
- Alembic
- Pydantic

## Frontend

- Next.js
- React
- TypeScript
- TailwindCSS

## Database

- PostgreSQL

## Cache

- Redis

## Object Storage

- MinIO

## Observability

- OpenTelemetry
- Prometheus
- Grafana
- Loki

## DevOps

- Docker
- Docker Compose
- GitHub Actions
- uv

---

# Project Structure

```
openforest/
├── backend/
│   ├── src/openforest/api/
│   │   ├── main.py                  # FastAPI app
│   │   ├── config.py                # pydantic-settings
│   │   ├── models/                  # SQLModel (area, monitoring, photo, project, user, …)
│   │   ├── infrastructure/          # DB engine, Alembic env
│   │   └── …
│   ├── tests/
│   ├── alembic.ini
│   ├── pyproject.toml
│   └── Dockerfile / Dockerfile.dev
├── frontend/                        # Next.js (em desenvolvimento)
├── infrastructure/                  # Docker, CI/CD, deploy
├── docs/
├── .github/
├── README.md
├── ARCHITECTURE.md
├── ROADMAP.md
├── CONTRIBUTING.md
└── AGENTS.md
```

---

# Core Domains

The application is organized into business domains instead of technical layers.

- Authentication
- Projects
- Restoration Areas
- Monitoring
- Species
- Users
- Media
- Notifications

Each domain owns its own:

- API
- Services
- Models
- Database access
- Tests

This improves maintainability and prepares the project for future decomposition if necessary.

---

# API First

Every feature is designed through the API before the user interface.

Benefits include:

- Third-party integrations
- Mobile applications
- Automation
- Public APIs
- Better testing

Interactive documentation is automatically generated using OpenAPI.

---

# Engineering Principles

OpenForest follows a small set of engineering principles.

## Simplicity First

Avoid unnecessary complexity.

## Modular Design

Business domains remain independent.

## Cloud Ready

Everything should be deployable in cloud environments.

## Observability by Default

Metrics, logs and traces are first-class citizens.

## Testability

Code should be easy to test.

## Documentation

Every architectural decision should be documented.

---

# Architecture Decision Records (ADR)

Every major architectural decision is documented.

Examples:

```
ADR-001 Modular Monolith

ADR-002 FastAPI

ADR-003 PostgreSQL

ADR-004 Redis

ADR-005 API First

ADR-006 Docker Compose
```

This allows contributors to understand not only **what** was built, but **why**.

---

# Getting Started

### Requirements

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- Docker + Docker Compose
- Node.js 20+

### Clone

```bash
git clone https://github.com/seu-usuario/openforest.git
cd openforest
```

### Configure Environment

Copie o arquivo de exemplo e ajuste as variáveis:

```bash
cp backend/.env.example backend/.env
```

> **Atenção:** O arquivo `.env` contém credenciais e não deve ser versionado.
> O `.gitignore` já o exclui — verifique antes de commitar.

### Opção 1 — Docker Compose (recomendado)

Sobe todos os serviços (PostgreSQL, Redis e backend):

```bash
docker compose up
```

- API: <http://localhost:8000>
- Swagger: <http://localhost:8000/docs>

### Opção 2 — Local (backend apenas)

Certifique-se de ter PostgreSQL e Redis rodando (ex: via `docker compose up postgres redis`).

```bash
cd backend
uv sync                       # instala dependências
alembic upgrade head           # executa migrations
fastapi dev                    # servidor de desenvolvimento
```

### Testes

```bash
cd backend
pytest                         # todos os testes
pytest -x                      # para no primeiro erro
pytest --cov=src/openforest/api  # com cobertura
```

---

# Documentation

Project documentation is organized under the `docs/` directory.

- Product Vision
- Architecture
- ADRs
- Development Guide
- API Design
- Deployment Guide

---

# Contributing

Contributions are welcome.

Before submitting a Pull Request:

- Read CONTRIBUTING.md
- Check existing issues
- Follow coding conventions
- Include tests
- Update documentation if necessary

---

# Roadmap

Upcoming engineering milestones include:

- Background jobs
- Event-driven processing
- File pipelines
- Geospatial support
- AWS deployment
- Kubernetes deployment
- OpenTelemetry
- Distributed tracing
- Rate limiting
- RBAC
- Public SDK

---

# Long-Term Vision

OpenForest aims to become more than a restoration monitoring platform.

The project aspires to become an open ecosystem for environmental data, restoration initiatives, ecological monitoring, and scientific collaboration.

We believe environmental software should be:

- Open
- Transparent
- Extensible
- Community-driven

---

# License

MIT License.

---

# Author

Created by **Johel Pires**.

If this project helps you, consider giving it a ⭐ on GitHub.
