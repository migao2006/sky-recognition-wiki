import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, Mock, patch
import asyncio

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts/local-valuation"))
import server


class LocalServiceTest(unittest.TestCase):
    def setUp(self):
        self.meta = json.loads((ROOT / "app/valuation-tabpfn-manifest.json").read_text())
        self.service = server.Service("x" * 48, self.meta)

    def test_validation(self):
        self.assertTrue(self.service.valid({"schemaVersion": 1, "features": {"season": None}}))
        for f in [{"price": 3500}, {"season": "fake"}, {"packageCount": float("nan")}, {"packageCount": True}]:
            self.assertFalse(self.service.valid({"schemaVersion": 1, "features": f}))
        for n in (0,99,100,200):
            self.assertTrue(self.service.valid({'schemaVersion':1,'features':{'packageCount':n}}))
        for n in (-1,1.5,'100',100000,float('inf')):
            self.assertFalse(self.service.valid({'schemaVersion':1,'features':{'packageCount':n}}))

    def test_global_rate_limit(self):
        self.assertTrue(all(self.service.rate_allowed("client") for _ in range(6)))
        self.assertFalse(self.service.rate_allowed("client"))
        self.assertTrue(self.service.rate_allowed("another"))

    def test_manifest_has_no_training_rows(self):
        self.assertEqual(self.meta["sampleCount"], 44)
        self.assertNotIn("rows", self.meta)
        self.assertNotIn("prices", self.meta)


class RequestStub:
    headers = {"authorization": "Bearer " + "x" * 48, "x-valuation-client": "a" * 64}

    async def stream(self):
        yield b'{"schemaVersion":1,"features":{"season":null}}'

    async def is_disconnected(self):
        return False


class FailureTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous = server.service
        self.service = server.Service("x" * 48, {"columns": ["season"], "seasons": []})
        self.service.ready = True
        self.service.process = Mock()
        self.service.process.is_alive.return_value = True
        self.service.pipe = Mock()
        self.service.pipe.poll.return_value = False
        self.service.start = AsyncMock()
        self.service.stop = Mock()
        server.service = self.service

    async def asyncTearDown(self):
        if self.service.restart_task:
            await self.service.restart_task
        server.service = self.previous

    async def test_full_queue_rejects_without_inference(self):
        self.service.waiting = 4
        result = await server.predict(RequestStub())
        self.assertEqual(result.status_code, 429)
        self.service.pipe.send.assert_not_called()

    async def test_active_timeout_restarts_worker(self):
        with patch.object(server, "PREDICTION_TIMEOUT", .01):
            result = await server.predict(RequestStub())
        self.assertEqual(result.status_code, 503)
        self.service.stop.assert_called_once()
        self.assertEqual(self.service.waiting, 0)

    async def test_waiting_timeout_does_not_kill_active_worker(self):
        await self.service.lock.acquire()
        try:
            with patch.object(server, "PREDICTION_TIMEOUT", .01):
                result = await server.predict(RequestStub())
            self.assertEqual(result.status_code, 503)
            self.service.pipe.send.assert_not_called()
            self.service.stop.assert_not_called()
        finally:
            self.service.lock.release()

    async def test_disconnected_queued_request_never_runs(self):
        request = RequestStub()
        request.is_disconnected = AsyncMock(return_value=True)
        self.assertEqual((await server.predict(request)).status_code, 408)
        self.service.pipe.send.assert_not_called()


if __name__ == "__main__":
    unittest.main()
