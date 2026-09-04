from __future__ import annotations

import base64
import hashlib
import hmac
import json
from typing import Any

from .config import get_settings
from .errors import ApiError


def encode_cursor(endpoint: str, owner_id: str, values: list[Any]) -> str:
    payload = json.dumps(
        {"endpoint": endpoint, "owner": owner_id, "values": values},
        separators=(",", ":"),
        sort_keys=True,
    ).encode()
    signature = hmac.new(
        get_settings().signing_secret.encode(), payload, hashlib.sha256
    ).digest()
    return base64.urlsafe_b64encode(payload + signature).rstrip(b"=").decode()


def decode_cursor(token: str, endpoint: str, owner_id: str) -> list[Any]:
    try:
        padded = token + "=" * (-len(token) % 4)
        combined = base64.urlsafe_b64decode(padded)
        payload, signature = combined[:-32], combined[-32:]
        expected = hmac.new(
            get_settings().signing_secret.encode(), payload, hashlib.sha256
        ).digest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        decoded = json.loads(payload)
        if decoded["endpoint"] != endpoint or decoded["owner"] != owner_id:
            raise ValueError
        values = decoded["values"]
        if not isinstance(values, list):
            raise ValueError
        return values
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise ApiError(
            400, "INVALID_CONTINUATION_TOKEN", "The continuation token is invalid."
        ) from exc

