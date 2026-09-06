# Diagnóstico de Caficultura Regenerativa (Backend + App Mobile) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao OpenForest um módulo `assessments` que implementa o diagnóstico de fincas de café (Guía de Caficultura Sostenible y Regenerativa, CATIE/GIZ 2025) e um app React Native em `mobile/`, offline-first, que o consome.

**Architecture:** O backend ganha um módulo de domínio próprio (templates data-driven + diagnoses + pontos de amostragem + scores), reutilizando auth JWT, multi-tenant por organização e models `Project`/`Area`/`Photo` existentes. O cálculo do nível de transição (contagem de "X" por coluna, com regra de prioridade para indicadores críticos) é um service puro, unit-testável. O app `mobile/` é Expo + expo-router com SQLite local e motor de sincronização: pull de templates/áreas, push fila ordenada de diagnoses/fotos, conflito por `version` (last-write-wins).

**Tech Stack:** FastAPI, SQLModel, Alembic, PostgreSQL (PostGIS), pytest, Ruff, mypy (backend). Expo SDK 53+, expo-router, expo-sqlite, @react-native-community/netinfo, expo-secure-store, expo-location, expo-image-picker, i18next (mobile).

## Global Constraints

- **Formato de erro da API:** `detail=[{"msg": "...", "type": "..."}]`, mensagens em português.
- **Convenções AGENTS.md:** sync `def`, `Annotated` deps, `Sequence[T]`/`list[T]` retorno, `| None` (Python 3.10+), tabelas snake_case plural, organisável.
- **Conteúdo do guia:** 8 dimensões, 41 indicadores, 4 níveis (0–3) cada. Todo o conteúdo é **espanhol (verbatim do guia) + português** — nunca hardcoded nos routers; data-driven em seed no banco. Coluna de tradução JSON `{"es": "...", "pt": "..."}`.
- **Multi-tenant:** `assessment` escopa via `area → project → organization`. Templates são conteúdo público (qualquer usuário autenticado lê; só superuser/manager cria/edita).
- **Regra de nível (do guia):** nível geral = coluna com mais "X"; **empate → nível mais baixo vence** (decisão deste plano). Se nível geral ∈ {2,3}, indicadores com nível 0 viram **prioridades**; se nível geral == 3, indicadores com nível ≤ 1 viram **avisos**.
- **Testes:** fixture boilerplate copiado por arquivo (Postgres `/openforest_test`, como em `tests/test_projects.py`). Rodar de `backend/`: `pytest`, `ruff check src/`, `mypy src/`.
- **Mobile:** TypeScript strict, sem import absoluto fora de `@/`, sem lib pesada desnecessária (YAGNI). Fotos e diagnoses só vão pro servidor via fila de sync.
- **Idioma da API:** o cliente mobile e endpoints usam query param `?lang=es|pt` (não header — mais simples no RN).
- Docs complementares: `database-schema-v2.md` (raiz), `MOBILE-ROADMAP.md` (raiz), `mobile/TODO-MOBILE.md`.

---

## File Structure

**Novos arquivos (backend):**
- `src/openforest/api/models/assessment.py` — `AssessmentTemplate`, `AssessmentDimension`, `AssessmentIndicator`, `AssessmentIndicatorLevel`, `Assessment`, `AssessmentSamplePoint`, `AssessmentScore`, enum `AssessmentStatus`
- `src/openforest/api/schemas/assessment.py` — request/response schemas
- `src/openforest/api/services/assessment_service.py` — cria/lê/lista/atualiza + `compute_transition_level` (puro) + `recommend_practices` (puro)
- `src/openforest/api/routers/assessments.py` — endpoints `/assessments*`
- `scripts/seed_assessments.py` — template com as 41 indicadoras (es+pt)
- `src/openforest/api/infrastructure/versions/<rev>_caficultura_assessments.py` — migration
- `tests/test_assessments.py` — suite de domínio
- `tests/test_assessment_level.py` — testes puros de nível/recomendações

**Novos arquivos (mobile):**
- `mobile/package.json`, `mobile/app.json`, `mobile/tsconfig.json`, `mobile/eslint.config.mjs`, `mobile/.env.example`
- `mobile/app/_layout.tsx`, `mobile/app/(auth)/login.tsx`, `mobile/app/(auth)/register.tsx`
- `mobile/app/(tabs)/_layout.tsx`, `fincas/index.tsx`, `diagnosticos/index.tsx`, `diagnosticos/[id]/index.tsx`, `diagnosticos/[id]/resultado.tsx`, `plan/index.tsx`, `perfil/index.tsx`
- `mobile/src/api/client.ts`, `mobile/src/api/endpoints.ts`, `mobile/src/api/auth.ts`
- `mobile/src/db/schema.ts`, `mobile/src/db/database.ts`, `mobile/src/db/repositories.ts`
- `mobile/src/sync/queue.ts`, `mobile/src/sync/sync.ts`
- `mobile/src/i18n/index.ts`, `mobile/src/i18n/resources.ts`
- `mobile/src/features/farmacia/*` (telas/diagnostico/resultado/plan)
- `mobile/TODO-MOBILE.md`

**Arquivos modificados:**
- `backend/src/openforest/api/main.py` — registrar router
- `backend/src/openforest/api/models/photo.py` — coluna `assessment_id` nullable (evidências por diagnóstico)
- `backend/src/openforest/api/infrastructure/versions/<rev>_photo_assessment_id.py` — migration da coluna
- `backend/pyproject.toml` — (sem novas deps; todas já presentes)

---

### Task 1: Models do módulo assessments + migrations

**Files:**
- Create: `src/openforest/api/models/assessment.py`
- Modify: `src/openforest/api/models/photo.py`, `src/openforest/api/models/__init__.py`
- Create migrations via autogenerate

**Interfaces:**
- Produces (usadas nas Tasks seguintes):
  - `AssessmentStatus(str, Enum)` com `draft | submitted | validated`
  - `AssessmentTemplate(Base, table=True)`: `name`, `version` (unique)
  - `AssessmentDimension(Base, table=True)`: `code`, `name_translations: dict[str,str]` (JSON), `sort_order`
  - `AssessmentIndicator(Base, table=True)`: `dimension_id` FK, `code`, `title_translations` (JSON), `sort_order`
  - `AssessmentIndicatorLevel(Base, table=True)`: `indicator_id` FK, `level: int`, `description_translations` (JSON); unique `(indicator_id, level)`
  - `Assessment(Base, table=True)`: `area_id` FK, `template_id` FK, `title`, `status`, `assessed_by`, `validated_by`, `validated_at`
  - `AssessmentSamplePoint(Base, table=True)`: `assessment_id` FK, `name`, `geometry` (Geometry 4326)
  - `AssessmentScore(Base, table=True)`: `assessment_id` FK, `indicator_id` FK, `sample_point_id` FK nullable, `level: int`; unique `(assessment_id, indicator_id)`
  - `Photo.assessment_id: UUID | None` (nullable)

- [ ] **Step 1: Escrever o model**

`src/openforest/api/models/assessment.py`:

```python
from datetime import datetime
from enum import Enum
from uuid import UUID

from geoalchemy2 import Geometry
from sqlmodel import JSON, Column, Field, Index, UniqueConstraint

from openforest.api.models.base import Base


class AssessmentStatus(str, Enum):
    draft = "draft"
    submitted = "submitted"
    validated = "validated"


class AssessmentTemplate(Base, table=True):
    __tablename__ = "assessment_template"

    name: str = Field(nullable=False)
    version: str = Field(nullable=False, unique=True)


class AssessmentDimension(Base, table=True):
    __tablename__ = "assessment_dimension"

    code: str = Field(nullable=False, unique=True)
    name_translations: dict[str, str] = Field(default_factory=dict, sa_type=JSON)
    sort_order: int = Field(default=0, nullable=False)


class AssessmentIndicator(Base, table=True):
    __tablename__ = "assessment_indicator"

    dimension_id: UUID = Field(
        nullable=False, foreign_key="assessment_dimension.id",
        ondelete="CASCADE", index=True,
    )
    code: str = Field(nullable=False)
    title_translations: dict[str, str] = Field(default_factory=dict, sa_type=JSON)
    sort_order: int = Field(default=0, nullable=False)


class AssessmentIndicatorLevel(Base, table=True):
    __tablename__ = "assessment_indicator_level"

    __table_args__ = (
        UniqueConstraint("indicator_id", "level", name="uq_indicator_level"),
    )

    indicator_id: UUID = Field(
        nullable=False, foreign_key="assessment_indicator.id",
        ondelete="CASCADE", index=True,
    )
    level: int = Field(nullable=False)
    description_translations: dict[str, str] = Field(default_factory=dict, sa_type=JSON)


class Assessment(Base, table=True):
    __tablename__ = "assessment"

    __table_args__ = (
        Index("ix_assessment_area_status", "area_id", "status"),
    )

    area_id: UUID = Field(
        nullable=False, foreign_key="area.id", ondelete="CASCADE", index=True
    )
    template_id: UUID = Field(
        nullable=False, foreign_key="assessment_template.id", ondelete="RESTRICT"
    )
    title: str = Field(nullable=False)
    status: AssessmentStatus = Field(default=AssessmentStatus.draft)
    assessed_by: UUID | None = Field(default=None, foreign_key="user.id")
    validated_by: UUID | None = Field(default=None, foreign_key="user.id")
    validated_at: datetime | None = Field(default=None)


class AssessmentSamplePoint(Base, table=True):
    __tablename__ = "assessment_sample_point"

    assessment_id: UUID = Field(
        nullable=False, foreign_key="assessment.id", ondelete="CASCADE", index=True
    )
    name: str = Field(nullable=False)
    geometry: object | None = Field(
        default=None, sa_column=Column(Geometry(srid=4326, spatial_index=False))
    )


class AssessmentScore(Base, table=True):
    __tablename__ = "assessment_score"

    __table_args__ = (
        UniqueConstraint("assessment_id", "indicator_id", name="uq_assessment_indicator"),
    )

    assessment_id: UUID = Field(
        nullable=False, foreign_key="assessment.id", ondelete="CASCADE", index=True
    )
    indicator_id: UUID = Field(
        nullable=False, foreign_key="assessment_indicator.id", ondelete="CASCADE"
    )
    sample_point_id: UUID | None = Field(
        default=None, foreign_key="assessment_sample_point.id", ondelete="CASCADE"
    )
    level: int = Field(nullable=False)
```

- [ ] **Step 2: Adicionar coluna de evidência na Photo**

`src/openforest/api/models/photo.py` — adicionar campo:

```python
    assessment_id: UUID | None = Field(
        default=None, foreign_key="assessment.id", ondelete="CASCADE", index=True
    )
```

- [ ] **Step 3: Registrar models no `__init__.py`**

`src/openforest/api/models/__init__.py` — garantir imports de `assessment` para o `SQLModel.metadata` conhecê-los (copie o padrão existente do arquivo).

- [ ] **Step 4: Gerar migrations**

Run (de `backend/`): `alembic revision --autogenerate -m "caficultura assessments module"` e outra para a coluna da photo. Verificar o diff no arquivo gerado (sem executar `upgrade head`), revisar que as FKs/uniques estão corretas.

- [ ] **Step 5: Commit**

```bash
git add backend/src/openforest/api/models/
git commit -m "feat: models do módulo caficultura assessments"
```

---

### Task 2: Seed do template (41 indicadoras, es + pt)

**Files:**
- Create: `scripts/seed_assessments.py` (idempotente)
- Test: `backend/tests/test_assessments.py` (criação do template via seed)

**Interfaces:**
- Produces: função `seed_assessment_template(session: Session) -> AssessmentTemplate` e CLI `uv run python scripts/seed_assessments.py`. Template `version="2025-01"`, `name="Guía de Caficultura Sostenible y Regenerativa"`.
- Data pública: templates por `GET /assessments/templates` (Task 5).

- [ ] **Step 1: Escrever o script com o dataset completo**

`scripts/seed_assessments.py` (o conteúdo é a fonte de verdade do guia). Estrutura:

```python
from collections.abc import Iterable

from sqlmodel import Session, select

from openforest.api.infrastructure.database import engine
from openforest.api.models.assessment import (
    AssessmentTemplate,
    AssessmentDimension,
    AssessmentIndicator,
    AssessmentIndicatorLevel,
)

TEMPLATE_VERSION = "2025-01"

# (code, {es, pt})
DIMENSIONS: list[tuple[str, dict[str, str]]] = [
    ("soil", {"es": "Suelo", "pt": "Solo"}),
    ("agronomic", {"es": "Prácticas agronómicas", "pt": "Práticas agronômicas"}),
    ("water", {"es": "Agua", "pt": "Água"}),
    ("biodiversity", {"es": "Biodiversidad", "pt": "Biodiversidade"}),
    ("microclimate", {"es": "Microclima", "pt": "Microclima"}),
    ("economic", {"es": "Económico", "pt": "Econômico"}),
    ("social", {"es": "Social", "pt": "Social"}),
    ("policy", {"es": "Política", "pt": "Política"}),
]

# dimension_code -> [(indicator_code, {es,pt}, [(level, {es,pt}), ...])]
INDICATORS: dict[str, list[tuple[str, dict[str, str], list[tuple[int, dict[str, str]]]]]] = {
    ...
}
```

Os 41 indicadores (es verbatim do guia, pt traduzido) estão no bloco completo da seção **Dataset do Guia** abaixo — copie-os para `INDICATORS`. Funções de seed:

```python
def seed_assessment_template(session: Session) -> AssessmentTemplate:
    existing = session.exec(select(AssessmentTemplate).where(AssessmentTemplate.version == TEMPLATE_VERSION)).first()
    if existing:
        return existing
    template = AssessmentTemplate(name="Guía de Caficultura Sostenible y Regenerativa", version=TEMPLATE_VERSION)
    session.add(template)
    session.flush()
    for sort_order, (dim_code, dim_names) in enumerate(DIMENSIONS):
        dim = AssessmentDimension(code=dim_code, name_translations=dim_names, sort_order=sort_order)
        session.add(dim)
        session.flush()
        for index_order, (ind_code, ind_names, levels) in enumerate(INDICATORS[dim_code]):
            indicator = AssessmentIndicator(
                dimension_id=dim.id, code=ind_code, title_translations=ind_names, sort_order=index_order
            )
            session.add(indicator)
            session.flush()
            for level, desc in levels:
                session.add(AssessmentIndicatorLevel(
                    indicator_id=indicator.id, level=level, description_translations=desc
                ))
    session.commit()
    session.refresh(template)
    return template


if __name__ == "__main__":
    with Session(engine) as session:
        seed_assessment_template(session)
        print(f"Template {TEMPLATE_VERSION} OK")
```

> **Dataset do Guia (copiar para `INDICATORS`)** — traduções pt são do plano; ajustar apenas se necessário:

```python
INDICATORS = {
    "soil": [
        ("soil_cover", {"es": "Cobertura en suelo", "pt": "Cobertura do solo"}, [
            (0, {"es": "Más del 50% del suelo está desnudo, sin nada encima.", "pt": "Mais de 50% do solo está descoberto, sem nada por cima."}),
            (1, {"es": "Hay más de 50% de hojas secas cubriendo el suelo.", "pt": "Há mais de 50% de folhas secas cobrindo o solo."}),
            (2, {"es": "Hay cobertura viva y muerta (hojas + zacates o plantas).", "pt": "Há cobertura viva e morta (folhas + gramíneas ou plantas)."}),
            (3, {"es": "Más del 90% del suelo tiene plantas vivas (que no compitan con el cultivo, tales como leguminosas o coberturas controladas).", "pt": "Mais de 90% do solo tem plantas vivas (que não competem com a cultura, como leguminosas ou coberturas controladas)."}),
        ]),
        ("soil_compaction", {"es": "Compactación", "pt": "Compactação"}, [
            (0, {"es": "El suelo está muy duro; cuesta meter el machete o deshacer un terrón.", "pt": "O solo está muito duro; é difícil fincar o facão ou desfazer um torrão."}),
            (1, {"es": "El suelo está algo duro, pero no tanto.", "pt": "O solo está um pouco duro, mas não tanto."}),
            (2, {"es": "El suelo se ve más suelto, pero aún se puede mejorar.", "pt": "O solo parece mais solto, mas ainda pode melhorar."}),
            (3, {"es": "El suelo está suelto, fácil de trabajar, sin compactación.", "pt": "O solo está solto, fácil de trabalhar, sem compactação."}),
        ]),
        ("soil_organic_matter", {"es": "Materia orgánica", "pt": "Matéria orgânica"}, [
            (0, {"es": "Suelo pálido, seco, sin olor ni materia orgánica.", "pt": "Solo pálido, seco, sem cheiro nem matéria orgânica."}),
            (1, {"es": "Color pálido pero ya se ve un poco de materia orgánica.", "pt": "Cor pálida, mas já se vê um pouco de matéria orgânica."}),
            (2, {"es": "Color rojizo o café, hay materia orgánica pero sin mucho olor.", "pt": "Cor avermelhada ou marrom; há matéria orgânica, mas sem muito cheiro."}),
            (3, {"es": "Color oscuro, huele a tierra buena, con mucha materia orgánica.", "pt": "Cor escura, cheira a terra boa, com muita matéria orgânica."}),
        ]),
        ("soil_conservation_practices", {"es": "Prácticas de conservación", "pt": "Práticas de conservação"}, [
            (0, {"es": "No se hace nada para proteger el suelo, hay señales de erosión o lavado.", "pt": "Não se faz nada para proteger o solo; há sinais de erosão ou lavagem."}),
            (1, {"es": "Se hace una práctica de conservación, pero el suelo aún se está perdiendo.", "pt": "Faz-se uma prática de conservação, mas o solo ainda está se perdendo."}),
            (2, {"es": "Se hacen varias prácticas y hay pocas señales de erosión.", "pt": "Fazem-se várias práticas e há poucos sinais de erosão."}),
            (3, {"es": "Se protege bien el suelo, no hay erosión ni señales de pérdida.", "pt": "O solo é bem protegido; não há erosão nem sinais de perda."}),
        ]),
        ("soil_biological_activity", {"es": "Actividad biológica", "pt": "Atividade biológica"}, [
            (0, {"es": "No se ven lombrices en los 4 lugares que revisé.", "pt": "Não se veem minhocas nos 4 locais que revisei."}),
            (1, {"es": "Menos de 130 lombrices en total (en los 4 puntos).", "pt": "Menos de 130 minhocas no total (nos 4 pontos)."}),
            (2, {"es": "Entre 131 y 198 lombrices.", "pt": "Entre 131 e 198 minhocas."}),
            (3, {"es": "Más de 199 lombrices.", "pt": "Mais de 199 minhocas."}),
        ]),
    ],
    "agronomic": [
        ("agronomic_fertilization", {"es": "Programa de fertilización", "pt": "Programa de fertilização"}, [
            (0, {"es": "Solo se usan fertilizantes químicos en gran cantidad (más de 350 kg N/ha/año).", "pt": "Só se usam fertilizantes químicos em grande quantidade (mais de 350 kg N/ha/ano)."}),
            (1, {"es": "Se usan químicos moderados (150–250 kg N/ha/año).", "pt": "Usam-se químicos moderados (150–250 kg N/ha/ano)."}),
            (2, {"es": "Se usan químicos en dosis bajas (hasta 200 kg N/ha/año) y se combinan con abonos orgánicos.", "pt": "Usam-se químicos em doses baixas (até 200 kg N/ha/ano) e combinados com adubos orgânicos."}),
            (3, {"es": "Solo se usan abonos orgánicos (bioles, compost, etc).", "pt": "Só se usam adubos orgânicos (bioles, composto, etc)."}),
        ]),
        ("agronomic_weeds", {"es": "Control de arvenses", "pt": "Controle de plantas espontâneas"}, [
            (0, {"es": "Se usa herbicida más de 4 veces al año.", "pt": "Usa-se herbicida mais de 4 vezes ao ano."}),
            (1, {"es": "Se aplica herbicida entre 2 y 4 veces al año.", "pt": "Aplica-se herbicida entre 2 e 4 vezes ao ano."}),
            (2, {"es": "Solo se aplica herbicida 1 vez al año y se combina con otras prácticas.", "pt": "Só se aplica herbicida 1 vez ao ano e se combina com outras práticas."}),
            (3, {"es": "No se usa herbicida. Se controla la maleza con machete, cobertura viva u otras formas naturales.", "pt": "Não se usa herbicida. Controle das plantas com facão, cobertura viva ou outras formas naturais."}),
        ]),
        ("agronomic_nematodes", {"es": "Control de nemátodos", "pt": "Controle de nematoides"}, [
            (0, {"es": "Se usan químicos fuertes más de una vez al año o en altas dosis.", "pt": "Usam-se químicos fortes mais de uma vez ao ano ou em altas doses."}),
            (1, {"es": "Se aplica nematicida químico una vez al año, en dosis moderadas.", "pt": "Aplica-se nematicida químico uma vez ao ano, em doses moderadas."}),
            (2, {"es": "Se aplica nematicida químico solo una vez al año o cada 3 años, en dosis bajas.", "pt": "Aplica-se nematicida químico só uma vez ao ano ou a cada 3 anos, em doses baixas."}),
            (3, {"es": "No se usan químicos. Se usa control biológico y manejo integrado.", "pt": "Não se usam químicos. Usa-se controle biológico e manejo integrado."}),
        ]),
        ("agronomic_jobotos", {"es": "Control de jobotos o gallina ciega", "pt": "Controle de corós (gallina ciega)"}, [
            (0, {"es": "Se aplican químicos sin otro tipo de control.", "pt": "Aplicam-se químicos sem outro tipo de controle."}),
            (1, {"es": "Solo se aplica una vez al año, en la dosis recomendada.", "pt": "Só se aplica uma vez ao ano, na dose recomendada."}),
            (2, {"es": "Se combinan químicos con otras prácticas de manejo.", "pt": "Combinam-se químicos com outras práticas de manejo."}),
            (3, {"es": "No se usa químico. Se controla con manejo natural y bioinsecticidas.", "pt": "Não se usa químico. Controle com manejo natural e bioinseticidas."}),
        ]),
        ("agronomic_mealybugs", {"es": "Control de cochinillas o piojillo", "pt": "Controle de cochonilhas de raiz"}, [
            (0, {"es": "Se usa solo insecticida en dosis fuertes (más de 500 ml por 200 litros de agua).", "pt": "Usa-se só inseticida em doses fortes (mais de 500 ml por 200 litros de água)."}),
            (1, {"es": "Se usa insecticida en dosis más bajas (200 ml por 200 litros).", "pt": "Usa-se inseticida em doses mais baixas (200 ml por 200 litros)."}),
            (2, {"es": "Se combina el uso de insecticidas con dosis bajas y otras prácticas de manejo.", "pt": "Combina-se o uso de inseticidas em doses baixas com outras práticas."}),
            (3, {"es": "No se usa químico. Se usa bioinsecticida y manejo natural.", "pt": "Não se usa químico. Usa-se bioinseticida e manejo natural."}),
        ]),
        ("agronomic_collar_rot", {"es": "Llagas del cafeto (Rosellinia sp)", "pt": "Chagas do cafeeiro (Rosellinia sp)"}, [
            (0, {"es": "Se usa solo fungicida en la planta.", "pt": "Usa-se só fungicida na planta."}),
            (1, {"es": "Se usa fungicidas en plantas con podas.", "pt": "Usam-se fungicidas em plantas com podas."}),
            (2, {"es": "Se esterilizan herramientas con químicos y se usa manejo integrado.", "pt": "Esterilizam-se ferramentas com químicos e usa-se manejo integrado."}),
            (3, {"es": "No se usan químicos. Se aplican bioinsumos y manejo natural.", "pt": "Não se usam químicos. Aplicam-se bioinsumos e manejo natural."}),
        ]),
    ],
    "water": [
        ("water_conservation_areas", {"es": "Estado de las áreas de conservación de agua", "pt": "Estado das áreas de conservação de água"}, [
            (0, {"es": "Las nacientes y ríos están sin protección, sin árboles o vegetación. Hay alto riesgo de contaminación.", "pt": "As nascentes e rios estão sem proteção, sem árvores ou vegetação. Alto risco de contaminação."}),
            (1, {"es": "Hay algo de protección (al menos el 50%) con árboles ou vegetación en los bordes.", "pt": "Há alguma proteção (pelo menos 50%) com árvores ou vegetação nas margens."}),
            (2, {"es": "La mayoría (entre 51% y 95%) de los ríos y nacientes están protegidos con vegetación.", "pt": "A maioria (51% a 95%) dos rios e nascentes está protegida com vegetação."}),
            (3, {"es": "Todos los ríos y nacientes están protegidos y delimitados, además las aguas residuales se manejan bien.", "pt": "Todos os rios e nascentes estão protegidos e delimitados; as águas residuais são bem manejadas."}),
        ]),
        ("water_conservation_practices", {"es": "Prácticas de conservación y producción", "pt": "Práticas de conservação e produção"}, [
            (0, {"es": "No se aplican prácticas de conservación dentro del cafetal.", "pt": "Não se aplicam práticas de conservação dentro do cafezal."}),
            (1, {"es": "Se aplican prácticas de conservación en menos del 50% del cafetal.", "pt": "Aplicam-se práticas de conservação em menos de 50% do cafezal."}),
            (2, {"es": "Se aplican prácticas en entre 51% y 95% del área.", "pt": "Aplicam-se práticas em 51% a 95% da área."}),
            (3, {"es": "Se aplican prácticas en casi toda la finca (más del 95%).", "pt": "Aplicam-se práticas em quase toda a propriedade (mais de 95%)."}),
        ]),
        ("water_availability", {"es": "La disponibilidad de agua", "pt": "Disponibilidade de água"}, [
            (0, {"es": "No hay suficiente agua para el cafetal ni para la finca, especialmente en época seca.", "pt": "Não há água suficiente para o cafezal nem para a propriedade, sobretudo na seca."}),
            (1, {"es": "Hay poca agua, no alcanza para todo lo que se necesita.", "pt": "Há pouca água; não dá para tudo o que é necessário."}),
            (2, {"es": "Hay agua disponible por lo menos 9 meses al año.", "pt": "Há água disponível por pelo menos 9 meses ao ano."}),
            (3, {"es": "Siempre hay agua disponible todo el año.", "pt": "Sempre há água disponível o ano todo."}),
        ]),
        ("water_quality", {"es": "Calidad de agua", "pt": "Qualidade da água"}, [
            (0, {"es": "El agua está sucia, con mal olor, mucha espuma o sedimentos. Muy contaminada.", "pt": "A água está suja, com mau cheiro, muita espuma ou sedimentos. Muito contaminada."}),
            (1, {"es": "El agua tiene algo de contaminación, de vez en cuando.", "pt": "A água tem alguma contaminação, de vez em quando."}),
            (2, {"es": "La mayoría del tiempo el agua está limpia, salvo en momentos muy puntuales del año.", "pt": "Na maioria do tempo a água está limpa, exceto em momentos pontuais do ano."}),
            (3, {"es": "El agua siempre está limpia. Hay peces y ranas, y análisis de laboratorio lo confirman.", "pt": "A água está sempre limpa. Há peixes e rãs, e análises de laboratório confirmam."}),
        ]),
    ],
    "biodiversity": [
        ("biod_pollinator_attraction", {"es": "Técnicas atracción y protección de polinizadores y controladores naturales", "pt": "Técnicas de atração e proteção de polinizadores e controladores naturais"}, [
            (0, {"es": "El suelo está completamente limpio, sin hierbas o plantas entre las calles del café.", "pt": "O solo está completamente limpo, sem ervas ou plantas entre as ruas do café."}),
            (1, {"es": "Hay algo de cobertura con hierbas en al menos el 50% del área buena parte del año.", "pt": "Há alguma cobertura com ervas em pelo menos 50% da área boa parte do ano."}),
            (2, {"es": "Entre 55% y 80% del suelo entre cafetos tiene hierbas o plantas durante gran parte del año.", "pt": "Entre 55% e 80% do solo entre cafeeiros tem ervas ou plantas durante boa parte do ano."}),
            (3, {"es": "Más del 80% del suelo entre cafetos tiene plantas que atraen polinizadores todo el año.", "pt": "Mais de 80% do solo entre cafeeiros tem plantas que atraem polinizadores o ano todo."}),
        ]),
        ("biod_agroforestry", {"es": "Sistemas agroforestales para proteger polinizadores y fauna benéfica", "pt": "Sistemas agroflorestais para proteger polinizadores e fauna benéfica"}, [
            (0, {"es": "Cultivo a pleno sol, sin árboles.", "pt": "Cultivo a pleno sol, sem árvores."}),
            (1, {"es": "Menos del 50% del cafetal tiene árboles diversos (frutales, leguminosos, maderables).", "pt": "Menos de 50% do cafezal tem árvores diversas (frutíferas, leguminosas, madeireiras)."}),
            (2, {"es": "Entre 50% y 80% del cafetal tiene árboles que atraen y protegen fauna benéfica.", "pt": "Entre 50% e 80% do cafezal tem árvores que atraem e protegem a fauna benéfica."}),
            (3, {"es": "Más del 80% del cafetal está en sistema agroforestal con árboles diversos y protectores.", "pt": "Mais de 80% do cafezal está em sistema agroflorestal com árvores diversas e protetoras."}),
        ]),
        ("biod_pesticide_management", {"es": "Manejo de pesticidas", "pt": "Manejo de pesticidas"}, [
            (0, {"es": "Se aplican pesticidas químicos frecuentemente (más de 5 veces al año), sin cuidado por la fauna.", "pt": "Aplicam-se pesticidas químicos com frequência (mais de 5 vezes ao ano), sem cuidado com a fauna."}),
            (1, {"es": "Uso moderado de químicos. Se aplican con algo de control.", "pt": "Uso moderado de químicos, aplicados com algum controle."}),
            (2, {"es": "Uso mínimo de químicos, con preferencia por sombra, chapeas, solo en casos necesarios. Se cuida a polinizadores.", "pt": "Uso mínimo de químicos, preferindo sombra e roçadas, só em casos necessários. Cuidado com polinizadores."}),
            (3, {"es": "No se usan pesticidas químicos. Se usan biopesticidas y se protege a polinizadores y fauna útil.", "pt": "Não se usam pesticidas químicos. Usam-se biopesticidas e protegem-se polinizadores e fauna útil."}),
        ]),
        ("biod_tree_diversity_plantation", {"es": "Diversidad de árboles en cafetales", "pt": "Diversidade de árvores nos cafezais"}, [
            (0, {"es": "No hay árboles en el cafetal.", "pt": "Não há árvores no cafezal."}),
            (1, {"es": "De 1 a 4 especies de árboles en el cafetal.", "pt": "De 1 a 4 espécies de árvores no cafezal."}),
            (2, {"es": "De 5 a 15 especies de árboles útiles en el cafetal.", "pt": "De 5 a 15 espécies de árvores úteis no cafezal."}),
            (3, {"es": "Más de 15 especies distintas de árboles en el cafetal en un sistema agroforestal.", "pt": "Mais de 15 espécies distintas de árvores no cafezal em sistema agroflorestal."}),
        ]),
        ("biod_tree_diversity_farm", {"es": "Diversidad de árboles en otras áreas de la finca", "pt": "Diversidade de árvores em outras áreas da propriedade"}, [
            (0, {"es": "No hay árboles fuera del cafetal.", "pt": "Não há árvores fora do cafezal."}),
            (1, {"es": "De 1 a 4 especies de árboles en otras áreas de la finca.", "pt": "De 1 a 4 espécies de árvores em outras áreas da propriedade."}),
            (2, {"es": "Entre 5 y 15 especies forestales fuera del cafetal.", "pt": "Entre 5 e 15 espécies florestais fora do cafezal."}),
            (3, {"es": "Más de 15 especies de árboles fuera del cafetal.", "pt": "Mais de 15 espécies de árvores fora do cafezal."}),
        ]),
        ("biod_weed_diversity", {"es": "Diversidad de arvenses/hierbas del suelo", "pt": "Diversidade de plantas espontâneas do solo"}, [
            (0, {"es": "No hay plantas vivas cubriendo el suelo.", "pt": "Não há plantas vivas cobrindo o solo."}),
            (1, {"es": "Hay 2 a 4 especies de hierbas creciendo naturalmente.", "pt": "Há 2 a 4 espécies de ervas crescendo naturalmente."}),
            (2, {"es": "Hay entre 4 y 20 especies de hierbas útiles creciendo entre los cafetos.", "pt": "Há entre 4 e 20 espécies de ervas úteis crescendo entre os cafeeiros."}),
            (3, {"es": "Se promueve la cobertura viva y hay más de 20 especies.", "pt": "Promove-se a cobertura viva e há mais de 20 espécies."}),
        ]),
        ("biod_vertebrate_diversity", {"es": "Diversidad de aves y mamíferos", "pt": "Diversidade de aves e mamíferos"}, [
            (0, {"es": "Rara presencia de aves y mamíferos.", "pt": "Rara presença de aves e mamíferos."}),
            (1, {"es": "Se han visto algunas aves o mamíferos, pero no se toman medidas para protegerlos.", "pt": "Viu-se algumas aves ou mamíferos, mas não se tomam medidas para protegê-los."}),
            (2, {"es": "Se conocen las especies presentes (con inventario) y se toman acciones para protegerlas.", "pt": "Conhecem-se as espécies presentes (com inventário) e tomam-se ações para protegê-las."}),
            (3, {"es": "Se protege activamente a aves y mamíferos sembrando árboles o plantas que los atraen. No hay riesgo de intoxicación.", "pt": "Protegem-se ativamente aves e mamíferos plantando árvores ou plantas que os atraem. Sem risco de intoxicação."}),
        ]),
        ("biod_landscape_connectivity", {"es": "Conectividad en el paisaje (dentro y fuera)", "pt": "Conectividade da paisagem (dentro e fora)"}, [
            (0, {"es": "No hay conexión entre cafetal y bosques. No se delimitan zonas naturales.", "pt": "Não há conexão entre cafezal e florestas. Não se delimitam zonas naturais."}),
            (1, {"es": "Hay algunos parches de bosque o árboles, pero cubren menos del 50% de la finca.", "pt": "Há alguns trechos de floresta ou árvores, mas cobrem menos de 50% da propriedade."}),
            (2, {"es": "Se delimitan áreas de bosque y hay conectividad en 51% a 80% del área.", "pt": "Delimitam-se áreas de floresta e há conectividade em 51% a 80% da área."}),
            (3, {"es": "Toda la finca está conectada por árboles y vegetación diversa, con más del 80% del área interconectada.", "pt": "Toda a propriedade está conectada por árvores e vegetação diversa, com mais de 80% da área interconectada."}),
        ]),
    ],
    "microclimate": [
        ("micro_shade_level", {"es": "Nivel de sombra", "pt": "Nível de sombra"}, [
            (0, {"es": "El cafetal está completamente al sol o tiene demasiada sombra (más del 70%).", "pt": "O cafezal está completamente ao sol ou com sombra demais (mais de 70%)."}),
            (1, {"es": "Hay sombra entre un 15% y 25%.", "pt": "Há sombra entre 15% e 25%."}),
            (2, {"es": "La sombra está entre 26% y 35% del área.", "pt": "A sombra está entre 26% e 35% da área."}),
            (3, {"es": "Sombra bien equilibrada, entre 36% y 55%.", "pt": "Sombra bem equilibrada, entre 36% e 55%."}),
        ]),
        ("micro_shade_distribution", {"es": "Distribución de la sombra", "pt": "Distribuição da sombra"}, [
            (0, {"es": "Hay pocos árboles y están mal distribuidos.", "pt": "Há poucas árvores e mal distribuídas."}),
            (1, {"es": "Árboles mal distribuidos pero cubren al menos un 30–40% del cafetal.", "pt": "Árvores mal distribuídas, mas cobrem ao menos 30–40% do cafezal."}),
            (2, {"es": "Árboles distribuidos entre 41% y 60% del cafetal.", "pt": "Árvores distribuídas entre 41% e 60% do cafezal."}),
            (3, {"es": "Árboles bien distribuidos en más del 61% del área.", "pt": "Árvores bem distribuídas em mais de 61% da área."}),
        ]),
        ("micro_tree_density", {"es": "Cantidad de árboles en el cafetal", "pt": "Quantidade de árvores no cafezal"}, [
            (0, {"es": "Menos de 20 árboles por hectárea.", "pt": "Menos de 20 árvores por hectare."}),
            (1, {"es": "Entre 20 y 50 árboles/ha.", "pt": "Entre 20 e 50 árvores/ha."}),
            (2, {"es": "Entre 51 y 100 árboles/ha.", "pt": "Entre 51 e 100 árvores/ha."}),
            (3, {"es": "Más de 100 árboles por hectárea.", "pt": "Mais de 100 árvores por hectare."}),
        ]),
        ("micro_shade_management", {"es": "Manejo de la sombra en el cafetal", "pt": "Manejo da sombra no cafezal"}, [
            (0, {"es": "No se hace ningún manejo. El cafetal está al sol o tiene exceso de sombra sin control.", "pt": "Não se faz manejo algum. Cafezal ao sol ou com excesso de sombra sem controle."}),
            (1, {"es": "Solo se hace manejo de sombra cada dos años.", "pt": "Só se faz manejo de sombra a cada dois anos."}),
            (2, {"es": "Se hace un manejo de sombra cada año.", "pt": "Faz-se manejo de sombra a cada ano."}),
            (3, {"es": "Se hacen al menos dos manejos al año, ajustando la sombra en verano y lluvia para regular la temperatura.", "pt": "Fazem-se ao menos dois manejos ao ano, ajustando a sombra na seca e na chuva para regular a temperatura."}),
        ]),
        ("micro_soil_moisture", {"es": "Probabilidad de humedad en el suelo", "pt": "Probabilidade de umidade no solo"}, [
            (0, {"es": "El suelo está desnudo, seco y recibe mucho sol.", "pt": "O solo está descoberto, seco e recebe muito sol."}),
            (1, {"es": "Más del 50% del suelo tiene sombra, hojarasca y cobertura viva.", "pt": "Mais de 50% do solo tem sombra, serapilheira e cobertura viva."}),
            (2, {"es": "Más del 70% del suelo está protegido y se mantiene húmedo.", "pt": "Mais de 70% do solo está protegido e mantém-se úmido."}),
            (3, {"es": "Más del 90% del suelo tiene sombra y cobertura que ayuda a conservar la humedad.", "pt": "Mais de 90% do solo tem sombra e cobertura que ajuda a conservar a umidade."}),
        ]),
        ("micro_windbreaks", {"es": "Barreras rompeviento", "pt": "Quebra-ventos"}, [
            (0, {"es": "No hay árboles ni barreras. El viento afecta fuertemente al cafetal.", "pt": "Não há árvores nem barreiras. O vento afeta fortemente o cafezal."}),
            (1, {"es": "Hay algunas barreras o árboles que protegen el 30–40% del área.", "pt": "Há algumas barreiras ou árvores que protegem 30–40% da área."}),
            (2, {"es": "Barreras con varios niveles (estratos) protegen entre 41% y 60%.", "pt": "Barreiras com vários estratos protegem entre 41% e 60%."}),
            (3, {"es": "Barreras con varias especies y niveles protegen más del 60% del área del viento.", "pt": "Barreiras com várias espécies e níveis protegem mais de 60% da área do vento."}),
        ]),
    ],
    "economic": [
        ("econ_marketing_channels", {"es": "Canales de comercialización", "pt": "Canais de comercialização"}, [
            (0, {"es": "No tiene clientes fijos o vende sin ningún valor agregado.", "pt": "Não tem clientes fixos ou vende sem nenhum valor agregado."}),
            (1, {"es": "Tiene compradores estables, pero vende café no diferenciado.", "pt": "Tem compradores estáveis, mas vende café não diferenciado."}),
            (2, {"es": "Tiene un canal de venta fijo y vende bajo estándares sostenibles.", "pt": "Tem um canal de venda fixo e vende sob padrões sustentáveis."}),
            (3, {"es": "Tiene varios canales estables y vende en mercados especiales (orgánico, comercio justo, regenerativo, etc).", "pt": "Tem vários canais estáveis e vende em mercados especiais (orgânico, comércio justo, regenerativo, etc)."}),
        ]),
        ("econ_farm_planning", {"es": "Planificación de la finca", "pt": "Planejamento da propriedade"}, [
            (0, {"es": "No tiene plan ni rumbo claro.", "pt": "Não tem plano nem rumo claro."}),
            (1, {"es": "Tiene ideas o metas a corto plazo, pero no están bien organizadas.", "pt": "Tem ideias ou metas de curto prazo, mas não bem organizadas."}),
            (2, {"es": "Tiene un plan anual basado en registros y metas claras de mejora.", "pt": "Tem um plano anual baseado em registros e metas claras de melhoria."}),
            (3, {"es": "Tiene un plan completo de corto, mediano y largo plazo para la finca cafetalera.", "pt": "Tem um plano completo de curto, médio e longo prazo para a propriedade cafeeira."}),
        ]),
        ("econ_records", {"es": "Registros del manejo", "pt": "Registros do manejo"}, [
            (0, {"es": "No lleva registros del manejo ni de las cosechas ni ventas.", "pt": "Não leva registros do manejo, das colheitas nem das vendas."}),
            (1, {"es": "Lleva algunos registros, pero incompletos.", "pt": "Leva alguns registros, mas incompletos."}),
            (2, {"es": "Tiene registros en general bien llevados, aunque con algunos vacíos.", "pt": "Tem registros em geral bem levados, embora com alguns vazios."}),
            (3, {"es": "Lleva todos los registros al día, con trazabilidad desde el manejo hasta la venta.", "pt": "Leva todos os registros em dia, com rastreabilidade do manejo até a venda."}),
        ]),
        ("econ_process_control", {"es": "Control de procesos", "pt": "Controle de processos"}, [
            (0, {"es": "No hay control del proceso productivo ni comercial.", "pt": "Não há controle do processo produtivo nem comercial."}),
            (1, {"es": "Se hacen controles mínimos de producción.", "pt": "Fazem-se controles mínimos de produção."}),
            (2, {"es": "Controla bien producción, transformación y comercialización.", "pt": "Controla bem produção, transformação e comercialização."}),
            (3, {"es": "Tiene excelente control en todas las etapas del negocio: desde la siembra hasta la venta.", "pt": "Tem excelente controle em todas as etapas do negócio: da semeadura à venda."}),
        ]),
        ("econ_profitability", {"es": "Evaluación de la rentabilidad", "pt": "Avaliação da rentabilidade"}, [
            (0, {"es": "Tiene pérdidas en algunos años y en otros apenas cubre los gastos.", "pt": "Tem prejuízos em alguns anos e em outros mal cobre os gastos."}),
            (1, {"es": "No tiene pérdidas, pero solo cubre los costos.", "pt": "Não tem prejuízos, mas só cobre os custos."}),
            (2, {"es": "En algunos ciclos cubre gastos y en otros tiene buenas ganancias.", "pt": "Em alguns ciclos cobre gastos e em outros tem bons ganhos."}),
            (3, {"es": "Siempre obtiene buenas ganancias. La finca es rentable.", "pt": "Sempre obtém bons ganhos. A propriedade é rentável."}),
        ]),
        ("econ_circular_economy", {"es": "Estrategias de economía circular", "pt": "Estratégias de economia circular"}, [
            (0, {"es": "No reutiliza recursos ni maneja bien los residuos (pulpa, aguas, basura, etc).", "pt": "Não reutiliza recursos nem maneja bem os resíduos (polpa, águas, lixo, etc)."}),
            (1, {"es": "Reutiliza algunos recursos, pero la mayoría de residuos no se manejan bien.", "pt": "Reutiliza alguns recursos, mas a maioria dos resíduos não é bem manejada."}),
            (2, {"es": "Reutiliza más del 50% de los recursos y gestiona bien los residuos principales.", "pt": "Reutiliza mais de 50% dos recursos e gerencia bem os resíduos principais."}),
            (3, {"es": "Tiene un plan claro y aprovecha al menos el 90% de los residuos de la finca, la casa y el negocio.", "pt": "Tem um plano claro e aproveita ao menos 90% dos resíduos da propriedade, da casa e do negócio."}),
        ]),
    ],
    "social": [
        ("social_quality_of_life", {"es": "Calidad de vida de los colaboradores y productor", "pt": "Qualidade de vida dos colaboradores e do produtor"}, [
            (0, {"es": "Las personas en la finca tienen muchas limitaciones en salud, alimentación, vivienda, seguridad, ambiente y educación.", "pt": "As pessoas na propriedade têm muitas limitações em saúde, alimentação, moradia, segurança, ambiente e educação."}),
            (1, {"es": "La calidad de vida es aceptable, pero hay carencias en varios aspectos.", "pt": "A qualidade de vida é aceitável, mas há carências em vários aspectos."}),
            (2, {"es": "Las personas que viven o trabajan en la finca tienen buena calidad de vida en general.", "pt": "As pessoas que vivem ou trabalham na propriedade têm boa qualidade de vida em geral."}),
            (3, {"es": "Todas las personas disfrutan de muy buenas condiciones en nutrición, salud, vivienda, seguridad, ambiente y educación.", "pt": "Todas as pessoas desfrutam de ótimas condições em nutrição, saúde, moradia, segurança, ambiente e educação."}),
        ]),
        ("social_women_youth", {"es": "Participación de mujeres y jóvenes", "pt": "Participação de mulheres e jovens"}, [
            (0, {"es": "No participan activamente en la finca ni en la toma de decisiones.", "pt": "Não participam ativamente na propriedade nem na tomada de decisões."}),
            (1, {"es": "Hay participación ocasional o limitada de miembros de la familia, especialmente mujeres y jóvenes.", "pt": "Há participação ocasional ou limitada dos membros da família, especialmente mulheres e jovens."}),
            (2, {"es": "Mujeres y jóvenes tienen una buena participación en las labores y decisiones cafetaleras.", "pt": "Mulheres e jovens têm boa participação nas tarefas e decisões do café."}),
            (3, {"es": "Toda la familia participa activamente, en especial mujeres y jóvenes, en la gestión y planificación del cafetal.", "pt": "Toda a família participa ativamente, especialmente mulheres e jovens, na gestão e no planejamento do cafezal."}),
        ]),
        ("social_community", {"es": "Enlace con la comunidad", "pt": "Vínculo com a comunidade"}, [
            (0, {"es": "La finca no se relaciona con su comunidad ni participa en actividades colectivas.", "pt": "A propriedade não se relaciona com a comunidade nem participa de atividades coletivas."}),
            (1, {"es": "Existe cierto vínculo con la comunidad, pero es débil o poco frecuente.", "pt": "Existe certo vínculo com a comunidade, mas é fraco ou pouco frequente."}),
            (2, {"es": "Hay buen vínculo con la comunidad y se participa de forma activa en actividades sociales.", "pt": "Há bom vínculo com a comunidade e participação ativa em atividades sociais."}),
            (3, {"es": "Hay un fuerte vínculo y colaboración activa con la comunidad para promover armonía social, económica y ambiental.", "pt": "Há forte vínculo e colaboração ativa com a comunidade para promover harmonia social, econômica e ambiental."}),
        ]),
        ("social_labor", {"es": "Situación laboral y distribución justa", "pt": "Situação trabalhista e distribuição justa"}, [
            (0, {"es": "Las personas que trabajan en la finca tienen condiciones muy difíciles, sin garantías ni derechos básicos.", "pt": "As pessoas que trabalham na propriedade têm condições muito difíceis, sem garantias nem direitos básicos."}),
            (1, {"es": "Las condiciones laborales cumplen lo mínimo, pero hay aspectos importantes por mejorar.", "pt": "As condições trabalhistas cumprem o mínimo, mas há aspectos importantes a melhorar."}),
            (2, {"es": "Se respetan derechos laborales como jornada justa, descansos, salud y seguridad.", "pt": "Respeitam-se direitos trabalhistas como jornada justa, descansos, saúde e segurança."}),
            (3, {"es": "Se ofrece a las personas colaboradoras condiciones excelentes, incluyendo salario justo, seguridad laboral, salud y ambiente digno.", "pt": "Oferecem-se às pessoas colaboradoras condições excelentes, incluindo salário justo, segurança, saúde e ambiente digno."}),
        ]),
    ],
    "policy": [
        ("policy_sectorial", {"es": "Política sectorial", "pt": "Política setorial"}, [
            (0, {"es": "No existen políticas del gobierno u organizaciones que favorezcan la caficultura sostenible y regenerativa.", "pt": "Não existem políticas do governo ou de organizações que favoreçam a cafeicultura sustentável e regenerativa."}),
            (1, {"es": "Hay algunas condiciones mínimas que ayudan, pero son muy limitadas.", "pt": "Há algumas condições mínimas que ajudam, mas são muito limitadas."}),
            (2, {"es": "Existe una política clara que apoya varios aspectos de la caficultura sostenible y regenerativa.", "pt": "Existe uma política clara que apoia vários aspectos da cafeicultura sustentável e regenerativa."}),
            (3, {"es": "Hay políticas específicas que reconocen y respaldan directamente la caficultura sostenible y regenerativa, con acciones concretas.", "pt": "Há políticas específicas que reconhecem e apoiam diretamente a cafeicultura sustentável e regenerativa, com ações concretas."}),
        ]),
        ("policy_legal_framework", {"es": "Marco legal para el sector", "pt": "Marco legal para o setor"}, [
            (0, {"es": "Las leyes no existen o incluso dificultan aplicar prácticas regenerativas.", "pt": "As leis não existem ou até dificultam aplicar práticas regenerativas."}),
            (1, {"es": "Hay leyes mínimas que permiten desarrollar algunas prácticas sostenibles y regenerativas.", "pt": "Há leis mínimas que permitem desenvolver algumas práticas sustentáveis e regenerativas."}),
            (2, {"es": "Existen leyes que favorecen la caficultura sostenible y regenerativa, como normas ambientales o incentivos sostenibles.", "pt": "Existem leis que favorecem a cafeicultura sustentável e regenerativa, como normas ambientais ou incentivos sustentáveis."}),
            (3, {"es": "El marco legal es claro y fuerte, y reconoce directamente los procedimientos de promoción.", "pt": "O marco legal é claro e forte, e reconhece diretamente os procedimentos de promoção."}),
        ]),
        ("policy_support_programs", {"es": "Programas de apoyo", "pt": "Programas de apoio"}, [
            (0, {"es": "No hay ningún tipo de programa que apoye a la caficultura sostenible y regenerativa.", "pt": "Não há nenhum tipo de programa que apoie a cafeicultura sustentável e regenerativa."}),
            (1, {"es": "Existen programas, pero con muy poco alcance o acceso limitado.", "pt": "Existem programas, mas com muito pouco alcance ou acesso limitado."}),
            (2, {"es": "Hay buenos programas de apoyo, tanto económicos como técnicos, que ayudan a avanzar.", "pt": "Há bons programas de apoio, econômicos e técnicos, que ajudam a avançar."}),
            (3, {"es": "Existen múltiples opciones de financiamiento, asistencia técnica y capacitación específica.", "pt": "Existem múltiplas opções de financiamento, assistência técnica e capacitação específica."}),
        ]),
    ],
}
```

- [ ] **Step 2: Rodar o seed e verificar**

Run (de `backend/`): `uv run python scripts/seed_assessments.py`. Verifique no banco: 1 template, 8 dimensões, 41 indicadores, 164 níveis:

```sql
SELECT d.code, count(i.id) FROM assessment_dimension d
LEFT JOIN assessment_indicator i ON i.dimension_id = d.id
GROUP BY d.code ORDER BY d.sort_order;
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed_assessments.py
git commit -m "feat: seed com template de caficultura regenerativa (41 indicadores, es+pt)"
```

---

### Task 3: Schemas do módulo

**Files:**
- Create: `src/openforest/api/schemas/assessment.py`

**Interfaces:**
- Produces (usadas em Task 4/5):
  - `AssessmentCreate(title: str, area_id: UUID, template_id: UUID)`
  - `ScoreIn(indicator_id: UUID, level: int)` com validação `0 <= level <= 3`
  - `ScoresReplace(scores: list[ScoreIn])`
  - `SamplePointCreate(name: str, coordinates: dict[str, object] | None)`
  - `ScoreOut(indicator_id: UUID, level: int, sample_point_id: UUID | None)`
  - `AssessmentRead(id, area_id, template_id, title, status, assessed_by, validated_by, validated_at, created_at, updated_at, scores: list[ScoreOut])`
  - `TemplateRead(version, dimensions: list[DimensionRead])`; `DimensionRead(code, name, sort_order, indicators)`;
    `IndicatorRead(code, title, sort_order, levels)`; `LevelRead(level, description)`
  - `AssessmentResultSummary(dimension_code, dimension_name, average_level, count)`
  - `RecommendationRead(code, title, practices: list[str])`
  - `AssessmentResult(level_counts: dict[int, int], overall_level: int, level_label: str, priorities: list[ScoreOut], warnings: list[ScoreOut], dimension_summary: list[AssessmentResultSummary], recommendations: list[RecommendationRead])`

- [ ] **Step 1: Escrever os schemas**

`src/openforest/api/schemas/assessment.py`:

```python
from datetime import datetime
from uuid import UUID

from pydantic import Field
from sqlmodel import SQLModel

from openforest.api.models.assessment import AssessmentStatus


class AssessmentCreate(SQLModel):
    title: str = Field(min_length=1, max_length=120)
    area_id: UUID
    template_id: UUID


class ScoreIn(SQLModel):
    indicator_id: UUID
    level: int = Field(ge=0, le=3)


class ScoresReplace(SQLModel):
    scores: list[ScoreIn]


class SamplePointCreate(SQLModel):
    name: str = Field(min_length=1, max_length=120)
    coordinates: dict[str, object] | None = None


class ScoreOut(SQLModel):
    indicator_id: UUID
    level: int
    sample_point_id: UUID | None = None


class LevelRead(SQLModel):
    level: int
    description: str


class IndicatorRead(SQLModel):
    code: str
    title: str
    sort_order: int
    levels: list[LevelRead]


class DimensionRead(SQLModel):
    code: str
    name: str
    sort_order: int
    indicators: list[IndicatorRead]


class TemplateRead(SQLModel):
    id: UUID
    name: str
    version: str
    dimensions: list[DimensionRead]


class AssessmentRead(SQLModel):
    id: UUID
    area_id: UUID
    template_id: UUID
    title: str
    status: AssessmentStatus
    assessed_by: UUID | None
    validated_by: UUID | None
    validated_at: datetime | None
    created_at: datetime
    updated_at: datetime
    scores: list[ScoreOut] = []


class AssessmentResultSummary(SQLModel):
    dimension_code: str
    dimension_name: str
    average_level: float
    count: int


class RecommendationRead(SQLModel):
    code: str
    title: str
    practices: list[str]


class AssessmentResult(SQLModel):
    level_counts: dict[int, int]
    overall_level: int
    level_label: str
    priorities: list[ScoreOut]
    warnings: list[ScoreOut]
    dimension_summary: list[AssessmentResultSummary]
    recommendations: list[RecommendationRead]
```

- [ ] **Step 2: Commit**

```bash
git add src/openforest/api/schemas/assessment.py
git commit -m "feat: schemas do módulo assessments"
```

---

### Task 4: Service de nível de transição + recomendações (puro, TDD)

**Files:**
- Create: `src/openforest/api/services/assessment_service.py`
- Test: `tests/test_assessment_level.py`

**Interfaces:**
- Produces:
  - `compute_transition_level(scores: Sequence[tuple[UUID, int]]) -> TransitionResult`
  - `TransitionResult` dataclass com `level_counts: dict[int,int]`, `overall_level: int`, `priority_indicator_ids: list[UUID]`, `warning_indicator_ids: list[UUID]`
  - `recommend_practices(dimension_averages: dict[str, float]) -> list[RecommendationRead]`
  - `LEVEL_LABELS: dict[int, dict[str, str]]` — rótulos dos níveis (es/pt)
  - `dimension_average(scores_by_dimension: dict[str, list[int]]) -> dict[str, float]`

- [ ] **Step 1: Escrever o teste que falha**

`tests/test_assessment_level.py`:

```python
from uuid import UUID

from openforest.api.services.assessment_service import (
    LEVEL_LABELS,
    compute_transition_level,
    recommend_practices,
    dimension_average,
)


def u(seed: str) -> UUID:
    return UUID(f"00000000-0000-0000-0000-{seed}")


def test_empate_vence_nivel_mais_baixo():
    result = compute_transition_level(
        [u("000000000001"), 1] * 3 + [u("000000000002"), 2] * 3
    )
    assert result.overall_level == 1


def test_nivel_geral_pela_maioria():
    scores = [(u(f"{i:012d}"), 3) for i in range(1, 21)]  # 20x nível 3
    scores += [(u(f"{i:012d}"), level) for level in (0, 1, 2) for i in range(21, 26)]
    result = compute_transition_level(scores)
    assert result.overall_level == 3


def test_nivel_2_ou_3_gera_prioridades_para_nivel_0():
    scores = [(u("000000000301"), 3)] * 30 + [(u("000000000311"), 0)]
    result = compute_transition_level(scores)
    assert u("000000000311") in result.priority_indicator_ids


def test_nivel_3_gera_avisos_para_nivel_1():
    scores = [(u("000000000401"), 3)] * 30 + [(u("000000000411"), 1)]
    result = compute_transition_level(scores)
    assert u("000000000411") in result.warning_indicator_ids


def test_nivel_3_sem_avisos_para_nivel_2():
    scores = [(u("000000000501"), 3)] * 30 + [(u("000000000511"), 2)]
    result = compute_transition_level(scores)
    assert result.warning_indicator_ids == []


def test_dimension_average():
    avg = dimension_average({"soil": [0, 3, 2], "water": [1, 1]})
    assert avg["soil"] == 5 / 3
    assert avg["water"] == 1.0


def test_recommend_practices_retorna_grupos_para_dimensoes_fracas():
    recs = recommend_practices({"soil": 1.2, "water": 3.0})
    codes = {r.code for r in recs}
    assert "soil_management" in codes
    assert "water_management" not in codes


def test_level_labels_bilingues():
    assert LEVEL_LABELS[0]["es"] == "Deficiente"
    assert LEVEL_LABELS[3]["pt"] == "Muito bom"
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pytest tests/test_assessment_level.py -v` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar o service**

`src/openforest/api/services/assessment_service.py`:

```python
from collections.abc import Sequence
from dataclasses import dataclass, field
from uuid import UUID

from openforest.api.schemas.assessment import RecommendationRead, AssessmentResultSummary

LEVEL_LABELS: dict[int, dict[str, str]] = {
    0: {"es": "Deficiente", "pt": "Deficiente"},
    1: {"es": "Regular", "pt": "Regular"},
    2: {"es": "Bueno", "pt": "Bom"},
    3: {"es": "Muy bueno", "pt": "Muito bom"},
}

SYSTEM_LABELS: dict[int, dict[str, str]] = {
    0: {"es": "Sistema degenerativo", "pt": "Sistema degenerativo"},
    1: {"es": "Transición básica", "pt": "Transição básica"},
    2: {"es": "Sistema regenerativo de transición avanzada", "pt": "Sistema regenerativo de transição avançada"},
    3: {"es": "Sistema regenerativo libre de insumos químicos", "pt": "Sistema regenerativo livre de insumos químicos"},
}


@dataclass(frozen=True)
class TransitionResult:
    level_counts: dict[int, int] = field(default_factory=lambda: {0: 0, 1: 0, 2: 0, 3: 0})
    overall_level: int = 0
    priority_indicator_ids: list[UUID] = field(default_factory=list)
    warning_indicator_ids: list[UUID] = field(default_factory=list)


def compute_transition_level(scores: Sequence[tuple[UUID, int]]) -> TransitionResult:
    counts = {0: 0, 1: 0, 2: 0, 3: 0}
    for _indicator_id, level in scores:
        counts[level] += 1
    overall = max((0, 1, 2, 3), key=lambda level: (counts[level], -level))
    priority_ids = [iid for iid, level in scores if level == 0] if overall in (2, 3) else []
    warning_ids = [iid for iid, level in scores if level <= 1] if overall == 3 else []
    return TransitionResult(
        level_counts=counts,
        overall_level=overall,
        priority_indicator_ids=priority_ids,
        warning_indicator_ids=warning_ids,
    )


def dimension_average(scores_by_dimension: dict[str, list[int]]) -> dict[str, float]:
    return {
        code: sum(values) / len(values)
        for code, values in scores_by_dimension.items()
        if values
    }


RECOMMENDATION_GROUPS: list[tuple[str, list[str], dict[str, str], list[dict[str, str]]]] = [
    (
        "soil_management",
        ["soil"],
        {"es": "Manejo, protección y restauración del suelo", "pt": "Manejo, proteção e restauração do solo"},
        [
            {"es": "Control integrado de arvenses", "pt": "Controle integrado de plantas espontâneas"},
            {"es": "Diversificación de coberturas nativas", "pt": "Diversificação de coberturas nativas"},
            {"es": "Prácticas de conservación contra la erosión", "pt": "Práticas de conservação contra a erosão"},
            {"es": "Fertilización equilibrada con enmiendas orgánicas y microorganismos benéficos", "pt": "Fertilização equilibrada com corretivos orgânicos e microrganismos benéficos"},
        ],
    ),
    (
        "pest_management",
        ["agronomic"],
        {"es": "Prevención y control de plagas y enfermedades", "pt": "Prevenção e controle de pragas e doenças"},
        [
            {"es": "Manejo integral y preventivo con monitoreo constante", "pt": "Manejo integral e preventivo com monitoramento constante"},
            {"es": "Análisis de suelo y follaje", "pt": "Análise de solo e folhas"},
            {"es": "Control biológico con microorganismos e insectos benéficos", "pt": "Controle biológico com microrganismos e insetos benéficos"},
            {"es": "Extractos naturales y trampas atrayentes", "pt": "Extratos naturais e armadilhas atrativas"},
        ],
    ),
    (
        "variety_management",
        ["microclimate", "agronomic"],
        {"es": "Variedades de café y manejo de planta", "pt": "Variedades de café e manejo da planta"},
        [
            {"es": "Uso de variedades resistentes y productivas", "pt": "Uso de variedades resistentes e produtivas"},
            {"es": "Podas y renovación de plantas", "pt": "Podas e renovação das plantas"},
            {"es": "Nutrición complementaria con bioinsumos", "pt": "Nutrição complementar com bioinsumos"},
        ],
    ),
    (
        "water_management",
        ["water"],
        {"es": "Manejo, tratamiento y conservación de aguas", "pt": "Manejo, tratamento e conservação de águas"},
        [
            {"es": "Protección de fuentes de agua", "pt": "Proteção das fontes de água"},
            {"es": "Riego eficiente", "pt": "Irrigação eficiente"},
            {"es": "Tratamiento sostenible de aguas residuales y subproductos del beneficiado", "pt": "Tratamento sustentável de águas residuais e subprodutos do benefício"},
        ],
    ),
    (
        "biodiversity_management",
        ["biodiversity"],
        {"es": "Manejo, restauración de biodiversidad y conectividad del paisaje", "pt": "Manejo, restauração da biodiversidade e conectividade da paisagem"},
        [
            {"es": "Cultivar café con árboles frutales, leguminosas y plantas nativas", "pt": "Cultivar café com árvores frutíferas, leguminosas e plantas nativas"},
            {"es": "Cercas vivas y conservación de parches de bosque", "pt": "Cercas vivas e conservação de trechos de floresta"},
            {"es": "Corredores ecológicos dentro y entre fincas", "pt": "Corredores ecológicos dentro e entre propriedades"},
        ],
    ),
    (
        "farm_management",
        ["economic", "social"],
        {"es": "Prácticas de gestión de cafetales y fincas", "pt": "Práticas de gestão dos cafezais e propriedades"},
        [
            {"es": "Registros y planificación de actividades", "pt": "Registros e planejamento de atividades"},
            {"es": "Seguimiento del bienestar del equipo", "pt": "Acompanhamento do bem-estar da equipe"},
            {"es": "Análisis de rentabilidad anual", "pt": "Análise de rentabilidade anual"},
        ],
    ),
    (
        "information_systems",
        ["policy"],
        {"es": "Apoyo en sistemas de información", "pt": "Apoio em sistemas de informação"},
        [
            {"es": "Monitoreo del clima", "pt": "Monitoramento do clima"},
            {"es": "Alertas tempranas sobre plagas", "pt": "Alertas precoces sobre pragas"},
            {"es": "Actualización constante de precios y mercados", "pt": "Atualização constante de preços e mercados"},
        ],
    ),
    (
        "organizational_practices",
        ["policy", "social"],
        {"es": "Prácticas organizativas", "pt": "Práticas organizativas"},
        [
            {"es": "Alianzas y participación en organizaciones comunales y regionales", "pt": "Alianças e participação em organizações comunitárias e regionais"},
            {"es": "Valorización de residuos del café para nuevos usos", "pt": "Valorização dos resíduos do café para novos usos"},
        ],
    ),
]


def recommend_practices(dimension_averages: dict[str, float], lang: str = "pt") -> list[RecommendationRead]:
    recommendations: list[RecommendationRead] = []
    for code, dimension_codes, title, practices in RECOMMENDATION_GROUPS:
        weak = [d for d in dimension_codes if dimension_averages.get(d, 0) < 2]
        if weak:
            recommendations.append(
                RecommendationRead(
                    code=code,
                    title=title[lang],
                    practices=[p[lang] for p in practices],
                )
            )
    return recommendations
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pytest tests/test_assessment_level.py -v` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/openforest/api/services/assessment_service.py tests/test_assessment_level.py
git commit -m "feat: cálculo do nível de transição e recomendações (TDD)"
```

---

### Task 5: Router + service de persistência + testes de domínio

**Files:**
- Create: `src/openforest/api/routers/assessments.py`
- Modify: `src/openforest/api/services/assessment_service.py` (add CRUD), `src/openforest/api/main.py`
- Test: `tests/test_assessments.py`

**Interfaces:**
- Produces endpoints (prefixo `/assessments`, tags `["diagnósticos"]`):
  - `GET /assessments/templates?lang=pt` → `list[TemplateRead]`
  - `POST /assessments` (volunteer+) com `AssessmentCreate` → `AssessmentRead`
  - `GET /assessments` (membro da org) → paginado `list[AssessmentRead]`
  - `GET /assessments/{id}` (membro da org) → `AssessmentRead`
  - `PUT /assessments/{id}/scores` (volunteer+, status draft) com `ScoresReplace` → `AssessmentRead`
  - `POST /assessments/{id}/sample-points` (volunteer+, draft) com `SamplePointCreate` → cria ponto
  - `POST /assessments/{id}/submit` (volunteer+) → valida 41 scores → status `submitted`
  - `POST /assessments/{id}/validate` (researcher+) → status `validated`
  - `GET /assessments/{id}/result?lang=pt` → `AssessmentResult`

- [ ] **Step 1: Escrever testes de domínio**

`tests/test_assessments.py` — copy the fixture boilerplate from `tests/test_projects.py` (test_engine, create_tables, session, client, auth_headers + casa helper de org). Testes:

- `test_criar_avaliacao_e_listar`: cria org+area, `POST /assessments`, `GET /assessments` retorna 1.
- `test_avaliacao_fora_da_org_403`: área de outra org → 403.
- `test_preencher_scores_e_buscar`: `PUT /scores` com 41 indicadores e `GET /{id}` retorna scores.
- `test_submit_exige_todos_indicadores`: submit com 5 scores → 400; com 41 → 200 status submitted.
- `test_validate_requer_researcher`: volunteer faz `validate` → 403; researcher → 200.
- `test_result_computa_nivel`: preenche majoritariamente nível 3, `GET /result` → `overall_level == 3`, `priorities` conforme regra.
- `test_templates_endpoint`: `GET /templates?lang=pt` retorna 1 template com 8 dimensões e 41 indicadores; `levels[0].description` em pt.
- `test_foto_vinculada_a_assessment`: `POST /photos` com `assessment_id` criado.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pytest tests/test_assessments.py -v` → FAIL (router não existe).

- [ ] **Step 3: Implementar CRUD no service**

Adicionar a `assessment_service.py`:

```python
from fastapi import HTTPException
from sqlmodel import Session, select, func
from openforest.api.models.area import Area
from openforest.api.models.assessment import (
    Assessment, AssessmentScore, AssessmentSamplePoint, AssessmentIndicator,
    AssessmentDimension, AssessmentIndicatorLevel, AssessmentTemplate, AssessmentStatus,
)
from openforest.api.models.project import Project
from openforest.api.schemas.assessment import (
    AssessmentCreate, ScoresReplace, SamplePointCreate, ScoreOut,
)
from openforest.api.models.user_organization import UserOrganizationRole


def create_assessment(session: Session, org_id: UUID, user_id: UUID, data: AssessmentCreate) -> Assessment:
    area = session.get(Area, data.area_id)
    if not area:
        raise HTTPException(status_code=422, detail=[{"msg": "Área não encontrada", "type": "not_found"}])
    project = session.get(Project, area.project_id)
    if project is None or project.organization_id != org_id:
        raise HTTPException(status_code=403, detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}])
    template = session.get(AssessmentTemplate, data.template_id)
    if not template:
        raise HTTPException(status_code=422, detail=[{"msg": "Template não encontrado", "type": "not_found"}])
    assessment = Assessment(**data.model_dump(), assessed_by=user_id)
    session.add(assessment)
    session.commit()
    session.refresh(assessment)
    return assessment


def get_org_assessment(session: Session, org_id: UUID, assessment_id: UUID) -> Assessment | None:
    stmt = (
        select(Assessment)
        .join(Area, Assessment.area_id == Area.id)
        .join(Project, Area.project_id == Project.id)
        .where(Assessment.id == assessment_id, Project.organization_id == org_id)
    )
    return session.exec(stmt).first()


def list_org_assessments(session: Session, org_id: UUID, offset: int, limit: int) -> tuple[list[Assessment], int]:
    base = select(Assessment).join(Area).join(Project).where(Project.organization_id == org_id)
    total = session.exec(select(func.count()).select_from(base.subquery())).one()
    items = session.exec(base.order_by(Assessment.created_at.desc()).offset(offset).limit(limit)).all()
    return list(items), total


def replace_scores(session: Session, assessment: Assessment, data: ScoresReplace) -> None:
    if assessment.status != AssessmentStatus.draft:
        raise HTTPException(status_code=409, detail=[{"msg": "Diagnóstico já não está em rascunho", "type": "conflict"}])
    for existing in session.exec(select(AssessmentScore).where(AssessmentScore.assessment_id == assessment.id)).all():
        session.delete(existing)
    session.flush()
    for score in data.scores:
        indicator = session.get(AssessmentIndicator, score.indicator_id)
        if not indicator:
            raise HTTPException(status_code=422, detail=[{"msg": "Indicador inválido", "type": "validation_error"}])
        session.add(AssessmentScore(assessment_id=assessment.id, indicator_id=score.indicator_id, level=score.level))
    session.commit()


def add_sample_point(session: Session, assessment: Assessment, data: SamplePointCreate) -> AssessmentSamplePoint:
    point = AssessmentSamplePoint(assessment_id=assessment.id, name=data.name, geometry=data.coordinates)
    session.add(point)
    session.commit()
    session.refresh(point)
    return point


def submit_assessment(session: Session, assessment: Assessment) -> None:
    if assessment.status != AssessmentStatus.draft:
        raise HTTPException(status_code=409, detail=[{"msg": "Diagnóstico já foi submetido", "type": "conflict"}])
    indicator_count = session.exec(select(func.count()).select_from(AssessmentIndicator)).one()
    scored = session.exec(
        select(func.count()).select_from(AssessmentScore)
        .where(AssessmentScore.assessment_id == assessment.id)
    ).one()
    if scored < indicator_count:
        raise HTTPException(
            status_code=400,
            detail=[{"msg": f"Responda todos os {indicator_count} indicadores antes de submeter", "type": "incomplete_assessment"}],
        )
    assessment.status = AssessmentStatus.submitted
    session.commit()
    session.refresh(assessment)


def validate_assessment(session: Session, assessment: Assessment, user_id: UUID) -> None:
    if assessment.status != AssessmentStatus.submitted:
        raise HTTPException(status_code=409, detail=[{"msg": "Diagnóstico precisa estar submetido", "type": "conflict"}])
    assessment.status = AssessmentStatus.validated
    assessment.validated_by = user_id
    assessment.validated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(assessment)
```

- [ ] **Step 4: Implementar o `score_out` builder + result builder**

Adicionar a `assessment_service.py`:

```python
def assessment_scores(session: Session, assessment_id: UUID) -> list[ScoreOut]:
    rows = session.exec(
        select(AssessmentScore).where(AssessmentScore.assessment_id == assessment_id)
    ).all()
    return [ScoreOut(indicator_id=r.indicator_id, level=r.level, sample_point_id=r.sample_point_id) for r in rows]


def assessment_result(session: Session, assessment: Assessment, lang: str) -> AssessmentResult:
    scores = session.exec(select(AssessmentScore).where(AssessmentScore.assessment_id == assessment.id)).all()
    scored = [(s.indicator_id, s.level) for s in scores]
    transition = compute_transition_level(scored)
    priorities = [ScoreOut(indicator_id=i, level=0) for i in transition.priority_indicator_ids]
    warnings = [ScoreOut(indicator_id=i, level=1) for i in transition.warning_indicator_ids]

    indicators = session.exec(select(AssessmentIndicator)).all()
    dimensions = session.exec(select(AssessmentDimension)).all()
    levels_by_dim: dict[UUID, list[int]] = {d.id: [] for d in dimensions}
    dim_map = {i.id: i.dimension_id for i in indicators}
    for s in scores:
        if s.indicator_id in dim_map:
            levels_by_dim[dim_map[s.indicator_id]].append(s.level)

    dim_name = {d.id: d.name_translations.get(lang, "?") for d in dimensions}
    summary = [
        AssessmentResultSummary(
            dimension_code=d.code,
            dimension_name=dim_name[d.id],
            average_level=(sum(levels_by_dim[d.id]) / len(levels_by_dim[d.id])) if levels_by_dim[d.id] else 0.0,
            count=len(levels_by_dim[d.id]),
        )
        for d in sorted(dimensions, key=lambda x: x.sort_order)
    ]
    averages = {d.code: avg.average_level for avg in summary}
    return AssessmentResult(
        level_counts=transition.level_counts,
        overall_level=transition.overall_level,
        level_label=SYSTEM_LABELS[transition.overall_level][lang],
        priorities=priorities,
        warnings=warnings,
        dimension_summary=summary,
        recommendations=recommend_practices(averages, lang),
    )
```

- [ ] **Step 5: Implementar o router**

`src/openforest/api/routers/assessments.py`:

```python
from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from openforest.api.dependencies.auth import CurrentUserDep
from openforest.api.dependencies.database import SessionDep
from openforest.api.dependencies.permissions import check_area_role
from openforest.api.infrastructure.pagination import PaginationQuery, paginate
from openforest.api.models.assessment import (
    Assessment, AssessmentDimension, AssessmentIndicator, AssessmentIndicatorLevel,
    AssessmentTemplate, AssessmentStatus,
)
from openforest.api.models.user import User
from openforest.api.models.user_organization import UserOrganization, UserOrganizationRole
from openforest.api.schemas.assessment import (
    AssessmentCreate, AssessmentRead, AssessmentResult, SamplePointCreate,
    ScoresReplace, ScoreOut, TemplateRead, DimensionRead, IndicatorRead, LevelRead,
)
from openforest.api.services import assessment_service

router = APIRouter(prefix="/assessments", tags=["diagnósticos"])

LangQuery = Annotated[str, Query(pattern="^(pt|es)$")]


@router.get("/templates")
def list_templates(
    session: SessionDep,
    current_user: CurrentUserDep,
    lang: LangQuery = "pt",
) -> list[TemplateRead]:
    templates = session.exec(select(AssessmentTemplate).order_by(AssessmentTemplate.version)).all()
    dimensions = session.exec(select(AssessmentDimension).order_by(AssessmentDimension.sort_order)).all()
    indicators = session.exec(select(AssessmentIndicator)).all()
    levels = session.exec(select(AssessmentIndicatorLevel)).all()

    levels_by_indicator: dict[UUID, list[LevelRead]] = {}
    for lv in levels:
        levels_by_indicator.setdefault(lv.indicator_id, []).append(
            LevelRead(level=lv.level, description=lv.description_translations.get(lang, ""))
        )
    indicators_by_dim: dict[UUID, list[IndicatorRead]] = {}
    for ind in sorted(indicators, key=lambda x: x.sort_order):
        indicators_by_dim.setdefault(ind.dimension_id, []).append(
            IndicatorRead(
                code=ind.code, title=ind.title_translations.get(lang, ""),
                sort_order=ind.sort_order,
                levels=sorted(levels_by_indicator.get(ind.id, []), key=lambda x: x.level),
            )
        )
    dims_by_template: dict[UUID, list[DimensionRead]] = {}
    for dim in dimensions:
        dims_by_template.setdefault(dim.template_id, []).append(
            DimensionRead(
                code=dim.code, name=dim.name_translations.get(lang, ""),
                sort_order=dim.sort_order, indicators=indicators_by_dim.get(dim.id, []),
            )
        )
    return [
        TemplateRead(
            id=t.id, name=t.name, version=t.version,
            dimensions=dims_by_template.get(t.id, []),
        )
        for t in templates
    ]
```

> Nota: as dimensões pertencem a um template; o model acima usa `template_id` na `AssessmentDimension`? **Não** — para 1 template global (2025-01) mantemos dimensões no nível global, sem `template_id`. O `list_templates` agrupa dimensões do template mais recente (`templates[0]`). Para futuras versões, adicionar `AssessmentTemplateVersion` mapeando (ver `database-schema-v2.md`). Implementação acima usa o primeiro template; se houver múltiplos, agrupar pelo mais recente (`.order_by(AssessmentTemplate.created_at.desc())`).

Endpoints de domínio (mesmo arquivo):

```python
@router.post("", response_model=None)
def create_assessment(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: Annotated[UserOrganization | None, Depends(get_current_org)],
    data: AssessmentCreate,
) -> AssessmentRead:
    if current_user.is_superuser is False:
        check_area_role(session, current_user, current_org, data.area_id, UserOrganizationRole.volunteer)
    org_id = _resolve_org_id(current_user, current_org)
    assessment = assessment_service.create_assessment(session, org_id, current_user.id, data)
    return _read(session, assessment)


@router.get("", response_model=None)
def list_assessments(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: Annotated[UserOrganization | None, Depends(get_current_org)],
    pagination: PaginationQuery,
) -> Sequence[AssessmentRead]:
    org_id = _resolve_org_id(current_user, current_org)
    items, total = assessment_service.list_org_assessments(session, org_id, pagination.offset, pagination.limit)
    return paginate([_read(session, a) for a in items], total, pagination)


def _resolve_org_id(user: User, org: UserOrganization | None) -> UUID:
    if user.is_superuser:
        raise HTTPException(status_code=403, detail=[{"msg": "Superusuário deve informar organização", "type": "no_organization"}])
    if org is None:
        raise HTTPException(status_code=403, detail=[{"msg": "Usuário não vinculado a nenhuma organização", "type": "no_organization"}])
    return org.organization_id


def _read(session: Session, assessment: Assessment) -> AssessmentRead:
    return AssessmentRead(
        **assessment.model_dump(),
        scores=assessment_service.assessment_scores(session, assessment.id),
    )


@router.get("/{assessment_id}")
def get_assessment(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: Annotated[UserOrganization | None, Depends(get_current_org)],
    assessment_id: UUID,
) -> AssessmentRead:
    org_id = _resolve_org_id(current_user, current_org)
    assessment = assessment_service.get_org_assessment(session, org_id, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail=[{"msg": "Diagnóstico não encontrado", "type": "not_found"}])
    return _read(session, assessment)


@router.put("/{assessment_id}/scores")
def replace_scores(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: Annotated[UserOrganization | None, Depends(get_current_org)],
    assessment_id: UUID,
    data: ScoresReplace,
) -> AssessmentRead:
    org_id = _resolve_org_id(current_user, current_org)
    assessment = _require_org_assessment(session, org_id, assessment_id)
    assessment_service.replace_scores(session, assessment, data)
    return _read(session, assessment)


@router.post("/{assessment_id}/sample-points")
def create_sample_point(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: Annotated[UserOrganization | None, Depends(get_current_org)],
    assessment_id: UUID,
    data: SamplePointCreate,
) -> dict[str, str]:
    org_id = _resolve_org_id(current_user, current_org)
    assessment = _require_org_assessment(session, org_id, assessment_id)
    point = assessment_service.add_sample_point(session, assessment, data)
    return {"id": str(point.id)}


@router.post("/{assessment_id}/submit")
def submit_assessment(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: Annotated[UserOrganization | None, Depends(get_current_org)],
    assessment_id: UUID,
) -> AssessmentRead:
    org_id = _resolve_org_id(current_user, current_org)
    assessment = _require_org_assessment(session, org_id, assessment_id)
    assessment_service.submit_assessment(session, assessment)
    return _read(session, assessment)


@router.post("/{assessment_id}/validate")
def validate_assessment(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: Annotated[UserOrganization | None, Depends(get_current_org)],
    assessment_id: UUID,
) -> AssessmentRead:
    org_id = _resolve_org_id(current_user, current_org)
    assessment = _require_org_assessment(session, org_id, assessment_id)
    if current_user.is_superuser is False and (
        current_org is None or current_org.role not in (UserOrganizationRole.researcher, UserOrganizationRole.manager)
    ):
        raise HTTPException(status_code=403, detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}])
    assessment_service.validate_assessment(session, assessment, current_user.id)
    return _read(session, assessment)


@router.get("/{assessment_id}/result")
def get_result(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: Annotated[UserOrganization | None, Depends(get_current_org)],
    assessment_id: UUID,
    lang: LangQuery = "pt",
) -> AssessmentResult:
    org_id = _resolve_org_id(current_user, current_org)
    assessment = _require_org_assessment(session, org_id, assessment_id)
    return assessment_service.assessment_result(session, assessment, lang)


def _require_org_assessment(session: Session, org_id: UUID, assessment_id: UUID) -> Assessment:
    assessment = assessment_service.get_org_assessment(session, org_id, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail=[{"msg": "Diagnóstico não encontrado", "type": "not_found"}])
    return assessment
```

- [ ] **Step 5: Registar no `main.py`**

`src/openforest/api/main.py` — adicionar import e include:

```python
from openforest.api.routers import assessments, areas, auth, monitoring, organizations, photos, projects
...
app.include_router(assessments.router, prefix="/api/v1")
```

- [ ] **Step 6: Rodar a suite e lint**

Run: `pytest tests/test_assessments.py tests/test_assessment_level.py -v` → PASS. Depois `ruff check src/` e `mypy src/`.

- [ ] **Step 7: Commit**

```bash
git add src/openforest/api/routers/assessments.py src/openforest/api/services/assessment_service.py src/openforest/api/main.py tests/test_assessments.py
git commit -m "feat: endpoints de diagnóstico de caficultura com níveis e recomendações"
```

---

### Task 6: Scaffold do app mobile (Expo + expo-router + i18n + auth)

**Files:**
- Create: `mobile/package.json`, `mobile/app.json`, `mobile/tsconfig.json`, `mobile/eslint.config.mjs`, `mobile/app/_layout.tsx`, `mobile/app/(auth)/login.tsx`, `mobile/app/(auth)/register.tsx`, `mobile/app/(tabs)/_layout.tsx`, `mobile/src/i18n/*`, `mobile/src/api/*`, `mobile/.env.example`
- Test: `mobile/README.md` com instruções `npx expo start`

**Interfaces:**
- Produces: client `api` com `login/refresh/register`, `securedRequest` com refresh automático; hook `useAuth` guardando tokens em `expo-secure-store`.

- [ ] **Step 1: Criar package.json e configs**

`mobile/package.json`:

```json
{
  "name": "openforest-mobile",
  "version": "0.1.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "lint": "expo lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "expo": "~53.0.0",
    "expo-router": "~5.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-sqlite": "~15.0.0",
    "expo-location": "~18.0.0",
    "expo-image-picker": "~16.0.0",
    "expo-constants": "~17.0.0",
    "react": "19.0.0",
    "react-native": "0.79.2",
    "i18next": "^23.0.0",
    "react-i18next": "^14.0.0",
    "@react-native-community/netinfo": "^11.0.0"
  },
  "devDependencies": {
    "typescript": "~5.8.0",
    "eslint": "^9.0.0",
    "eslint-config-expo": "~9.0.0"
  }
}
```

`mobile/tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

`mobile/.env.example`:

```
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

- [ ] **Step 2: i18n inicial**

`mobile/src/i18n/resources.ts` (pt reconciled, es):

```typescript
export const resources = {
  pt: {
    translation: {
      tabs: { farms: "Fincas", diagnosis: "Diagnóstico", plan: "Plano", profile: "Perfil" },
      auth: { login: "Entrar", register: "Criar conta", email: "E-mail", password: "Senha" },
      diagnosis: { new: "Novo diagnóstico", status: { draft: "Rascunho", submitted: "Submetido", validated: "Validado" } },
      results: { close: "Fechar", priorities: "Prioridades críticas", warnings: "Ainda a trabalhar" },
    },
  },
  es: { translation: { /* espelho */ } },
} as const;
```

`mobile/src/i18n/index.ts`:

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";

void i18n.use(initReactI18next).init({
  resources,
  lng: "pt",
  fallbackLng: "pt",
  interpolation: { escapeValue: false },
});

export default i18n;
```

- [ ] **Step 3: Client de API com refresh de token**

`mobile/src/api/client.ts`:

```typescript
import * as SecureStore from "expo-secure-store";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const TOKEN_KEY = "openforest.access_token";
const REFRESH_KEY = "openforest.refresh_token";

async function rawRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

async function secureRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) throw new ApiError(401, { detail: "Não autenticado" });
  try {
    return await rawRequest<T>(path, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...options.headers },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const refreshed = await tryRefresh();
      if (refreshed) return secureRequest<T>(path, options);
    }
    throw error;
  }
}

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API error ${status}`);
  }
}

export const api = {
  raw: rawRequest,
  secured: secureRequest,
};
```

`mobile/src/api/auth.ts`:

```typescript
import * as SecureStore from "expo-secure-store";
import { api, ApiError } from "./client";

const TOKEN_KEY = "openforest.access_token";
const REFRESH_KEY = "openforest.refresh_token";

export async function login(email: string, password: string): Promise<void> {
  const data = await api.raw<{ access_token: string; refresh_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await SecureStore.setItemAsync(TOKEN_KEY, data.access_token);
  await SecureStore.setItemAsync(REFRESH_KEY, data.refresh_token);
}

export async function tryRefresh(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const data = await api.raw<{ access_token: string }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    await SecureStore.setItemAsync(TOKEN_KEY, data.access_token);
    return true;
  } catch {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    return false;
  }
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}
```

> Nota: conferir o payload real de `/auth/refresh` e `/auth/login` no backend (`routers/auth.py`) e ajustar os nomes dos campos ao implementar.

- [ ] **Step 4: Layout raiz + tabs skeleton**

`mobile/app/_layout.tsx`:

```tsx
import { Stack } from "expo-router";
import "@/src/i18n";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`mobile/app/(tabs)/_layout.tsx` — Tabs com 4 abas (fincas, diagnosticos, plan, perfil).

- [ ] **Step 5: Verificar bootstrap**

Run: `npx expo start` (ou `npm install && npm run typecheck`). Typecheck e lint passam.

- [ ] **Step 6: Commit**

```bash
git add mobile/
git commit -m "feat: scaffold Expo do app mobile (router, i18n, auth)"
```

---

### Task 7: Camada offline — SQLite + sync engine

**Files:**
- Create: `mobile/src/db/schema.ts`, `mobile/src/db/database.ts`, `mobile/src/db/repositories.ts`, `mobile/src/sync/queue.ts`, `mobile/src/sync/sync.ts`
- Modify: `mobile/package.json` (adicionar `expo-file-system` para fotos locais)

**Interfaces:**
- Produces:
  - `initDb()` → abre BD `openforest.db`
  - `pullCatalog()` → grava templates+areas em tabelas locais
  - `enqueueAssessment(payload)` / `enqueuePhoto(localUri, assessmentId)` → fila `pending_ops`
  - `runSync()` → executa a fila em ordem quando online (`netinfo`)
  - `getDrafts()` → diagnoses locais não sincronizadas

- [ ] **Step 1: Schema SQLite**

`mobile/src/db/schema.ts`:

```sql
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS template (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dimension (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS indicator (
  id TEXT PRIMARY KEY,
  dimension_id TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS indicator_level (
  indicator_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  description TEXT NOT NULL,
  PRIMARY KEY (indicator_id, level)
);
CREATE TABLE IF NOT EXISTS local_area (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  size_hectares REAL,
  biome TEXT,
  synced_at TEXT
);
CREATE TABLE IF NOT EXISTS local_assessment (
  id TEXT PRIMARY KEY,
  area_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  local_pending INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS local_score (
  assessment_id TEXT NOT NULL,
  indicator_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  PRIMARY KEY (assessment_id, indicator_id)
);
CREATE TABLE IF NOT EXISTS pending_op (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,          -- 'assessment_create' | 'scores_replace' | 'submit' | 'photo'
  assessment_id TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
```

- [ ] **Step 2: Repositórios locais**

`mobile/src/db/database.ts` — helper `openDatabase()` com `expo-sqlite` (`SQLite.openDatabaseAsync`). `mobile/src/db/repositories.ts` — `saveTemplate(tx, template)`, `upsertAssessment`, `addScore`, `markSynced(assessmentId, version)`, `listDrafts`, `getCatalog()`. (Tratar `indicator_level.description` já traduzido no pull conforme `lang`; o catálogo assume lang fixa por usuário.)

- [ ] **Step 3: Motor de sync**

`mobile/src/sync/queue.ts`:

```typescript
export type PendingOp =
  | { kind: "assessment_create"; payload: AssessmentCreate }
  | { kind: "scores_replace"; assessmentId: string; payload: ScoresReplace }
  | { kind: "submit"; assessmentId: string }
  | { kind: "photo"; assessmentId: string; localUri: string };

export function enqueue(op: PendingOp): Promise<void> { /* INSERT INTO pending_op */ }
```

`mobile/src/sync/sync.ts` — `runSync()`:

```typescript
import NetInfo from "@react-native-community/netinfo";

export async function runSync(): Promise<void> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return;
  const ops = await pendingOps();
  for (const op of ops) {
    try {
      if (op.kind === "assessment_create") {
        const created = await api.secured<AssessmentRead>("/assessments", {
          method: "POST", body: JSON.stringify(op.payload),
        });
        await mapAssessmentToCatalog(created);
      } else if (op.kind === "scores_replace") {
        await api.secured(`/assessments/${op.assessmentId}/scores`, {
          method: "PUT", body: JSON.stringify(op.payload),
        });
      } else if (op.kind === "submit") {
        await api.secured(`/assessments/${op.assessmentId}/submit`, { method: "POST" });
      } else if (op.kind === "photo") {
        await uploadPhoto(op.assessmentId, op.localUri);
      }
      await deletePendingOp(op.id);
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        await markConflict(op.id); // não re-tenta erro 4xx
      } else {
        await retryLater(op.id);
      }
    }
  }
}

NetInfo.addEventListener(() => { void runSync(); });
```

> Conflito LWW: `mapAssessmentToCatalog` sobrescreve a linha local quando o servidor responde; o endpoint `PUT /scores` sobrescreve no servidor. `version` local incrementa a cada edição offline; em conflito, o servidor ganha.

- [ ] **Step 4: Teste de fumaça**

Run: `npm run typecheck` + `npm run lint`. (Testes da lógica offline ficam em Task 9 com jest-expo.)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/db mobile/src/sync
git commit -m "feat: sqlite local e motor de sincronização offline-first"
```

---

### Task 8: Telas principais (formulário, resultado, plano)

**Files:**
- Create: `mobile/app/(tabs)/fincas/index.tsx`, `mobile/app/(tabs)/diagnosticos/index.tsx`, `mobile/app/diagnosticos/[id]/index.tsx`, `mobile/app/diagnosticos/[id]/resultado.tsx`, `mobile/app/(tabs)/plan/index.tsx`, `mobile/app/(tabs)/perfil/index.tsx`, `mobile/src/features/DiagnosticoForm.tsx`, `mobile/src/features/Resultado.tsx`, `mobile/src/features/PlanScreen.tsx`

**Interfaces:**
- Consumes: `multilingualText({es,pt})` helper; catálogo do SQLite; `enqueue()`; `api.secured("/assessments/{id}/result")`.
- Produces: fluxo completo Finca → Diagnóstico (8 seções) → Resultado → Plano.

- [ ] **Step 1: Helper de idioma**

`mobile/src/i18n/lang.ts`:

```typescript
export type Lang = "pt" | "es";
export function text(translations: Record<Lang, string>, lang: Lang): string {
  return translations[lang] ?? translations.pt;
}
```

- [ ] **Step 2: Lista de fincas + diagnóstico**

`fincas/index.tsx` — lista `local_area` (pull), botão "Novo diagnóstico" abre seletor de área e cria `local_assessment` local (`enqueue({kind:"assessment_create", ...})` quando online). `diagnosticos/index.tsx` — lista diagnoses da org (`GET /assessments` online, senão `listDrafts()`), navega para `diagnosticos/[id]`.

- [ ] **Step 3: Formulário por dimensão**

`DiagnosticoForm` — uma seção por dimensão; cada indicador é um radio de 4 níveis usando as `indicator_level.description` do catálogo local:

```tsx
interface Props { assessmentId: string; dimension: DimensionRead; }
export function IndicadorRow({ indicator, value, onChange }: {
  indicator: IndicatorRead; value: number | null; onChange: (l: number) => void;
}) {
  return (
    <View>
      <Text>{indicator.title}</Text>
      {indicator.levels.map((level) => (
        <Pressable key={level.level} onPress={() => onChange(level.level)}>
          <Radio checked={value === level.level} />
          <Text>{level.description}</Text>
        </Pressable>
      ))}
    </View>
  );
}
```

Salvar cada resposta em `local_score` + `enqueue({kind:"scores_replace", assessmentId, payload:{scores}})`. Aba "Submeter" chama `enqueue({kind:"submit", assessmentId})` (o backend valida os 41; o app exibe o erro de incomplete via sync).

- [ ] **Step 4: Resultado**

`Resultado.tsx` — `GET /assessments/{id}/result?lang=pt`; grafo de barras por dimensão (flat `View`, sem lib de chart), texto do nível (`level_label`), chips de `priorities`/`warnings`, lista de `recommendations`.

- [ ] **Step 5: Plano**

`PlanScreen` — salva manualmente as recomendações como checklist local (`local_plan` table opcional) e exibe.

> Para MVP, o Plano é derivado do Resultado; persistir checklist fica como TODO pós-MVP (ver `mobile/TODO-MOBILE.md`).

- [ ] **Step 6: Commit**

```bash
git add mobile/app mobile/src/features
git commit -m "feat: telas de fincas, diagnóstico, resultado e plano"
```

---

### Task 9: Testes do app + verificação E2E

**Files:**
- Create: `mobile/jest.config.js`, `mobile/src/sync/__tests__/queue.test.ts`, `mobile/src/i18n/__tests__/lang.test.tsx`
- Modify: `mobile/package.json` (jest-expo), `backend/tests/test_assessments.py`

- [ ] **Step 1: Testes unitários mobile**

`queue.test.ts` — `enqueue`/`markSynced`/`listDrafts` com BD in-memory (`expo-sqlite` test double ou `better-sqlite3` via jest-expo mock). `lang.test.tsx` — `text({es, pt}, "pt")` resolve pt; fallback pt.

- [ ] **Step 2: Teste E2E de fluxo (api)**

Adicionar em `tests/test_assessments.py` um teste de integração completa no fluxo da Task 5, se ainda não existir: `test_fluxo_completo_produtor_tecnico` (cria org manager, produtor volunteer com área, preenche offline-equivalente via API, submete, researcher valida, resultado com nível esperado).

- [ ] **Step 3: Lint/typecheck final**

Run: `cd backend && pytest && ruff check src/ && mypy src/` e `cd mobile && npm run lint && npm run typecheck`.

- [ ] **Step 4: Docs update**

Atualizar `AGENTS.md` (comandos mobile) e `AGENTS-FRONTEND.md` apontando para `mobile/` (ou criar `AGENTS-MOBILE.md` com convenções do app).

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat: caficultura regenerativa — módulo assessments + app mobile offline-first"
```

---

## Self-Review

- **Cobertura do spec:** 8 dimensões/41 indicadores/seeding (Task 2); regra de nível + prioridades (Task 4); recomendações (Task 4); CRUD + submit/validate + result (Task 5); offline SQLite + sync (Task 7); telas (Task 8); i18n pt/es (Tasks 2, 6, 8); fotos de evidência por `Photo.assessment_id` (Task 1); multi-tenant escopado por org (Task 5). Docs complementares: `database-schema-v2.md`, `MOBILE-ROADMAP.md`, `mobile/TODO-MOBILE.md`.
- **Gaps conhecidos (pós-MVP, em `TODO-MOBILE.md`):** plano com checklist persistido; conflitos avançados (3-way); upload de fotos com retry/compressão; `GERENCIAMENTO` de template version mapping (adicionar `assessment_template_version` quando houver 2ª versão); PostGIS `ST_DWithin` para validação de pontos de amostragem; alertas de clima (roadmap M4).
- **Consistência de tipos:** nomes `AssessmentCreate/ScoresReplace/SamplePointCreate/ScoreOut/AssessmentRead/AssessmentResult/TemplateRead/DimensionRead/IndicatorRead/LevelRead` consistentes entre schemas (Task 3), service (Task 4/5) e router (Task 5). `compute_transition_level` e `recommend_practices` assinaturas batem com os testes da Task 4. Payloads reais de `/auth/login` e `/auth/refresh` devem ser conferidos (Task 6, nota inline).