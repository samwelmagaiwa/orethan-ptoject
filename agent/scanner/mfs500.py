"""
Mantra MFS500 driver — spawns mfs500_bridge.exe (32-bit) to call
Morfin_Auth_Core.dll, which properly activates the LED on the device.

The bridge is a 32-bit C# process that talks JSON over stdin/stdout.
We keep the process alive between captures (one per agent lifetime).
"""
from __future__ import annotations
import base64
import json
import logging
import os
import subprocess
import time
from pathlib import Path

from .base import ScannerDriver, CaptureResult

log = logging.getLogger(__name__)

_BRIDGE     = str(Path(__file__).parent.parent / "mfs500_bridge.exe")
_BRIDGE_CWD = r"C:\Program Files\Mantra\MorFin\Driver\MorFinAuthTest"


class MFS500Driver(ScannerDriver):
    """Mantra MFS500 via 32-bit Morfin_Auth_Core.dll bridge."""

    name   = "Mantra MFS500"
    serial = "MFS500"

    def __init__(self):
        self._proc: subprocess.Popen | None = None

    # ── helpers ──────────────────────────────────────────────────────────────

    def _send(self, obj: dict) -> dict:
        if not self._proc or self._proc.poll() is not None:
            raise RuntimeError("Bridge process not running")
        line = json.dumps(obj) + "\n"
        self._proc.stdin.write(line)
        self._proc.stdin.flush()
        resp = self._proc.stdout.readline()
        if not resp:
            raise RuntimeError("Bridge closed unexpectedly")
        return json.loads(resp.strip())

    # ── Lifecycle ────────────────────────────────────────────────────────────

    def open(self) -> bool:
        if not os.path.exists(_BRIDGE):
            log.warning("mfs500_bridge.exe not found at %s", _BRIDGE)
            return False
        try:
            env = os.environ.copy()
            env["PATH"] = _BRIDGE_CWD + os.pathsep + env.get("PATH", "")
            self._proc = subprocess.Popen(
                [_BRIDGE],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                encoding="utf-8",
                cwd=_BRIDGE_CWD,
                env=env,
            )
            # Initialise the device directly (IsDeviceConnected requires init first)
            ri = self._send({"cmd": "init"})
            if not ri.get("ok"):
                log.warning("MFS500 bridge init failed: %s", ri.get("error"))
                self._proc.terminate()
                self._proc = None
                return False

            serial = ri.get("serial") or ri.get("model") or "MFS500"
            self.serial = serial
            log.info("MFS500 bridge ready (handle=%s, serial=%s)", ri.get("handle"), serial)
            return True
        except Exception as exc:
            log.warning("MFS500 bridge open error: %s", exc)
            return False

    def close(self):
        if self._proc:
            try:
                self._send({"cmd": "close"})
            except Exception:
                pass
            try:
                self._proc.terminate()
            except Exception:
                pass
            self._proc = None

    # ── Capture ──────────────────────────────────────────────────────────────

    def capture(self, timeout_ms: int = 15000) -> CaptureResult:
        """
        Sends {"cmd":"capture","timeout":N} to the bridge.
        The bridge calls Finger_Auth_AutoCapture which lights the LED and
        blocks until a finger is placed (or timeout expires).
        """
        r = self._send({"cmd": "capture", "timeout": timeout_ms})
        if not r.get("ok"):
            raise RuntimeError(r.get("error", "capture failed"))

        return CaptureResult(
            template=r["template"],
            quality_score=int(r.get("quality", 80)),
            device_serial=self.serial,
            simulated=False,
            image_b64=r.get("image", ""),
        )

    def match_template(self, probe_b64: str, gallery_b64: str) -> int:
        """Return match score 0-100. ≥40 = same person."""
        r = self._send({"cmd": "match", "probe": probe_b64, "gallery": gallery_b64})
        if not r.get("ok"):
            raise RuntimeError(r.get("error", "match failed"))
        return int(r.get("score", 0))

    def get_live_quality(self) -> int | None:
        return None
