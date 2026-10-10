import logging
import os
from functools import lru_cache

import azure.functions as func
from azure.data.tables import TableClient
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient

from processor import process_reference

app = func.FunctionApp()


@lru_cache(maxsize=1)
def clients():
    account = os.environ["TELEMETRY_STORAGE_ACCOUNT"]
    credential = DefaultAzureCredential()
    return (
        BlobServiceClient(f"https://{account}.blob.core.windows.net", credential=credential).get_container_client("gameplay-traces"),
        TableClient(f"https://{account}.table.core.windows.net", "GameplayRuns", credential=credential),
    )


@app.queue_trigger(arg_name="message", queue_name="gameplay-traces", connection="TraceQueue")
def process_gameplay_trace(message: func.QueueMessage):
    try:
        metrics = process_reference(message.get_body(), *clients())
        logging.info("Gameplay trace processed: bytes=%d rows=%d transactions=%d", metrics["bytes"], metrics["rows"], metrics["transactions"])
    except Exception as error:
        logging.error("Gameplay trace processing failed: cause=%s", type(error).__name__)
        raise RuntimeError("Gameplay trace processing failed") from None
