from unittest.mock import MagicMock

import pytest

from tools.configure_api import deployment_settings
from tools import setup_api_database


def test_preview_settings_use_the_preview_origin_and_runtime_credentials(monkeypatch):
    values = {
        "APP_URL": "https://preview.example.test/", "API_ENVIRONMENT": "8",
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
