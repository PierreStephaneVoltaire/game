import json
from io import BytesIO
from unittest.mock import MagicMock
from urllib.error import HTTPError

import pytest

from tools.configure_api import deployment_settings
from tools import check_api, configure_api, setup_api_database


def test_preview_settings_use_the_preview_origin_and_runtime_credentials(monkeypatch):
    values = {
        "APP_URL": "https://preview.example.test/", "API_ENVIRONMENT": "staging",
        "SIGNING_SECRET": "signing", "DISCORD_CLIENT_SECRET": "discord",
        "AZURE_DATABASE_CLIENT_ID": "runtime", "AZURE_DATABASE_CLIENT_SECRET": "credential",
        "AZURE_TENANT_ID": "tenant",
    }
    for key, value in values.items():
        monkeypatch.setenv(key, value)
    settings = deployment_settings({"DATABASE_URL": "database", "APP_BASE_URL": "https://production.example.test"})
    assert settings["APP_BASE_URL"] == "https://preview.example.test"
    assert settings["DISCORD_CALLBACK_URL"] == "https://preview.example.test/api/auth/discord/callback"
    assert settings["ENVIRONMENT"] == "preview"
    assert settings["DATABASE_URL"] == "database"
    assert settings["AZURE_CLIENT_ID"] == "runtime"
    assert settings["DISCORD_CLIENT_SECRET"] == "discord"

    monkeypatch.setenv("API_ENVIRONMENT", "default")
    monkeypatch.setenv("APP_URL", "https://production.example.test")
    settings = deployment_settings(settings)
    assert settings["ENVIRONMENT"] == "production"
    assert settings["APP_BASE_URL"] == "https://production.example.test"
    assert settings["DISCORD_CALLBACK_URL"] == "https://production.example.test/api/auth/discord/callback"


def test_new_preview_is_configured_only_after_creation(monkeypatch):
    monkeypatch.setenv("API_ENVIRONMENT", "staging")
    monkeypatch.setenv("STATIC_WEB_APP_NAME", "app")
    monkeypatch.setenv("RESOURCE_GROUP_NAME", "group")
    monkeypatch.delenv("APP_URL", raising=False)
    azure = MagicMock(return_value=[{"name": "default", "hostname": "production.example.test"}])
    monkeypatch.setattr(configure_api, "azure", azure)
    configure_api.main()
    assert azure.call_count == 1
    assert azure.call_args.args[:3] == ("staticwebapp", "environment", "list")


def test_existing_preview_settings_do_not_trigger_another_restart(monkeypatch):
    monkeypatch.setenv("API_ENVIRONMENT", "staging")
    monkeypatch.setenv("STATIC_WEB_APP_NAME", "app")
    monkeypatch.setenv("RESOURCE_GROUP_NAME", "group")
    monkeypatch.delenv("APP_URL", raising=False)
    for key in ("SIGNING_SECRET", "DISCORD_CLIENT_SECRET", "AZURE_DATABASE_CLIENT_ID",
                "AZURE_DATABASE_CLIENT_SECRET", "AZURE_TENANT_ID"):
        monkeypatch.setenv(key, "configured")
    azure = MagicMock(return_value=[{"name": "staging", "hostname": "preview.example.test"}])
    monkeypatch.setattr(configure_api, "azure", azure)

    def settings(environment="default"):
        result = deployment_settings({"DATABASE_URL": "database", "DATABASE_USERNAME": "vpet_api",
                                      "DISCORD_CLIENT_ID": "discord"})
        if environment == "default":
            result["APP_BASE_URL"] = "https://production.example.test"
        return result

    monkeypatch.setattr(configure_api, "environment_settings", settings)
    configure_api.main()
    assert azure.call_count == 1


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
    monkeypatch.setattr(setup_api_database, "production_settings", lambda: {
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
