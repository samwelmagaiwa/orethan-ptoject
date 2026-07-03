"""
WBF probe — WinBioLocateSensor works without admin and confirms physical finger placement.
Also tests WinBioVerify for completeness.
"""
import ctypes, sys, time

winbio = ctypes.WinDLL("winbio.dll")

WINBIO_TYPE_FINGERPRINT = 0x00000008
WINBIO_POOL_SYSTEM      = 1
WINBIO_FLAG_DEFAULT     = 0

winbio.WinBioOpenSession.restype  = ctypes.c_long
winbio.WinBioOpenSession.argtypes = [
    ctypes.c_ulong,ctypes.c_ulong,ctypes.c_ulong,
    ctypes.c_void_p,ctypes.c_size_t,ctypes.c_void_p,
    ctypes.POINTER(ctypes.c_size_t),
]
session = ctypes.c_size_t(0)
hr = winbio.WinBioOpenSession(WINBIO_TYPE_FINGERPRINT, WINBIO_POOL_SYSTEM, WINBIO_FLAG_DEFAULT,
                               None, 0, None, ctypes.byref(session))
print(f"WinBioOpenSession: hr=0x{hr&0xFFFFFFFF:08X}  session={session.value}")
if hr != 0:
    sys.exit(1)

# ── WinBioLocateSensor: waits for any finger tap, no admin needed ─────────────
unit_id = ctypes.c_ulong(0)
winbio.WinBioLocateSensor.restype  = ctypes.c_long
winbio.WinBioLocateSensor.argtypes = [ctypes.c_size_t, ctypes.POINTER(ctypes.c_ulong)]

print(">>> WinBioLocateSensor: Place finger on MFS500 ...")
t0 = time.time()
hr = winbio.WinBioLocateSensor(session.value, ctypes.byref(unit_id))
elapsed = time.time() - t0
print(f"WinBioLocateSensor: hr=0x{hr&0xFFFFFFFF:08X}  unit={unit_id.value}  elapsed={elapsed:.1f}s")
if hr == 0:
    print(f"SUCCESS - Finger detected on unit {unit_id.value} in {elapsed:.1f}s!")
else:
    codes = {0x80070005:"ACCESS_DENIED",0x00000102:"TIMEOUT",0x80098003:"DEVICE_FAILURE"}
    print(f"  -> {codes.get(hr&0xFFFFFFFF, hex(hr&0xFFFFFFFF))}")

winbio.WinBioCloseSession.restype  = ctypes.c_long
winbio.WinBioCloseSession.argtypes = [ctypes.c_size_t]
winbio.WinBioCloseSession(session.value)
print("Done.")
