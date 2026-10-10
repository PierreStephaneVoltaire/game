from __future__ import annotations

import gzip
import hashlib
import hmac
import json
import os
from functools import lru_cache

from azure.core.exceptions import ResourceExistsError
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient, ContentSettings
from azure.storage.queue import QueueClient

from backend.errors import ApiError
from .schemas import Batch


@lru_cache(maxsize=1)
def clients():
    account = os.environ["TELEMETRY_STORAGE_ACCOUNT"]
    credential = DefaultAzureCredential()
    return (
        BlobServiceClient(f"https://{account}.blob.core.windows.net", credential=credential).get_container_client("gameplay-traces"),
        QueueClient(f"https://{account}.queue.core.windows.net", "gameplay-traces", credential=credential),
    )


def account_suffix(user_id: str) -> str:
    secret = os.environ["TELEMETRY_HMAC_SECRET"]
    if len(secret) < 32:
        raise RuntimeError("Telemetry identity key is not configured")
    return hmac.new(secret.encode(), user_id.encode(), hashlib.sha256).hexdigest()[:32]


def ingest(batch: Batch, raw: bytes, user_id: str, environment: str) -> dict[str, str]:
    suffix = account_suffix(user_id)
    digest = hashlib.sha256(raw).hexdigest()
    name = f"{environment}/{suffix}/{batch.batchId}.json.gz"
    blobs, queue = clients()
    blob = blobs.get_blob_client(name)
    try:
        blob.upload_blob(gzip.compress(raw, mtime=0), overwrite=False, metadata={"sha256": digest},
                         content_settings=ContentSettings(content_type="application/json", content_encoding="gzip"))
    except ResourceExistsError:
        if blob.get_blob_properties().metadata.get("sha256") != digest:
            raise ApiError(409, "BATCH_ID_CONFLICT", "The batch identifier has different content.")
    queue.send_message(json.dumps({"schemaVersion": 1, "blob": name, "digest": digest,
                                   "environment": environment, "accountSuffix": suffix,
                                   "batchId": batch.batchId}, separators=(",", ":")), time_to_live=-1)
    return {"batchId": batch.batchId, "digest": digest}
