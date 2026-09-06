from __future__ import annotations

from typing import Any

class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        **details: Any,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


def error_payload(error: ApiError, request_id: str) -> dict[str, object]:
    body: dict[str, object] = {
        "code": error.code,
        "message": error.message,
        "requestId": request_id,
    }
    body.update(error.details)
    return {"error": body}
