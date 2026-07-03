"""
Probe WinBioEnrollBegin/EnrollCapture — this is the path that turns the LED on.
Previous attempt used subfactor 0xFF (invalid). Trying valid values.
"""
import ctypes, sys

winbio = ctypes.WinDLL("winbio.dll")

WINBIO_TYPE_FINGERPRINT = 0x00000008
WINBIO_POOL_SYSTEM = 1
WINBIO_FLAG_DEFAULT = 0
UNIT_ID = 4

# Subfactor constants (WINBIO_ANSI_381_POS_*)
SUBS = [
    (0x00, "UNKNOWN/ANY"),
    (0x01, "RH_THUMB"),
    (0x02, "RH_INDEX"),
    (0xFF, "NO_INFORMATION"),
]

winbio.WinBioOpenSession.restype  = ctypes.c_long
winbio.WinBioOpenSession.argtypes = [ctypes.c_ulong,ctypes.c_ulong,ctypes.c_ulong,
    ctypes.c_void_p,ctypes.c_size_t,ctypes.c_void_p,ctypes.POINTER(ctypes.c_size_t)]
winbio.WinBioCloseSession.restype  = ctypes.c_long
winbio.WinBioCloseSession.argtypes = [ctypes.c_size_t]
winbio.WinBioEnrollBegin.restype  = ctypes.c_long
winbio.WinBioEnrollBegin.argtypes = [ctypes.c_size_t, ctypes.c_ubyte, ctypes.c_ulong]
winbio.WinBioEnrollDiscard.restype  = ctypes.c_long
winbio.WinBioEnrollDiscard.argtypes = [ctypes.c_size_t]
winbio.WinBioEnrollCapture.restype  = ctypes.c_long
winbio.WinBioEnrollCapture.argtypes = [ctypes.c_size_t, ctypes.POINTER(ctypes.c_ulong)]

for sub_val, sub_name in SUBS:
    sess = ctypes.c_size_t(0)
    hr = winbio.WinBioOpenSession(WINBIO_TYPE_FINGERPRINT, WINBIO_POOL_SYSTEM, WINBIO_FLAG_DEFAULT,
                                   None, 0, None, ctypes.byref(sess))
    if hr != 0:
        print(f"OpenSession failed: 0x{hr&0xFFFFFFFF:08X}")
        sys.exit(1)

    hr_begin = winbio.WinBioEnrollBegin(sess.value, sub_val, UNIT_ID)
    print(f"EnrollBegin(subfactor=0x{sub_val:02X} {sub_name}, unit={UNIT_ID}): hr=0x{hr_begin&0xFFFFFFFF:08X}  {'OK' if hr_begin==0 else 'FAIL'}")

    if hr_begin == 0:
        print(f"  -> EnrollBegin OK with subfactor {sub_name}! Place finger now ...")
        reject = ctypes.c_ulong(0)
        hr_cap = winbio.WinBioEnrollCapture(sess.value, ctypes.byref(reject))
        print(f"  -> EnrollCapture: hr=0x{hr_cap&0xFFFFFFFF:08X}  reject=0x{reject.value:08X}")
        winbio.WinBioEnrollDiscard(sess.value)
        winbio.WinBioCloseSession(sess.value)
        print(f"  -> Done. Subfactor {sub_name} (0x{sub_val:02X}) works!")
        break

    winbio.WinBioCloseSession(sess.value)

print("Probe complete.")
