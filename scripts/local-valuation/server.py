"""Authenticated loopback API. No user payloads or training records are logged."""
import asyncio
from collections import OrderedDict, deque
from contextlib import asynccontextmanager
import hashlib
import hmac
import json
import multiprocessing as mp
from pathlib import Path
import re
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from model import ROOT, REVISION, Predictor
PREDICTION_TIMEOUT = 43


def worker(pipe):
    try:
        predictor = Predictor()
        pipe.send({"ready": True})
        while True:
            features = pipe.recv()
            pipe.send(predictor.predict(features))
    except Exception:
        # Never expose exception text, paths, training data or request values.
        try:
            pipe.send({"error": "model_unavailable"})
        except (OSError, EOFError):
            pass


class Service:
    def __init__(self, token, meta):
        self.token, self.meta = token, meta
        self.lock = asyncio.Lock()
        self.waiting = 0
        self.cache = OrderedDict()
        self.clients = OrderedDict()
        self.process = None
        self.ready = False
        self.restart_task = None

    def stop(self):
        self.ready = False
        if self.process is not None:
            if self.process.is_alive():
                self.process.terminate()
            self.process.join(timeout=3)
            self.pipe.close()
            self.process = None

    async def start(self):
        self.stop()
        parent, child = mp.get_context("spawn").Pipe()
        self.pipe = parent
        self.process = mp.get_context("spawn").Process(target=worker, args=(child,), daemon=True)
        self.process.start()
        child.close()
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline and self.process.is_alive():
            if self.pipe.poll():
                self.ready = self.pipe.recv().get("ready") is True
                break
            await asyncio.sleep(.1)
        if not self.ready:
            self.stop()

    def valid(self, body):
        if not isinstance(body, dict) or set(body) != {"schemaVersion", "features"} or type(body["schemaVersion"]) is not int or body["schemaVersion"] != 1:
            return False
        features = body["features"]
        if not isinstance(features, dict) or set(features) - set(self.meta["columns"]):
            return False
        enums = {"season": self.meta["seasons"], "breakClass": ["none", "slight", "medium", "large"],
                 "packageTier": ["few", "medium", "many", "hundred"], "accountStyle": ["simple", "regular", "resource"]}
        for key, value in features.items():
            if value is None:
                continue
            if key.startswith("item:"):
                if value not in ["present", "absent"]:
                    return False
            elif key.startswith("binding:"):
                if value not in ["unbound", "transferable", "不出", "遺失", "異常"]:
                    return False
            elif key in enums:
                if value not in enums[key]:
                    return False
            elif type(value) not in (int, float) or not 0 <= value <= (1 if key.startswith("progress:") else 99999):
                return False
        return True

    def rate_allowed(self, client):
        now = time.monotonic()
        while self.clients and next(iter(self.clients.values()))[-1] <= now - 60:
            self.clients.popitem(last=False)
        hits = self.clients.pop(client, deque())
        while hits and hits[0] <= now - 60:
            hits.popleft()
        allowed = len(hits) < 6
        if allowed:
            hits.append(now)
        self.clients[client] = hits
        # Bound anonymous-client memory even during an attack.
        if len(self.clients) > 4096:
            self.clients.popitem(last=False)
        return allowed


service = None


@asynccontextmanager
async def lifespan(app):
    global service
    config = json.loads((ROOT / "work/local-valuation/config.json").read_text(encoding="utf-8"))
    if len(config["token"]) < 40:
        raise ValueError("Invalid service credential")
    meta = json.loads((ROOT / "app/valuation-tabpfn-manifest.json").read_text(encoding="utf-8"))
    service = Service(config["token"], meta)
    await service.start()
    yield
    if service.restart_task:
        service.restart_task.cancel()
    service.stop()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


def response(data, status=200):
    return JSONResponse(data, status_code=status, headers={"Cache-Control": "no-store"})


@app.get("/health")
async def health():
    ready = bool(service and service.ready and service.process and service.process.is_alive())
    return response({"ready": ready, "modelRevision": REVISION}, 200 if ready else 503)


@app.post("/predict")
async def predict(request: Request):
    if not service or not hmac.compare_digest(request.headers.get("authorization", "").encode(), ("Bearer " + service.token).encode()):
        return response({"error": "unauthorized"}, 401)
    if not service.ready:
        return response({"error": "offline"}, 503)
    client = request.headers.get("x-valuation-client", "")
    if not re.fullmatch(r"[a-f0-9]{64}", client):
        return response({"error": "invalid_client"}, 400)
    if not service.rate_allowed(client):
        return response({"error": "rate_limited"}, 429)
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 32768:
            return response({"error": "too_large"}, 413)
    try:
        body = json.loads(raw)
    except (ValueError, UnicodeError):
        return response({"error": "invalid_request"}, 400)
    if not service.valid(body):
        return response({"error": "invalid_request"}, 400)
    key = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
    cached = service.cache.get(key)
    if cached and cached[0] > time.monotonic():
        service.cache.move_to_end(key)
        return response(cached[1])
    if service.waiting >= 4:
        return response({"error": "busy"}, 429)
    service.waiting += 1
    active = False
    try:
        async with asyncio.timeout(PREDICTION_TIMEOUT):
            async with service.lock:
                if await request.is_disconnected():
                    return response({"error": "cancelled"}, 408)
                if not service.ready:
                    return response({"error": "offline"}, 503)
                active = True
                service.pipe.send(body["features"])
                while not service.pipe.poll():
                    if not service.process.is_alive():
                        raise EOFError()
                    await asyncio.sleep(.03)
                result = service.pipe.recv()
                active = False
                if "error" in result:
                    active = True
                    raise EOFError()
                service.cache[key] = (time.monotonic() + 600, result)
                service.cache.move_to_end(key)
                while len(service.cache) > 128:
                    service.cache.popitem(last=False)
                return response(result)
    except (TimeoutError, EOFError, OSError):
        if active or not service.process or not service.process.is_alive():
            service.stop()
            service.restart_task = asyncio.create_task(service.start())
        return response({"error": "timeout"}, 503)
    finally:
        service.waiting -= 1
