"""Configure the API environment created by the Static Web Apps deployment."""

import json
import os
import subprocess
import tempfile
from pathlib import Path


def azure(*args: str):
    result = subprocess.run(["az", *args, "--output", "json"], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError("Azure configuration request failed; check CI permissions.")
    return json.loads(result.stdout) if result.stdout.strip() else None


def production_settings() -> dict[str, str]:
    return azure(
        "staticwebapp", "appsettings", "list", "--name", os.environ["STATIC_WEB_APP_NAME"],
        "--resource-group", os.environ["RESOURCE_GROUP_NAME"],
    )["properties"]


def deployment_settings(existing: dict[str, str]) -> dict[str, str]:
    origin = os.environ["APP_URL"].rstrip("/")
    return {
        **existing,
        "APP_BASE_URL": origin,
        "DISCORD_CALLBACK_URL": f"{origin}/api/auth/discord/callback",
        "ENVIRONMENT": "production" if os.environ["API_ENVIRONMENT"] == "default" else "preview",
        "SIGNING_SECRET": os.environ["SIGNING_SECRET"],
        "DISCORD_CLIENT_SECRET": os.environ["DISCORD_CLIENT_SECRET"],
        "AZURE_CLIENT_ID": os.environ["AZURE_DATABASE_CLIENT_ID"],
        "AZURE_TENANT_ID": os.environ["AZURE_TENANT_ID"],
        "AZURE_CLIENT_SECRET": os.environ["AZURE_DATABASE_CLIENT_SECRET"],
    }


def main() -> None:
    settings = deployment_settings(production_settings())
    required = ["DATABASE_URL", "DATABASE_USERNAME", "SIGNING_SECRET", "DISCORD_CLIENT_ID",
                "DISCORD_CLIENT_SECRET", "AZURE_CLIENT_ID", "AZURE_TENANT_ID", "AZURE_CLIENT_SECRET"]
    missing = [key for key in required if not settings.get(key)]
    if missing:
        raise RuntimeError("Missing API settings: " + ", ".join(missing))
    resource = azure(
        "staticwebapp", "show", "--name", os.environ["STATIC_WEB_APP_NAME"],
        "--resource-group", os.environ["RESOURCE_GROUP_NAME"],
    )["id"]
    environment = os.environ["API_ENVIRONMENT"]
    if environment != "default":
        resource += f"/builds/{environment}"
    with tempfile.TemporaryDirectory() as directory:
        payload = Path(directory) / "settings.json"
        payload.touch(mode=0o600)
        payload.write_text(json.dumps({"properties": settings}))
        azure("rest", "--method", "put", "--url",
              f"https://management.azure.com{resource}/config/appsettings?api-version=2023-12-01",
              "--body", f"@{payload}")
    print(f"Configured API environment {environment}.")


if __name__ == "__main__":
    main()
