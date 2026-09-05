from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from typing import Any

import azure.functions as func
from sqlalchemy.orm import Session

from backend.auth.routes import require_user
from backend.config import get_settings
from backend.content.service import CONTENT_VERSION_HEADER, require_current_content_version
from backend.database import get_session_factory
from backend.errors import ApiError
from backend.http import body, endpoint, json_response, limit, same_origin
from backend.pagination import decode_cursor, encode_cursor

from .schemas import CreateGame, DeathWrite, GameWrite
from .service import GameService

bp = func.Blueprint()
service = GameService()


def _content(request: func.HttpRequest, session: Session) -> str:
    version = require_current_content_version(
        request.headers.get(CONTENT_VERSION_HEADER),
        session,
    )
    session.commit()
    return version


def _if_match(value: str | None) -> int:
    if value is None:
        raise ApiError(400, "INVALID_REQUEST", "If-Match is required.")
    try:
        return int(value.strip().strip('"'))
    except ValueError as error:
        raise ApiError(400, "INVALID_REQUEST", "If-Match must contain a state version.") from error


def _page(
    items: list[Any],
    page_size: int,
    route: str,
    user_id: str,
    cursor_values: Callable[[Any], list[object]],
) -> dict[str, Any]:
    page, extra = items[:page_size], items[page_size:]
    token = encode_cursor(route, user_id, cursor_values(page[-1])) if extra and page else None
    return {"items": page, "continuationToken": token}


@bp.route(route="games", methods=["POST"])
@endpoint
def create_game(request: func.HttpRequest) -> func.HttpResponse:
    same_origin(request, get_settings())
    data = body(request, CreateGame)
    with get_session_factory()() as session:
        user = require_user(request, session)
        result = service.create(session, user.id, _content(request, session), data)
    return json_response(result, 201, {"ETag": f'"{result["stateVersion"]}"'})


@bp.route(route="games/{game_hash}", methods=["GET"])
@endpoint
def get_game(request: func.HttpRequest) -> func.HttpResponse:
    with get_session_factory()() as session:
        user = require_user(request, session)
        result = service.get(session, user.id, request.route_params["game_hash"])
        require_current_content_version(
            request.headers.get(CONTENT_VERSION_HEADER),
            session,
        )
    return json_response(result, headers={"ETag": f'"{result["stateVersion"]}"'})


@bp.route(route="games/{game_hash}", methods=["PUT"])
@endpoint
def write_game(request: func.HttpRequest) -> dict[str, Any]:
    same_origin(request, get_settings())
    data = body(request, GameWrite)
    with get_session_factory()() as session:
        user = require_user(request, session)
        return service.write(
            session,
            user.id,
            _content(request, session),
            request.route_params["game_hash"],
            _if_match(request.headers.get("if-match")),
            data,
        )


@bp.route(route="games/{game_hash}/death", methods=["POST"])
@endpoint
def record_death(request: func.HttpRequest) -> dict[str, Any]:
    same_origin(request, get_settings())
    data = body(request, DeathWrite)
    with get_session_factory()() as session:
        user = require_user(request, session)
        return service.write(
            session,
            user.id,
            _content(request, session),
            request.route_params["game_hash"],
            _if_match(request.headers.get("if-match")),
            data,
            death=True,
            cause_event_id=data.cause_event_id,
        )


@bp.route(route="games/{game_hash}/events", methods=["GET"])
@endpoint
def game_events(request: func.HttpRequest) -> dict[str, Any]:
    page_size = limit(request)
    game_hash = request.route_params["game_hash"]
    with get_session_factory()() as session:
        user = require_user(request, session)
        require_current_content_version(
            request.headers.get(CONTENT_VERSION_HEADER),
            session,
        )
        route = f"game-events:{game_hash}"
        token = request.params.get("continuationToken")
        values = decode_cursor(token, route, user.id) if token else [0]
        if len(values) != 1 or not isinstance(values[0], int):
            raise ApiError(400, "INVALID_CONTINUATION_TOKEN", "The continuation token is invalid.")
        events = service.events(session, user.id, game_hash, values[0], page_size)
        return _page(events, page_size, route, user.id, lambda event: [event["sequence"]])


def _list_games(
    dead: bool,
    request: func.HttpRequest,
    session: Session,
    page_size: int,
) -> dict[str, Any]:
    user = require_user(request, session)
    require_current_content_version(
        request.headers.get(CONTENT_VERSION_HEADER),
        session,
    )
    route = "graves" if dead else "games"
    after = None
    token = request.params.get("continuationToken")
    if token:
        values = decode_cursor(token, route, user.id)
        if len(values) != 2 or not all(isinstance(value, str) for value in values):
            raise ApiError(400, "INVALID_CONTINUATION_TOKEN", "The continuation token is invalid.")
        try:
            after = (datetime.fromisoformat(values[0]), values[1])
        except ValueError as error:
            raise ApiError(400, "INVALID_CONTINUATION_TOKEN", "The continuation token is invalid.") from error
    games = service.list_games(session, user.id, dead, after, page_size)
    items = [
        {
            "gameHash": game.game_hash,
            "state": game.state_json,
            "stateVersion": game.state_version,
            "diedAt": game.died_at,
            "updatedAt": game.updated_at,
        }
        for game in games
    ]
    timestamp = "diedAt" if dead else "updatedAt"
    return _page(
        items,
        page_size,
        route,
        user.id,
        lambda game: [game[timestamp].isoformat(), game["gameHash"]],
    )


@bp.route(route="me/games", methods=["GET"])
@endpoint
def list_games(request: func.HttpRequest) -> dict[str, Any]:
    with get_session_factory()() as session:
        return _list_games(False, request, session, limit(request))


@bp.route(route="me/graves", methods=["GET"])
@endpoint
def list_graves(request: func.HttpRequest) -> dict[str, Any]:
    with get_session_factory()() as session:
        return _list_games(True, request, session, limit(request))


@bp.route(route="graves/{game_hash}", methods=["GET"])
@endpoint
def get_grave(request: func.HttpRequest) -> dict[str, Any]:
    with get_session_factory()() as session:
        user = require_user(request, session)
        require_current_content_version(
            request.headers.get(CONTENT_VERSION_HEADER),
            session,
        )
        return service.grave(session, user.id, request.route_params["game_hash"])
