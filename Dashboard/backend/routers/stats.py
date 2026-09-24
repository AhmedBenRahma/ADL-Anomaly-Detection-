"""Statistical aggregation endpoint for charting views."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from schemas.responses import StatsResponse
from services.data_service import DataService

router = APIRouter(prefix="/api", tags=["stats"])


def _svc(request: Request) -> DataService:
    return request.app.state.data_service


@router.get("/houses/{house_id}/stats", response_model=StatsResponse)
def house_stats(house_id: int, request: Request) -> StatsResponse:
    """Return weekday/season groups, score distributions, and top anomalies."""

    try:
        return _svc(request).get_stats(house_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
