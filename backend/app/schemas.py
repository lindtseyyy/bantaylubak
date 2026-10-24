from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


Coordinate = Annotated[float, Field(strict=True, ge=0, le=1, allow_inf_nan=False)]
Polygon = list[tuple[Coordinate, Coordinate]]
Box = tuple[Coordinate, Coordinate, Coordinate, Coordinate]


class DetectorInfo(BaseModel):
    name: Literal["placeholder", "yolo26s-seg"]
    placeholder: bool
    weights_path: str | None


class Health(BaseModel):
    status: Literal["ok"]
    version: str
    detector: DetectorInfo
    confidence_threshold: float


class DetectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    label: str
    confidence: Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
    box: Box
    polygon: Polygon


class DetectResponse(BaseModel):
    detections: list[DetectionOut]
    inference_ms: float
    frame_width: int
    frame_height: int
    detector: str


class EventOut(DetectionOut):
    id: int
    code: str
    created_at: str
    image_url: str
    image_path: str
    detector: str


class EventList(BaseModel):
    total: int
    items: list[EventOut]
