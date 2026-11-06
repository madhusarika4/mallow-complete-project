"""Mallow API (FastAPI). Serves the built React app too, so one command runs everything."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from config import AppConfig
from mallow_api import routes_chat, routes_companion, routes_core, routes_infant, routes_parent
from mallow_api.deps import AuthState
from runtime import build_runtime

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "frontend" / "dist"


def create_app(config: AppConfig | None = None) -> FastAPI:
    app = FastAPI(title="Mallow API", version="2.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.state.runtime = build_runtime(config)
    app.state.auth = AuthState()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"], allow_headers=["*"],
        expose_headers=["X-Voice-Name", "X-Voice-Engine", "X-Voice-Notice"],
    )
    for router in (
        routes_core.router,
        routes_chat.router,
        routes_parent.router,
        routes_infant.router,
        routes_companion.router,
    ):
        app.include_router(router, prefix="/api")

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        loc = ".".join(str(p) for p in first.get("loc", []) if p not in ("body", "query"))
        message = str(first.get("msg", "Invalid input")).replace("Value error, ", "")
        return JSONResponse(status_code=422, content={"detail": f"{loc}: {message}" if loc else message})

    @app.get("/api/health")
    def health():
        return {"ok": True}

    if DIST.exists():
        app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str):
            if path.startswith("api/"):
                raise HTTPException(404, "Not found")
            candidate = DIST / path
            if path and candidate.is_file() and DIST in candidate.resolve().parents:
                return FileResponse(candidate)
            return FileResponse(DIST / "index.html")

    return app
