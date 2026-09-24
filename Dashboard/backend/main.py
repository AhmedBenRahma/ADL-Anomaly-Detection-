"""FastAPI application entrypoint for anomaly dashboard backend."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import anomalies, days, houses, stats
from services.data_service import DataService
from services.model_service import load_assets


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model/scalers and precompute house scores once at startup."""

    assets = load_assets(
        model_path="model/lstm_autoencoder_model.pth",
        scaler_path="model/scaler (1).pkl",
    )
    data_service = DataService(assets=assets, data_dir="backend/data")
    data_service.preload()

    app.state.assets = assets
    app.state.data_service = data_service

    yield

    # Explicit cleanup slot for future resource lifecycle management.
    app.state.assets = None
    app.state.data_service = None


app = FastAPI(
    title="Elderly Monitoring Anomaly API",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow local frontend app to call backend during development and deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(houses.router)
app.include_router(anomalies.router)
app.include_router(days.router)
app.include_router(stats.router)


@app.get("/api/health")
def health() -> dict:
    """Simple liveness endpoint used by local checks and container probes."""

    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
