"""
Probe Morfin_Auth_Core.dll to find working call signatures for MFS500.
Tries common patterns and reports what works.
"""
import ctypes, sys, time

DLL = r"C:\Program Files\Mantra\MorFin\Driver\MorFinAuthTest\Morfin_Auth_Core.dll"

try:
    lib = ctypes.WinDLL(DLL)
    print("DLL loaded OK")
except Exception as e:
    print(f"Cannot load DLL: {e}")
    sys.exit(1)

# ── Finger_Auth_GetVersion ────────────────────────────────────────────────────
try:
    lib.Finger_Auth_GetVersion.restype = ctypes.c_char_p
    ver = lib.Finger_Auth_GetVersion()
    print(f"Version: {ver}")
except Exception as e:
    print(f"GetVersion error: {e}")

# ── Finger_Auth_IsDeviceConnected ─────────────────────────────────────────────
try:
    lib.Finger_Auth_IsDeviceConnected.restype = ctypes.c_int
    connected = lib.Finger_Auth_IsDeviceConnected()
    print(f"IsDeviceConnected: {connected}")
except Exception as e:
    print(f"IsDeviceConnected error: {e}")

# ── Finger_Auth_GetDeviceList ─────────────────────────────────────────────────
try:
    buf = ctypes.create_string_buffer(4096)
    count = ctypes.c_int(0)
    lib.Finger_Auth_GetDeviceList.restype = ctypes.c_int
    ret = lib.Finger_Auth_GetDeviceList(buf, ctypes.byref(count))
    print(f"GetDeviceList ret={ret} count={count.value} buf={buf.value[:200]}")
except Exception as e:
    print(f"GetDeviceList error: {e}")

# ── Finger_Auth_InitDevice ────────────────────────────────────────────────────
handle = ctypes.c_int(0)
try:
    lib.Finger_Auth_InitDevice.restype = ctypes.c_int
    # Try signature 1: (int* handle)
    ret = lib.Finger_Auth_InitDevice(ctypes.byref(handle))
    print(f"InitDevice(handle) ret={ret}  handle={handle.value}")
except Exception as e:
    print(f"InitDevice sig1 error: {e}")

# ── Finger_Auth_AutoCapture ───────────────────────────────────────────────────
IMAGE_SIZE = 400 * 400
img_buf  = ctypes.create_string_buffer(IMAGE_SIZE)
img_size = ctypes.c_int(IMAGE_SIZE)
quality  = ctypes.c_int(0)
timeout  = ctypes.c_int(10000)  # 10 s

print("\nAttempting AutoCapture (place finger on scanner within 10 s) ...")
try:
    lib.Finger_Auth_AutoCapture.restype = ctypes.c_int
    # Signature: (handle, imgBuf, imgSize*, quality*, timeout)
    ret = lib.Finger_Auth_AutoCapture(
        handle.value, img_buf, ctypes.byref(img_size),
        ctypes.byref(quality), timeout.value
    )
    print(f"AutoCapture ret={ret}  img_size={img_size.value}  quality={quality.value}")
except Exception as e:
    print(f"AutoCapture error: {e}")

# ── Finger_Auth_GetTemplate ───────────────────────────────────────────────────
tmpl_buf  = ctypes.create_string_buffer(2048)
tmpl_size = ctypes.c_int(2048)
try:
    lib.Finger_Auth_GetTemplate.restype = ctypes.c_int
    ret = lib.Finger_Auth_GetTemplate(
        handle.value, img_buf, img_size.value,
        tmpl_buf, ctypes.byref(tmpl_size)
    )
    print(f"GetTemplate ret={ret}  tmpl_size={tmpl_size.value}")
except Exception as e:
    print(f"GetTemplate error: {e}")

# ── Finger_Auth_UninitDevice ──────────────────────────────────────────────────
try:
    lib.Finger_Auth_UninitDevice.restype = ctypes.c_int
    ret = lib.Finger_Auth_UninitDevice(handle.value)
    print(f"UninitDevice ret={ret}")
except Exception as e:
    print(f"UninitDevice error: {e}")

print("\nDone.")
