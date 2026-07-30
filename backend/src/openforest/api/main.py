from fastapi import FastAPI

from openforest.api.routers import projects

app = FastAPI(title="OpenForest API", version="0.1.0")
app.include_router(projects.router, prefix="/api/v1")


@app.get("/api/v1/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "version": app.version, "title": app.title}
