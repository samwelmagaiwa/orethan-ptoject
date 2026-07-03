import pefile

for path in [
    r"C:\Program Files\Mantra\MorFin\Driver\MorFinAuthTest\MorFin_Auth.dll",
    r"C:\Program Files\Mantra\MorFin\Driver\MorFinAuthTest\Morfin_Auth_Core.dll",
    r"C:\Program Files\Mantra\MorFin\Driver\MorFinAuthTest\iengine_ansi_iso.dll",
]:
    print(f"\n=== {path.split(chr(92))[-1]} ===")
    try:
        pe = pefile.PE(path)
        if hasattr(pe, 'DIRECTORY_ENTRY_EXPORT'):
            for exp in pe.DIRECTORY_ENTRY_EXPORT.symbols:
                name = exp.name.decode() if exp.name else f"ord_{exp.ordinal}"
                print(f"  {name}")
        else:
            print("  (no exports)")
    except Exception as e:
        print(f"  Error: {e}")
