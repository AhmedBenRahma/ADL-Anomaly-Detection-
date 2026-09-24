"""Data orchestration service for house-level anomaly analytics.

This service preloads house CSV files, computes scores once at startup,
and exposes query-focused methods for API routers.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

from schemas.responses import (
    AnomalyItem,
    ComparisonRow,
    DaySummary,
    HouseMeta,
    HouseSummaryResponse,
    StatsResponse,
    TopAnomaly,
    WeekdayStat,
    SeasonStat,
    WindowScore,
)
from services.model_service import ModelAssets
from services.scoring_service import (
    DayResult,
    day_of_week,
    excess_percentage,
    infer_severity,
    resolve_house_scaler,
    score_house,
    season_of_date,
)


@dataclass
class HouseCache:
    """In-memory cache entry for one house."""

    house_id: int
    name: str
    file_name: str
    csv_path: str
    results: List[DayResult]


class DataService:
    """Repository-like service that provides all API-facing data views."""

    def __init__(self, assets: ModelAssets, data_dir: str = "backend/data"):
        self.assets = assets
        self.data_dir = data_dir
        self._houses: Dict[int, HouseCache] = {}

    def _resolve_data_root(self) -> Path:
        """Resolve data folder across local dev and container layouts."""

        candidates = [
            Path.cwd() / self.data_dir,
            Path(__file__).resolve().parents[2] / self.data_dir,
            Path(__file__).resolve().parents[1] / self.data_dir,
        ]

        if self.data_dir.startswith("backend/"):
            trimmed = self.data_dir.split("backend/", 1)[1]
            candidates.extend(
                [
                    Path.cwd() / trimmed,
                    Path(__file__).resolve().parents[1] / trimmed,
                ]
            )

        for root in candidates:
            if root.exists():
                return root

        return Path.cwd() / self.data_dir

    def preload(self) -> None:
        """Load and score all available house files at startup."""

        data_root = self._resolve_data_root()
        csv_files = sorted(data_root.glob("CLEAN_House*.csv"))

        for csv_file in csv_files:
            match = re.search(r"House(\d+)", csv_file.name, flags=re.IGNORECASE)
            if not match:
                continue

            house_id = int(match.group(1))
            scaler = resolve_house_scaler(self.assets.scalers, house_id)
            results = score_house(
                csv_path=str(csv_file),
                house_idx=house_id,
                model=self.assets.model,
                scaler=scaler,
                cfg=self.assets.cfg,
            )

            self._houses[house_id] = HouseCache(
                house_id=house_id,
                name=f"House {house_id}",
                file_name=csv_file.name,
                csv_path=str(csv_file),
                results=results,
            )

            # Persist house threshold for downstream logic.
            if results:
                self.assets.thresholds[house_id] = float(results[0].threshold)
            else:
                self.assets.thresholds[house_id] = 0.0

    def _require_house(self, house_id: int) -> HouseCache:
        """Return house cache or raise a descriptive key error."""

        if house_id not in self._houses:
            raise KeyError(f"House {house_id} was not found or not loaded")
        return self._houses[house_id]

    def get_houses(self) -> List[HouseMeta]:
        """Return available houses with metadata."""

        rows: List[HouseMeta] = []
        for house_id in sorted(self._houses):
            entry = self._houses[house_id]
            rows.append(
                HouseMeta(
                    house_id=entry.house_id,
                    name=entry.name,
                    file_name=entry.file_name,
                    available_days=len(entry.results),
                )
            )
        return rows

    def get_house_summary(self, house_id: int) -> HouseSummaryResponse:
        """Aggregate KPI and timeline metrics for one house."""

        entry = self._require_house(house_id)
        total_days = len(entry.results)
        anomalous_days = sum(1 for r in entry.results if r.is_anomaly)
        normal_days = total_days - anomalous_days
        anomaly_rate = (anomalous_days / total_days * 100.0) if total_days else 0.0
        mean_score = sum(r.score for r in entry.results) / total_days if total_days else 0.0
        threshold = self.assets.thresholds.get(house_id, 0.0)

        timeline = [
            DaySummary(
                date=r.date,
                score=float(r.score),
                is_anomaly=bool(r.is_anomaly),
                consumption_mean=float(r.consumption_mean),
            )
            for r in entry.results
        ]

        return HouseSummaryResponse(
            house_id=house_id,
            total_days=total_days,
            normal_days=normal_days,
            anomalous_days=anomalous_days,
            anomaly_rate=float(anomaly_rate),
            mean_score=float(mean_score),
            threshold=float(threshold),
            timeline=timeline,
        )

    def get_anomalies(
        self,
        house_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        severity: Optional[str] = None,
        season: Optional[str] = None,
        day_name: Optional[str] = None,
    ) -> List[AnomalyItem]:
        """Filter anomaly list by optional date/severity/season/weekday criteria."""

        entry = self._require_house(house_id)
        threshold = self.assets.thresholds.get(house_id, 0.0)
        rows: List[AnomalyItem] = []

        for r in entry.results:
            if not r.is_anomaly:
                continue

            d = date.fromisoformat(r.date)
            dow = day_of_week(r.date)
            seas = season_of_date(r.date)
            excess_pct = excess_percentage(r.score, threshold)
            sev = infer_severity(r.score, threshold)

            if start_date and d < start_date:
                continue
            if end_date and d > end_date:
                continue
            if severity and sev != severity:
                continue
            if season and seas.lower() != season.lower():
                continue
            if day_name and dow.lower() != day_name.lower():
                continue

            rows.append(
                AnomalyItem(
                    date=r.date,
                    score=float(r.score),
                    threshold=float(threshold),
                    excess_pct=float(excess_pct),
                    severity=sev,  # type: ignore[arg-type]
                    day_of_week=dow,
                    season=seas,
                )
            )

        # Show strongest anomalies first for operational relevance.
        rows.sort(key=lambda x: x.score, reverse=True)
        return rows

    def get_day_detail(self, house_id: int, target_date: str) -> Dict[str, Any]:
        """Return full signal-level detail for a specific house/day pair."""

        entry = self._require_house(house_id)
        threshold = self.assets.thresholds.get(house_id, 0.0)

        for r in entry.results:
            if r.date != target_date:
                continue

            win_scores = [
                WindowScore(
                    start_minute=w.start_minute,
                    end_minute=w.end_minute,
                    score=float(w.score),
                    is_anomaly=bool(w.score > threshold),
                )
                for w in r.window_scores
            ]

            return {
                "date": r.date,
                "score": float(r.score),
                "is_anomaly": bool(r.is_anomaly),
                "threshold": float(threshold),
                "original_signal": [float(v) for v in r.original_signal],
                "reconstructed_signal": [float(v) for v in r.reconstructed_signal],
                "window_scores": [ws.model_dump() for ws in win_scores],
                "hourly_errors": [float(v) for v in r.hourly_errors],
            }

        raise KeyError(f"No scored day found for date={target_date} in house {house_id}")

    def get_stats(self, house_id: int) -> StatsResponse:
        """Return grouped stats and distributions for dashboard analytics charts."""

        entry = self._require_house(house_id)

        weekday_order = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ]
        season_order = ["winter", "spring", "summer", "autumn"]

        weekday_map: Dict[str, Dict[str, int]] = {
            day: {"normal": 0, "anomaly": 0} for day in weekday_order
        }
        season_map: Dict[str, Dict[str, int]] = {
            s: {"normal": 0, "anomaly": 0} for s in season_order
        }

        normal_scores: List[float] = []
        anomalous_scores: List[float] = []

        for r in entry.results:
            dow = day_of_week(r.date)
            seas = season_of_date(r.date)
            key = "anomaly" if r.is_anomaly else "normal"

            weekday_map[dow][key] += 1
            season_map[seas][key] += 1

            if r.is_anomaly:
                anomalous_scores.append(float(r.score))
            else:
                normal_scores.append(float(r.score))

        by_weekday = [
            WeekdayStat(
                day=day,
                normal_count=weekday_map[day]["normal"],
                anomaly_count=weekday_map[day]["anomaly"],
            )
            for day in weekday_order
        ]

        by_season = [
            SeasonStat(
                season=s,
                normal_count=season_map[s]["normal"],
                anomaly_count=season_map[s]["anomaly"],
            )
            for s in season_order
        ]

        top = sorted(entry.results, key=lambda r: r.score, reverse=True)[:10]
        top10 = [TopAnomaly(date=r.date, score=float(r.score)) for r in top]

        return StatsResponse(
            by_weekday=by_weekday,
            by_season=by_season,
            score_distribution={
                "normal": normal_scores,
                "anomalous": anomalous_scores,
            },
            top10_anomalies=top10,
        )

    def get_comparison(self) -> List[ComparisonRow]:
        """Return lightweight summary table across all loaded houses."""

        rows: List[ComparisonRow] = []
        for house_id in sorted(self._houses):
            summary = self.get_house_summary(house_id)
            rows.append(
                ComparisonRow(
                    house_id=house_id,
                    total_days=summary.total_days,
                    anomalous_days=summary.anomalous_days,
                    anomaly_rate=summary.anomaly_rate,
                    mean_score=summary.mean_score,
                )
            )
        return rows
