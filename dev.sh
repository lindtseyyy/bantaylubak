#!/usr/bin/env bash
# Start backend (:8000) and frontend (:5173) together; Ctrl+C stops both.
#   ./dev.sh          laptop only:  http://localhost:5173
#   ./dev.sh --phone  same Wi-Fi:   https://<laptop-ip>:5173 (self-signed cert; accept the warning once)
#   ./dev.sh --usb    Android USB:  http://localhost:5173 on the phone via `adb reverse`
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mode="${1:-}"

case "$mode" in
  "" | --phone | --usb) ;;
  *) echo "usage: $0 [--phone | --usb]" >&2; exit 2 ;;
esac

(cd "$root/backend" && uv sync --quiet)
(cd "$root/frontend" && npm install --no-audit --no-fund --silent)

if [ "$mode" = --phone ]; then
  export BANTAYLUBAK_PHONE=1
  lan_ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}')"
  echo "Phone (same Wi-Fi): https://${lan_ip:-<laptop-ip>}:5173  — tap Advanced → Proceed on the certificate warning."
  echo "Can't connect? The firewall may block it: sudo ufw allow 5173/tcp"
elif [ "$mode" = --usb ]; then
  adb reverse tcp:5173 tcp:5173
  echo "Phone (USB): open http://localhost:5173 in Chrome on the phone."
fi

(cd "$root/backend" && exec uv run uvicorn app.main:app --port 8000) &
backend_pid=$!
trap 'kill "$backend_pid" 2>/dev/null || true' EXIT INT TERM

cd "$root/frontend" && npm run dev
