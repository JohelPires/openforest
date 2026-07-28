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
