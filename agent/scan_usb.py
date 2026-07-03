import usb.core, usb.util
import libusb_package, usb.backend.libusb1 as _lb1

backend = _lb1.get_backend(find_library=libusb_package.find_library)
devices = list(usb.core.find(find_all=True, backend=backend))
print(f"Found {len(devices)} USB devices:")
for d in devices:
    try:
        mfr = usb.util.get_string(d, d.iManufacturer) if d.iManufacturer else "-"
        prd = usb.util.get_string(d, d.iProduct) if d.iProduct else "-"
    except Exception:
        mfr, prd = "-", "-"
    print(f"  VID=0x{d.idVendor:04X}  PID=0x{d.idProduct:04X}  {mfr} | {prd}")
