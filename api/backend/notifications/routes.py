from __future__ import annotations

import azure.functions as func

from backend.auth.routes import require_user
from backend.config import get_settings
from backend.database import get_session_factory
from backend.http import body, endpoint, same_origin

from .schemas import NotificationPreference
from .service import get_preference, set_preference

bp = func.Blueprint()


@bp.route(route="me/notifications", methods=["GET"])
@endpoint
def get_notifications(request: func.HttpRequest) -> dict[str, object]:
    with get_session_factory()() as session:
        user = require_user(request, session)
        return NotificationPreference(discord_dm=get_preference(session, user.id)).model_dump(by_alias=True)


@bp.route(route="me/notifications", methods=["PUT"])
@endpoint
def write_notifications(request: func.HttpRequest) -> dict[str, object]:
    same_origin(request, get_settings())
    data = body(request, NotificationPreference)
    with get_session_factory()() as session:
        user = require_user(request, session)
        enabled = set_preference(session, user.id, data.discord_dm)
        return NotificationPreference(discord_dm=enabled).model_dump(by_alias=True)
