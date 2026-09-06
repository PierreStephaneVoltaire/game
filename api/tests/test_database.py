from types import SimpleNamespace
from unittest.mock import Mock

from backend import database


def test_azure_postgres_refreshes_entra_token_for_each_connection(monkeypatch):
    url = "postgresql+psycopg://example.postgres.database.azure.com/pet?user=Admin+Name&sslmode=require"
    monkeypatch.setattr(database, "get_settings", lambda: SimpleNamespace(database_url=url))
    credential = Mock()
    credential.get_token.side_effect = [SimpleNamespace(token="first"), SimpleNamespace(token="second")]
    monkeypatch.setattr(database, "DefaultAzureCredential", lambda: credential)
    monkeypatch.setenv("DATABASE_USERNAME", "vpet_api")
    database.reset_database_caches()
    engine = database.get_engine()
    try:
        args, params = engine.dialect.create_connect_args(engine.url)
        assert params["user"] == "Admin Name"
        assert params["sslmode"] == "require"
        for token in ("first", "second"):
            for listener in engine.dialect.dispatch.do_connect:
                listener(engine.dialect, None, args, params)
            assert params["password"] == token
            assert params["user"] == "vpet_api"
        credential.get_token.assert_called_with("https://ossrdbms-aad.database.windows.net/.default")
    finally:
        engine.dispose()
        database.reset_database_caches()
