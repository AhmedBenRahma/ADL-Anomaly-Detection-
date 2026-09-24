"""House listing, house summary, and cross-house comparison endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from schemas.responses import ComparisonRow, HouseMeta, HouseSummaryResponse
from services.data_service import DataService

router = APIRouter(prefix="/api", tags=["houses"])


def _svc(request: Request) -> DataService:
    """Convenience accessor for app-scoped data service."""

    return request.app.state.data_service


@router.get("/houses", response_model=list[HouseMeta])
def list_houses(request: Request) -> list[HouseMeta]:
    """Return available houses and core metadata."""

    return _svc(request).get_houses()


@router.get("/houses/{house_id}/summary", response_model=HouseSummaryResponse)
def house_summary(house_id: int, request: Request) -> HouseSummaryResponse:
    """Return KPI-level summary and timeline for one house."""

    try:
        return _svc(request).get_house_summary(house_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/comparison", response_model=list[ComparisonRow])
def comparison(request: Request) -> list[ComparisonRow]:
    """Return comparison data across all loaded houses."""

    return _svc(request).get_comparison()
