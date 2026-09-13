import asyncio
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import azure.functions as func
import pytest
from azure.core.exceptions import ResourceExistsError
from pydantic import ValidationError

from backend.errors import ApiError
from backend.telemetry import routes, storage
from backend.telemetry.schemas import Batch

worker_path = Path(__file__).resolve().parents[3] / "telemetry-worker"
spec = importlib.util.spec_from_file_location("trace_processor", worker_path / "processor.py")
processor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(processor)


def payload(count=1):
    operation_id, stream_id = str(uuid4()), str(uuid4())
    return {"schemaVersion": 1, "batchId": str(uuid4()), "records": [{
        "schemaVersion": 1, "streamId": stream_id, "operationId": operation_id,
        "parentId": None, "sequence": 1, "gameHash": "00421873", "runStartedAt": 1_800_000_000_000,
        "mode": "streaming", "timezone": "America/Toronto", "simulationAt": 1_800_000_000_000,
        "recordedAt": 1_800_000_000_001, "engineBuild": "a" * 64, "contentVersion": "content-1",
        "kind": "command", "summary": {"stateVersion": 2, "balance": 50, "endingKind": None, "commandType": "wait", "accepted": True},
        "part": index, "parts": count, "data": [{"path": [], "value": {"input": {"type": "wait"}}}],
    } for index in range(count)]}


class Blobs:
    def __init__(self):
        self.values = {}

    def get_blob_client(self, name):
        parent = self

        class Blob:
            def upload_blob(self, data, **kwargs):
                assert kwargs["overwrite"] is False
                if name in parent.values:
                    raise ResourceExistsError("exists")
                parent.values[name] = data, kwargs["metadata"]

            def get_blob_properties(self):
                return SimpleNamespace(metadata=parent.values[name][1])

            def download_blob(self, **kwargs):
                assert kwargs == {"decompress": False}
                return SimpleNamespace(readall=lambda: parent.values[name][0])

        return Blob()


def ingest(data, monkeypatch, blobs=None, queue=None):
    blobs, queue = blobs or Blobs(), queue or MagicMock()
    monkeypatch.setenv("TELEMETRY_HMAC_SECRET", "independent-stable-key" * 3)
    monkeypatch.setattr(storage, "clients", lambda: (blobs, queue))
    raw = json.dumps(data, separators=(",", ":")).encode()
    result = storage.ingest(Batch.model_validate(data), raw, "original-account", "production")
    return result, raw, blobs, queue


def test_lost_acknowledgement_and_duplicate_delivery_are_safe(monkeypatch):
    data = payload()
    result, raw, blobs, queue = ingest(data, monkeypatch)
    assert result == {"batchId": data["batchId"], "digest": hashlib.sha256(raw).hexdigest()}
    assert ingest(data, monkeypatch, blobs, queue)[0] == result
    assert len(blobs.values) == 1
    assert queue.send_message.call_count == 2
    assert queue.send_message.call_args.kwargs["time_to_live"] == -1
    assert gzip.decompress(next(iter(blobs.values.values()))[0]) == raw
    assert b"original-account" not in raw
    changed = json.loads(raw)
    changed["records"][0]["summary"]["balance"] = 90
    with pytest.raises(ApiError) as caught:
        ingest(changed, monkeypatch, blobs, queue)
    assert caught.value.status_code == 409


def test_blob_survives_queue_failure_and_retry_can_enqueue_it(monkeypatch):
    blobs, queue, data = Blobs(), MagicMock(), payload()
    queue.send_message.side_effect = RuntimeError("queue offline")
    with pytest.raises(RuntimeError):
        ingest(data, monkeypatch, blobs, queue)
    assert len(blobs.values) == 1
    queue.send_message.side_effect = None
    ingest(data, monkeypatch, blobs, queue)
    assert len(blobs.values) == 1


def test_worker_recovers_partial_writes_and_reordered_duplicate_delivery(monkeypatch):
    data = payload(150)
    _, raw, blobs, queue = ingest(data, monkeypatch)
    reference = queue.send_message.call_args.args[0].encode()
    entities = {}
    calls = 0

    def write(operations):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("storage unavailable")
        assert len(operations) <= 100
        for operation, entity, options in operations:
            assert operation == "upsert" and options == {"mode": "replace"}
            entities[entity["PartitionKey"], entity["RowKey"]] = entity

    table = SimpleNamespace(submit_transaction=write)
    with pytest.raises(RuntimeError):
        processor.process_reference(reference, blobs, table)
    assert len(entities) == 100
    assert processor.process_reference(reference, blobs, table)["rows"] == 150
    processor.process_reference(reference, blobs, table)
    assert len(entities) == 150
    data["batchId"] = str(uuid4())
    data["records"].reverse()
    _, _, _, queue = ingest(data, monkeypatch, blobs)
    processor.process_reference(queue.send_message.call_args.args[0].encode(), blobs, table)
    assert len(entities) == 150
    assert gzip.decompress(next(iter(blobs.values.values()))[0]) == raw
    assert all("original-account" not in key[0] for key in entities)


def test_failed_worker_preserves_trace_for_native_poison_handling(monkeypatch):
    _, _, blobs, queue = ingest(payload(), monkeypatch)
    reference = json.loads(queue.send_message.call_args.args[0])
    reference["digest"] = "0" * 64
    for _ in range(6):
        with pytest.raises(ValueError, match="digest"):
            processor.process_reference(json.dumps(reference).encode(), blobs, MagicMock())
    assert len(blobs.values) == 1
    host = json.loads((worker_path / "host.json").read_text())
    assert host["extensions"]["queues"]["maxDequeueCount"] == 6
    assert host["extensions"]["queues"]["messageEncoding"] == "none"


@pytest.mark.parametrize("value", [float("nan"), float("inf"), {"password": "private"}, {"__proto__": {}}, 2**60])
def test_invalid_payload_values_are_rejected(value):
    data = payload()
    data["records"][0]["data"][0]["value"] = value
    with pytest.raises(ValidationError):
        Batch.model_validate(data)


def test_ingest_checks_origin_account_and_digest_before_acceptance(monkeypatch):
    monkeypatch.setenv("TELEMETRY_ENABLED", "true")
    monkeypatch.setattr(routes, "get_settings", lambda: SimpleNamespace(app_base_url="https://example.test", environment="preview"))
    monkeypatch.setattr(routes, "get_session_factory", lambda: MagicMock())
    monkeypatch.setattr(routes, "require_user", lambda *args: SimpleNamespace(id="original-account"))
    stored = MagicMock(return_value={"accepted": True})
    monkeypatch.setattr(routes, "ingest", stored)
    raw = json.dumps(payload()).encode()
    headers = {"origin": "https://example.test", "content-type": "application/json", "x-content-digest": hashlib.sha256(raw).hexdigest(), "x-telemetry-owner": "original-account"}

    def request(changes):
        return json.loads(asyncio.run(routes.telemetry_batch(func.HttpRequest("POST", "https://example.test/api/telemetry/batches", headers={**headers, **changes}, body=raw))))["statusCode"]

    assert request({"origin": "https://foreign.test"}) == 403
    assert request({"x-telemetry-owner": "another-account"}) == 403
    assert request({"x-content-digest": "0" * 64}) == 422
    stored.assert_not_called()
    assert request({}) == 200
    assert stored.call_args.args[-2:] == ("original-account", "preview")


def test_account_suffix_is_stable_and_identity_key_is_independent(monkeypatch):
    monkeypatch.setenv("TELEMETRY_HMAC_SECRET", "stable-key" * 8)
    first = storage.account_suffix("first")
    monkeypatch.setenv("SIGNING_SECRET", "rotated-authentication-key")
    assert first == storage.account_suffix("first")
    assert first != storage.account_suffix("second")
    assert len(first) == 32
