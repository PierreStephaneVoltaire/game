import json
from io import BytesIO
from unittest.mock import MagicMock
from urllib.error import HTTPError

import pytest

from tools.configure_api import secret_settings
from tools import check_api, configure_api, setup_api_database


def test_secrets_are_added_on_top_of_terraform_settings(monkeypatch):
    for key, value in {"SIGNING_SECRET": "signing", "DISCORD_CLIENT_SECRET": "discord",
                       "AZURE_DATABASE_CLIENT_ID": "runtime", "AZURE_DATABASE_CLIENT_SECRET": "credential",
                       "AZURE_TENANT_ID": "tenant"}.items():
        monkeypatch.setenv(key, value)
    settings = secret_settings({"DATABASE_URL": "database", "APP_BASE_URL": "https://stage.example.test"})
    assert settings["DATABASE_URL"] == "database"
    assert settings["APP_BASE_URL"] == "https://stage.example.test"
    assert settings["AZURE_CLIENT_ID"] == "runtime"
    assert settings["DISCORD_CLIENT_SECRET"] == "discord"


def test_configured_secrets_do_not_trigger_another_restart(monkeypatch):
    for key in ("SIGNING_SECRET", "DISCORD_CLIENT_SECRET", "AZURE_DATABASE_CLIENT_ID",
                "AZURE_DATABASE_CLIENT_SECRET", "AZURE_TENANT_ID"):
        monkeypatch.setenv(key, "configured")
    existing = secret_settings({"DATABASE_URL": "database", "DATABASE_USERNAME": "vpet_api",
                                "APP_BASE_URL": "https://stage.example.test", "DISCORD_CLIENT_ID": "discord"})
    monkeypatch.setattr(configure_api, "app_settings", lambda: existing)
    write = MagicMock()
    monkeypatch.setattr(configure_api, "write_app_settings", write)
    configure_api.main()
    write.assert_not_called()


def test_missing_terraform_settings_fail_before_writing(monkeypatch):
    for key in ("SIGNING_SECRET", "DISCORD_CLIENT_SECRET", "AZURE_DATABASE_CLIENT_ID",
                "AZURE_DATABASE_CLIENT_SECRET", "AZURE_TENANT_ID"):
        monkeypatch.setenv(key, "configured")
    monkeypatch.setattr(configure_api, "app_settings", lambda: {"DATABASE_URL": "database"})
    write = MagicMock()
    monkeypatch.setattr(configure_api, "write_app_settings", write)
    with pytest.raises(RuntimeError, match="APP_BASE_URL"):
        configure_api.main()
    write.assert_not_called()


def test_api_check_rejects_a_discord_redirect_without_its_cookie(monkeypatch):
    client = MagicMock()
    responses = []
    for status, body in [(200, {"status": "ok"}), (401, {"error": {"code": "UNAUTHORIZED"}})]:
        response = MagicMock(status=status)
        response.__enter__.return_value = response
        response.read.return_value = json.dumps(body).encode()
        responses.append(response)
    from email.message import Message

    headers = Message()
    headers["Location"] = "https://discord.com/api/oauth2/authorize?redirect_uri=https%3A%2F%2Fpreview.example.test%2Fapi%2Fauth%2Fdiscord%2Fcallback"
    responses.append(HTTPError("https://preview.example.test/api/auth/discord", 303, "See Other", headers,
                               BytesIO(b'')))
    client.open.side_effect = responses
    monkeypatch.setattr(check_api, "build_opener", lambda *args: client)
    with pytest.raises(RuntimeError, match="no OAuth state cookie"):
        check_api.check("https://preview.example.test")


def test_api_check_waits_for_settings_but_still_fails_at_deadline(monkeypatch):
    monkeypatch.setenv("APP_URL", "https://preview.example.test/")
    probe = MagicMock(side_effect=[RuntimeError("ORIGIN_REJECTED")] * 30 + [None])
    monkeypatch.setattr(check_api, "check", probe)
    monkeypatch.setattr(check_api.time, "monotonic", lambda: 0)
    monkeypatch.setattr(check_api.time, "sleep", lambda seconds: None)
    check_api.main()
    assert probe.call_count == 31
    probe.assert_called_with("https://preview.example.test")

    probe.side_effect = RuntimeError("ORIGIN_REJECTED")
    monkeypatch.setattr(check_api.time, "monotonic", MagicMock(side_effect=[0, 600]))
    with pytest.raises(RuntimeError, match="ORIGIN_REJECTED"):
        check_api.main()


def test_database_setup_rejects_a_role_owned_by_another_identity(monkeypatch):
    monkeypatch.setenv("AZURE_DATABASE_OBJECT_ID", "11111111-1111-1111-1111-111111111111")
    monkeypatch.setattr(setup_api_database, "app_settings", lambda: {
        "DATABASE_URL": "postgresql+psycopg://example.test/pet?user=admin&sslmode=require",
        "DATABASE_USERNAME": "vpet_api",
    })
    monkeypatch.setattr(setup_api_database, "AzureCliCredential", MagicMock())
    connection = MagicMock()
    connection.__enter__.return_value.execute.return_value.fetchone.return_value = (
        "vpet_api", "service", "22222222-2222-2222-2222-222222222222",
    )
    monkeypatch.setattr(setup_api_database.psycopg, "connect", lambda **kwargs: connection)
    schema = MagicMock()
    monkeypatch.setattr(setup_api_database, "create_schema", schema)
    with pytest.raises(RuntimeError, match="another identity"):
        setup_api_database.main()
    schema.assert_not_called()
