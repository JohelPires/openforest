# Design — Multi-tenant scoping e roles (researcher/technician)

> Data: 2026-08-06
> Status: Aprovado
> Autores: Johel Pires, big-pickle

## Objetivo

Tornar o OpenForest verdadeiramente multi-tenant: cada usuário vê **apenas os dados da organização à qual está vinculado**, com capacidades definidas por **papel na organização**. O foco central é o fluxo do **pesquisador/technician**: ele faz login, lista projetos e enxerga somente os projetos da organização dele — sem precisar informar `organization_id` e sem enxergar dados de outras organizações.

## Estado Atual

- O modelo já é "multi-tenant no papel": `Project.organization_id`, e `Area → project → organization`, `Monitoring → area → ...`, `Photo → monitoring → ...`.
- `UserOrganization` (PK composta `user_id` + `organization_id` + `role`) liga usuário a organização.
- **Porém:** as leituras não são escopadas. Qualquer usuário autenticado lista/lê qualquer projeto, área, monitoramento, foto e organização (`project_service.list_projects` sem filtro retorna tudo).
- Escritas exigem `admin` ou `manager` na organização (`check_area_write_permission`, `_check_role_in_org`).
- `GET /projects` aceita `?organization_id=` **fornecido pelo cliente**, sem validação de pertencimento — nenhum mecanismo de confiança.
- Não existe endpoint de gerenciamento de membros: `UserOrganization` só é criada direto no banco (fixtures de teste fazem isso).
- Criar organização **não** vincula o criador como membro (gap de owner).

## Decisões de Modelo

1. **Admin global.** `User.is_superuser: bool` — papel global de plataforma, ignora todos os checks de organização. Separado dos papéis por-org.
2. **Single-org por usuário.** Cada usuário pertence a exatamente uma organização. O servidor resolve a organização automaticamente — nenhum header/param de tenant.
3. **Papéis por organização:** `manager | researcher | volunteer | viewer`. O valor `admin` da enum é **descontinuado** e migrado para `manager` (eram o "topo da org").
4. **Capacidade vem do papel na org, não da posse da linha.** `created_by` existe como campo de auditoria e para views tipo "meus projetos", **não** como mecanismo de permissão.
5. **Sem permissões por projeto** no MVP (sem tabela `UserProject`). Revisitar quando houver necessidade real de acesso restrito a projetos individuais.

## Papéis e Capacidades

| Ação | manager | researcher | volunteer | viewer |
|---|---|---|---|---|
| Gerenciar membros da org / editar-excluir org | ✅ | ❌ | ❌ | ❌ |
| CRUD projetos e áreas | ✅ | ✅ | ❌ | ❌ |
| Criar monitoramentos + subir fotos | ✅ | ✅ | ✅ | ❌ |
| Editar/excluir monitoramentos e fotos | ✅ | ✅ | ❌ | ❌ |
| Ler dados da org (escopado) | ✅ | ✅ | ✅ | ✅ |
| Exportar dados brutos (gate futuro) | ✅ | ✅ | ❌ | ❌ |

`is_superuser` ignora a matriz (acesso total).

## Mecânica de Escopo

### Dependências (`dependencies/`)

- `CurrentOrgDep` — resolve `UserOrganization` do usuário atual; **403** `"usuário não está vinculado a nenhuma organização"` se não houver.
- `require_org_role(*roles)` — generalização do `require_role` existente; agora **não recebe** `organization_id` (a org vem de `CurrentOrgDep`).
- `require_superuser` — para o bypass do admin global.
- `check_area_write_permission` vira `require_area_role(area_id, *roles)` para admitir `volunteer` em monitoramentos/fotos.

### Services

- Toda função de leitura recebe `organization_id` e filtra por ele.
- Recursos aninhados escopam pela cadeia pai: `area → project → org`; `monitoring → area → ...`; `photo → monitoring → ...`.
- `create_organization` cria a organização **e** o vínculo do criador como `manager` na mesma transação.
- Novo serviço de membros (`organization_membership_service`).

### Routers

- **Auth:** inalterado. Registro cria usuário "órfão" (sem org) → 403 até ser vinculado por um manager.
- **Organizations:** `POST /` qualquer usuário autenticado (vira manager). `GET /` e `GET /{id}` escopados à própria org (superuser vê tudo). `PATCH`/`DELETE` manager ou superuser.
- **Membros (novo):** `GET/POST/PATCH/DELETE /organizations/{id}/members` — manager ou superuser. `POST` rejeita com **409** se o alvo já pertence a outra org.
- **Projects/Areas:** create manager|researcher; list/get auto-escopados; patch/delete manager|researcher.
- **Monitoring:** create manager|researcher|volunteer; list/get auto-escopados; patch/delete manager|researcher.
- **Photos:** upload manager|researcher|volunteer; download auto-escopado; delete manager|researcher.
- **Remover** o param `?organization_id=` de `GET /projects` — a org vem do servidor, nunca confiada ao cliente.

## Modelo de Dados

```python
class User(Base, table=True):
    ...
    is_superuser: bool = Field(default=False)

class Organization(Base, table=True):
    ...
    created_by: UUID | None = Field(foreign_key="user.id", default=None)

class Project(Base, table=True):
    ...
    created_by: UUID | None = Field(foreign_key="user.id", default=None)

class UserOrganizationRole(str, enum.Enum):
    manager = "manager"
    researcher = "researcher"
    volunteer = "volunteer"
    viewer = "viewer"
```

- Índice único em `user_organization.user_id` para impor single-org (a PK composta permite múltiplas linhas hoje).

## Migrações (Alembic)

1. `User.is_superuser` (default `false`).
2. `Organization.created_by`, `Project.created_by`.
3. Alterar enum `UserOrganizationRole` (remover `admin`; ajustar tipo no PostgreSQL).
4. Migrar dados: `admin → manager`.
5. Índice único em `user_organization.user_id`; **tratar dados legados** com múltiplos vínculos (manter o mais antigo, deletar os demais com log).

## Casos de Borda

- Usuário sem org: 403 com mensagem clara ("aguardando vínculo com uma organização").
- Conflito single-org no add de membro: 409.
- Vínculos múltiplos legados: migração mantém o mais antigo.
- `created_by` é auditoria apenas — não confere permissão.

## Testes

- Atualizar fixtures existentes: membros `admin` → `manager`.
- Novos testes:
  - superuser ignora escopo/matriz;
  - researcher: CRUD completo em projetos/áreas/monitoramentos/fotos;
  - volunteer: cria monitoramento e fotos, mas **não** edita/exclui;
  - viewer: somente leitura;
  - membros: add (e 409 cross-org), troca de papel, remoção;
  - leitura cross-org bloqueada (usuário da org A não vê dados da org B);
  - usuário sem org → 403;
  - `POST /organizations` vincula criador como manager.

## Trade-offs Considerados

- **Service-layer auto-scoping (escolhido):** explícito, segue padrões existentes, testável com sqlite. Custo: disciplina por convenção (todo query novo precisa do filtro).
- **Helper de query escopada:** mais DRY para entidades aninhadas, mas mais abstração; pode entrar como refino futuro se as listas ficarem repetitivas.
- **PostgreSQL Row-Level Security:** garantia mais forte no nível do banco, mas quebra o setup de testes sqlite e adiciona complexidade operacional — **adiado** (caminho de migração quando o monólito crescer).

## Itens Adiados

- Exportação de dados brutos (gate `researcher+` no futuro; a feature não existe ainda).
- Permissões por projeto (`UserProject`).
- RLS no PostgreSQL.
- Multi-org com seletor de org ativa.

## Definição de Pronto

- [ ] Rotas, dependências e services escopados conforme a matriz.
- [ ] Endpoints de membros funcionando (manager/superuser).
- [ ] Migrações aplicadas e dados legados tratados.
- [ ] Testes cobrindo a matriz e o escopo.
- [ ] Docs atualizadas (README, AGENTS.md, ARCHITECTURE.md, ROADMAP.md).
