from backend.config import get_settings
from backend.errors import ApiError
from backend.pagination import decode_cursor, encode_cursor


def test_cursor_is_endpoint_and_owner_bound(monkeypatch):
    monkeypatch.setenv("SIGNING_SECRET", "test-secret")
    get_settings.cache_clear()
    token = encode_cursor("games", "user-1", ["2026-09-03", "00421873"])
    assert decode_cursor(token, "games", "user-1") == [
        "2026-09-03",
        "00421873",
    ]
    for endpoint, owner in (("graves", "user-1"), ("games", "user-2")):
        try:
            decode_cursor(token, endpoint, owner)
        except ApiError as error:
            assert error.code == "INVALID_CONTINUATION_TOKEN"
        else:
            raise AssertionError("cursor binding was not enforced")
    get_settings.cache_clear()
