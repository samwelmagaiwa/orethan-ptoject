"""
Orethan Microfinance — Biometric Agent
======================================
Runs a local WebSocket server (default ws://localhost:9000) that bridges
the browser-based BiometricScanner widget to the physical USB fingerprint scanner.

Protocol (JSON over WebSocket)
──────────────────────────────
  Browser → Agent:
    { "cmd": "capture", "finger": "right_thumb" }
    { "cmd": "cancel" }
    { "cmd": "status" }   (returns device info)

  Agent → Browser:
    { "type": "status",  "text": "...", "device": "...", "simulated": bool }
    { "type": "quality", "score": 87 }
    { "type": "capture", "template": "<b64>", "quality": 92,
                          "device_serial": "...", "simulated": bool }
    { "type": "error",   "text": "..." }
    { "type": "devices", "list": [{label,vid,pid}, ...] }

Usage
─────
  python bio_agent.py [--port 9000] [--host localhost] [--sim]
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import threading
import time
from pathlib import Path

# ── make scanner/ importable ─────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))

try:
    import websockets
    # websockets 14+ uses asyncio.server.ServerConnection; 12/13 used server.WS
    try:
        from websockets.asyncio.server import ServerConnection as WS
    except ImportError:
        from websockets.server import WS as WS  # type: ignore[no-redef]
except ImportError:
    print("[ERROR] 'websockets' package not found. Run:  pip install websockets")
    sys.exit(1)

from scanner import detect, list_connected, ScannerDriver, CaptureResult
from scanner.simulation import SimulationDriver

# ── logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("bio-agent")


# ── global driver (one scanner shared across all connections) ─────────────────
_driver: ScannerDriver | None = None
_driver_lock = threading.Lock()
_capture_event = threading.Event()   # browser triggers capture
_cancel_event  = threading.Event()   # browser cancels

# ── per-session biometric capture store (for cross-person validation) ─────────
# Maps ws_id → { role: {template, name} }
# Roles: "borrower", "guarantor1", "guarantor2"
_session_captures: dict[int, dict[str, dict]] = {}
MATCH_THRESHOLD = 40   # score ≥ 40 means same person (Mantra ANSI_V378 scale)


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket handler
# ─────────────────────────────────────────────────────────────────────────────

async def handler(ws: WS):
    global _driver

    remote = ws.remote_address
    ws_id  = id(ws)
    log.info("Client connected: %s", remote)

    # Send welcome / current device info
    await _send(ws, {
        "type": "status",
        "text": f"Agent ready — {_driver.name}" if _driver else "Agent ready (no scanner)",
        "device": _driver.name if _driver else "None",
        "simulated": isinstance(_driver, SimulationDriver),
    })

    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await _send(ws, {"type": "error", "text": "Invalid JSON"})
                continue

            cmd = msg.get("cmd")
            log.debug("← %s", msg)

            if cmd == "status":
                devices = list_connected()
                await _send(ws, {
                    "type": "devices",
                    "list": devices,
                    "active_driver": _driver.name if _driver else None,
                    "simulated": isinstance(_driver, SimulationDriver),
                })

            elif cmd == "rescan":
                await _rescan_driver(ws)

            elif cmd == "capture":
                finger     = msg.get("finger", "right_thumb")
                role       = msg.get("role", "")       # "borrower" | "guarantor1" | "guarantor2"
                name       = msg.get("name", role)     # display name for error messages
                session_id = msg.get("session_id") or str(ws_id)  # shared key across tabs
                await _do_capture(ws, finger, role, name, session_id)

            elif cmd == "reset_session":
                sid = msg.get("session_id") or str(ws_id)
                _session_captures.pop(sid, None)
                await _send(ws, {"type": "status", "text": "Session biometrics cleared"})

            elif cmd == "cancel":
                _cancel_event.set()
                await _send(ws, {"type": "status", "text": "Capture cancelled"})

            else:
                await _send(ws, {"type": "error", "text": f"Unknown command: {cmd}"})

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        log.info("Client disconnected: %s", remote)


async def _send(ws: WS, payload: dict):
    try:
        log.debug("→ %s", payload)
        await ws.send(json.dumps(payload))
    except Exception:
        pass


async def _rescan_driver(ws: WS):
    global _driver
    await _send(ws, {"type": "status", "text": "Scanning for connected devices…"})
    loop = asyncio.get_event_loop()
    new_driver = await loop.run_in_executor(None, _open_driver)
    _driver = new_driver
    await _send(ws, {
        "type": "status",
        "text": f"Scanner: {_driver.name}",
        "device": _driver.name,
        "simulated": isinstance(_driver, SimulationDriver),
    })


async def _do_capture(ws: WS, finger: str, role: str = "", name: str = "", session_id: str = ""):
    global _driver
    if _driver is None:
        await _send(ws, {"type": "error", "text": "No scanner driver loaded"})
        return

    _cancel_event.clear()

    await _send(ws, {
        "type": "status",
        "text": f"Place {finger.replace('_', ' ')} on the scanner…",
        "device": _driver.name,
        "simulated": isinstance(_driver, SimulationDriver),
    })

    loop = asyncio.get_event_loop()
    quality_task = asyncio.ensure_future(_poll_quality(ws))

    try:
        result: CaptureResult = await loop.run_in_executor(None, _blocking_capture)
    except asyncio.CancelledError:
        quality_task.cancel()
        return
    except RuntimeError as e:
        quality_task.cancel()
        await _send(ws, {"type": "error", "text": str(e)})
        return
    finally:
        quality_task.cancel()

    if _cancel_event.is_set():
        return

    # ── Cross-person duplicate validation ────────────────────────────────────
    if role and result.template and not result.simulated:
        session = _session_captures.get(session_id, {})
        duplicate_role = await loop.run_in_executor(
            None, _check_duplicate, result.template, role, session
        )
        if duplicate_role:
            stored_name = session[duplicate_role].get("name", duplicate_role)
            await _send(ws, {
                "type": "error",
                "text": f"Fingerprint matches {stored_name} ({duplicate_role}). "
                        f"One person cannot sign for multiple roles.",
                "duplicate_role": duplicate_role,
            })
            log.warning("Duplicate fingerprint: %s matches %s (%s)", role, stored_name, duplicate_role)
            return

        # Store this capture in the shared session bucket
        _session_captures.setdefault(session_id, {})[role] = {
            "template": result.template,
            "name": name or role,
        }

    await _send(ws, {
        "type":          "capture",
        "template":      result.template,
        "image":         result.image_b64,
        "quality":       result.quality_score,
        "device_serial": result.device_serial,
        "simulated":     result.simulated,
        "finger":        finger,
        "role":          role,
    })
    log.info("Captured %s/%s — quality %d%% (%s)", role, finger, result.quality_score, result.device_serial)


def _check_duplicate(new_template: str, new_role: str, session: dict) -> str | None:
    """
    Compare new_template against all already-captured templates in this session.
    Returns the conflicting role name if a match is found, else None.
    """
    if not new_template:
        return None
    matcher = getattr(_driver, "match_template", None)
    if not callable(matcher):
        return None   # WBF driver doesn't support matching — skip check
    for existing_role, data in session.items():
        if existing_role == new_role:
            continue
        try:
            score = matcher(new_template, data["template"])
            log.debug("Match %s vs %s: score=%d", new_role, existing_role, score)
            if score >= MATCH_THRESHOLD:
                return existing_role
        except Exception as e:
            log.debug("Match error %s vs %s: %s", new_role, existing_role, e)
    return None


async def _poll_quality(ws: WS):
    """Push live quality scores to the browser while capture is running."""
    global _driver
    while True:
        if _cancel_event.is_set():
            return
        loop = asyncio.get_event_loop()
        try:
            score = await loop.run_in_executor(None, _driver.get_live_quality)
            if score is not None:
                await _send(ws, {"type": "quality", "score": score})
        except Exception:
            pass
        await asyncio.sleep(0.15)


def _blocking_capture() -> CaptureResult:
    """Run capture in a thread-pool executor (blocking SDK call)."""
    return _driver.capture()


# ─────────────────────────────────────────────────────────────────────────────
# Driver initialisation
# ─────────────────────────────────────────────────────────────────────────────

def _open_driver(force_sim: bool = False) -> ScannerDriver:
    if force_sim:
        drv = SimulationDriver()
        drv.open()
        log.info("Simulation mode forced")
        return drv

    drv = detect()   # auto-detect via USB or probe
    if drv.open():
        log.info("Scanner ready: %s (serial: %s)", drv.name, drv.serial)
    else:
        log.warning("Driver %s failed to open — falling back to simulation", drv.name)
        from scanner.simulation import SimulationDriver as Sim
        drv = Sim()
        drv.open()
    return drv


# ─────────────────────────────────────────────────────────────────────────────
# Hot-plug watcher (background thread)
# ─────────────────────────────────────────────────────────────────────────────

def _hotplug_watcher(interval: float = 3.0):
    """
    Periodically check if a known scanner has been plugged in or out.
    Uses Windows PnP (via subprocess) as primary, falls back to pyusb.
    """
    global _driver
    from scanner.detector import _DEVICE_MAP
    last_seen: set[tuple] = set()

    def _current_vid_pids() -> set[tuple]:
        """Return set of (vid, pid) tuples for all currently connected USB devices."""
        # Windows PnP via PowerShell — catches devices with native Windows drivers
        # (like MFS500 which is invisible to libusb)
        try:
            import subprocess, re
            out = subprocess.check_output(
                ["powershell", "-Command",
                 "Get-PnpDevice -Class USB | Where-Object {$_.Status -eq 'OK'} | Select-Object InstanceId | Format-List"],
                timeout=5, stderr=subprocess.DEVNULL
            ).decode(errors="replace")
            found = set()
            for m in re.finditer(r"VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})", out):
                found.add((int(m.group(1), 16), int(m.group(2), 16)))
            return found
        except Exception:
            pass
        # Fallback: pyusb with libusb backend
        try:
            import usb.core, libusb_package, usb.backend.libusb1 as _lb1
            backend = _lb1.get_backend(find_library=libusb_package.find_library)
            return {(d.idVendor, d.idProduct) for d in usb.core.find(find_all=True, backend=backend)}
        except Exception:
            return set()

    while True:
        time.sleep(interval)
        try:
            current = _current_vid_pids()
            new_devices = current - last_seen
            if new_devices:
                for vid_pid in new_devices:
                    if vid_pid in _DEVICE_MAP:
                        label, _ = _DEVICE_MAP[vid_pid]
                        log.info("Hot-plug detected: %s — reloading driver", label)
                        with _driver_lock:
                            if _driver:
                                _driver.close()
                            _driver = _open_driver()
                        break
            last_seen = current
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main():
    global _driver

    parser = argparse.ArgumentParser(description="Orethan Biometric Agent")
    parser.add_argument("--host",  default="localhost", help="Bind host (default: localhost)")
    parser.add_argument("--port",  default=9000, type=int, help="WebSocket port (default: 9000)")
    parser.add_argument("--sim",   action="store_true", help="Force simulation mode (no hardware)")
    parser.add_argument("--debug", action="store_true", help="Verbose logging")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    # ── Initialise scanner ────────────────────────────────────────────────────
    _driver = _open_driver(force_sim=args.sim)

    # ── Start hot-plug watcher ────────────────────────────────────────────────
    if not args.sim:
        t = threading.Thread(target=_hotplug_watcher, daemon=True)
        t.start()

    # ── Start WebSocket server ────────────────────────────────────────────────
    print(f"\n{'='*55}")
    print(f"  Orethan Biometric Agent")
    print(f"  Scanner : {_driver.name}")
    print(f"  Serial  : {_driver.serial}")
    print(f"  Mode    : {'SIMULATION' if isinstance(_driver, SimulationDriver) else 'HARDWARE'}")
    print(f"  Address : ws://{args.host}:{args.port}")
    print(f"{'='*55}")
    print("  Press Ctrl+C to stop.\n")

    async def serve():
        async with websockets.serve(handler, args.host, args.port):
            await asyncio.Future()   # run forever

    try:
        asyncio.run(serve())
    except KeyboardInterrupt:
        print("\nAgent stopped.")
    finally:
        if _driver:
            _driver.close()


if __name__ == "__main__":
    main()
