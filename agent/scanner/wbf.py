"""
Windows Biometric Framework (WBF) driver.

Works with any fingerprint scanner that has a WBF-compatible driver installed
on Windows — SecuGen, ZKTeco, DigitalPersona/HID, Futronic, Suprema, etc.

How it works:
  - Opens a WBF SYSTEM pool session (no admin needed)
  - WinBioLocateSensor() blocks until the user places a finger on the scanner
    and activates the device LED on most WBF drivers
  - Returns an HMAC-SHA256 presence token (unique per scan, auditable)

Quality: WBF SYSTEM pool + DEFAULT flags don't expose a raw quality score,
so we return a fixed 85 and rely on the "finger was physically detected" guarantee.
"""
from __future__ import annotations
import ctypes
import hashlib
import hmac
import logging
import os
import time

from .base import ScannerDriver, CaptureResult

log = logging.getLogger(__name__)


def _pnp_name_for_unit(_unit_id: int) -> str | None:
    """Ask Windows PnP for a friendly name for any connected biometric device."""
    try:
        import subprocess, re
        out = subprocess.check_output(
            ["powershell", "-Command",
             "Get-PnpDevice -Class Biometric | Where-Object {$_.Status -eq 'OK'} "
             "| Select-Object FriendlyName | Format-List"],
            timeout=5, stderr=subprocess.DEVNULL,
        ).decode(errors="replace")
        m = re.search(r"FriendlyName\s*:\s*(.+)", out)
        if m:
            return m.group(1).strip()
    except Exception:
        pass
    return None

# ── WBF constants ─────────────────────────────────────────────────────────────
WINBIO_TYPE_FINGERPRINT = 0x00000008
WINBIO_POOL_SYSTEM      = 1
WINBIO_POOL_PRIVATE     = 2
WINBIO_FLAG_DEFAULT     = 0x00000000
WINBIO_FLAG_BASIC       = 0x00000001
WINBIO_FLAG_ADVANCED    = 0x00000002

# HRESULT success / known errors
S_OK                          = 0x00000000
WINBIO_E_DATABASE_CANT_OPEN   = 0x80098007
WINBIO_E_BAD_CAPTURE          = 0x80098009
WINBIO_E_CANCELED             = 0x80090300

_HANDLE = ctypes.c_size_t   # WINBIO_SESSION_HANDLE / WINBIO_UNIT_ID type


def _hr(v: int) -> int:
    """Normalise HRESULT to unsigned 32-bit."""
    return v & 0xFFFFFFFF


class WBFDriver(ScannerDriver):
    """Generic WBF driver — works with any Windows-registered scanner."""

    name   = "WBF Scanner"
    serial = "WBF-0"

    def __init__(self):
        self._winbio  = None
        self._session = _HANDLE(0)
        self._unit_id = 0
        self._secret  = os.urandom(32)

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def open(self) -> bool:
        try:
            lib = ctypes.WinDLL("winbio.dll")
        except OSError:
            log.debug("winbio.dll not available")
            return False

        # Bind prototypes
        lib.WinBioOpenSession.restype  = ctypes.c_long
        lib.WinBioOpenSession.argtypes = [
            ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong,
            ctypes.c_void_p, ctypes.c_size_t, ctypes.c_void_p,
            ctypes.POINTER(_HANDLE),
        ]
        lib.WinBioLocateSensor.restype  = ctypes.c_long
        lib.WinBioLocateSensor.argtypes = [_HANDLE, ctypes.POINTER(ctypes.c_ulong)]
        lib.WinBioCloseSession.restype  = ctypes.c_long
        lib.WinBioCloseSession.argtypes = [_HANDLE]
        lib.WinBioEnumBiometricUnits.restype  = ctypes.c_long
        lib.WinBioEnumBiometricUnits.argtypes = [
            ctypes.c_ulong,
            ctypes.POINTER(ctypes.c_void_p),
            ctypes.POINTER(ctypes.c_size_t),
        ]

        sess = _HANDLE(0)
        hr = lib.WinBioOpenSession(
            WINBIO_TYPE_FINGERPRINT, WINBIO_POOL_SYSTEM, WINBIO_FLAG_DEFAULT,
            None, 0, None, ctypes.byref(sess),
        )
        if _hr(hr) != S_OK:
            log.debug("WBF OpenSession failed: 0x%08X", _hr(hr))
            return False

        # Enumerate units to get a unit ID and build a friendly name
        units_ptr   = ctypes.c_void_p(0)
        units_count = ctypes.c_size_t(0)
        unit_id = 0
        if lib.WinBioEnumBiometricUnits(WINBIO_TYPE_FINGERPRINT,
                                         ctypes.byref(units_ptr),
                                         ctypes.byref(units_count)) == 0:
            if units_ptr.value and units_count.value > 0:
                unit_id = ctypes.c_ulong.from_address(units_ptr.value).value
                try:
                    lib.WinBioFree.restype  = ctypes.c_long
                    lib.WinBioFree.argtypes = [ctypes.c_void_p]
                    lib.WinBioFree(units_ptr)
                except Exception:
                    pass

        if units_count.value == 0:
            # No units registered with WBF — scanner has no WBF driver
            lib.WinBioCloseSession(sess.value)
            log.debug("WBF: no biometric units found")
            return False

        # Try to get a friendly device name via Windows PnP description
        device_name = _pnp_name_for_unit(unit_id)

        self._winbio  = lib
        self._session = sess
        self._unit_id = unit_id
        self.serial   = f"WBF-U{unit_id}"
        self.name     = device_name or f"WBF Fingerprint Scanner (unit {unit_id})"

        log.info("WBF session opened — %d unit(s), unit_id=%d, name=%s",
                 units_count.value, unit_id, self.name)
        return True

    def close(self):
        if self._winbio and self._session.value:
            self._winbio.WinBioCloseSession(self._session.value)
            self._session = _HANDLE(0)
            log.info("WBF session closed")

    # ── Capture ───────────────────────────────────────────────────────────────

    def capture(self) -> CaptureResult:
        if not self._winbio:
            raise RuntimeError("WBF driver not initialised")

        # Open a fresh session per capture — this reliably activates the LED
        lib = self._winbio
        sess = _HANDLE(0)
        hr = lib.WinBioOpenSession(
            WINBIO_TYPE_FINGERPRINT, WINBIO_POOL_SYSTEM, WINBIO_FLAG_DEFAULT,
            None, 0, None, ctypes.byref(sess),
        )
        if _hr(hr) != S_OK:
            raise RuntimeError(f"WBF session failed: 0x{_hr(hr):08X}")

        unit_out = ctypes.c_ulong(0)
        try:
            hr = lib.WinBioLocateSensor(sess.value, ctypes.byref(unit_out))
        finally:
            lib.WinBioCloseSession(sess.value)

        if _hr(hr) != S_OK:
            msgs = {
                0x80070005: "Access denied — run agent as administrator",
                0x80070057: "Scanner does not support WinBioLocateSensor",
                0x80098003: "Device failure — reconnect scanner",
                0x00000102: "Timeout — no finger placed",
                0x80090300: "Capture cancelled",
            }
            code = _hr(hr)
            raise RuntimeError(msgs.get(code, f"WBF error 0x{code:08X}"))

        # Unique presence token — HMAC-SHA256(secret, unit_id + timestamp)
        ts        = str(time.time()).encode()
        unit_bytes = str(unit_out.value).encode()
        token     = hmac.new(self._secret, unit_bytes + ts, hashlib.sha256).hexdigest()
        import base64
        template_b64 = base64.b64encode(token.encode()).decode()

        return CaptureResult(
            template=template_b64,
            quality_score=85,
            device_serial=self.serial,
            simulated=False,
        )

    def get_live_quality(self) -> int | None:
        # WinBioLocateSensor blocks — no live quality stream available
        return None
