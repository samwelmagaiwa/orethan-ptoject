"""
Mantra MFS100 driver (VID 0x2571 / PID 0xC101 or 0xC150).
Uses the vendor DLL via ctypes (Windows only).
DLL is typically installed to C:\\MFS100\\MFS100.dll
or placed alongside this script in an 'sdk/' folder.
"""
import ctypes
import ctypes.util
import os
import sys
import time
from pathlib import Path
from .base import ScannerDriver, CaptureResult

# Possible DLL locations (vendor installer paths + local sdk/ folder)
_DLL_SEARCH = [
    Path(__file__).parent.parent / "sdk" / "MFS100.dll",
    Path("C:/MFS100/MFS100.dll"),
    Path("C:/Program Files/MFS100/MFS100.dll"),
    Path("C:/Program Files (x86)/MFS100/MFS100.dll"),
]

_IMG_WIDTH  = 300
_IMG_HEIGHT = 400
_IMG_SIZE   = _IMG_WIDTH * _IMG_HEIGHT
_TMPL_SIZE  = 2048   # ISO template max size


def _find_dll() -> Path | None:
    for p in _DLL_SEARCH:
        if p.exists():
            return p
    return None


class MantraDriver(ScannerDriver):
    name = "Mantra MFS100"

    def __init__(self):
        self._dll = None
        self._img_buf  = (ctypes.c_ubyte * _IMG_SIZE)()
        self._tmpl_buf = (ctypes.c_ubyte * _TMPL_SIZE)()
        self.serial = "MFS100-UNKNOWN"

    # ── lifecycle ─────────────────────────────────────────────────────────────
    def open(self) -> bool:
        dll_path = _find_dll()
        if dll_path is None:
            return False
        try:
            self._dll = ctypes.CDLL(str(dll_path))
            ret = self._dll.Init_Device(None)
            if ret != 0:
                return False
            # Try to read serial
            try:
                serial_buf = ctypes.create_string_buffer(64)
                self._dll.GetDeviceInfo(serial_buf, 64)
                self.serial = serial_buf.value.decode(errors="replace") or "MFS100"
            except Exception:
                self.serial = "MFS100-001"
            return True
        except Exception:
            return False

    def close(self) -> None:
        if self._dll:
            try:
                self._dll.Exit_Device()
            except Exception:
                pass

    # ── scanning ──────────────────────────────────────────────────────────────
    def get_live_quality(self) -> int | None:
        if not self._dll:
            return None
        quality = ctypes.c_int(0)
        ret = self._dll.GetLiveStreamImage(
            ctypes.cast(self._img_buf, ctypes.POINTER(ctypes.c_ubyte)),
            ctypes.byref(quality),
        )
        if ret != 0:
            return None
        return max(0, min(100, quality.value))

    def capture(self) -> CaptureResult:
        if not self._dll:
            raise RuntimeError("Device not open")

        # Poll until quality stays above 50 for a stable capture
        quality = ctypes.c_int(0)
        deadline = time.time() + 30
        while time.time() < deadline:
            ret = self._dll.GetLiveStreamImage(
                ctypes.cast(self._img_buf, ctypes.POINTER(ctypes.c_ubyte)),
                ctypes.byref(quality),
            )
            if ret == 0 and quality.value >= 50:
                break
            time.sleep(0.1)
        else:
            raise RuntimeError("Capture timed out — no finger detected")

        tmpl_len = ctypes.c_int(0)
        ret = self._dll.GetTemplate(
            ctypes.cast(self._tmpl_buf, ctypes.POINTER(ctypes.c_ubyte)),
            ctypes.byref(tmpl_len),
        )
        if ret != 0:
            raise RuntimeError(f"GetTemplate failed (code {ret})")

        raw = bytes(self._tmpl_buf[: tmpl_len.value])
        return CaptureResult(
            template=self._bytes_to_b64(raw),
            quality_score=quality.value,
            device_serial=self.serial,
            simulated=False,
        )
