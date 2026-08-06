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
| Framework        | Next.js 16 (App Router)                  |
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
│   └── proxy.ts                 # Next.js proxy (auth, redirect) — antigo middleware
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
    <button className={`rounded px-4 py-2 font-medium ${variant === "primary" ? "bg-green-600 text-white hover:bg-green-700" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>
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
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
```

## API Integration

### Base URL

- Backend: `http://localhost:8000` — todas as rotas sob `/api/v1`.
- O `next.config.ts` faz rewrite de `/api/:path*` → `${BACKEND_URL}/api/:path*`, então chamadas do browser usam **caminhos relativos** (`/api/v1/...`) — mesmo domínio, sem CORS.
- Ajuste em produção via `BACKEND_URL` (server-side, usada pelo rewrite).

### API client (`src/lib/api.ts`)

```typescript
// Chamadas do browser usam caminhos relativos (rewrite do next.config.ts)
apiFetch<T>("/v1/...") // -> /api/v1/...
```

- `apiFetch<T>(path, { method, body, auth })` — `auth: true` adiciona `Authorization: Bearer <access_token>`.
- Erros do backend (`{detail:[{msg,type}]}`) normalizados em `ApiError { status, type, message }` com a mensagem em português.
- Em `401` com refresh token válido, tenta `POST /auth/refresh` e repete a requisição uma vez (evita loop).
- Funções exportadas: `login`, `register`, `refreshTokens`, `logout`.

### Autenticação (frontend)

- Tokens JWT armazenados no cliente: `localStorage` quando "Lembrar de mim" marcado, senão `sessionStorage`.
- Access token: 15 min. Refresh token: 7 dias.
- `POST /auth/refresh` rotaciona os tokens (mesma storage de origem).
- `POST /auth/logout` com o refresh token blacklista o refresh no backend.
- `src/lib/auth.ts` gerencia a sessão e um cookie marcador `of_session` (`path=/; samesite=lax`), usado pelo `proxy.ts` para guarda otimista de rotas.
- Guarda de rotas em `src/proxy.ts` (o Next.js 16 renomeou `middleware.ts` para `proxy.ts`). A guarda é **otimista** — a segurança real fica no backend validando o JWT por requisição.

## Backend API Reference

Fonte: `/openapi.json` do backend (FastAPI). Base: `http://localhost:8000/api/v1`.

### Autenticação

| Método | Rota                    | Body                        | Retorno                                        |
|--------|-------------------------|-----------------------------|------------------------------------------------|
| POST   | `/auth/register`        | `{name, email, password}`   | `{access_token, refresh_token, token_type}`    |
| POST   | `/auth/login`           | `{email, password}`         | `{access_token, refresh_token, token_type}`    |
| POST   | `/auth/refresh`         | `{refresh_token}`           | `{access_token, refresh_token, token_type}`    |
| POST   | `/auth/logout`          | `{refresh_token}`           | `{msg}`                                        |

- Register/login/refresh retornam tokens (register já loga o usuário).
- Erros conhecidos: `duplicate_email` (409), `invalid_credentials` (401), `token_expired`/`invalid_token` (401).

### Endpoints protegidos (exigem `Authorization: Bearer <access_token>`)

| Método | Rota                                   | Observação                        |
|--------|----------------------------------------|-----------------------------------|
| GET/POST | `/projects/` (com barra final)        | Lista paginada / cria             |
| GET/PATCH/DELETE | `/projects/{project_id}`       | CRUD                              |
| GET/POST | `/organizations/` (com barra final)   | Lista paginada / cria             |
| GET/PATCH/DELETE | `/organizations/{organization_id}` | CRUD                          |
| GET/POST | `/projects/{project_id}/areas`        | Áreas de um projeto               |
| GET/PATCH/DELETE | `/areas/{area_id}`              | CRUD                              |
| GET/POST | `/areas/{area_id}/monitorings`        | Monitoramentos de uma área        |
| GET/PATCH/DELETE | `/monitorings/{monitoring_id}`  | CRUD                              |
| POST   | `/monitorings/{monitoring_id}/photos` | Upload multipart (`file`)         |
| GET/DELETE | `/photos/{photo_id}`              | Detalhe / remover                 |
| GET    | `/photos/{photo_id}/download`          | Download                          |
| GET    | `/health`                              | Sem auth                          |

- Listas paginadas usam `{items, total, offset, limit}` (query `offset`/`limit`, máximo 100).
- Consultas por id usam UUID.

### Formatos

```json
// Erro de negócio
{ "detail": [{ "msg": "Email já cadastrado", "type": "duplicate_email" }] }

// Erro de validação (FastAPI 422)
{ "detail": [{ "loc": ["body", "email"], "msg": "Field required", "type": "missing" }] }
```

## Environment Variables

```
# .env.local
BACKEND_URL=http://localhost:8000
```

- `BACKEND_URL` é lida pelo `next.config.ts` (rewrite `/api/:path*`). Não é exposta ao browser.
- O cliente nunca usa URL absoluta do backend — sempre caminhos relativos `/api/v1/...`.

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
