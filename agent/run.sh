#!/usr/bin/env bash
# ============================================================
#  Orethan Biometric Agent — Linux / macOS Launcher
# ============================================================

set -e
cd "$(dirname "$0")"

if ! command -v python3 &>/dev/null; then
    echo "[ERROR] python3 not found. Install Python 3.11+."
    exit 1
fi

# Install deps if needed
python3 -c "import websockets" 2>/dev/null || {
    echo "Installing dependencies..."
    pip3 install -r requirements.txt
}

PORT=9000
if [ -f config.json ]; then
    PORT=$(python3 -c "import json; d=json.load(open('config.json')); url=d.get('agent_websocket_url','ws://localhost:9000'); print(url.split(':')[-1])" 2>/dev/null || echo 9000)
fi

echo ""
echo "============================================================"
echo "  Orethan Biometric Agent (Linux/macOS)"
echo "  Port: $PORT"
echo "============================================================"
echo ""

python3 bio_agent.py --port "$PORT" || python3 bio_agent.py --port "$PORT" --sim
