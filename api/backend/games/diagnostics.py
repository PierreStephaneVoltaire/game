from contextlib import contextmanager
import logging

from backend.errors import ApiError


@contextmanager
def save_diagnostics(request, data):
    try:
        yield
    except ApiError as error:
        logging.warning(
            "Game save rejected reason=%s code=%s request=%s batch=%s version=%s cursor=%s",
            error.message, error.code, request.headers.get("x-request-id", "unknown")[:128],
            getattr(data, "batch_id", None) or getattr(data, "creation_batch_id", None),
            request.headers.get("if-match", "")[:32], getattr(data, "previous_event_id", None),
        )
        raise
