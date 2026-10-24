import math
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal


BACKEND_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_WEIGHTS = (
    BACKEND_ROOT.parent / "training-results" / "models" / "yolo26s-seg-combined_20261023-1437.pt"
)


@dataclass(frozen=True)
class Settings:
    data_dir: Path = BACKEND_ROOT / "data"
    weights_path: Path = DEFAULT_WEIGHTS
    conf_threshold: float = 0.5
    detector_mode: Literal["auto", "placeholder", "yolo"] = "auto"
    placeholder_every: int = 20
    captures_dir: Path = field(init=False)
    db_path: Path = field(init=False)

    def __post_init__(self) -> None:
        if self.detector_mode not in {"auto", "placeholder", "yolo"}:
            raise ValueError("BANTAYLUBAK_DETECTOR must be auto, placeholder, or yolo")
        if not math.isfinite(self.conf_threshold) or not 0 <= self.conf_threshold <= 1:
            raise ValueError("BANTAYLUBAK_CONF must be between 0 and 1")
        if self.placeholder_every < 1:
            raise ValueError("BANTAYLUBAK_PLACEHOLDER_EVERY must be positive")
        object.__setattr__(self, "captures_dir", self.data_dir / "captures")
        object.__setattr__(self, "db_path", self.data_dir / "bantaylubak.db")


def get_settings() -> Settings:
    return Settings(
        data_dir=Path(os.environ.get("BANTAYLUBAK_DATA_DIR", BACKEND_ROOT / "data"))
        .expanduser()
        .resolve(),
        weights_path=Path(os.environ.get("BANTAYLUBAK_WEIGHTS", DEFAULT_WEIGHTS))
        .expanduser()
        .resolve(),
        conf_threshold=float(os.environ.get("BANTAYLUBAK_CONF", "0.5")),
        detector_mode=os.environ.get("BANTAYLUBAK_DETECTOR", "auto"),
        placeholder_every=int(os.environ.get("BANTAYLUBAK_PLACEHOLDER_EVERY", "20")),
    )
