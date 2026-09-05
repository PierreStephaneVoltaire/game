from __future__ import annotations

import azure.functions as func

from backend.database import get_session_factory
from backend.http import endpoint, json_response

from .service import content_manifest, immutable_bundle

bp = func.Blueprint()


@bp.route(route="content/manifest", methods=["GET"])
@endpoint
def get_manifest(request: func.HttpRequest) -> func.HttpResponse:
    with get_session_factory()() as session:
        manifest = content_manifest(session)
    headers = {"Cache-Control": "no-cache", "ETag": f'"{manifest.version}"'}
    if request.headers.get("if-none-match") == headers["ETag"]:
        return func.HttpResponse(status_code=304, headers=headers)
    return json_response(manifest, headers=headers)


@bp.route(route="content/{content_version}", methods=["GET"])
@endpoint
def get_bundle(request: func.HttpRequest) -> func.HttpResponse:
    with get_session_factory()() as session:
        bundle = immutable_bundle(session, request.route_params["content_version"])
    return json_response(
        bundle,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
