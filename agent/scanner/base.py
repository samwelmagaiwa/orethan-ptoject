"""Abstract base class every scanner driver must implement."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
import base64


@dataclass
class CaptureResult:
    template: str          # base64-encoded ANSI minutiae template
    quality_score: int     # 0-100
    device_serial: str
    simulated: bool = False
    image_b64: str = ""    # base64-encoded BMP fingerprint image (for voucher printing)


class ScannerDriver(ABC):
    """Common interface for all fingerprint scanner drivers."""

    name: str = "Unknown"
    serial: str = "UNKNOWN"

    @abstractmethod
    def open(self) -> bool:
        """Open/initialise the device. Return True on success."""

    @abstractmethod
    def close(self) -> None:
        """Release the device."""

    @abstractmethod
    def get_live_quality(self) -> Optional[int]:
        """
        Return a live quality score (0-100) while the user is placing their
        finger, or None if no finger is detected yet.
        Called repeatedly in a polling loop.
        """

    @abstractmethod
    def capture(self) -> CaptureResult:
        """
        Block until a clean capture is available, then return the result.
        Raises RuntimeError on failure.
        """

    # ── helpers ──────────────────────────────────────────────────────────────
    @staticmethod
    def _bytes_to_b64(data: bytes) -> str:
        return base64.b64encode(data).decode()
