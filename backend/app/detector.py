import hashlib
import logging
import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Protocol

from PIL import Image

from .config import Settings


logger = logging.getLogger(__name__)


@dataclass
class Detection:
    label: str
    confidence: float
    box: list[float]
    polygon: list[list[float]]


class Detector(Protocol):
    name: str
    placeholder: bool
    weights_path: Path | None

    def detect(self, image: Image.Image) -> list[Detection]: ...


class PlaceholderDetector:
    """Synthetic stand-in until trained weights exist; not real pothole inference."""

    name = "placeholder"
    placeholder = True
    weights_path = None

    def __init__(self, every: int) -> None:
        if every < 1:
            raise ValueError("Placeholder cadence must be positive")
        self.every = every
        self._frames = 0
        self._lock = Lock()

    def detect(self, image: Image.Image) -> list[Detection]:
        with self._lock:
            self._frames += 1
            if self._frames % self.every:
                return []
        polygon = [
            [
                max(0.0, min(1.0, 0.5 + 0.34 * math.cos(2 * math.pi * i / 32))),
                max(0.0, min(1.0, 0.66 + 0.08 * math.sin(2 * math.pi * i / 32))),
            ]
            for i in range(32)
        ]
        digest = hashlib.sha256(image.tobytes()).digest()
        confidence = round(0.82 + int.from_bytes(digest[:8]) / (2**64 - 1) * 0.15, 2)
        return [
            Detection(
                label="pothole",
                confidence=confidence,
                box=[
                    min(point[0] for point in polygon),
                    min(point[1] for point in polygon),
                    max(point[0] for point in polygon),
                    max(point[1] for point in polygon),
                ],
                polygon=polygon,
            )
        ]


def detections_from_arrays(
    polygons,
    boxes,
    confidences,
    classes,
    names: Mapping[int, str] | Sequence[str],
) -> list[Detection]:
    """Convert normalized YOLO arrays to plain Python values, without importing ML."""
    detections = []
    for polygon, box, confidence, class_id in zip(
        polygons, boxes, confidences, classes, strict=True
    ):
        points = [[max(0.0, min(1.0, float(v))) for v in point] for point in polygon]
        if not points:
            continue
        detections.append(
            Detection(
                label=names[int(class_id)].lower(),
                confidence=float(confidence),
                box=[max(0.0, min(1.0, float(v))) for v in box],
                polygon=points,
            )
        )
    return detections


class YoloSegDetector:
    name = "yolo26s-seg"
    placeholder = False

    def __init__(self, weights_path: Path, threshold: float) -> None:
        from ultralytics import YOLO

        self.weights_path = weights_path
        self.threshold = threshold
        self.model = YOLO(str(weights_path))
        self._lock = Lock()

    def detect(self, image: Image.Image) -> list[Detection]:
        detections = []
        with self._lock:
            results = self.model.predict(image, conf=self.threshold, verbose=False)
        for result in results:
            if result.masks is None or result.boxes is None:
                continue
            detections.extend(
                detections_from_arrays(
                    result.masks.xyn,
                    result.boxes.xyxyn.cpu().tolist(),
                    result.boxes.conf.cpu().tolist(),
                    result.boxes.cls.cpu().tolist(),
                    result.names,
                )
            )
        return detections


def load_detector(settings: Settings) -> Detector:
    if settings.detector_mode == "placeholder":
        return PlaceholderDetector(settings.placeholder_every)
    if settings.weights_path.is_file():
        return YoloSegDetector(settings.weights_path, settings.conf_threshold)
    if settings.detector_mode == "yolo":
        raise RuntimeError(f"YOLO weights not found: {settings.weights_path}")
    logger.warning("Weights not found at %s; using placeholder", settings.weights_path)
    return PlaceholderDetector(settings.placeholder_every)
