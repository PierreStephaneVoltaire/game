from __future__ import annotations

import httpx

from .service import DeliveryFailed

API = "https://discord.com/api/v10"


def bot_sender(bot_token: str, client: httpx.Client):
    headers = {"Authorization": f"Bot {bot_token}"}

    def send(discord_user_id: str, content: str) -> None:
        try:
            channel = client.post(f"{API}/users/@me/channels", headers=headers, json={"recipient_id": discord_user_id})
            if channel.status_code >= 400:
                raise DeliveryFailed(channel.status_code == 429 or channel.status_code >= 500)
            message = client.post(
                f"{API}/channels/{channel.json()['id']}/messages",
                headers=headers,
                json={"content": content, "allowed_mentions": {"parse": []}},
            )
            if message.status_code >= 400:
                raise DeliveryFailed(message.status_code == 429 or message.status_code >= 500)
        except httpx.HTTPError as error:
            raise DeliveryFailed(True) from error

    return send
