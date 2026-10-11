"""Add CI-held secrets to the notifier Function App whose other settings Terraform owns."""

import json
import os
import tempfile
from pathlib import Path

from tools.configure_api import azure

SECRETS = {
    "DISCORD_BOT_TOKEN": "DISCORD_BOT_TOKEN",
    "AZURE_CLIENT_ID": "AZURE_DATABASE_CLIENT_ID",
    "AZURE_TENANT_ID": "AZURE_TENANT_ID",
    "AZURE_CLIENT_SECRET": "AZURE_DATABASE_CLIENT_SECRET",
}


def main() -> None:
    name, group = os.environ["NOTIFIER_NAME"], os.environ["RESOURCE_GROUP_NAME"]
    resource = azure("functionapp", "show", "--name", name, "--resource-group", group)["id"]
    existing = azure("rest", "--method", "post", "--url",
                     f"https://management.azure.com{resource}/config/appsettings/list?api-version=2023-12-01")["properties"]
    settings = {**existing, **{key: os.environ[source] for key, source in SECRETS.items()}}
    missing = [key for key in ["DATABASE_URL", "DATABASE_USERNAME", "APP_BASE_URL", *SECRETS] if not settings.get(key)]
    if missing:
        raise RuntimeError("Missing notifier settings: " + ", ".join(missing))
    if settings == existing:
        print("Notifier secrets are already configured.")
        return
    with tempfile.TemporaryDirectory() as directory:
        payload = Path(directory) / "settings.json"
        payload.touch(mode=0o600)
        payload.write_text(json.dumps({"properties": settings}))
        azure("rest", "--method", "put", "--url",
              f"https://management.azure.com{resource}/config/appsettings?api-version=2023-12-01",
              "--body", f"@{payload}")
    print("Configured notifier secrets.")


if __name__ == "__main__":
    main()
