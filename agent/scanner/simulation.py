"""Simulation driver — no hardware needed. Used as automatic fallback."""
import base64
import os
import time
import random
from .base import ScannerDriver, CaptureResult


class SimulationDriver(ScannerDriver):
    name = "Simulation (no hardware)"
    serial = "SIM-0001"

    def open(self) -> bool:
        return True

    def close(self) -> None:
        pass

    def get_live_quality(self) -> int:
        # Simulate a slowly-rising quality score
        return random.randint(60, 95)

    def capture(self) -> CaptureResult:
        # ~2 second "scan"
        time.sleep(2.0)
        template_bytes = os.urandom(512)
        quality = random.randint(75, 99)
        return CaptureResult(
            template=base64.b64encode(template_bytes).decode(),
            quality_score=quality,
            device_serial=self.serial,
            simulated=True,
        )
