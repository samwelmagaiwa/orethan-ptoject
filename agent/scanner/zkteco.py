"""
ZKTeco driver — ZK4500 / ZK9500 / ZK8500 (VID 0x1B55).
Uses zkfp2.dll (ZKFinger SDK v8/v9).
DLL typically at C:\\Program Files\\ZKFinger SDK\\lib\\x86\\zkfp2.dll
"""
import ctypes
import time
from pathlib import Path
from .base import ScannerDriver, CaptureResult

_DLL_SEARCH = [
    Path(__file__).parent.parent / "sdk" / "zkfp2.dll",
    Path("C:/Program Files/ZKFinger SDK/lib/x86/zkfp2.dll"),
    Path("C:/Program Files (x86)/ZKFinger SDK/lib/x86/zkfp2.dll"),
    Path("C:/ZKFinger SDK/lib/x86/zkfp2.dll"),
    Path("C:/ZKTeco/ZKFinger SDK/lib/x86/zkfp2.dll"),
]

_TEMPLATE_SIZE = 2048
_IMAGE_SIZE    = 320 * 480   # max buffer


def _find_dll():
    for p in _DLL_SEARCH:
        if p.exists():
            return p
    return None


class ZKTecoDriver(ScannerDriver):
    name = "ZKTeco"

    def __init__(self):
        self._dll    = None
        self._handle = None  # device handle (ctypes void ptr)
        self._img_buf  = (ctypes.c_ubyte * _IMAGE_SIZE)()
        self._tmpl_buf = (ctypes.c_ubyte * _TEMPLATE_SIZE)()
        self.serial = "ZK-UNKNOWN"

    def open(self) -> bool:
        p = _find_dll()
        if not p:
            return False
        try:
            self._dll = ctypes.CDLL(str(p))
            if self._dll.ZKFPM_Init() != 0:
                return False
            count = self._dll.ZKFPM_GetDeviceCount()
            if count < 1:
                return False
            handle = self._dll.ZKFPM_OpenDevice(0)
            if handle == 0:
                return False
            self._handle = handle
            # Serial number
            try:
                buf = ctypes.create_string_buffer(64)
                size = ctypes.c_int(64)
                self._dll.ZKFPM_GetParameters(handle, 1, buf, ctypes.byref(size))
                self.serial = buf.value.decode(errors="replace") or "ZK-001"
            except Exception:
                self.serial = "ZK-001"
            return True
        except Exception:
            return False

    def close(self) -> None:
        if self._dll and self._handle:
            try:
                self._dll.ZKFPM_CloseDevice(self._handle)
                self._dll.ZKFPM_Terminate()
            except Exception:
                pass

    def get_live_quality(self) -> int | None:
        if not self._dll or not self._handle:
            return None
        img_size = ctypes.c_int(_IMAGE_SIZE)
        tmpl_size = ctypes.c_int(_TEMPLATE_SIZE)
        ret = self._dll.ZKFPM_AcquireFingerprint(
            self._handle,
            ctypes.cast(self._img_buf,  ctypes.POINTER(ctypes.c_ubyte)),
            ctypes.byref(img_size),
            ctypes.cast(self._tmpl_buf, ctypes.POINTER(ctypes.c_ubyte)),
            ctypes.byref(tmpl_size),
        )
        if ret == 0:
            return 80   # ZKTeco doesn't expose a separate quality API; assume good
        return None

    def capture(self) -> CaptureResult:
        if not self._dll or not self._handle:
            raise RuntimeError("Device not open")

        deadline = time.time() + 30
        while time.time() < deadline:
            img_size  = ctypes.c_int(_IMAGE_SIZE)
            tmpl_size = ctypes.c_int(_TEMPLATE_SIZE)
            ret = self._dll.ZKFPM_AcquireFingerprint(
                self._handle,
                ctypes.cast(self._img_buf,  ctypes.POINTER(ctypes.c_ubyte)),
                ctypes.byref(img_size),
                ctypes.cast(self._tmpl_buf, ctypes.POINTER(ctypes.c_ubyte)),
                ctypes.byref(tmpl_size),
            )
            if ret == 0:
                raw = bytes(self._tmpl_buf[: tmpl_size.value])
                return CaptureResult(
                    template=self._bytes_to_b64(raw),
                    quality_score=85,
                    device_serial=self.serial,
                    simulated=False,
                )
            time.sleep(0.1)

        raise RuntimeError("Capture timed out")
