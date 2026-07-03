"""
SecuGen driver — Hamster Pro / OptiMouse Pro / U20 (VID 0x1162).
Uses sgfplib.dll (SecuGen SGFPLIB).
DLL installs to C:\\SecuGen\\bin\\sgfplib.dll by default.
"""
import ctypes
import time
from pathlib import Path
from .base import ScannerDriver, CaptureResult

_DLL_SEARCH = [
    Path(__file__).parent.parent / "sdk" / "sgfplib.dll",
    Path("C:/SecuGen/bin/sgfplib.dll"),
    Path("C:/Program Files/SecuGen/FDU04/bin/sgfplib.dll"),
    Path("C:/Program Files (x86)/SecuGen/FDU04/bin/sgfplib.dll"),
]

# SecuGen device constants
SG_DEV_AUTO  = 0
SG_DEV_FDU03 = 0x03
SG_DEV_FDU04 = 0x06
SG_IMG_DPI_500 = 500
SG_TEMPLATE_SIZE_ANSI = 400


def _find_dll():
    for p in _DLL_SEARCH:
        if p.exists():
            return p
    return None


class SecuGenDriver(ScannerDriver):
    name = "SecuGen"
    _IMG_W = 260
    _IMG_H = 300

    def __init__(self):
        self._dll = None
        self._img = (ctypes.c_ubyte * (self._IMG_W * self._IMG_H))()
        self._tmpl = (ctypes.c_ubyte * 400)()
        self.serial = "SG-UNKNOWN"

    def open(self) -> bool:
        p = _find_dll()
        if not p:
            return False
        try:
            self._dll = ctypes.CDLL(str(p))
            err = self._dll.SGFPM_Init(SG_DEV_AUTO, 500, 0)
            if err != 0:
                return False
            err = self._dll.SGFPM_OpenDevice(0)
            if err != 0:
                return False
            # Attempt serial read
            try:
                buf = ctypes.create_string_buffer(64)
                self._dll.SGFPM_GetDeviceInfo(buf, 64)
                self.serial = buf.value.decode(errors="replace") or "SG-001"
            except Exception:
                self.serial = "SG-001"
            return True
        except Exception:
            return False

    def close(self) -> None:
        if self._dll:
            try:
                self._dll.SGFPM_CloseDevice(0)
                self._dll.SGFPM_Terminate()
            except Exception:
                pass

    def get_live_quality(self) -> int | None:
        if not self._dll:
            return None
        quality = ctypes.c_long(0)
        ret = self._dll.SGFPM_GetImage(
            ctypes.cast(self._img, ctypes.POINTER(ctypes.c_ubyte))
        )
        if ret != 0:
            return None
        self._dll.SGFPM_GetImageQuality(
            self._IMG_W, self._IMG_H,
            ctypes.cast(self._img, ctypes.POINTER(ctypes.c_ubyte)),
            ctypes.byref(quality),
        )
        return max(0, min(100, quality.value))

    def capture(self) -> CaptureResult:
        if not self._dll:
            raise RuntimeError("Device not open")

        deadline = time.time() + 30
        quality = ctypes.c_long(0)
        while time.time() < deadline:
            ret = self._dll.SGFPM_GetImage(
                ctypes.cast(self._img, ctypes.POINTER(ctypes.c_ubyte))
            )
            if ret == 0:
                self._dll.SGFPM_GetImageQuality(
                    self._IMG_W, self._IMG_H,
                    ctypes.cast(self._img, ctypes.POINTER(ctypes.c_ubyte)),
                    ctypes.byref(quality),
                )
                if quality.value >= 50:
                    break
            time.sleep(0.15)
        else:
            raise RuntimeError("Capture timed out")

        tmpl_size = ctypes.c_long(400)
        ret = self._dll.SGFPM_CreateTemplate(
            None,
            ctypes.cast(self._img, ctypes.POINTER(ctypes.c_ubyte)),
            ctypes.cast(self._tmpl, ctypes.POINTER(ctypes.c_ubyte)),
        )
        if ret != 0:
            raise RuntimeError(f"CreateTemplate failed (code {ret})")

        return CaptureResult(
            template=self._bytes_to_b64(bytes(self._tmpl)),
            quality_score=quality.value,
            device_serial=self.serial,
            simulated=False,
        )
