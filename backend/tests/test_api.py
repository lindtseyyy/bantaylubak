import json
import re
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.detector import PlaceholderDetector, detections_from_arrays, load_detector
from app.main import create_app


@pytest.fixture
def frame() -> bytes:
    output = BytesIO()
    with Image.new("RGB", (80, 60), color=(43, 55, 61)) as image:
        image.save(output, format="PNG")
    return output.getvalue()


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("BANTAYLUBAK_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("BANTAYLUBAK_DETECTOR", "placeholder")
    monkeypatch.setenv("BANTAYLUBAK_PLACEHOLDER_EVERY", "3")
    monkeypatch.setenv("BANTAYLUBAK_CONF", "0.5")
    with TestClient(create_app()) as client:
        yield client


def event_fields(**overrides) -> dict:
    return {
        "confidence": "0.94",
        "polygon": json.dumps([[0.2, 0.6], [0.8, 0.6], [0.5, 0.8]]),
        "box": json.dumps([0.2, 0.6, 0.8, 0.8]),
        "detector": "placeholder",
        **overrides,
    }


def save_event(client, frame, **overrides):
    return client.post(
        "/api/events",
        data=event_fields(**overrides),
        files={"frame": ("frame.png", frame, "image/png")},
    )


def test_health_reports_placeholder(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == "0.1.0"
    assert body["detector"] == {
        "name": "placeholder",
        "placeholder": True,
        "weights_path": None,
    }
    assert body["confidence_threshold"] == 0.5


def test_detect_cadence_and_normalized_polygon(client, frame):
    for _ in range(2):
        response = client.post("/api/detect", files={"frame": ("frame.png", frame, "image/png")})
        assert response.status_code == 200
        assert response.json()["detections"] == []

    response = client.post("/api/detect", files={"frame": ("frame.png", frame, "image/png")})
    assert response.status_code == 200
    body = response.json()
    assert body["detector"] == "placeholder"
    assert (body["frame_width"], body["frame_height"]) == (80, 60)
    assert body["inference_ms"] >= 0
    assert len(body["detections"]) == 1
    detection = body["detections"][0]
    assert detection["label"] == "pothole"
    assert 0.82 <= detection["confidence"] <= 0.97
    assert len(detection["polygon"]) == 32
    assert all(0 <= coordinate <= 1 for point in detection["polygon"] for coordinate in point)
    xs, ys = zip(*detection["polygon"])
    assert detection["box"] == [min(xs), min(ys), max(xs), max(ys)]
    assert detection["box"] == pytest.approx([0.16, 0.58, 0.84, 0.74])


def test_detect_rejects_non_image(client):
    response = client.post("/api/detect", files={"frame": ("bad.jpg", b"not an image", "image/jpeg")})
    assert response.status_code == 400


def test_save_get_list_and_capture_image(client, frame):
    response = save_event(client, frame)
    assert response.status_code == 201
    first = response.json()
    assert first["id"] == 1
    assert first["code"] == "BL-0001"
    assert first["label"] == "pothole"
    assert first["confidence"] == 0.94
    assert first["detector"] == "placeholder"
    assert first["polygon"] == json.loads(event_fields()["polygon"])
    assert first["box"] == json.loads(event_fields()["box"])
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", first["created_at"])
    assert first["image_url"] == "/media/captures/BL-0001.jpg"
    assert first["image_path"] == "data/captures/BL-0001.jpg"
    assert client.get(f"/api/events/{first['id']}").json() == first

    image_response = client.get(first["image_url"])
    assert image_response.status_code == 200
    assert image_response.headers["content-type"] == "image/jpeg"
    with Image.open(BytesIO(image_response.content)) as saved:
        assert saved.format == "JPEG"
        assert saved.size == (80, 60)

    second_response = save_event(client, frame, confidence="0.88")
    assert second_response.status_code == 201
    second = second_response.json()
    assert second["code"] == "BL-0002"
    listing = client.get("/api/events").json()
    assert listing == {"total": 2, "items": [second, first]}
    assert client.get("/api/events?limit=1&offset=1").json() == {"total": 2, "items": [first]}
    assert client.get("/api/events?limit=0").json() == {"total": 2, "items": []}


@pytest.mark.parametrize("capture_missing", [False, True])
def test_delete_event_removes_record_and_capture(client, frame, tmp_path, capture_missing):
    response = save_event(client, frame)
    assert response.status_code == 201
    event = response.json()
    remaining = save_event(client, frame).json()
    assert client.get("/api/events?limit=0").json()["total"] == 2
    assert client.get(event["image_url"]).status_code == 200
    if capture_missing:
        (tmp_path / "captures" / f"{event['code']}.jpg").unlink()

    response = client.delete(f"/api/events/{event['id']}")
    assert response.status_code == 204
    assert response.content == b""
    response = client.get(f"/api/events/{event['id']}")
    assert response.status_code == 404
    assert response.json() == {"detail": "Event not found"}
    assert client.get("/api/events").json() == {"total": 1, "items": [remaining]}
    assert client.get(event["image_url"]).status_code == 404
    assert client.get(remaining["image_url"]).status_code == 200

    response = client.delete(f"/api/events/{event['id']}")
    assert response.status_code == 404
    assert response.json() == {"detail": "Event not found"}
    assert client.get("/api/events").json() == {"total": 1, "items": [remaining]}


def test_unknown_event_returns_404(client):
    assert client.get("/api/events/9999").status_code == 404


def test_media_does_not_expose_database(client):
    assert client.get("/media/bantaylubak.db").status_code == 404
    assert client.get("/media/captures/../bantaylubak.db").status_code == 404


@pytest.mark.parametrize(
    "overrides",
    [
        {"confidence": "-0.1"},
        {"confidence": "1.1"},
        {"confidence": "nan"},
        {"polygon": "not-json"},
        {"polygon": "null"},
        {"polygon": '{"x":0.5,"y":0.6}'},
        {"polygon": "[[0.1]]"},
        {"polygon": '[["0.1",0.2]]'},
        {"polygon": "[[true,0.2]]"},
        {"polygon": "[[0.1,1.2]]"},
        {"box": "[0,0,1]"},
        {"box": "[0,0,1,1,1]"},
        {"box": "[0,0,1,NaN]"},
        {"box": '"box"'},
    ],
)
def test_bad_event_input_returns_422_without_saving(client, frame, overrides):
    assert save_event(client, frame, **overrides).status_code == 422
    assert client.get("/api/events").json() == {"total": 0, "items": []}


def test_save_rejects_non_image_without_saving(client):
    assert save_event(client, b"not an image").status_code == 400
    assert client.get("/api/events").json() == {"total": 0, "items": []}


@pytest.mark.parametrize("query", ["limit=-1", "limit=201", "offset=-1"])
def test_invalid_pagination_returns_422(client, query):
    assert client.get(f"/api/events?{query}").status_code == 422


def test_threshold_filters_placeholder(monkeypatch, tmp_path, frame):
    monkeypatch.setenv("BANTAYLUBAK_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("BANTAYLUBAK_DETECTOR", "placeholder")
    monkeypatch.setenv("BANTAYLUBAK_PLACEHOLDER_EVERY", "1")
    monkeypatch.setenv("BANTAYLUBAK_CONF", "1")
    with TestClient(create_app()) as client:
        response = client.post("/api/detect", files={"frame": ("frame.png", frame, "image/png")})
        assert response.status_code == 200
        assert response.json()["detections"] == []


def test_yolo_raw_array_conversion():
    detections = detections_from_arrays(
        polygons=[[[0.1, 0.2], [0.8, 0.2], [1.01, -0.01]], [[0, 0], [1, 0], [1, 1]]],
        boxes=[[0.1, 0.2, 1.01, 1], [0, 0, 1, 1]],
        confidences=[0.93, 0.87],
        classes=[1.0, 0.0],
        names={0: "Road", 1: "POTHOLE"},
    )
    assert len(detections) == 2
    assert detections[0].label == "pothole"
    assert detections[0].confidence == 0.93
    assert detections[0].box == [0.1, 0.2, 1.0, 1.0]
    assert detections[0].polygon == [[0.1, 0.2], [0.8, 0.2], [1.0, 0.0]]
    assert detections[1].label == "road"
    assert detections_from_arrays([], [], [], [], {}) == []


def test_placeholder_is_deterministic_and_thread_safe():
    detector = PlaceholderDetector(every=3)
    with Image.new("RGB", (4, 4)) as image, ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: detector.detect(image), range(30)))
    detections = [result[0] for result in results if result]
    assert len(detections) == 10
    assert all(detection == detections[0] for detection in detections)


def test_missing_weights_fall_back_or_fail_when_required(tmp_path):
    weights = tmp_path / "missing.pt"
    assert load_detector(Settings(weights_path=weights, detector_mode="auto")).placeholder is True
    with pytest.raises(RuntimeError, match="weights not found"):
        load_detector(Settings(weights_path=weights, detector_mode="yolo"))
