"""
EzQuant backend — FastAPI entrypoint.

Run locally:
    uvicorn app.main:app --reload --port 8000

Interactive docs:
    http://localhost:8000/docs
    http://localhost:8000/redoc
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api import health, market, pipeline, agent
from backend.core.config import get_settings


def _configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def create_app() -> FastAPI:
    settings = get_settings()
    _configure_logging(settings.log_level)

    app = FastAPI(
        title="EzQuant Backend",
        version="0.1.0",
        description=(
            "Backend for EzQuant — a visual quant workflow builder. "
            "Provides market data, project/pipeline management, and agent endpoints."
        ),
    )

    # CORS — Next.js on :3000 needs to hit this during dev.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routes
    app.include_router(health.router)
    app.include_router(market.router)
    app.include_router(pipeline.router)
    app.include_router(agent.router)

    return app


app = create_app()
