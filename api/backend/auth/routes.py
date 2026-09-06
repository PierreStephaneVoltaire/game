from __future__ import annotations

from datetime import UTC, datetime

import azure.functions as func
from sqlalchemy.orm import Session

from backend.config import get_settings
from backend.database import get_session_factory
from backend.errors import ApiError
from backend.http import (
    body,
    clear_cookie_header,
    cookie_header,
    cookie_value,
    endpoint,
    json_response,
    redirect,
    same_origin,
    source,
)

from .discord import begin, profile
from .models import User
from .schemas import DiscordCompleteRequest, LoginRequest, PasswordRequest, RegisterRequest, ResetRequest
from .service import AuthProblem, AuthService
from .sessions import current

bp = func.Blueprint()
OAUTH_COOKIE = "discord_oauth"


def _server_now() -> str:
    return datetime.now(UTC).isoformat()


def _raise(problem: AuthProblem) -> None:
    raise ApiError(problem.status, problem.code, problem.message)


def _session_cookie(token: str) -> str:
    settings = get_settings()
    return cookie_header(
        settings.session_cookie_name,
        token,
        max_age=settings.session_ttl_days * 24 * 60 * 60,
        secure=settings.secure_cookies,
    )


def require_user(request: func.HttpRequest, session: Session) -> User:
    settings = get_settings()
    auth_session = current(
        session,
        cookie_value(request, settings.session_cookie_name),
    )
    if auth_session is None:
        raise ApiError(401, "UNAUTHORIZED", "Sign in to continue.")
    user = session.get(User, auth_session.user_id)
    if user is None:
        raise ApiError(401, "UNAUTHORIZED", "Sign in to continue.")
    session.commit()
    return user


@bp.route(route="auth/register", methods=["POST"])
@endpoint
def register(request: func.HttpRequest) -> func.HttpResponse:
    settings = get_settings()
    same_origin(request, settings)
    data = body(request, RegisterRequest)
    with get_session_factory()() as session:
        try:
            user, token = AuthService(session).register(
                data.username,
                data.password,
                source(request),
            )
        except AuthProblem as problem:
            _raise(problem)
    return json_response(
        {"user": user.model_dump(by_alias=True), "serverNow": _server_now()},
        201,
        {"Set-Cookie": _session_cookie(token)},
    )


@bp.route(route="auth/login", methods=["POST"])
@endpoint
def login(request: func.HttpRequest) -> func.HttpResponse:
    settings = get_settings()
    same_origin(request, settings)
    data = body(request, LoginRequest)
    with get_session_factory()() as session:
        try:
            user, token = AuthService(session).login(
                data.username,
                data.password,
                source(request),
            )
        except AuthProblem as problem:
            _raise(problem)
    return json_response(
        {"user": user.model_dump(by_alias=True), "serverNow": _server_now()},
        headers={"Set-Cookie": _session_cookie(token)},
    )


@bp.route(route="me", methods=["GET"])
@endpoint
def me(request: func.HttpRequest) -> dict[str, object]:
    with get_session_factory()() as session:
        user = require_user(request, session)
        return {"user": AuthService(session).safe_user(user).model_dump(by_alias=True)}


@bp.route(route="auth/logout", methods=["POST"])
@endpoint
def logout(request: func.HttpRequest) -> func.HttpResponse:
    settings = get_settings()
    same_origin(request, settings)
    with get_session_factory()() as session:
        auth_session = current(
            session,
            cookie_value(request, settings.session_cookie_name),
        )
        if auth_session is None:
            raise ApiError(401, "UNAUTHORIZED", "Sign in to continue.")
        session.delete(auth_session)
        session.commit()
    return json_response(
        {"serverNow": _server_now()},
        headers={
            "Set-Cookie": clear_cookie_header(
                settings.session_cookie_name,
                secure=settings.secure_cookies,
            )
        },
    )


@bp.route(route="auth/password", methods=["PUT"])
@endpoint
def password(request: func.HttpRequest) -> dict[str, object]:
    settings = get_settings()
    same_origin(request, settings)
    data = body(request, PasswordRequest)
    with get_session_factory()() as session:
        try:
            AuthService(session).change_password(
                require_user(request, session),
                data.current_password,
                data.new_password,
            )
        except AuthProblem as problem:
            _raise(problem)
    return {"serverNow": _server_now()}


@bp.route(route="auth/password/reset", methods=["POST"])
@endpoint
def reset(request: func.HttpRequest) -> dict[str, object]:
    same_origin(request, get_settings())
    data = body(request, ResetRequest)
    with get_session_factory()() as session:
        try:
            AuthService(session).consume_reset(data.token, data.new_password)
        except AuthProblem as problem:
            _raise(problem)
    return {"serverNow": _server_now()}


def _discord_start(request: func.HttpRequest, mode: str) -> func.HttpResponse:
    settings = get_settings()
    if not settings.discord_client_id or not settings.discord_client_secret:
        raise ApiError(503, "OAUTH_FAILED", "Discord sign-in is not configured.")
    try:
        location, state = begin(
            settings.discord_client_id,
            settings.discord_client_secret,
            settings.discord_callback_url,
            mode,
            settings.signing_secret,
        )
    except Exception as error:
        raise ApiError(400, "OAUTH_FAILED", "Discord sign-in could not start.") from error
    return redirect(
        location,
        cookie_header(
            OAUTH_COOKIE,
            state,
            max_age=600,
            secure=settings.secure_cookies,
        ),
    )


@bp.route(route="auth/discord", methods=["GET"])
@endpoint
def discord_login(request: func.HttpRequest) -> func.HttpResponse:
    return _discord_start(request, "login")


@bp.route(route="auth/discord/link", methods=["GET"])
@endpoint
def discord_link(request: func.HttpRequest) -> func.HttpResponse:
    with get_session_factory()() as session:
        require_user(request, session)
    return _discord_start(request, "link")


@bp.route(route="auth/discord/callback", methods=["GET"])
@endpoint
async def discord_callback(request: func.HttpRequest) -> func.HttpResponse:
    settings = get_settings()
    try:
        discord_id, provider_profile, mode = await profile(
            settings.discord_client_id,
            settings.discord_client_secret,
            settings.discord_callback_url,
            request.url,
            cookie_value(request, OAUTH_COOKIE) or "",
            settings.signing_secret,
        )
        with get_session_factory()() as session:
            service = AuthService(session)
            if mode == "link":
                service.link_discord(require_user(request, session), discord_id)
                destination = f"{settings.app_base_url}/key"
                token = None
                onboarding = None
            else:
                _, token, onboarding = service.resolve_discord(
                    discord_id,
                    provider_profile,
                )
                destination = (
                    f"{settings.app_base_url}/login#discord-onboarding={onboarding}"
                    if onboarding
                    else f"{settings.app_base_url}/key"
                )
    except AuthProblem as problem:
        _raise(problem)
    except Exception as error:
        raise ApiError(400, "OAUTH_FAILED", "Discord sign-in could not be completed.") from error
    cookie = _session_cookie(token) if token else clear_cookie_header(
        OAUTH_COOKIE,
        secure=settings.secure_cookies,
    )
    return redirect(destination, cookie)


@bp.route(route="auth/discord/complete", methods=["POST"])
@endpoint
def discord_complete(request: func.HttpRequest) -> func.HttpResponse:
    settings = get_settings()
    same_origin(request, settings)
    data = body(request, DiscordCompleteRequest)
    with get_session_factory()() as session:
        try:
            user, token = AuthService(session).complete_onboarding(
                data.onboarding_token,
                data.username,
            )
        except AuthProblem as problem:
            _raise(problem)
    return json_response(
        {"user": user.model_dump(by_alias=True), "serverNow": _server_now()},
        headers={"Set-Cookie": _session_cookie(token)},
    )
