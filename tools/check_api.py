"""Wait for API readiness and a usable Discord authorization redirect."""

import json
import os
import time
from http.cookies import SimpleCookie
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
    status, headers, _ = request("/api/auth/discord")
    location = urlsplit(headers.get("Location", ""))
    callback = parse_qs(location.query).get("redirect_uri")
    if status != 303 or location.hostname != "discord.com" or callback != [origin + "/api/auth/discord/callback"]:
        raise RuntimeError(f"Discord authorization redirect check failed (HTTP {status}).")
    cookies = SimpleCookie()
    for header in headers.get_all("Set-Cookie", []):
        cookies.load(header)
    if "discord_oauth" not in cookies or not cookies["discord_oauth"].value:
        raise RuntimeError("Discord redirect returned no OAuth state cookie; callback cannot succeed.")


def main() -> None:
    origin = os.environ["APP_URL"].rstrip("/")
    deadline = time.monotonic() + 600
    while True:
        try:
            check(origin)
            print("API health, anonymous session, and Discord state-cookie checks passed.")
            return
        except (RuntimeError, URLError, TimeoutError) as error:
            if time.monotonic() >= deadline:
                raise
            print(str(error), flush=True)
            time.sleep(5)


if __name__ == "__main__":
    main()
