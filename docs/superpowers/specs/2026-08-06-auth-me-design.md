# Design: endpoint `GET /api/v1/auth/me`

Data: 2026-08-06

## Objetivo

Expor o usuário autenticado e sua organização vinculada para o frontend montar o contexto multi-tenant.

## Decisões

- Endpoint: `GET /api/v1/auth/me`, protegido por Bearer token via `CurrentUserDep`.
- Resposta inclui dados do usuário **e** da organização vinculada (id, nome, role).
- Usuário sem organização (recém-registrado) ou superuser recebe `200` com `organization: null`.
- Implementação inline no router `auth.py`, seguindo os padrões existentes do repo (queries inline já usadas em `auth.py` e `organizations.py`).

## Componentes

### Schema (`schemas/auth.py`)

```python
class MeOrganization(SQLModel):
    id: UUID
    name: str
    role: UserOrganizationRole

class MeRead(SQLModel):
    id: UUID
    name: str
    email: str
    created_at: datetime
    updated_at: datetime
    organization: MeOrganization | None = None
```

### Rota (`routers/auth.py`)

`GET /me` com `SessionDep` + `CurrentUserDep`:

- Se `current_user.is_superuser`: `organization = None`.
- Senão, busca `UserOrganization` por `user_id` e, se existir, carrega a `Organization` para montar `MeOrganization(id, name, role)`.
- Se não houver vínculo: `organization = None` (200).

## Testes

Em `tests/test_auth.py`:

- `GET /me` sem token → 401.
- Usuário registrado sem org → 200 com `organization: null`.
- Usuário que criou uma org (`POST /organizations`) → 200 com `organization.role == "manager"` e id/name da org.
- Superuser → 200 com `organization: null`.

## Fora de escopo

- Mudança de comportamento de `get_current_org` (mantém 403 para outras rotas).
- Refresh/session endpoints novos.
