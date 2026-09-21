import json
from unittest.mock import MagicMock
from subprocess import CompletedProcess

import pytest

from tools import configure_telemetry
from tools.check_telemetry_budget import estimate
from tools import check_telemetry_budget


@pytest.mark.parametrize("failures,error,success", [
    (1, 'ERROR: Too Many Requests({"error":{"code":"429"}})', True),
    (4, 'ERROR: Too Many Requests({"error":{"code":"429"}})', False),
    (1, 'ERROR: Unauthorized({"error":{"code":"RBACAccessDenied"}})', False),
])
def test_billing_retries_throttling_without_bypassing_failed_verification(monkeypatch, failures, error, success):
    run = MagicMock(side_effect=[CompletedProcess([], 1, "", error)] * failures + [CompletedProcess([], 0, '{"properties":{}}', "")])
    sleep = MagicMock()
    monkeypatch.setattr(check_telemetry_budget.subprocess, "run", run)
    monkeypatch.setattr(check_telemetry_budget.time, "sleep", sleep)
    if success:
        assert check_telemetry_budget.azure("rest") == {"properties": {}}
        assert run.call_count == 2 and sleep.call_count == 1
    else:
        with pytest.raises(RuntimeError, match="Azure billing verification failed"):
            check_telemetry_budget.azure("rest")
        assert run.call_count == failures and sleep.call_count == failures - 1
    assert all(call.args == (60,) for call in sleep.call_args_list)


def test_cost_estimate_includes_retention_and_the_100_player_stress_case():
    samples = [{"batches": 852, "tableRows": 4275, "compressedBytes": 10_355_201}]
    initial = estimate(samples, 25, 10, 1)
    retained = estimate(samples, 25, 10, 12)
    stress = estimate(samples, 25, 100, 12)
    assert initial["totalMonthlyCAD"] < retained["totalMonthlyCAD"] < 50
    assert stress["totalMonthlyCAD"] > 50
    assert retained["retainedStorageCAD"] > 10 * initial["retainedStorageCAD"]
    assert stress["batchesPerMonth"] == 10 * retained["batchesPerMonth"]


def test_rollout_requires_an_indexed_worker_and_keeps_the_existing_identity_key(monkeypatch):
    for key, value in {"TELEMETRY_WORKER_NAME": "worker", "RESOURCE_GROUP_NAME": "group", "STATIC_WEB_APP_NAME": "app", "API_ENVIRONMENT": "staging"}.items():
        monkeypatch.setenv(key, value)
    production = {"TELEMETRY_HMAC_SECRET": "stable-key", "DATABASE_URL": "unchanged"}
    staging = {"APP_BASE_URL": "https://staging.example.test", "DISCORD_CALLBACK_URL": "https://staging.example.test/api/auth/discord/callback"}
    monkeypatch.setattr(configure_telemetry, "environment_settings", lambda environment="default": production if environment == "default" else staging)
    requests = []

    def azure(*arguments):
        if arguments[:3] == ("functionapp", "function", "list"):
            return [{"name": "worker/process_gameplay_trace"}]
        if arguments[:2] == ("staticwebapp", "show"):
            return {"id": "/subscription/app"}
        path = arguments[arguments.index("--body") + 1][1:]
        requests.append((arguments, json.loads(open(path).read())))

    monkeypatch.setattr(configure_telemetry, "azure", azure)
    configure_telemetry.main()
    assert len(requests) == 1
    assert "/builds/staging/" in requests[0][0][4]
    assert requests[0][1]["properties"] == {**staging, "TELEMETRY_HMAC_SECRET": "stable-key", "TELEMETRY_ENABLED": "true"}
    assert "TELEMETRY_ENABLED" not in production
    monkeypatch.setattr(configure_telemetry, "azure", MagicMock(return_value=[]))
    with pytest.raises(RuntimeError, match="Deploy and index"):
        configure_telemetry.main()
