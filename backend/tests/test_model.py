"""Trained YOLO26s-seg weights served through the API (skipped when weights are absent)."""

from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import get_settings
from app.main import create_app

FIXTURE = Path(__file__).parent / "fixtures" / "pothole_test_split.jpg"  # held-out test split image

pytestmark = pytest.mark.skipif(
    not get_settings().weights_path.is_file(), reason="trained weights not installed"
)


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("BANTAYLUBAK_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("BANTAYLUBAK_DETECTOR", "yolo")
    with TestClient(create_app()) as test_client:
        yield test_client


def detect(client, data: bytes):
    response = client.post("/api/detect", files={"frame": ("frame.jpg", data, "image/jpeg")})
    assert response.status_code == 200
    return response.json()


def test_health_reports_trained_model(client):
    detector = client.get("/api/health").json()["detector"]
    assert detector == {
        "name": "yolo26s-seg",
        "placeholder": False,
        "weights_path": str(get_settings().weights_path),
    }


def test_detects_pothole_with_normalized_segmentation(client):
    body = detect(client, FIXTURE.read_bytes())
    assert body["detector"] == "yolo26s-seg"
    assert body["detections"], "expected a pothole in the held-out test image"
    confidences = [d["confidence"] for d in body["detections"]]
    assert confidences == sorted(confidences, reverse=True)
    for detection in body["detections"]:
        assert detection["label"] == "pothole"
        assert detection["confidence"] >= 0.5
        assert len(detection["polygon"]) >= 3
        x1, y1, x2, y2 = detection["box"]
        assert 0 <= x1 < x2 <= 1 and 0 <= y1 < y2 <= 1
        for x, y in detection["polygon"]:
            assert x1 - 0.02 <= x <= x2 + 0.02 and y1 - 0.02 <= y <= y2 + 0.02


def test_blank_frame_has_no_detections(client):
    output = BytesIO()
    Image.new("RGB", (640, 480), color=(128, 128, 128)).save(output, format="JPEG")
    assert detect(client, output.getvalue())["detections"] == []
