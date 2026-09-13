import json
import os
import secrets
import tempfile
from pathlib import Path

from tools.configure_api import azure, environment_settings


def main():
    worker = os.environ["TELEMETRY_WORKER_NAME"]
    functions = azure("functionapp", "function", "list", "--name", worker, "--resource-group", os.environ["RESOURCE_GROUP_NAME"])
    if not any(item["name"].endswith("/process_gameplay_trace") for item in functions):
        raise RuntimeError("Deploy and index the logging worker before enabling ingestion")
    resource = azure("staticwebapp", "show", "--name", os.environ["STATIC_WEB_APP_NAME"], "--resource-group", os.environ["RESOURCE_GROUP_NAME"])["id"]
    production = environment_settings()
    identity_key = production.get("TELEMETRY_HMAC_SECRET") or secrets.token_hex(32)
    targets = ["default"]
    target = os.environ["API_ENVIRONMENT"]
    if target != "default":
        targets.append(target)
    for environment in targets:
        settings = production if environment == "default" else environment_settings(environment)
        desired = {**settings, "TELEMETRY_HMAC_SECRET": identity_key}
        if environment == target:
            desired["TELEMETRY_ENABLED"] = "true"
        if settings == desired:
            continue
        scope = resource if environment == "default" else f"{resource}/builds/{environment}"
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "settings.json"
            path.touch(mode=0o600)
            path.write_text(json.dumps({"properties": desired}))
            azure("rest", "--method", "put", "--url", f"https://management.azure.com{scope}/config/appsettings?api-version=2023-12-01", "--body", f"@{path}")
    print("Logging identity provisioned and ingestion enabled after worker readiness.")


if __name__ == "__main__":
    main()
