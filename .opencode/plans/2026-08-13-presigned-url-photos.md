# Presigned URLs para Fotos (MinIO direto) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o frontend baixar fotos diretamente do MinIO via presigned URLs, removendo o proxy de download do backend.

**Architecture:** O backend continua salvando no storage (MinIO/S3) e gravando metadados no Postgres. A diferença: o campo `url` do schema `PhotoRead` passa a ser uma **presigned URL do S3** (assinada, expiração configurável, default 3600s) em vez de `/api/v1/photos/{id}/download`. O endpoint proxy de download é removido. A geração da URL mantém o escopo de permissão: só usuários com acesso à org/área recebem a URL (o backend valida antes de assinar).

**Tech Stack:** Python 3.12, FastAPI, SQLModel, boto3 (já dependência), MinIO (via `docker-compose.yaml`), pytest + httpx TestClient.

## Global Constraints

- Storage: MinIO/S3 via boto3. `STORAGE_BACKEND=s3` em produção e dev (docker compose). `local` continua existindo apenas para testes (mecânica de escrita/remoção) — **fotos NÃO são servidas** em modo `local`.
- **`S3_ENDPOINT_URL`/`MINIO_ENDPOINT` deve ser o endereço alcançável pelo navegador** (ex: `http://localhost:9000`), não o hostname interno do docker (`http://minio:9000`). A presigned URL herda o host do endpoint configurado no backend; se for o hostname interno, o navegador não resolve.
- Presigned URLs servem conteúdo privado por org/área; expiram em `PRESIGNED_URL_EXPIRE_SECONDS` (default `3600`).
- Presigned URL gerada por `GET /api/v1/monitorings/{id}/photos`, `GET /api/v1/photos/{id}` e na resposta do upload. Permissão validada no backend (escopo org + `check_area_role`) antes de assinar.
- Backend continua autorizando `manager`, `researcher`, `volunteer` para upload e `manager`/`researcher` para delete (inalterado).
- Config backward-compat: env vars legadas `MINIO_*` continuam funcionando (aliases), `S3_*` é a nomenclatura canônica.
- Versionamento `/v1/`, erros no formato `{"detail": [{"msg", "type"}]}`, imports por convenção do AGENTS.md (`Annotated`, `Sequence`, etc.).
- Não adicionar comentários em código (exceto docstrings se já houver padrão).

---

### Task 1: Config — expiração de URL + aliases de env `MINIO_*`

**Files:**
- Modify: `backend/src/openforest/api/config.py`
- Create: `backend/tests/test_config.py`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: nada novo.
- Produces: `settings.presigned_url_expire_seconds: int` (default `3600`); campos `s3_endpoint_url`, `s3_bucket`, `s3_access_key`, `s3_secret_key` populados por `S3_*` **ou** `MINIO_*` (legado).

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_config.py`:

```python
from openforest.api.config import Settings


def test_presigned_url_expire_default() -> None:
    assert Settings(_env_file=None).presigned_url_expire_seconds == 3600


def test_minio_env_aliases(monkeypatch) -> None:
    monkeypatch.setenv("MINIO_ENDPOINT", "http://localhost:9000")
    monkeypatch.setenv("MINIO_ACCESS_KEY", "access")
    monkeypatch.setenv("MINIO_SECRET_KEY", "secret")
    monkeypatch.setenv("MINIO_BUCKET", "openforest")
    s = Settings(_env_file=None)
    assert s.s3_endpoint_url == "http://localhost:9000"
    assert s.s3_access_key == "access"
    assert s.s3_secret_key == "secret"
    assert s.s3_bucket == "openforest"


def test_s3_env_names(monkeypatch) -> None:
    monkeypatch.setenv("S3_ENDPOINT_URL", "http://s3:9000")
    monkeypatch.setenv("S3_ACCESS_KEY", "a")
    s = Settings(_env_file=None)
    assert s.s3_endpoint_url == "http://s3:9000"
    assert s.s3_access_key == "a"
```

- [ ] **Step 2: Run tests to verify they fail**

Run (a partir de `backend/`): `uv run pytest tests/test_config.py -v`
Expected: FAIL — `Settings` não tem `presigned_url_expire_seconds`; aliases `MINIO_*` não lidos.

- [ ] **Step 3: Implement**

`backend/src/openforest/api/config.py`:

```python
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://localhost:5432/openforest"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"
    storage_backend: str = "local"
    storage_path: str = "./uploads"
    s3_endpoint_url: str | None = Field(
        default=None, validation_alias=AliasChoices("S3_ENDPOINT_URL", "MINIO_ENDPOINT")
    )
    s3_bucket: str = Field(
        default="openforest", validation_alias=AliasChoices("S3_BUCKET", "MINIO_BUCKET")
    )
    s3_access_key: str = Field(
        default="", validation_alias=AliasChoices("S3_ACCESS_KEY", "MINIO_ACCESS_KEY")
    )
    s3_secret_key: str = Field(
        default="", validation_alias=AliasChoices("S3_SECRET_KEY", "MINIO_SECRET_KEY")
    )
    s3_region: str = "us-east-1"
    presigned_url_expire_seconds: int = 3600
    max_upload_size_mb: int = 10

    model_config = {"env_file": ".env"}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_config.py -v`
Expected: PASS (3 testes).

- [ ] **Step 5: Update `.env.example`**

`backend/.env.example` — substituir o bloco de storage:

```
DATABASE_URL=postgresql://user:password@localhost:5432/openforest
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key

# Storage (MinIO / S3)
# STORAGE_BACKEND=local                 # "local" | "s3" (produção/dev: "s3")
# STORAGE_PATH=./uploads
# S3_ENDPOINT_URL=http://localhost:9000 # deve ser alcançável pelo navegador (não usar hostname interno do docker)
# S3_BUCKET=openforest
# S3_ACCESS_KEY=openforest
# S3_SECRET_KEY=your-minio-secret
# S3_REGION=us-east-1
# PRESIGNED_URL_EXPIRE_SECONDS=3600
# MAX_UPLOAD_SIZE_MB=10
#
# Compatibilidade: MINIO_ENDPOINT/MINIO_ACCESS_KEY/MINIO_SECRET_KEY/MINIO_BUCKET
# também são aceitos (aliases de S3_ENDPOINT_URL/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET).
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/openforest/api/config.py backend/tests/test_config.py backend/.env.example
git commit -m "feat: config para presigned URLs e aliases MINIO_*"
```

---

### Task 2: storage.py — `get_presigned_url` e `delete_photo_prefix`

**Files:**
- Modify: `backend/src/openforest/api/infrastructure/storage.py`
- Create: `backend/tests/test_storage.py`

**Interfaces:**
- Consumes: `settings.storage_backend`, `settings.s3_bucket`, `settings.presigned_url_expire_seconds`, `_s3_client()` (já existente).
- Produces:
  - `get_presigned_url(file_path: str, expires_in: int | None = None) -> str`
  - `delete_photo_prefix(prefix: str) -> None`
- `read_file` continua existindo nesta task (removido na Task 4 junto com a rota).

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_storage.py`:

```python
import pytest

from openforest.api.config import settings
from openforest.api.infrastructure.storage import delete_photo_prefix, get_presigned_url


class FakeS3Client:
    def __init__(self, pages: list[dict] | None = None) -> None:
        self._pages = pages or []
        self.generate_presigned_url_calls: list[tuple] = []
        self.deleted: dict[str, list[str]] = {"keys": []}
        self.put_object_calls: list[dict] = []

    def generate_presigned_url(self, method: str, params: dict, expires_in: int) -> str:
        self.generate_presigned_url_calls.append((method, params, expires_in))
        return f"https://minio.example/{params['Key']}?x-id=GetObject&expires={expires_in}"

    def list_objects_v2(self, **kwargs: object) -> dict:
        if self._pages:
            return self._pages.pop(0)
        return {"Contents": [], "IsTruncated": False}

    def delete_objects(self, *, Bucket: object = None, Delete: object = None) -> None:
        for obj in Delete["Objects"]:
            self.deleted["keys"].append(obj["Key"])

    def put_object(self, **kwargs: object) -> None:
        self.put_object_calls.append(kwargs)


@pytest.fixture
def fake_s3(monkeypatch) -> FakeS3Client:
    original = settings.storage_backend
    settings.storage_backend = "s3"
    client = FakeS3Client()
    monkeypatch.setattr("openforest.api.infrastructure.storage._s3_client", lambda: client)
    yield client
    settings.storage_backend = original


def test_get_presigned_url(fake_s3: FakeS3Client) -> None:
    url = get_presigned_url("photos/abc/1.jpg")
    assert url == "https://minio.example/photos/abc/1.jpg?x-id=GetObject&expires=3600"
    method, params, expires_in = fake_s3.generate_presigned_url_calls[0]
    assert method == "get_object"
    assert params == {"Bucket": settings.s3_bucket, "Key": "photos/abc/1.jpg"}
    assert expires_in == settings.presigned_url_expire_seconds


def test_get_presigned_url_custom_expiry(fake_s3: FakeS3Client) -> None:
    get_presigned_url("photos/abc/1.jpg", expires_in=120)
    assert fake_s3.generate_presigned_url_calls[0][2] == 120


def test_get_presigned_url_requires_s3(monkeypatch) -> None:
    settings.storage_backend = "local"
    with pytest.raises(RuntimeError):
        get_presigned_url("photos/abc/1.jpg")


def test_delete_photo_prefix(fake_s3: FakeS3Client) -> None:
    fake_s3._pages = [
        {
            "Contents": [{"Key": "photos/a/1.jpg"}, {"Key": "photos/b/2.jpg"}],
            "IsTruncated": False,
        }
    ]
    delete_photo_prefix("photos/")
    assert sorted(fake_s3.deleted["keys"]) == ["photos/a/1.jpg", "photos/b/2.jpg"]


def test_delete_photo_prefix_paginates(fake_s3: FakeS3Client) -> None:
    fake_s3._pages = [
        {"Contents": [{"Key": "photos/a/1.jpg"}], "IsTruncated": True, "NextContinuationToken": "tok"},
        {"Contents": [{"Key": "photos/b/2.jpg"}], "IsTruncated": False},
    ]
    delete_photo_prefix("photos/")
    assert sorted(fake_s3.deleted["keys"]) == ["photos/a/1.jpg", "photos/b/2.jpg"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_storage.py -v`
Expected: FAIL — `ImportError: cannot import name 'get_presigned_url'`.

- [ ] **Step 3: Implement**

Adicionar ao final de `backend/src/openforest/api/infrastructure/storage.py` (após `read_file`):

```python
def get_presigned_url(file_path: str, expires_in: int | None = None) -> str:
    if settings.storage_backend != "s3":
        raise RuntimeError("presigned URLs requerem storage_backend='s3'")
    return _s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": file_path},
        ExpiresIn=expires_in or settings.presigned_url_expire_seconds,
    )


def delete_photo_prefix(prefix: str) -> None:
    client = _s3_client()
    keys: list[str] = []
    token: str | None = None
    while True:
        kwargs: dict[str, object] = {"Bucket": settings.s3_bucket, "Prefix": prefix}
        if token:
            kwargs["ContinuationToken"] = token
        page = client.list_objects_v2(**kwargs)
        keys.extend(entry["Key"] for entry in page.get("Contents", []))
        if not page.get("IsTruncated"):
            break
        token = page.get("NextContinuationToken")
    if keys:
        client.delete_objects(
            Bucket=settings.s3_bucket,
            Delete={"Objects": [{"Key": key} for key in keys]},
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_storage.py -v`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/openforest/api/infrastructure/storage.py backend/tests/test_storage.py
git commit -m "feat: presigned URL e cleanup de prefixo no storage"
```

---

### Task 3: `PhotoRead.url` vira presigned URL (s3) ou download path (local/dev)

**Files:**
- Modify: `backend/src/openforest/api/schemas/photo.py`
- Modify: `backend/tests/test_photos.py`

**Interfaces:**
- Consumes: `settings.storage_backend`, `get_presigned_url(file_path: str) -> str` (Task 2).
- Produces: `PhotoRead.url` — presigned URL quando `storage_backend == "s3"`; `/api/v1/photos/{id}/download` em modo local (dev/test apenas, rota será removida na Task 4).

- [ ] **Step 1: Write the failing test**

Em `backend/tests/test_photos.py`, adicionar um `FakeS3Client` e fixture `s3_storage`, e o teste de URL presigned:

```python
class FakeS3Client:
    def generate_presigned_url(self, method: str, params: dict, expires_in: int) -> str:
        return f"https://minio.example/{params['Key']}?expires={expires_in}"

    def put_object(self, **kwargs: object) -> None:
        return None


@pytest.fixture
def s3_storage(monkeypatch):
    original = settings.storage_backend
    settings.storage_backend = "s3"
    monkeypatch.setattr("openforest.api.infrastructure.storage._s3_client", lambda: FakeS3Client())
    yield
    settings.storage_backend = original
```

```python
def test_list_photos_returns_presigned_url_in_s3(
    client: TestClient,
    monitoring: Monitoring,
    auth_headers: dict,
    manager_membership: UserOrganization,
    s3_storage: None,
) -> None:
    upload = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )
    assert upload.status_code == 200
    photo_id = upload.json()["id"]

    response = client.get(f"/api/v1/monitorings/{monitoring.id}/photos", headers=auth_headers)
    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["url"].startswith("https://minio.example/photos/")
    assert item["url"].endswith(f"?expires={settings.presigned_url_expire_seconds}")
    assert photo_id == item["id"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_photos.py::test_list_photos_returns_presigned_url_in_s3 -v`
Expected: FAIL — `url` retorna `/api/v1/photos/{id}/download`, não presigned.

- [ ] **Step 3: Implement**

`backend/src/openforest/api/schemas/photo.py`:

```python
from openforest.api.config import settings
from openforest.api.infrastructure.storage import get_presigned_url

class PhotoRead(PhotoCreate):
    id: UUID
    monitoring_id: UUID
    file_path: str
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def url(self) -> str:
        if settings.storage_backend == "s3":
            return get_presigned_url(self.file_path)
        return f"/api/v1/photos/{self.id}/download"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_photos.py -v`
Expected: PASS — o novo teste passa e os existentes continuam (modo local mantém `/api/v1/photos/{id}/download`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/openforest/api/schemas/photo.py backend/tests/test_photos.py
git commit -m "feat: PhotoRead.url gera presigned URL em storage s3"
```

---

### Task 4: Remover rota de download proxy e `read_file`

**Files:**
- Modify: `backend/src/openforest/api/routers/photos.py`
- Modify: `backend/src/openforest/api/infrastructure/storage.py`
- Modify: `backend/tests/test_photos.py`

**Interfaces:**
- Consumes: nada.
- Produces: rota `GET /api/v1/photos/{photo_id}/download` removida; função `read_file` removida; imports `read_file` e `Response` removidos do router.

- [ ] **Step 1: Write the failing test**

Em `backend/tests/test_photos.py`, **remover** `test_download_photo` (linhas ~259-276) e **adicionar**:

```python
def test_download_route_removed(
    client: TestClient,
    monitoring: Monitoring,
    auth_headers: dict,
    manager_membership: UserOrganization,
) -> None:
    upload = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )
    photo_id = upload.json()["id"]
    response = client.get(f"/api/v1/photos/{photo_id}/download", headers=auth_headers)
    assert response.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_photos.py::test_download_route_removed -v`
Expected: FAIL — a rota ainda existe (retorna 200).

- [ ] **Step 3: Implement**

Em `backend/src/openforest/api/routers/photos.py`:
- Remover `Response` do import de `fastapi.responses` (linha 4);
- Remover `read_file` do import de storage (linha 11);
- Remover a rota `download_photo_route` (linhas 123-145).

Em `backend/src/openforest/api/infrastructure/storage.py`:
- Remover `read_file` (linhas 62-66) e o import `cast` se não for mais usado.

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_photos.py -v`
Expected: PASS — `test_download_route_removed` passa (404); demais testes intactos.

- [ ] **Step 5: Lint e type check**

Run (a partir de `backend/`):
```bash
uv run ruff check src tests/test_photos.py
uv run ruff format src --check
uv run mypy src
```
Expected: sem erros (nenhum uso restante de `read_file`/`Response`).

- [ ] **Step 6: Commit**

```bash
git add backend/src/openforest/api/routers/photos.py backend/src/openforest/api/infrastructure/storage.py backend/tests/test_photos.py
git commit -m "refactor: remove proxy de download de fotos"
```

---

### Task 5: Seed grava via storage e `--reset` limpa MinIO

**Files:**
- Modify: `backend/src/openforest/api/seed.py`
- Modify: `backend/tests/test_seed.py`

**Interfaces:**
- Consumes: `save_upload(file_bytes, original_filename, mime_type, monitoring_id) -> str`, `delete_photo_prefix(prefix: str) -> None`, `settings.storage_backend`.
- Produces: `_write_photo_file` retorna `(key, file_size)` gravando via `save_upload` (funciona em local e s3); `main()` limpa `photos/` no bucket quando `storage_backend == "s3"` no `--reset`.

- [ ] **Step 1: Write the failing test**

Em `backend/tests/test_seed.py`, adicionar `FakeS3Client` + fixture `s3_storage` (mesmo padrão da Task 3, com `put_object`/`list_objects_v2`/`delete_objects`) e os testes:

```python
def test_seed_writes_photos_via_s3(session, s3_storage) -> None:
    report = seed(session, create_photos=True)
    session.commit()
    assert report.photos_created >= 600
    local_files = [p for p in Path(settings.storage_path).rglob("*") if p.is_file()]
    assert local_files == []


def test_seed_reset_cleans_bucket(session, s3_storage) -> None:
    report = seed(session, create_photos=True)
    session.commit()
    reset(session)
    assert fake_s3_client.deleted["keys"]
    assert all(key.startswith("photos/") for key in fake_s3_client.deleted["keys"])
```

> Nota: `s3_storage` precisa expor o `FakeS3Client` numa variável acessível (`fake_s3_client` global) para o `reset` limpar e o teste asserir.

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_seed.py -k "s3 or via_s3" -v`
Expected: FAIL — `_write_photo_file` escreve direto no disco e `reset` não limpa bucket.

- [ ] **Step 3: Implement**

`backend/src/openforest/api/seed.py`:
- Adicionar import: `from openforest.api.infrastructure.storage import delete_photo_prefix, save_upload`
- Substituir `_write_photo_file`:

```python
def _write_photo_file(monitoring_id: UUID, original_filename: str) -> tuple[str, int]:
    png_bytes = _placeholder_png()
    key = save_upload(png_bytes, original_filename, "image/png", monitoring_id)
    return key, len(png_bytes)
```

- Em `main()` (trecho atual linhas 1182-1186), trocar o reset por:

```python
        if args.reset:
            reset(session)
            if settings.storage_backend == "s3":
                delete_photo_prefix("photos/")
            else:
                _clear_local_photos()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_seed.py -v`
Expected: PASS — testes novos passam e `test_seed_creates_realistic_data` (local) continua verde (mesma mecânica de escrita).

- [ ] **Step 5: Commit**

```bash
git add backend/src/openforest/api/seed.py backend/tests/test_seed.py
git commit -m "feat: seed grava fotos via storage e reset limpa bucket MinIO"
```

---

### Task 6: Verificação final + passos de ambiente

**Files:**
- Nenhum novo código. Instruções de ambiente (arquivos `.env` são gitignored — o usuário edita localmente).

**Global check — nenhum passo de código; apenas verificação.**

- [ ] **Step 1: Rodar suíte completa**

Run (a partir de `backend/`):
```bash
uv run pytest
uv run ruff check src
uv run ruff format src --check
uv run mypy src
```
Expected: todos PASS; lint/format/mypy limpos.

- [ ] **Step 2: Configurar `.env` local (backend/container)**

Editar `backend/.env` (e/ou raiz `.env` usado no compose) adicionando:

```
STORAGE_BACKEND=s3
S3_ENDPOINT_URL=http://localhost:9000   # alcançável pelo navegador (não http://minio:9000)
S3_BUCKET=openforest
S3_ACCESS_KEY=<sua chave MinIO>
S3_SECRET_KEY=<seu segredo MinIO>
```

Se já existem `MINIO_ENDPOINT`/`MINIO_ACCESS_KEY`/etc. na raiz `.env`, eles continuam funcionando (aliases). Subir o stack: `docker compose up -d --build` e rodar `docker compose exec backend uv run python scripts/seed.py --reset` para popular fotos no bucket.

- [ ] **Step 3: Smoke test manual**

1. `docker compose up -d`; login na API; `POST /api/v1/monitorings/{id}/photos` com uma imagem.
2. `GET /api/v1/monitorings/{id}/photos` → conferir que `items[].url` é uma URL `http://localhost:9000/...?X-Amz-...` (assinada).
3. Abrir a `url` no navegador → a imagem renderiza direto do MinIO, sem passar pelo backend.

- [ ] **Step 4: Commit final (se houver sobras de docs)**

Se o `README.md`/`ARCHITECTURE.md` citarem o endpoint de download, atualizá-los e commitar; caso contrário, pular.

```bash
git add -A
git commit -m "docs: fotos servidas via presigned URLs do MinIO"
```

---

## Self-Review

**1. Spec coverage**
- Presigned URL na listagem/get/upload: Task 3. ✓
- Remoção do proxy de download: Task 4. ✓
- Expiração configurável (default 3600): Task 1. ✓
- Backend local sempre com MinIO (sem fallback): Task 4 (rota removida; `local` restrito a testes). ✓
- Seed grava via storage + `--reset` limpa bucket: Task 5. ✓
- Env `.env.example`/aliases: Task 1. ✓

**2. Placeholder scan:** Nenhum TBD/TODO; todos os steps têm código real.

**3. Type consistency:** `get_presigned_url(file_path, expires_in=None) -> str` e `delete_photo_prefix(prefix) -> None` definidos na Task 2, usados na Task 3 e Task 5 com mesmas assinaturas. `save_upload` (existente) assinatura inalterada. Nomes de env: `S3_ENDPOINT_URL` canônico, `MINIO_ENDPOINT` alias.

**Ponto de atenção (não bloqueante):** a fixture `s3_storage` em `test_photos.py` e `test_seed.py` é duplicada por arquivo (padrão do repo — boilerplate replicado por arquivo de teste, ver AGENTS.md).
