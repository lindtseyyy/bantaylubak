import json
import logging
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from time import perf_counter
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from pydantic import TypeAdapter, ValidationError

from . import db
from .config import get_settings
from .detector import load_detector
from .schemas import Box, DetectResponse, DetectorInfo, EventList, EventOut, Health, Polygon


VERSION = "0.1.0"
logger = logging.getLogger(__name__)
polygon_adapter = TypeAdapter(Polygon)
box_adapter = TypeAdapter(Box)


def decode_frame(frame: UploadFile) -> Image.Image:
    try:
        with Image.open(frame.file) as image:
            return image.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=400, detail="Frame is not a decodable image") from exc


def event_out(row: sqlite3.Row) -> EventOut:
    image_file = row["image_file"]
    return EventOut(
        id=row["id"],
        code=f"BL-{row['id']:04d}",
        label=row["label"],
        confidence=row["confidence"],
        created_at=row["created_at"],
        image_url=f"/media/captures/{image_file}",
        image_path=f"data/captures/{image_file}",
        polygon=json.loads(row["polygon"]),
        box=json.loads(row["box"]),
        detector=row["detector"],
    )


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        settings.captures_dir.mkdir(parents=True, exist_ok=True)
        db.init_db(settings.db_path)
        app.state.detector = load_detector(settings)
        yield

    app = FastAPI(title="BantayLubak", version=VERSION, lifespan=lifespan)
    app.state.settings = settings
    app.mount(
        "/media/captures",
        StaticFiles(directory=settings.captures_dir, check_dir=False),
        name="captures",
    )

    @app.get("/api/health", response_model=Health)
    def health() -> Health:
        detector = app.state.detector
        return Health(
            status="ok",
            version=VERSION,
            detector=DetectorInfo(
                name=detector.name,
                placeholder=detector.placeholder,
                weights_path=str(detector.weights_path) if detector.weights_path else None,
            ),
            confidence_threshold=settings.conf_threshold,
        )

    @app.post("/api/detect", response_model=DetectResponse)
    def detect(frame: Annotated[UploadFile, File()]) -> DetectResponse:
        with decode_frame(frame) as image:
            started = perf_counter()
            detections = app.state.detector.detect(image)
            inference_ms = (perf_counter() - started) * 1000
            detections = sorted(
                (d for d in detections if d.confidence >= settings.conf_threshold),
                key=lambda d: d.confidence,
                reverse=True,
            )
            return DetectResponse(
                detections=detections,
                inference_ms=inference_ms,
                frame_width=image.width,
                frame_height=image.height,
                detector=app.state.detector.name,
            )

    @app.post("/api/events", status_code=201, response_model=EventOut)
    def create_event(
        frame: Annotated[UploadFile, File()],
        confidence: Annotated[float, Form(ge=0, le=1, allow_inf_nan=False)],
        polygon: Annotated[str, Form()],
        box: Annotated[str, Form()],
        detector: Annotated[str, Form()],
        label: Annotated[str, Form()] = "pothole",
    ) -> EventOut:
        try:
            parsed_polygon = polygon_adapter.validate_json(polygon)
            parsed_box = box_adapter.validate_json(box)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail="Invalid polygon or box JSON") from exc

        with decode_frame(frame) as image:
            event_id = db.insert_event(
                settings.db_path,
                created_at=datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
                label=label,
                confidence=confidence,
                polygon=parsed_polygon,
                box=parsed_box,
                detector=detector,
            )
            image_file = f"BL-{event_id:04d}.jpg"
            image_path = settings.captures_dir / image_file
            try:
                image.save(image_path, format="JPEG", quality=90)
                db.set_image_file(settings.db_path, event_id, image_file)
            except (OSError, sqlite3.Error) as exc:
                db.delete_event(settings.db_path, event_id)
                image_path.unlink(missing_ok=True)
                logger.exception("Could not save event %s", event_id)
                raise HTTPException(status_code=500, detail="Could not save event") from exc
        return event_out(db.get_event(settings.db_path, event_id))

    @app.get("/api/events", response_model=EventList)
    def list_events(
        limit: Annotated[int, Query(ge=0, le=200)] = 50,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> EventList:
        return EventList(
            total=db.count_events(settings.db_path),
            items=[event_out(row) for row in db.list_events(settings.db_path, limit, offset)],
        )

    @app.get("/api/events/{event_id}", response_model=EventOut)
    def get_event(event_id: int) -> EventOut:
        row = db.get_event(settings.db_path, event_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Event not found")
        return event_out(row)

    @app.delete("/api/events/{event_id}", status_code=204)
    def delete_event(event_id: int) -> Response:
        row = db.get_event(settings.db_path, event_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Event not found")
        db.delete_event(settings.db_path, event_id)
        (settings.captures_dir / row["image_file"]).unlink(missing_ok=True)
        return Response(status_code=204)

    return app


app = create_app()
