"""Fail deployment when the API is missing or authentication cannot reach its database."""

import json
import os
import secrets
import time
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def check(origin: str) -> None:
    client = build_opener(NoRedirect())

    def request(path, payload=None):
        data = json.dumps(payload).encode() if payload is not None else None
        req = Request(origin + path, data=data,
                      headers={"Origin": origin, "Content-Type": "application/json"})
        try:
            response = client.open(req, timeout=15)
        except HTTPError as error:
            response = error
        with response:
            raw = response.read()
            try:
                body = json.loads(raw)
            except (ValueError, UnicodeDecodeError):
                body = {}
            return response.status, response.headers, body

    status, _, body = request("/api/health")
    if status != 200 or body.get("status") != "ok":
        raise RuntimeError(f"API health check failed (HTTP {status}).")
    status, _, body = request("/api/me")
    if status != 401 or body.get("error", {}).get("code") != "UNAUTHORIZED":
        raise RuntimeError(f"Session route check failed (HTTP {status}).")
    status, _, body = request("/api/auth/login", {
        "username": "check_" + secrets.token_hex(6), "password": secrets.token_urlsafe(24),
    })
    if status != 401 or body.get("error", {}).get("code") != "USERNAME_NOT_FOUND":
        raise RuntimeError(f"Password login/database check failed (HTTP {status}).")
    status, headers, _ = request("/api/auth/discord")
    location = urlsplit(headers.get("Location", ""))
    callback = parse_qs(location.query).get("redirect_uri")
    if status != 303 or location.hostname != "discord.com" or callback != [origin + "/api/auth/discord/callback"]:
        raise RuntimeError(f"Discord authorization redirect check failed (HTTP {status}).")


def main() -> None:
    origin = os.environ["APP_URL"].rstrip("/")
    for attempt in range(24):
        try:
            check(origin)
            print("API health, sessions, password login, and Discord redirect checks passed.")
            return
        except (RuntimeError, URLError, TimeoutError) as error:
            if attempt == 23:
                raise
            print(str(error), flush=True)
            time.sleep(5)


if __name__ == "__main__":
    main()
