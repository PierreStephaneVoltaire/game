import argparse
import calendar
import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path


def azure(*arguments):
    result = subprocess.run(["az", *arguments, "--output", "json"], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"Azure billing verification failed: {result.stderr.strip()}")
    return json.loads(result.stdout)


def estimate(measurements, baseline, players, retention_months):
    sessions = players * 30
    batches = max(row["batches"] for row in measurements) * sessions
    rows = max(row["tableRows"] for row in measurements) * sessions
    blob_gb = max(row["compressedBytes"] for row in measurements) * sessions / 1_000_000_000
    index_gb = rows * 2048 / 1_000_000_000
    compute = max(0, batches * 0.5 - 100_000) * 0.000026 * 1.5
    invocations = max(0, batches - 250_000) / 1_000_000 * 0.40 * 1.5
    storage_operations = batches / 10_000 * (0.0693 + 0.0055 + 3 * 0.0055) + rows / 10_000 * 0.0005 + 0.10
    retained_storage = retention_months * (blob_gb * 0.0255 + index_gb * 0.0624)
    return {"dailyPlayers": players, "retentionMonths": retention_months, "batchesPerMonth": batches,
            "tableRowsPerMonth": rows, "blobGrowthGBPerMonth": round(blob_gb, 3),
            "indexGrowthGBPerMonth": round(index_gb, 3), "computeCAD": round(compute + invocations, 2),
            "storageOperationsCAD": round(storage_operations, 2), "retainedStorageCAD": round(retained_storage, 2),
            "totalMonthlyCAD": round(baseline + 5 + compute + invocations + storage_operations + retained_storage, 2)}


def check(path: Path):
    account = azure("account", "show")
    cost = azure("rest", "--method", "post", "--url",
                 f"https://management.azure.com/subscriptions/{account['id']}/providers/Microsoft.CostManagement/query?api-version=2025-03-01",
                 "--body", json.dumps({"type": "ActualCost", "timeframe": "MonthToDate", "dataset": {
                     "granularity": "None", "aggregation": {"totalCost": {"name": "PreTaxCost", "function": "Sum"}}}}))["properties"]
    columns = {column["name"]: index for index, column in enumerate(cost["columns"])}
    if not cost["rows"] or any(row[columns["Currency"]] != "CAD" for row in cost["rows"]):
        raise RuntimeError("A current CAD billing result is required before deployment")
    actual = sum(row[columns["PreTaxCost"]] for row in cost["rows"])
    now = datetime.now(UTC)
    days = calendar.monthrange(now.year, now.month)[1]
    baseline = max(25, actual / max(1, now.day - 1) * days)
    measurements = json.loads(path.read_text())["sessions"]
    scenarios = [estimate(measurements, baseline, players, months) for players in [1, 10, 100] for months in [1, 12]]
    print(json.dumps({"verifiedAt": now.isoformat(), "actualMonthToDateCAD": actual,
                      "baselineMonthlyCAD": baseline, "diagnosticsAllowanceCAD": 5,
                      "assumptions": {"sessionMinutes": 60, "sessionsPerPlayerPerDay": 1, "actionsPerSession": 60,
                                      "workerSecondsPerBatch": 1, "workerMemoryGB": 0.5, "budgetUSDToCAD": 1.5,
                                      "indexBytesPerRow": 2048, "alwaysReadyInstances": 0}, "scenarios": scenarios}, indent=2))
    if any(row["totalMonthlyCAD"] >= 50 for row in scenarios if row["dailyPlayers"] <= 10):
        raise RuntimeError("Projected initial infrastructure cost exceeds the C$50 monitored target; review before deployment")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("measurements", type=Path)
    check(parser.parse_args().measurements)
