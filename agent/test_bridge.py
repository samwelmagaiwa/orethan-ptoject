"""Quick test: can the bridge talk to the Mantra DLL?"""
import json, subprocess, os, sys
from pathlib import Path

BRIDGE = str(Path(__file__).parent / "mfs500_bridge.exe")
CWD    = r"C:\Program Files\Mantra\MorFin\Driver\MorFinAuthTest"

if not os.path.exists(BRIDGE):
    print("ERROR: mfs500_bridge.exe not found at", BRIDGE)
    sys.exit(1)

env = os.environ.copy()
env["PATH"] = CWD + os.pathsep + env.get("PATH", "")

proc = subprocess.Popen(
    [BRIDGE], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
    stderr=subprocess.PIPE, text=True, encoding="utf-8", cwd=CWD, env=env,
)

def ask(cmd_dict):
    proc.stdin.write(json.dumps(cmd_dict) + "\n")
    proc.stdin.flush()
    line = proc.stdout.readline()
    return json.loads(line.strip()) if line.strip() else {}

print("--- status (informational) ---")
r = ask({"cmd": "status"})
print(r)

if not r.get("ok"):
    print("\nBridge failed to start. stderr:")
    print(proc.stderr.read())
    sys.exit(1)

print("\n--- init ---")
r2 = ask({"cmd": "init"})
print(r2)

if r2.get("ok"):
    print("\nSUCCESS — bridge is working! Device handle:", r2.get("handle"))
    ask({"cmd": "close"})
else:
    print("Init failed:", r2.get("error"))

proc.terminate()
