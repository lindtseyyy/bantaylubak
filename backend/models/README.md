# Trained pothole model
The backend loads `training-results/models/yolo26s-seg-combined_20261023-1437.pt` by default (committed; `best.pt` of the forward-view retraining run `yolo26s-seg-combined_20261023-1437`).
To serve other weights, put the `.pt` file here (`*.pt` is gitignored in this folder) and set `BANTAYLUBAK_WEIGHTS` to its path, e.g. `BANTAYLUBAK_WEIGHTS=models/pothole-yolo26s-seg.pt` for the original close-up model.
Restart the backend after switching; `/api/health` reports `yolo26s-seg` and the loaded `weights_path`.
Without a weights file, auto mode falls back to the demo placeholder detector.
