from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from openforest.api.routers import areas, organizations, projects

app = FastAPI(title="OpenForest API", version="0.1.0")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(organizations.router, prefix="/api/v1")
app.include_router(areas.router, prefix="/api/v1")


@app.exception_handler(Exception)
def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "detail": [
                {
                    "msg": f"Erro interno do servidor: {exc}",
                    "type": "internal_error",
                }
            ]
        },
    )


@app.get("/api/v1/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "version": app.version, "title": app.title}
