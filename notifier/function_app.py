import logging

import azure.functions as func
import httpx

from backend.config import get_settings
from backend.database import get_session_factory
from backend.games import models as game_models  # noqa: F401
from backend.notifications.discord_dm import bot_sender
from backend.notifications.service import dispatch_due

app = func.FunctionApp()


@app.timer_trigger(schedule="0 * * * * *", arg_name="timer", run_on_startup=False, use_monitor=False)
def dispatch_notifications(timer: func.TimerRequest) -> None:
    settings = get_settings()
    if not settings.discord_bot_token:
        logging.warning("Notification dispatch skipped: DISCORD_BOT_TOKEN is not configured.")
        return
    with httpx.Client(timeout=10) as client, get_session_factory()() as session:
        delivered = dispatch_due(session, bot_sender(settings.discord_bot_token, client), settings.app_base_url)
    if delivered:
        logging.info("Notification dispatch delivered=%d", delivered)
