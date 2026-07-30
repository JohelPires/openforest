# Contribuindo com o OpenForest

## Pré-requisitos

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- Docker + Docker Compose
- Node.js 20+

## Setup

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/openforest.git
cd openforest

# 2. Configure as variáveis de ambiente
cp backend/.env.example backend/.env

# 3. Instale as dependências do backend
cd backend
uv sync

# 4. Suba os serviços (PostgreSQL + Redis)
docker compose up postgres redis -d

# 5. Execute as migrations
alembic upgrade head

# 6. Rode o servidor de desenvolvimento
fastapi dev
```

A API estará em <http://localhost:8000> e o Swagger em <http://localhost:8000/docs>.

## Comandos úteis

> Execute todos abaixo no diretório `backend/`.

```bash
pytest                          # Todos os testes
pytest -x                       # Para no primeiro erro
pytest --cov=src/openforest/api # Com cobertura

ruff check src/                 # Lint
ruff format src/ --check        # Verificar formatação
ruff format src/                # Corrigir formatação

mypy src/                       # Type checking

alembic revision --autogenerate -m "descrição"
alembic upgrade head
alembic downgrade -1

uv add <pacote>                 # Adicionar dependência
uv sync                         # Sincronizar ambiente
uv lock                         # Atualizar lockfile
```

## Estrutura do projeto

```
backend/src/openforest/api/
├── main.py              # FastAPI app, lifespan, router includes
├── config.py            # pydantic-settings
├── models/              # SQLModel table models
├── schemas/             # Pydantic request/response schemas
├── routers/             # APIRouters por domínio
├── dependencies/        # Depends reutilizáveis
├── services/            # Lógica de negócio
└── infrastructure/      # Conexões externas (DB, cache, storage)
```

## Como contribuir

1. Crie uma branch a partir da `main`:
   ```bash
   git checkout -b feat/nome-da-feature
   ```
2. Faça suas alterações seguindo as convenções do projeto.
3. Certifique-se de que testes, lint e type check passam:
   ```bash
   pytest && ruff check src/ && mypy src/
   ```
4. Faça commit com mensagem clara e descritiva:
   ```bash
   git commit -m "feat: adiciona autenticação JWT"
   ```
5. Abra um Pull Request para a branch `main`.

## Convenções de código

As convenções detalhadas estão em [`AGENTS.md`](./AGENTS.md). Resumo:

- **Sync por padrão**, async apenas com libs async
- **Annotated** para Depends, Query, Path
- **Return types** declarados em todos os endpoints
- **Erros** como lista de objetos com `msg` e `type`
- **SQLModel** para models de banco; Pydantic separado para schemas
- **Ruff + mypy** obrigatórios antes de commitar

## Segurança

- Nunca commite arquivos `.env` ou secrets
- O `.gitignore` já exclui `.env` — verifique com `git status` antes de commitar
- Use placeholders em exemplos de documentação

## Code Review

- Todo PR precisa de ao menos uma aprovação
- Verifique se testes passam no CI
- Mantenha PRs pequenos e focados

## Dúvidas

Abra uma [issue](https://github.com/anomalyco/openforest/issues) ou discussion.
