import os
import secrets

from tools.configure_api import app_settings, azure, write_app_settings


def main():
    worker = os.environ["TELEMETRY_WORKER_NAME"]
    functions = azure("functionapp", "function", "list", "--name", worker, "--resource-group", os.environ["RESOURCE_GROUP_NAME"])
    if not any(item["name"].endswith("/process_gameplay_trace") for item in functions):
        raise RuntimeError("Deploy and index the logging worker before enabling ingestion")
    settings = app_settings()
    desired = {
        **settings,
        "TELEMETRY_HMAC_SECRET": settings.get("TELEMETRY_HMAC_SECRET") or secrets.token_hex(32),
        "TELEMETRY_ENABLED": "true",
    }
    if settings != desired:
        write_app_settings(desired)
    print("Logging identity provisioned and ingestion enabled after worker readiness.")


if __name__ == "__main__":
    main()
