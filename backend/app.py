"""Optional FastAPI sidecar. The live desk is the TanStack app on port 8080."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "ml" / "registry" / "production.json"

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
except ImportError:  # pragma: no cover
    FastAPI = None  # type: ignore


def create_app():
    if FastAPI is None:
        raise RuntimeError("fastapi is not installed. The live desk does not need it.")
    app = FastAPI(title="EarningsIQ", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health():
        return {"ok": True, "service": "earningsiq", "dataMode": "fixture"}

    @app.get("/model")
    def model():
        if not REGISTRY.exists():
            raise HTTPException(
                status_code=503,
                detail="MLflow registry unavailable — refusing to score from a stale pickle.",
            )
        return json.loads(REGISTRY.read_text())

    return app


app = create_app() if FastAPI is not None else None
