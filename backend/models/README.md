# Trained pothole model
Trained weights live here as `pothole-yolo26s-seg.pt` (gitignored; copy of `training-results/models/pothole-yolo26s-seg.pt`, = `train/weights/best.pt` of run `yolo26s-seg_20261017-0644`).
Restart the backend after replacing them; `/api/health` reports `yolo26s-seg` when loaded.
Without this file, auto mode falls back to the demo placeholder detector.
