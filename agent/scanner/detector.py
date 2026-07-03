"""
USB scanner auto-detection.

Maps (VendorID, ProductID) pairs to driver classes.
Scans all connected USB devices and returns the first matching driver,
or SimulationDriver if nothing is recognised.
"""
from __future__ import annotations
import logging
from typing import Type

log = logging.getLogger(__name__)

# ── Known fingerprint scanner USB IDs ────────────────────────────────────────
# (VID, PID) → (human label, driver class name)
_DEVICE_MAP: dict[tuple[int, int], tuple[str, str]] = {
    # Mantra devices — all use mfs500.MFS500Driver (MorFin_Auth.dll bridge, auto-detects model)
    (0x2C0F, 0x1100): ("Mantra MFS500",        "mfs500.MFS500Driver"),
    (0x2571, 0xC101): ("Mantra MFS100",        "mfs500.MFS500Driver"),
    (0x2571, 0xC150): ("Mantra MFS100 (alt)",  "mfs500.MFS500Driver"),
    (0x2571, 0xC200): ("Mantra MFS300",        "mfs500.MFS500Driver"),
    (0x2C0F, 0x1200): ("Mantra MFS110",        "mfs500.MFS500Driver"),
    (0x2C0F, 0x0200): ("Mantra MFS1000",       "mfs500.MFS500Driver"),
    # SecuGen — WBF driver (Windows ships WBF support for these)
    (0x1162, 0x0300): ("SecuGen Hamster Pro",     "wbf.WBFDriver"),
    (0x1162, 0x0200): ("SecuGen OptiMouse",       "wbf.WBFDriver"),
    (0x1162, 0x0500): ("SecuGen Hamster Pro 20",  "wbf.WBFDriver"),
    (0x1162, 0x0510): ("SecuGen U20",             "wbf.WBFDriver"),
    (0x1162, 0x0318): ("SecuGen Hamster IV",      "wbf.WBFDriver"),
    # ZKTeco — WBF
    (0x1B55, 0x0120): ("ZKTeco ZK4500",           "wbf.WBFDriver"),
    (0x1B55, 0x0140): ("ZKTeco ZK9500",           "wbf.WBFDriver"),
    (0x1B55, 0x0150): ("ZKTeco ZK8500",           "wbf.WBFDriver"),
    (0x1B55, 0x0200): ("ZKTeco Live20R",          "wbf.WBFDriver"),
    # DigitalPersona / HID — WBF
    (0x05BA, 0x000A): ("DigitalPersona U.are.U 4500", "wbf.WBFDriver"),
    (0x05BA, 0x0007): ("DigitalPersona U.are.U 4000", "wbf.WBFDriver"),
    (0x05BA, 0x0008): ("DigitalPersona U.are.U 5160", "wbf.WBFDriver"),
    # Futronic — WBF
    (0x096E, 0x0005): ("Futronic FS80",           "wbf.WBFDriver"),
    (0x096E, 0x0003): ("Futronic FS88",           "wbf.WBFDriver"),
    (0x096E, 0x0009): ("Futronic FS30",           "wbf.WBFDriver"),
    # Nitgen — WBF
    (0x0586, 0x0810): ("Nitgen eNBioScan",        "wbf.WBFDriver"),
    # Suprema — WBF
    (0x16D1, 0x0101): ("Suprema BioMini",         "wbf.WBFDriver"),
    (0x16D1, 0x0111): ("Suprema BioMini Plus",    "wbf.WBFDriver"),
    # Crossmatch / HID — WBF
    (0x0483, 0x2016): ("Crossmatch Verifier 300", "wbf.WBFDriver"),
}


def _load_driver(dotted: str):
    """Import and return a driver class from 'module.ClassName'."""
    module_name, class_name = dotted.rsplit(".", 1)
    import importlib
    mod = importlib.import_module(f"scanner.{module_name}")
    return getattr(mod, class_name)


def detect() -> "ScannerDriver":  # noqa: F821
    """
    Scan USB buses for known scanners.
    Tries Windows PnP first (catches devices with native drivers like MFS500),
    then libusb/pyusb, then blind driver probe.
    Returns an *instantiated* (but not yet opened) driver, or SimulationDriver.
    """
    from scanner.simulation import SimulationDriver

    # ── Windows PnP scan (catches MFS500 and other natively-driven devices) ───
    try:
        import subprocess, re
        out = subprocess.check_output(
            ["powershell", "-Command",
             "Get-PnpDevice -Class USB | Where-Object {$_.Status -eq 'OK'} | Select-Object InstanceId | Format-List"],
            timeout=8, stderr=subprocess.DEVNULL
        ).decode(errors="replace")
        for m in re.finditer(r"VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})", out):
            key = (int(m.group(1), 16), int(m.group(2), 16))
            if key in _DEVICE_MAP:
                label, dotted = _DEVICE_MAP[key]
                log.info("Detected via PnP: %s (VID=%04X PID=%04X)", label, *key)
                try:
                    return _load_driver(dotted)()
                except Exception as e:
                    log.warning("Could not load driver for %s: %s", label, e)
    except Exception as e:
        log.debug("PnP scan failed: %s", e)

    # ── libusb/pyusb scan (for devices without native Windows drivers) ────────
    try:
        import usb.core
        backend = None
        try:
            import libusb_package, usb.backend.libusb1 as _lb1
            backend = _lb1.get_backend(find_library=libusb_package.find_library)
        except Exception:
            pass
        for dev in usb.core.find(find_all=True, backend=backend):
            key = (dev.idVendor, dev.idProduct)
            if key in _DEVICE_MAP:
                label, dotted = _DEVICE_MAP[key]
                log.info("Detected via libusb: %s (VID=%04X PID=%04X)", label, *key)
                try:
                    return _load_driver(dotted)()
                except Exception as e:
                    log.warning("Could not load driver for %s: %s", label, e)
    except ImportError:
        log.debug("pyusb not installed")
    except Exception as e:
        log.debug("libusb scan error: %s", e)

    # ── Blind driver probe ────────────────────────────────────────────────────
    for DriverClass in _priority_probe():
        drv = DriverClass()
        if drv.open():
            drv.close()
            log.info("Driver probe succeeded: %s", drv.name)
            return drv

    log.info("No scanner found — using simulation")
    return SimulationDriver()


def _priority_probe():
    """
    Try drivers in priority order without USB enumeration.
    MFS500 (Mantra bridge) is tried first, then WBF as a universal fallback
    for any scanner Windows recognises (SecuGen, ZKTeco, DigitalPersona, etc.).
    """
    from scanner.mfs500 import MFS500Driver
    from scanner.wbf    import WBFDriver
    return [MFS500Driver, WBFDriver]


def list_connected() -> list[dict]:
    """Return a list of recognised fingerprint scanners on USB (for status/info)."""
    found = []
    try:
        import usb.core
        backend = None
        try:
            import libusb_package, usb.backend.libusb1 as _lb1
            backend = _lb1.get_backend(find_library=libusb_package.find_library)
        except Exception:
            pass
        for dev in usb.core.find(find_all=True, backend=backend):
            key = (dev.idVendor, dev.idProduct)
            if key in _DEVICE_MAP:
                label, _ = _DEVICE_MAP[key]
                found.append({
                    "label": label,
                    "vid": f"0x{dev.idVendor:04X}",
                    "pid": f"0x{dev.idProduct:04X}",
                })
    except Exception:
        pass
    return found
