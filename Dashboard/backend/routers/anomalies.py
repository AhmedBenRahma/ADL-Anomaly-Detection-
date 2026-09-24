"""Anomaly list endpoint with filter support."""

from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request

from schemas.responses import AnomalyItem
from services.data_service import DataService

router = APIRouter(prefix="/api", tags=["anomalies"])


def _svc(request: Request) -> DataService:
    return request.app.state.data_service


@router.get("/houses/{house_id}/anomalies", response_model=list[AnomalyItem])
def list_anomalies(
    house_id: int,
    request: Request,
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    severity: Optional[Literal["critical", "high", "moderate"]] = Query(default=None),
    season: Optional[str] = Query(default=None),
    day_of_week: Optional[str] = Query(default=None),
) -> list[AnomalyItem]:
    """Return anomalies with optional date/severity/season/weekday filters."""

    try:
        return _svc(request).get_anomalies(
            house_id=house_id,
            start_date=start_date,
            end_date=end_date,
            severity=severity,
            season=season,
            day_name=day_of_week,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
