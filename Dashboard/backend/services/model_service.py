"""Model loading and inference configuration services.

This module owns:
1. The exact LSTM autoencoder architecture expected by training artifacts.
2. Runtime loading for the model and house scalers.
3. A shared application state container used by routers/services.
"""

from __future__ import annotations

import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
import torch
import torch.nn as nn
import joblib


# Global inference configuration required by the scoring pipeline.
CFG: Dict[str, Any] = {
    "window_size": 30,
    "stride": 15,
    "hidden_size": 64,
    "num_layers": 2,
    "dropout": 0.3,
    "threshold_percentile": 90,
    "minutes_per_day": 1440,
    "min_day_coverage": 1152,
    "max_gap_fill_minutes": 30,
    "time_col": "Time",
    "aggregate_col": "Aggregate",
}


class LSTMEncoder(nn.Module):
    """Encoder that returns the final hidden state for each sequence."""

    def __init__(self, input_size: int, hidden_size: int, num_layers: int, dropout: float):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size,
            hidden_size,
            num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        _, (h_n, _) = self.lstm(x)
        return h_n[-1]


class LSTMDecoder(nn.Module):
    """Decoder that expands latent vectors back to full sequence length."""

    def __init__(
        self,
        hidden_size: int,
        output_size: int,
        seq_len: int,
        num_layers: int,
        dropout: float,
    ):
        super().__init__()
        self.seq_len = seq_len
        self.lstm = nn.LSTM(
            hidden_size,
            hidden_size,
            num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.fc = nn.Linear(hidden_size, output_size)

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(z.unsqueeze(1).repeat(1, self.seq_len, 1))
        return self.fc(out)


class LSTMAutoencoder(nn.Module):
    """Full LSTM autoencoder used for reconstruction-based anomaly scoring."""

    def __init__(
        self,
        input_size: int,
        hidden_size: int,
        seq_len: int,
        num_layers: int,
        dropout: float,
    ):
        super().__init__()
        self.encoder = LSTMEncoder(input_size, hidden_size, num_layers, dropout)
        self.decoder = LSTMDecoder(hidden_size, input_size, seq_len, num_layers, dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.decoder(self.encoder(x))


@dataclass
class ModelAssets:
    """Shared loaded assets held for the app lifetime."""

    model: nn.Module
    scalers: Any
    cfg: Dict[str, Any]
    thresholds: Dict[int, float]


def _resolve_project_root() -> Path:
    """Resolve repository root from backend/services directory."""

    return Path(__file__).resolve().parents[2]


def _resolve_runtime_path(path_value: str) -> Path:
    """Resolve file paths across local dev and containerized layouts.

    Supports both `backend/...` paths and backend-local paths depending
    on where the application is launched from.
    """

    raw = Path(path_value)
    if raw.is_absolute() and raw.exists():
        return raw

    candidates = [
        Path.cwd() / path_value,
        _resolve_project_root() / path_value,
        Path(__file__).resolve().parents[1] / path_value,
    ]

    # If path starts with "backend/", also try stripping that prefix.
    if path_value.startswith("backend/"):
        trimmed = path_value.split("backend/", 1)[1]
        candidates.extend(
            [
                Path.cwd() / trimmed,
                Path(__file__).resolve().parents[1] / trimmed,
            ]
        )

    for candidate in candidates:
        if candidate.exists():
            return candidate

    # Fall back to original path semantics for explicit downstream errors.
    return Path(path_value)


def _build_model_from_cfg(cfg: Dict[str, Any]) -> LSTMAutoencoder:
    """Build an uninitialized model that matches the training architecture."""

    return LSTMAutoencoder(
        input_size=1,
        hidden_size=cfg["hidden_size"],
        seq_len=cfg["window_size"],
        num_layers=cfg["num_layers"],
        dropout=cfg["dropout"],
    )


def _load_checkpoint_into_model(model: nn.Module, checkpoint: Any) -> nn.Module:
    """Load either a full model object or a state_dict-style checkpoint."""

    if isinstance(checkpoint, nn.Module):
        checkpoint.eval()
        return checkpoint

    # Most training scripts save either a pure state_dict or a dict wrapper.
    if isinstance(checkpoint, dict):
        if "state_dict" in checkpoint and isinstance(checkpoint["state_dict"], dict):
            model.load_state_dict(checkpoint["state_dict"], strict=False)
        else:
            # If the dict itself is a state_dict, this also works.
            model.load_state_dict(checkpoint, strict=False)

    model.eval()
    return model


def load_assets(
    model_path: str = "backend/model/lstm_autoencoder_model.pth",
    scaler_path: str = "backend/model/scaler (1).pkl",
    cfg: Optional[Dict[str, Any]] = None,
) -> ModelAssets:
    """Load model and scalers from disk with CPU-safe inference defaults.

    Required runtime loading conventions (as requested):
    - torch.load("backend/model/lstm_autoencoder_model.pth", map_location="cpu")
    - pickle.load(open("backend/model/scaler (1).pkl", "rb"))
    """

    final_cfg = cfg or CFG.copy()
    model_file = _resolve_runtime_path(model_path)
    scaler_file = _resolve_runtime_path(scaler_path)

    raw_checkpoint = torch.load(str(model_file), map_location="cpu")
    scalers = joblib.load(scaler_path)


    model = _build_model_from_cfg(final_cfg)
    model = _load_checkpoint_into_model(model, raw_checkpoint)

    return ModelAssets(model=model, scalers=scalers, cfg=final_cfg, thresholds={})


def compute_percentile_threshold(scores: np.ndarray, percentile: float) -> float:
    """Utility to compute stable percentile thresholds from non-empty scores."""

    if scores.size == 0:
        return 0.0
    return float(np.percentile(scores, percentile))
