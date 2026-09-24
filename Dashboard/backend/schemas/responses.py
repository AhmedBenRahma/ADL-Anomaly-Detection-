"""Pydantic response schemas for all public API endpoints.

These models centralize output contracts to keep router responses consistent,
well-documented, and easy to validate.
"""

from __future__ import annotations

from typing import Dict, List, Literal

from pydantic import BaseModel, Field


class HouseMeta(BaseModel):
    """Basic metadata for a single monitored house."""

    house_id: int = Field(..., ge=1)
    name: str
    file_name: str
    available_days: int = Field(..., ge=0)


class DaySummary(BaseModel):
    """Daily anomaly summary used in timeline views."""

    date: str
    score: float
    is_anomaly: bool
    consumption_mean: float


class HouseSummaryResponse(BaseModel):
    """Aggregated score and anomaly information for one house."""

    house_id: int
    total_days: int
    normal_days: int
    anomalous_days: int
    anomaly_rate: float
    mean_score: float
    threshold: float
    timeline: List[DaySummary]


class AnomalyItem(BaseModel):
    """Anomaly record used for alert tables and filtering."""

    date: str
    score: float
    threshold: float
    excess_pct: float
    severity: Literal["critical", "high", "moderate"]
    day_of_week: str
    season: str


class WindowScore(BaseModel):
    """Window-level reconstruction error over a day."""

    start_minute: int
    end_minute: int
    score: float
    is_anomaly: bool


class DayDetailResponse(BaseModel):
    """Detailed reconstruction diagnostics for a selected day."""

    date: str
    score: float
    is_anomaly: bool
    threshold: float
    original_signal: List[float]
    reconstructed_signal: List[float]
    window_scores: List[WindowScore]
    hourly_errors: List[float]


class WeekdayStat(BaseModel):
    """Weekday grouped anomaly counts."""

    day: str
    normal_count: int
    anomaly_count: int


class SeasonStat(BaseModel):
    """Season grouped anomaly counts."""

    season: str
    normal_count: int
    anomaly_count: int


class TopAnomaly(BaseModel):
    """Top anomaly days ordered by reconstruction score."""

    date: str
    score: float


class StatsResponse(BaseModel):
    """House-level statistical views for charts and diagnostics."""

    by_weekday: List[WeekdayStat]
    by_season: List[SeasonStat]
    score_distribution: Dict[str, List[float]]
    top10_anomalies: List[TopAnomaly]


class ComparisonRow(BaseModel):
    """Cross-house comparison row for dashboard ranking widgets."""

    house_id: int
    total_days: int
    anomalous_days: int
    anomaly_rate: float
    mean_score: float
