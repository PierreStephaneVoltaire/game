"""Create API tables and grant the separate runtime identity access to them."""

import os
from uuid import UUID

import psycopg
from psycopg import sql
from azure.identity import AzureCliCredential
from sqlalchemy.engine import make_url

from backend.database import create_schema
from tools.configure_api import production_settings


def main() -> None:
    settings = production_settings()
    url = make_url(settings["DATABASE_URL"])
    role = settings["DATABASE_USERNAME"]
    object_id = str(UUID(os.environ["AZURE_DATABASE_OBJECT_ID"]))
    token = AzureCliCredential().get_token("https://ossrdbms-aad.database.windows.net/.default").token
    connection = {
        "host": url.host, "port": url.port or 5432,
        "user": url.query["user"], "password": token,
        "sslmode": "require", "connect_timeout": 30,
    }
    with psycopg.connect(**connection, dbname="postgres") as db:
        existing = db.execute(
            "SELECT * FROM pg_catalog.pgaadauth_list_principals(false) WHERE rolename = %s",
            (role,),
        ).fetchone()
        if existing is None:
            db.execute("SELECT pg_catalog.pgaadauth_create_principal_with_oid(%s, %s, 'service', false, false)",
                       (role, object_id))
        elif str(UUID(existing[2])) != object_id:
            raise RuntimeError("The API database role belongs to another identity.")

    os.environ["DATABASE_URL"] = settings["DATABASE_URL"]
    os.environ.pop("DATABASE_USERNAME", None)
    create_schema()
    with psycopg.connect(**connection, dbname=url.database) as db:
        db.execute(sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(
            sql.Identifier(url.database), sql.Identifier(role)))
        for statement in [
            "GRANT USAGE ON SCHEMA public TO {}",
            "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {}",
            "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {}",
            "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {}",
            "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO {}",
        ]:
            db.execute(sql.SQL(statement).format(sql.Identifier(role)))
    print("API tables and runtime database permissions are ready.")


if __name__ == "__main__":
    main()
