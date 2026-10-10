from __future__ import annotations

import gzip
import hashlib
import json
import re
from io import BytesIO
from collections import defaultdict

from backend.telemetry.schemas import Batch


def process_reference(message: bytes, blobs, table) -> dict[str, int]:
    reference = json.loads(message)
    if set(reference) != {"schemaVersion", "blob", "digest", "environment", "accountSuffix", "batchId"} or reference["schemaVersion"] != 1:
        raise ValueError("Invalid trace reference")
    environment, suffix, batch_id = reference["environment"], reference["accountSuffix"], reference["batchId"]
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,31}", environment) or not re.fullmatch(r"[0-9a-f]{32}", suffix):
        raise ValueError("Invalid trace partition")
    if not re.fullmatch(r"[0-9a-f-]{36}", batch_id) or not re.fullmatch(r"[0-9a-f]{64}", reference["digest"]):
        raise ValueError("Invalid trace identifier")
    if reference["blob"] != f"{environment}/{suffix}/{batch_id}.json.gz":
        raise ValueError("Invalid trace blob path")
    compressed = blobs.get_blob_client(reference["blob"]).download_blob(decompress=False).readall()
    with gzip.GzipFile(fileobj=BytesIO(compressed)) as stream:
        raw = stream.read(256 * 1024 + 1)
    if len(raw) > 256 * 1024 or hashlib.sha256(raw).hexdigest() != reference["digest"]:
        raise ValueError("Invalid trace blob digest")
    batch = Batch.model_validate_json(raw)
    if batch.batchId != batch_id:
        raise ValueError("Trace batch identity mismatch")
    partitions = defaultdict(list)
    for record in batch.records:
        partition = f"{environment}|{record.gameHash}|{suffix}|{record.runStartedAt:016d}"
        row = f"{record.simulationAt:016d}|{record.streamId}|{record.sequence:016d}|{record.operationId}|{record.part:016d}"
        partitions[partition].append({
            "PartitionKey": partition, "RowKey": row,
            "StreamId": record.streamId, "OperationId": record.operationId,
            "ParentId": record.parentId or "", "Sequence": record.sequence,
            "Part": record.part, "Parts": record.parts,
            "SimulationAt": record.simulationAt, "RecordedAt": record.recordedAt,
            "Kind": record.kind, "Mode": record.mode, "Timezone": record.timezone,
            "EngineBuild": record.engineBuild, "ContentVersion": record.contentVersion,
            "Summary": json.dumps(record.summary.model_dump(), separators=(",", ":")),
            "TraceBlob": reference["blob"], "BatchId": batch_id, "BatchDigest": reference["digest"],
        })
    transactions = 0
    for entities in partitions.values():
        for start in range(0, len(entities), 100):
            table.submit_transaction([("upsert", entity, {"mode": "replace"}) for entity in entities[start:start + 100]])
            transactions += 1
    return {"bytes": len(raw), "rows": len(batch.records), "transactions": transactions}
