# Sprint 2 — Autenticação e Usuários

> Data: 2026-07-30
> Status: Aprovado
> Sprint: 2

## Objetivo

Implementar autenticação JWT completa (register, login, refresh, logout), proteger todos os endpoints existentes, e estabelecer base para autorização baseada em `UserOrganizationRole`.

## Pacotes

Adicionar ao `pyproject.toml`:

| Pacote | Versão | Uso |
|--------|--------|-----|
| `passlib[bcrypt]` | >=1.7.4 | Hash de senhas |
| `pyjwt` | >=2.8.0 | Criação/validação de JWT |
| `python-multipart` | — | Suporte a form data no login |

## Schemas (`schemas/auth.py`)

- `UserCreate` — `name: str`, `email: str`, `password: str`
- `UserRead` — `id: UUID`, `name: str`, `email: str`, `created_at: datetime`, `updated_at: datetime`
- `Token` — `access_token: str`, `refresh_token: str`, `token_type: str = "bearer"`
- `LoginRequest` — `email: str`, `password: str`
- `RefreshRequest` — `refresh_token: str`

## Auth Router (`routers/auth.py`)

Router com prefix `/auth` e tag `autenticação`.

### Endpoints

| Método | Path | Request | Response | Lógica |
|--------|------|---------|----------|--------|
| POST | `/auth/register` | `UserCreate` | `Token` | Hash password, cria User, gera tokens |
| POST | `/auth/login` | `LoginRequest` | `Token` | Verifica email+senha, gera tokens |
| POST | `/auth/refresh` | `RefreshRequest` | `Token` | Valida refresh token (não blacklisted), gera novos tokens |
| POST | `/auth/logout` | `RefreshRequest` | `{"msg"}` | Blacklista refresh token no Redis |

### Fluxos

**Register:** valida email único → hash password → cria User → `create_access_token(user.id)` + `create_refresh_token(user.id)` → retorna `Token`.

**Login:** busca user por email → `verify_password` → se falhar, 401 → gera tokens → retorna `Token`.

**Refresh:** decodifica refresh token → checa Redis blacklist → se blacklisted, 401 → gera novos access + refresh tokens → retorna `Token`.

**Logout:** decodifica refresh token → adiciona ao Redis blacklist com TTL → retorna 200.

## Services (`services/auth_service.py`)

### `hash_password(password: str) -> str`

Usa `passlib.context.CryptContext(schemes=["bcrypt"])`.

### `verify_password(plain: str, hashed: str) -> bool`

Usa `pwd_context.verify(plain, hashed)`.

### `create_access_token(user_id: str) -> str`

JWT com:
- sub: user_id
- exp: `datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)`
- type: "access"

### `create_refresh_token(user_id: str) -> str`

JWT com:
- sub: user_id
- exp: `datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)`
- type: "refresh"
- jti: `uuid4()` (para blacklist)

### `decode_token(token: str) -> dict`

Decodifica JWT com `settings.secret_key`, `algorithms=[settings.algorithm]`. Levanta exceção se expirado/inválido.

### `blacklist_token(jti: str, expires_in: int)`

Adiciona `jti` ao Redis com TTL.

## Dependências (`dependencies/auth.py`)

### `get_current_user`

1. Extrai token do header `Authorization: Bearer <token>`
2. Decodifica JWT
3. Busca `User` no DB por `UUID(sub)`
4. Se não encontrar, 401
5. Retorna `User`

### `CurrentUserDep`

`Annotated[User, Depends(get_current_user)]`

### Verificação de token no Redis (dentro de get_current_user)

Para access tokens, não verificamos Redis (access token é curto, 15min). A verificação de blacklist só ocorre para refresh tokens.

## Proteção de Endpoints Existentes

Adicionar `current_user: CurrentUserDep` em todos os endpoints dos routers:
- `routers/projects.py` — todos os 5 endpoints
- `routers/areas.py` — todos os 5 endpoints
- `routers/organizations.py` — todos os 5 endpoints
- `routers/monitoring.py` — todos os 5 endpoints

Endpoint `/health` permanece público.

## Autorização por Role (`UserOrganizationRole`)

### `RoleChecker`

Fábrica que retorna uma dependência configurável:

```python
def require_role(*roles: UserOrganizationRole) -> Callable:
    # Retorna dependência que verifica se current_user
    # tem pelo menos uma das roles na organização do recurso
```

Para recursos organizacionais (projetos, áreas), verificar na `UserOrganization` se `current_user.id` + `organization_id` tem a role adequada.

### Regras de autorização (MVP)

- **Criar/Editar/Deletar** (projetos, áreas, monitoramentos): `admin` ou `manager`
- **Visualizar**: qualquer role (`admin`, `manager`, `researcher`, `volunteer`, `viewer`)

## Redis (`infrastructure/redis.py`)

```python
from redis import Redis

redis_client: Redis | None = None

def get_redis() -> Redis:
    global redis_client
    if redis_client is None:
        redis_client = Redis.from_url(settings.redis_url)
    return redis_client

def blacklist_token(jti: str, expires_in: int) -> None:
    r = get_redis()
    r.setex(f"token_blacklist:{jti}", expires_in, "blacklisted")

def is_token_blacklisted(jti: str) -> bool:
    r = get_redis()
    return r.exists(f"token_blacklist:{jti}") > 0
```

Usar `get_redis()` com lazy initialization e connection pooling do redis-py.

## Config

Adicionar a `Settings` em `config.py`:

```python
algorithm: str = "HS256"
```

`secret_key`, `access_token_expire_minutes`, `refresh_token_expire_days`, `redis_url` já existem.

## Testes (`tests/test_auth.py`)

Usar PostgreSQL real (mesmo padrão de `test_projects.py`).

### Cenários

| Teste | Verificação |
|-------|-------------|
| `test_register_user` | 200, retorna tokens, access_token é string |
| `test_register_duplicate_email` | 409, email já cadastrado |
| `test_login_success` | 200, retorna tokens |
| `test_login_wrong_password` | 401 |
| `test_login_email_not_found` | 401 |
| `test_refresh_token_success` | 200, novo access_token |
| `test_refresh_token_invalid` | 401 |
| `test_refresh_token_blacklisted` | 401 após logout |
| `test_logout` | 200, refresh token invalidado |
| `test_protected_endpoint_no_auth` | 401 |
| `test_protected_endpoint_invalid_token` | 401 |
| `test_protected_endpoint_valid_token` | 200 |

### Fixtures

```python
@pytest.fixture
def auth_headers(client, session):
    # Registra user, retorna {"Authorization": "Bearer <token>"}
```

## Alterações no Modelo User

Nenhuma. O modelo atual (`name`, `email`, `password_hash`) atende ao MVP. Sem `is_active`.

## Pendências (fora do escopo)

- Rate limiting
- Password reset flow
- Email verification
- OAuth2 / SSO
- Paginação em listagens
- `get_current_user_optional`
