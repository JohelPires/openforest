# Design — recent_monitorings aninhado no list de áreas

> Data: 2026-08-07
> Status: Aprovado
> Autores: Johel Pires, big-pickle

## Objetivo

Ao listar áreas (`GET /projects/{project_id}/areas`), cada área passa a carregar a lista dos **10 monitoramentos mais recentes** (`recent_monitorings`) aninhada na resposta. Caso de uso: dashboard com lista de áreas expansível — o usuário expande uma área e vê os monitoramentos sem round-trip extra (sem N+1).

## Estado Atual

- `GET /projects/{project_id}/areas` retorna `list[AreaRead]` flat (`routers/areas.py:21`).
- Monitoramentos são buscados à parte em `GET /areas/{area_id}/monitorings`.
- `Monitoring` tem índice `ix_monitoring_area_visit` em `(area_id, visit_date)` (`models/monitoring.py:12`).
- Frontend ainda é esqueleto (sem telas de áreas/monitoramentos).

## Decisões

1. **Sempre aninhar** os 10 mais recentes no `AreaRead` (sem parâmetro opcional). Evolução natural futura: `?include=` se o payload virar problema.
2. **"Mais recente" = `visit_date desc`**, com tiebreak `created_at desc` (determinismo). Escolhido por refletir a data da visita, mais relevante para dashboard.
3. **Sempre `[]`** quando a área não tem monitoramentos (nunca `null`).
4. O endpoint `GET /areas/{id}/monitorings` permanece para "ver todos".

## Mudanças

### `schemas/area.py`

```python
from openforest.api.schemas.monitoring import MonitoringRead

class AreaRead(AreaCreate):
    id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime
    recent_monitorings: list[MonitoringRead] = []
```

Sem import circular (`schemas/monitoring.py` não importa `schemas/area.py`).

### `services/area_service.py`

- Constante `RECENT_MONITORINGS_LIMIT = 10`.
- `list_areas` mantém a query existente de áreas e adiciona **1 query** com window function cobrindo todas as áreas do projeto, com o mesmo scoping por organização:

```python
rn = func.row_number().over(
    partition_by=Monitoring.area_id,
    order_by=(Monitoring.visit_date.desc(), Monitoring.created_at.desc()),
).label("rn")

subq = (
    select(Monitoring, rn)
    .join(Area, Monitoring.area_id == Area.id)
    .join(Project, Area.project_id == Project.id)
    .where(Area.project_id == project_id)
)
if organization_id is not None:
    subq = subq.where(Project.organization_id == organization_id)

rows = session.exec(select(subq.corresponding_column...)).all()
```

- Agrupa por `area_id` num dict; monta `list[AreaRead]` via `AreaRead(**area.model_dump(), recent_monitorings=...)`.
- Sem áreas → retorna `[]` sem executar a segunda query.
- `list_areas` passa a retornar `list[AreaRead]` (antes `list[Area]`).

### `routers/areas.py`

- Sem lógica nova: apenas a anotação de retorno de `list_areas_route` passa a `list[AreaRead]`. `response_model` permanece `list[AreaRead]`.

### Testes (`tests/test_areas.py`)

- Existentes permanecem válidos (empty → `[]`; 2 áreas → len 2, cada uma com `recent_monitorings: []`).
- Novos:
  1. `recent_monitorings` populado, ordenado por `visit_date desc`.
  2. Limite de 10 quando a área tem mais de 10 monitoramentos.
  3. Monitoramentos de área de outra organização não vazam (escopo respeitado).

## Fora de Escopo

- Mudanças de tabela/migração (nada em banco muda).
- Endpoint dedicado de dashboard.
- Paginação de `recent_monitorings` (o "ver todos" cobre o caso).

## Verificação

- `ruff check backend/src/`
- `ruff format backend/src/ --check`
- `mypy backend/src/`
- `pytest backend/tests/test_areas.py backend/tests/test_monitoring.py`
