"""Manual Windows launcher. No deployment credentials and no sleep-setting changes."""
import argparse
import ctypes
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / "work/local-valuation"
PORT = 8765


def config():
    STATE.mkdir(parents=True, exist_ok=True)
    path = STATE / "config.json"
    if not path.exists():
        with path.open("x", encoding="utf-8") as f:
            json.dump({"token": secrets.token_urlsafe(48)}, f)
    return json.loads(path.read_text(encoding="utf-8"))


def healthy():
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health", timeout=2) as r:
            return json.load(r).get("ready") is True
    except Exception:
        return False


def live(pid):
    kernel = ctypes.windll.kernel32
    kernel.OpenProcess.restype = ctypes.c_void_p
    handle = kernel.OpenProcess(0x1000, False, pid)
    if not handle:
        return False
    code = ctypes.c_ulong()
    kernel.GetExitCodeProcess(ctypes.c_void_p(handle), ctypes.byref(code))
    kernel.CloseHandle(ctypes.c_void_p(handle))
    return code.value == 259


def status():
    path = STATE / "status.json"
    state = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    print(json.dumps({**state, "ready": healthy()}, ensure_ascii=False))


def run(local_only):
    config()
    lock = STATE / "manager.pid"
    if lock.exists():
        if live(int(lock.read_text())):
            return
        lock.unlink()
    with lock.open("x") as f:
        f.write(str(os.getpid()))
    stop = STATE / "stop"
    stop.unlink(missing_ok=True)
    children = []
    failed = False
    def save(state, url=None):
        (STATE / "status.json").write_text(json.dumps({"state": state, "url": url}), encoding="utf-8")
    try:
        with (STATE / "service.log").open("w", encoding="utf-8") as service_log, (STATE / "tunnel.log").open("w", encoding="utf-8") as tunnel_log:
            backend = subprocess.Popen([sys.executable, "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", str(PORT), "--no-access-log"],
                cwd=Path(__file__).parent, stdout=service_log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
            children.append(backend)
            save("warming")
            deadline = time.monotonic() + 200
            while not healthy():
                if backend.poll() is not None or stop.exists() or time.monotonic() > deadline:
                    raise RuntimeError("Backend warmup did not complete")
                time.sleep(.5)
            url = f"http://127.0.0.1:{PORT}" if local_only else None
            if not local_only:
                tunnel = subprocess.Popen(["cloudflared", "tunnel", "--url", f"http://127.0.0.1:{PORT}", "--no-autoupdate"],
                    stdout=tunnel_log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
                children.append(tunnel)
                deadline = time.monotonic() + 60
                while not url:
                    match = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", (STATE / "tunnel.log").read_text(encoding="utf-8", errors="replace"))
                    if match:
                        url = match.group()
                    elif tunnel.poll() is not None or stop.exists() or time.monotonic() > deadline:
                        raise RuntimeError("Tunnel did not start")
                    time.sleep(.5)
            save("running", url)
            while not stop.exists() and all(p.poll() is None for p in children):
                time.sleep(.5)
    except Exception:
        failed = True
    finally:
        # Kill only children created by this manager, including the model worker.
        for child in reversed(children):
            if child.poll() is None:
                subprocess.run(["taskkill", "/PID", str(child.pid), "/T", "/F"], capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
        lock.unlink(missing_ok=True)
        stop.unlink(missing_ok=True)
        save("failed" if failed else "stopped")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["start", "run", "stop", "status", "init"])
    parser.add_argument("--local-only", action="store_true")
    args = parser.parse_args()
    config()
    if args.action == "run":
        run(args.local_only)
    elif args.action == "start":
        command = [sys.executable, str(Path(__file__).resolve()), "run"]
        if args.local_only:
            command.append("--local-only")
        subprocess.Popen(command, creationflags=subprocess.CREATE_NO_WINDOW)
        print("Starting. Use status to check readiness and the current URL.")
    elif args.action == "stop":
        (STATE / "stop").touch()
        print("Stop requested for this service only.")
    elif args.action == "status":
        status()
    else:
        print("Private credentials initialized. No credentials printed.")
