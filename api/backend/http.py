from __future__ import annotations

import inspect
import json
import logging
from datetime import date, datetime
from http.cookies import SimpleCookie
from typing import Any, Awaitable, Callable, TypeVar
from urllib.parse import urlsplit
from uuid import uuid4

import azure.functions as func
from pydantic import BaseModel, ValidationError

from .config import Settings
from .errors import ApiError, error_payload

HandlerResult = func.HttpResponse | BaseModel | dict[str, Any] | list[Any] | None
Handler = Callable[[func.HttpRequest], HandlerResult | Awaitable[HandlerResult]]
Model = TypeVar("Model", bound=BaseModel)


def _default(value: object) -> str:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    raise TypeError(f"{type(value).__name__} is not JSON serializable")


def json_response(
    value: HandlerResult,
    status: int = 200,
    headers: dict[str, str] | None = None,
) -> func.HttpResponse:
    if isinstance(value, BaseModel):
        value = value.model_dump(by_alias=True, mode="json")
    return func.HttpResponse(
        json.dumps(value, default=_default, separators=(",", ":")),
        status_code=status,
        headers=headers,
        mimetype="application/json",
    )


def redirect(location: str, cookie: str | None = None) -> func.HttpResponse:
    headers = {"Location": location}
    if cookie:
        headers["Set-Cookie"] = cookie
    return func.HttpResponse(status_code=303, headers=headers)


def endpoint(handler: Handler) -> Handler:
    async def wrapped(req: func.HttpRequest) -> func.HttpResponse:
        request_id = req.headers.get("x-request-id", str(uuid4()))
        try:
            result = handler(req)
            if inspect.isawaitable(result):
                result = await result
            response = result if isinstance(result, func.HttpResponse) else json_response(result)
        except ValidationError:
            response = json_response(
                error_payload(ApiError(422, "INVALID_REQUEST", "The request is invalid."), request_id),
                422,
            )
        except ApiError as error:
            response = json_response(error_payload(error, request_id), error.status_code)
        except Exception:
            logging.exception("Unhandled API error [%s]", request_id)
            response = json_response(
                error_payload(ApiError(500, "INTERNAL_ERROR", "The request could not be completed."), request_id),
                500,
            )
        response.headers["x-request-id"] = request_id
        return response

    # Azure indexes the wrapper's binding signature and uses its name as the route name.
    wrapped.__name__ = handler.__name__
    return wrapped


def body(request: func.HttpRequest, model: type[Model]) -> Model:
    try:
        return model.model_validate(request.get_json())
    except ValueError as error:
        raise ApiError(422, "INVALID_REQUEST", "The request is invalid.") from error


def cookie_value(request: func.HttpRequest, name: str) -> str | None:
    cookie = SimpleCookie()
    cookie.load(request.headers.get("cookie", ""))
    return cookie[name].value if name in cookie else None


def cookie_header(name: str, value: str, *, max_age: int, secure: bool) -> str:
    cookie = SimpleCookie()
    cookie[name] = value
    morsel = cookie[name]
    morsel["path"] = "/"
    morsel["max-age"] = str(max_age)
    morsel["httponly"] = True
    morsel["samesite"] = "Lax"
    if secure:
        morsel["secure"] = True
    return morsel.OutputString()


def clear_cookie_header(name: str, *, secure: bool) -> str:
    return cookie_header(name, "", max_age=0, secure=secure)


def same_origin(request: func.HttpRequest, settings: Settings) -> None:
    supplied = urlsplit(request.headers.get("origin", ""))
    expected = urlsplit(settings.app_base_url)
    if (supplied.scheme.lower(), supplied.netloc.lower()) != (
        expected.scheme.lower(),
        expected.netloc.lower(),
    ):
        raise ApiError(403, "ORIGIN_REJECTED", "The request origin is not allowed.")


def source(request: func.HttpRequest) -> str:
    return request.headers.get("x-forwarded-for", "unknown").split(",", 1)[0].strip()


def limit(request: func.HttpRequest) -> int:
    try:
        value = int(request.params.get("limit", "25"))
    except ValueError as error:
        raise ApiError(422, "INVALID_REQUEST", "Limit must be between 1 and 100.") from error
    if not 1 <= value <= 100:
        raise ApiError(422, "INVALID_REQUEST", "Limit must be between 1 and 100.")
    return value
