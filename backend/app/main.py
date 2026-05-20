"""FastAPI entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db import init_db
from app.routes import agent as agent_routes
from app.routes import emails as email_routes
from app.routes import tools as tool_routes
from app.routes import uploads as upload_routes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    settings = get_settings()
    logger.info(
        "TigTagToe API ready. Model=%s, concurrency=%s, db=%s",
        settings.anthropic_model,
        settings.agent_concurrency,
        settings.database_url,
    )
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="TigTagToe API",
        version="0.1.0",
        description="Backend for the TigTagToe email triage assistant.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(upload_routes.router)
    app.include_router(agent_routes.router)
    app.include_router(email_routes.router)
    app.include_router(tool_routes.router)

    @app.get("/healthz")
    def healthz() -> JSONResponse:
        return JSONResponse({"status": "ok"})

    @app.get("/")
    def root() -> JSONResponse:
        return JSONResponse(
            {
                "name": "TigTagToe API",
                "docs": "/docs",
                "health": "/healthz",
            }
        )

    return app


app = create_app()
