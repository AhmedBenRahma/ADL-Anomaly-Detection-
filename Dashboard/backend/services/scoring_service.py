"""Scoring pipeline for daily anomaly detection.

Implements the requested process:
- 1-minute resampling
- day coverage filtering
- gap filling
- robust scaling + clipping
- sliding-window reconstruction scoring (MSE)
- day-level score as max window score
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple

import numpy as np
import pandas as pd
import torch

from services.model_service import compute_percentile_threshold


@dataclass
class WindowResult:
    """Per-window reconstruction error details."""

    start_minute: int
    end_minute: int
    score: float


@dataclass
class DayResult:
    """Complete daily scoring artifact used by API layers."""

    date: str
    score: float
    is_anomaly: bool
    threshold: float
    consumption_mean: float
    original_signal: List[float]
    reconstructed_signal: List[float]
    window_scores: List[WindowResult]
    hourly_errors: List[float]


def resolve_house_scaler(scalers: Any, house_idx: int) -> Any:
    """Resolve a house-specific scaler from multiple possible pickle structures."""

    if isinstance(scalers, dict):
        for key in (house_idx, str(house_idx), f"house_{house_idx}", f"House{house_idx}"):
            if key in scalers:
                return scalers[key]

        # Fallback: if no direct key exists, use first value deterministically.
        first_key = next(iter(scalers))
        return scalers[first_key]

    if isinstance(scalers, (list, tuple)):
        # Typical list layout is [house1_scaler, house2_scaler, ...].
        idx = max(0, house_idx - 1)
        if idx < len(scalers):
            return scalers[idx]
        return scalers[0]

    # Single scaler fallback.
    return scalers


def _build_day_index(day: pd.Timestamp, minutes_per_day: int) -> pd.DatetimeIndex:
    """Build an exact 1440-point index for robust daily slicing."""

    start = day.normalize()
    return pd.date_range(start=start, periods=minutes_per_day, freq="min")


def _to_windows(
    values: np.ndarray,
    window_size: int,
    stride: int,
) -> Tuple[np.ndarray, List[Tuple[int, int]]]:
    """Create [N, window_size, 1] window tensor input and coordinate mapping."""

    windows: List[np.ndarray] = []
    spans: List[Tuple[int, int]] = []
    end = len(values) - window_size + 1
    for start in range(0, max(0, end), stride):
        stop = start + window_size
        windows.append(values[start:stop])
        spans.append((start, stop - 1))

    if not windows:
        return np.empty((0, window_size, 1), dtype=np.float32), spans

    arr = np.asarray(windows, dtype=np.float32)[..., np.newaxis]
    return arr, spans


def _run_model_mse(model: torch.nn.Module, windows: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """Run model inference and return per-window MSE + reconstructed windows."""

    if windows.size == 0:
        return np.array([], dtype=np.float32), np.empty_like(windows)

    with torch.no_grad():
        x = torch.from_numpy(windows)
        recon = model(x).detach().cpu().numpy()

    mse = ((windows - recon) ** 2).mean(axis=(1, 2)).astype(np.float32)
    return mse, recon


def _merge_reconstruction(
    recon_windows: np.ndarray,
    spans: Sequence[Tuple[int, int]],
    day_length: int,
) -> np.ndarray:
    """Merge overlapping window reconstructions back into a full day signal."""

    if recon_windows.size == 0:
        return np.zeros(day_length, dtype=np.float32)

    acc = np.zeros(day_length, dtype=np.float32)
    cnt = np.zeros(day_length, dtype=np.float32)

    for idx, (start, end) in enumerate(spans):
        seg = recon_windows[idx, :, 0]
        acc[start : end + 1] += seg
        cnt[start : end + 1] += 1.0

    cnt[cnt == 0] = 1.0
    return acc / cnt


def _infer_season(ts: pd.Timestamp) -> str:
    """Convert month to climatological season label."""

    m = ts.month
    if m in (12, 1, 2):
        return "winter"
    if m in (3, 4, 5):
        return "spring"
    if m in (6, 7, 8):
        return "summer"
    return "autumn"


def infer_severity(score: float, threshold: float) -> str:
    """Severity buckets based on percentage above threshold."""

    if threshold <= 0:
        return "moderate"

    excess_pct = ((score - threshold) / threshold) * 100.0
    if excess_pct >= 100:
        return "critical"
    if excess_pct >= 40:
        return "high"
    return "moderate"


def score_house(csv_path: str, house_idx: int, model: torch.nn.Module, scaler: Any, cfg: Dict[str, Any]) -> List[DayResult]:
    """Score daily anomalies for one house based on sliding-window reconstruction MSE.

    Steps implemented exactly as required:
    1) Parse time and index by datetime.
    2) Resample to 1 minute using mean.
    3) Keep days with minimum valid coverage.
    4) Fill short gaps, scale, clip, window, reconstruct, and score.
    5) Daily score is max window MSE.
    6) Threshold is per-house percentile over daily scores.
    """

    df = pd.read_csv(csv_path)
    time_col = cfg["time_col"]
    agg_col = cfg["aggregate_col"]

    # Parse and normalize source stream to 1-minute granularity.
    df[time_col] = pd.to_datetime(df[time_col], errors="coerce")
    df = df.dropna(subset=[time_col]).set_index(time_col).sort_index()
    one_min = df[[agg_col]].resample("1min").mean()

    minutes_per_day = int(cfg["minutes_per_day"])
    min_day_coverage = int(cfg["min_day_coverage"])
    max_gap_fill_minutes = int(cfg["max_gap_fill_minutes"])
    window_size = int(cfg["window_size"])
    stride = int(cfg["stride"])

    day_records: List[Dict[str, Any]] = []

    # Iterate by calendar day and keep only days with sufficient raw coverage.
    for day, day_frame in one_min.groupby(one_min.index.normalize()):
        day_idx = _build_day_index(day, minutes_per_day)
        day_series = day_frame[agg_col].reindex(day_idx)
        valid_count = int(day_series.notna().sum())

        if valid_count < min_day_coverage:
            continue

        # Fill only short missing segments, then hard-fill remaining gaps to zero.
        day_filled = day_series.ffill(limit=max_gap_fill_minutes).fillna(0.0)
        original_signal = day_filled.to_numpy(dtype=np.float32)
        consumption_mean = float(np.mean(original_signal))

        # Apply house-level robust scaling, then clip to avoid unstable extremes.
        scaled = scaler.transform(original_signal.reshape(1, -1)).reshape(-1)
        scaled = np.clip(scaled, -3.0, 3.0).astype(np.float32)

        windows, spans = _to_windows(scaled, window_size=window_size, stride=stride)
        mse_scores, recon_windows = _run_model_mse(model, windows)

        if mse_scores.size == 0:
            continue

        daily_score = float(np.max(mse_scores))

        merged_recon_scaled = _merge_reconstruction(recon_windows, spans, minutes_per_day)
        reconstructed_signal = scaler.inverse_transform(merged_recon_scaled.reshape(1, -1)).reshape(-1)
        errors = np.abs(original_signal - reconstructed_signal)
        hourly_errors = (
            errors[: minutes_per_day]
            .reshape(24, 60)
            .mean(axis=1)
            .astype(np.float32)
            .tolist()
        )

        window_results: List[WindowResult] = []
        for idx, (start_min, end_min) in enumerate(spans):
            window_results.append(
                WindowResult(
                    start_minute=int(start_min),
                    end_minute=int(end_min),
                    score=float(mse_scores[idx]),
                )
            )

        day_records.append(
            {
                "date": pd.Timestamp(day).strftime("%Y-%m-%d"),
                "score": daily_score,
                "consumption_mean": consumption_mean,
                "original_signal": original_signal.astype(float).tolist(),
                "reconstructed_signal": reconstructed_signal.astype(float).tolist(),
                "window_scores": window_results,
                "hourly_errors": [float(v) for v in hourly_errors],
                "day_ts": pd.Timestamp(day),
            }
        )

    # Compute house-level threshold from all available daily scores.
    all_scores = np.array([r["score"] for r in day_records], dtype=np.float32)
    threshold = compute_percentile_threshold(all_scores, float(cfg["threshold_percentile"]))

    results: List[DayResult] = []
    for rec in day_records:
        is_anomaly = bool(rec["score"] > threshold)
        results.append(
            DayResult(
                date=rec["date"],
                score=float(rec["score"]),
                is_anomaly=is_anomaly,
                threshold=threshold,
                consumption_mean=float(rec["consumption_mean"]),
                original_signal=rec["original_signal"],
                reconstructed_signal=rec["reconstructed_signal"],
                window_scores=rec["window_scores"],
                hourly_errors=rec["hourly_errors"],
            )
        )

    return results


def day_of_week(date_str: str) -> str:
    """Human-readable weekday name from ISO date."""

    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return dt.strftime("%A")


def season_of_date(date_str: str) -> str:
    """Season helper from ISO date string."""

    return _infer_season(pd.Timestamp(date_str))


def excess_percentage(score: float, threshold: float) -> float:
    """Relative excess over threshold in percent."""

    if threshold <= 0:
        return 0.0
    return float(((score - threshold) / threshold) * 100.0)
