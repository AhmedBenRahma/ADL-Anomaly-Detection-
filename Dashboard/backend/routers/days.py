"""Day-level detail endpoint for deep anomaly inspection."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from schemas.responses import DayDetailResponse
from services.data_service import DataService

router = APIRouter(prefix="/api", tags=["day-detail"])


def _svc(request: Request) -> DataService:
    return request.app.state.data_service


@router.get("/houses/{house_id}/day/{target_date}", response_model=DayDetailResponse)
def day_detail(house_id: int, target_date: str, request: Request) -> DayDetailResponse:
    """Return full day signal, window scores, and hourly error heat data."""

    try:
        payload = _svc(request).get_day_detail(house_id, target_date)
        return DayDetailResponse(**payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {target_date}") from exc
