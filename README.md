# BantayLubak

Real-time pothole detection for drivers. The phone or laptop camera feed is segmented by a YOLO26s-seg model; detected potholes are outlined on the live view, a beep alerts the driver, and each hazard is saved (frame + outline) for later review.

- `backend/`: FastAPI + Ultralytics YOLO (CPU-only PyTorch), SQLite storage
- `frontend/`: React + TypeScript + Vite, mobile-first UI
- `training-results/models/`: trained weights; the backend loads `yolo26s-seg-combined_20261023-1437.pt` by default

## Requirements

| Tool | Version | Notes |
|---|---|---|
| [git](https://git-scm.com/) | any | |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | recent | installs Python 3.12 and the backend packages for you |
| [Node.js](https://nodejs.org/) | 20.19+ or 22.12+ | includes npm |

No GPU is needed: PyTorch is the CPU build. The first `uv sync` downloads about 1.4 GB of packages.

## Run

```bash
git clone https://github.com/lindtseyyy/bantaylubak.git
cd bantaylubak
./dev.sh
```

`dev.sh` installs the backend and frontend dependencies, then starts the backend on port 8000 and the frontend on port 5173. Open **http://localhost:5173** and allow camera access. Press `Ctrl+C` to stop both.

### Without `dev.sh` (e.g. Windows)

Use two terminals; each server keeps its terminal busy.

```bash
# terminal 1: backend, http://127.0.0.1:8000
cd backend
uv sync
uv run uvicorn app.main:app --port 8000
```

```bash
# terminal 2: frontend, http://localhost:5173
cd frontend
npm install
npm run dev
```

The frontend forwards `/api` and `/media` to the backend, so always open the app through port 5173.

### On a phone

Browsers only allow the camera on HTTPS or `localhost`.

| Command | Phone connects via | Open on the phone |
|---|---|---|
| `./dev.sh --phone` | same Wi-Fi as the laptop | `https://<laptop-ip>:5173` (printed at startup); accept the self-signed certificate warning once. If it can't connect, allow the port: `sudo ufw allow 5173/tcp` |
| `./dev.sh --usb` | Android USB debugging (needs `adb`) | `http://localhost:5173` in Chrome |

## Check it works

```bash
curl http://127.0.0.1:8000/api/health
```

`"detector": {"name": "yolo26s-seg", "placeholder": false, ...}` means the trained model is loaded. `"placeholder": true` means the weights file was not found and the app is running a simulated demo detector.

## Configuration

Set these environment variables before starting the backend:

| Variable | Default | Meaning |
|---|---|---|
| `BANTAYLUBAK_WEIGHTS` | `training-results/models/yolo26s-seg-combined_20261023-1437.pt` | model weights to load; e.g. `../training-results/models/pothole-yolo26s-seg.pt` (relative to `backend/`) for the earlier close-up model |
| `BANTAYLUBAK_CONF` | `0.5` | minimum detection confidence (0–1) |
| `BANTAYLUBAK_DETECTOR` | `auto` | `auto`: model if the weights exist, else demo; `yolo`: require the model; `placeholder`: always demo |
| `BANTAYLUBAK_DATA_DIR` | `backend/data` | where the SQLite database and saved frames go |

Example: `BANTAYLUBAK_CONF=0.4 ./dev.sh`

## Tests and checks

```bash
cd backend && uv run pytest
cd frontend && npm run build && npm run lint
```
