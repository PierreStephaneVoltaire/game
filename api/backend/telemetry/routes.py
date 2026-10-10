from __future__ import annotations

import hashlib
import hmac
import json
import os
import re

import azure.functions as func

from backend.auth.routes import require_user
from backend.config import get_settings
from backend.database import get_session_factory
from backend.errors import ApiError
from backend.http import endpoint, same_origin
from .schemas import Batch
from .storage import ingest

bp = func.Blueprint()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


@bp.route(route="telemetry/batches", methods=["POST"])
@endpoint
def telemetry_batch(request: func.HttpRequest) -> dict[str, str]:
    settings = get_settings()
    same_origin(request, settings)
    if os.getenv("TELEMETRY_ENABLED") != "true":
        raise ApiError(503, "TELEMETRY_UNAVAILABLE", "Logging ingestion is not enabled.")
    raw = request.get_body()
    if not raw or len(raw) > 256 * 1024:
        raise ApiError(413, "BATCH_SIZE", "The logging batch size is invalid.")
    if request.headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
        raise ApiError(400, "BATCH_TYPE", "Logging batches require JSON.")
    digest = request.headers.get("x-content-digest", "")
    if not hmac.compare_digest(digest, hashlib.sha256(raw).hexdigest()):
        raise ApiError(422, "DIGEST_MISMATCH", "The logging batch digest does not match.")
    try:
        data = json.loads(raw, object_pairs_hook=unique_object)
    except (ValueError, UnicodeDecodeError, RecursionError) as error:
        raise ApiError(422, "INVALID_BATCH", "The logging batch is invalid.") from error
    batch = Batch.model_validate(data)
    with get_session_factory()() as session:
        user = require_user(request, session)
        if not hmac.compare_digest(request.headers.get("x-telemetry-owner", ""), user.id):
            raise ApiError(403, "ACCOUNT_MISMATCH", "The original logging account must sign in.")
        user_id = user.id
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,31}", settings.environment):
        raise RuntimeError("Invalid telemetry environment")
    return ingest(batch, raw, user_id, settings.environment)
