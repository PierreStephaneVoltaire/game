"""Exercise a real account and its session against the deployed API."""

import os

import httpx


def expect(response: httpx.Response, status: int) -> dict:
    try:
        body = response.json()
    except ValueError:
        body = {}
    if response.status_code != status:
        error = body.get("error", {})
        raise RuntimeError(
            f"{response.request.method} {response.request.url.path}: "
            f"HTTP {response.status_code}, {error.get('code', 'UNKNOWN')}, "
            f"requestId={error.get('requestId', response.headers.get('x-request-id', 'unknown'))}"
        )
    return body


def check(origin: str, username: str, password: str) -> None:
    credentials = {"username": username, "password": password}
    with httpx.Client(base_url=origin, headers={"Origin": origin}, timeout=30) as client:
        response = client.post("/api/auth/login", json=credentials)
        if response.status_code == 401 and response.json().get("error", {}).get("code") == "USERNAME_NOT_FOUND":
            response = client.post("/api/auth/register", json=credentials)
            expect(response, 201)
            print(f"Created integration account {username}.")
        else:
            expect(response, 200)
        if not client.cookies:
            raise RuntimeError("Authentication returned no session cookie; login cannot persist.")
        user = expect(client.get("/api/me"), 200)["user"]
        if user["username"] != username:
            raise RuntimeError("Session belongs to an unexpected account.")
        expect(client.post("/api/auth/logout"), 200)
        expect(client.get("/api/me"), 401)
        client.cookies.clear()

        expect(client.post("/api/auth/login", json=credentials), 200)
        if expect(client.get("/api/me"), 200)["user"] != user:
            raise RuntimeError("Fresh password login did not restore the same account.")
        session_cookie = "; ".join(
            f"{cookie.name}={cookie.value}" for cookie in client.cookies.jar
        )
        expect(client.post("/api/auth/logout"), 200)
        expect(client.get("/api/me", headers={"Cookie": session_cookie}), 401)
    print("Account login, authenticated session, fresh login, and logout revocation passed.")


if __name__ == "__main__":
    check(os.environ["APP_URL"].rstrip("/"), os.getenv("AUTH_TEST_USERNAME", "admin"),
          os.environ["AUTH_TEST_PASSWORD"])
