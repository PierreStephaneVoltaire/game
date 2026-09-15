variable "telemetry_ingest_principal_id" {
  type    = string
  default = ""
}

resource "azurerm_storage_container" "gameplay_traces" {
  name                  = "gameplay-traces"
  storage_account_id    = data.azurerm_storage_account.quotes.id
  container_access_type = "private"
  lifecycle { prevent_destroy = true }
}

resource "azurerm_storage_container" "gameplay_worker_deployments" {
  name                  = "gameplay-worker-deployments"
  storage_account_id    = data.azurerm_storage_account.quotes.id
  container_access_type = "private"
}

resource "azurerm_storage_queue" "gameplay_traces" {
  name               = "gameplay-traces"
  storage_account_id = data.azurerm_storage_account.quotes.id
  lifecycle { prevent_destroy = true }
}

resource "azurerm_storage_queue" "gameplay_poison" {
  name               = "gameplay-traces-poison"
  storage_account_id = data.azurerm_storage_account.quotes.id
  lifecycle { prevent_destroy = true }
}

resource "azurerm_storage_table" "gameplay_runs" {
  name               = "GameplayRuns"
  storage_account_id = data.azurerm_storage_account.quotes.id
  lifecycle { prevent_destroy = true }
}

resource "azurerm_service_plan" "gameplay_worker" {
  name                = "${var.name}-trace-worker"
  resource_group_name = var.resource_group_name
  location            = data.azurerm_storage_account.quotes.location
  os_type             = "Linux"
  sku_name            = "FC1"
}

resource "azurerm_function_app_flex_consumption" "gameplay_worker" {
  depends_on                  = [azurerm_resource_provider_registration.gameplay_flex]
  name                        = "${var.name}-trace-worker"
  resource_group_name         = var.resource_group_name
  location                    = data.azurerm_storage_account.quotes.location
  service_plan_id             = azurerm_service_plan.gameplay_worker.id
  storage_container_type      = "blobContainer"
  storage_container_endpoint  = "${data.azurerm_storage_account.quotes.primary_blob_endpoint}${azurerm_storage_container.gameplay_worker_deployments.name}"
  storage_authentication_type = "SystemAssignedIdentity"
  runtime_name                = "python"
  runtime_version             = "3.11"
  instance_memory_in_mb       = 512
  maximum_instance_count      = 40
  https_only                  = true

  identity { type = "SystemAssigned" }
  site_config {}

  app_settings = {
    TELEMETRY_STORAGE_ACCOUNT             = data.azurerm_storage_account.quotes.name
    AzureWebJobsStorage__accountName      = data.azurerm_storage_account.quotes.name
    AzureWebJobsStorage__credential       = "managedidentity"
    TraceQueue__queueServiceUri           = data.azurerm_storage_account.quotes.primary_queue_endpoint
    TraceQueue__credential                = "managedidentity"
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.api.connection_string
    AzureFunctionsWebHost__hostid         = "companion-gameplay-worker"
    PYTHON_ENABLE_WORKER_EXTENSIONS       = "0"
  }
}

resource "azurerm_resource_provider_registration" "gameplay_flex" {
  name = "Microsoft.App"
  lifecycle { prevent_destroy = true }
}

resource "azurerm_role_assignment" "gameplay_worker_host_storage" {
  for_each             = azurerm_storage_container.gameplay_host
  scope                = each.value.id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = azurerm_function_app_flex_consumption.gameplay_worker.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_storage_container" "gameplay_host" {
  for_each              = toset(["azure-webjobs-hosts", "azure-webjobs-secrets"])
  name                  = each.value
  storage_account_id    = data.azurerm_storage_account.quotes.id
  container_access_type = "private"
}

resource "azurerm_role_assignment" "gameplay_worker_deployments" {
  scope                = azurerm_storage_container.gameplay_worker_deployments.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_function_app_flex_consumption.gameplay_worker.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "gameplay_worker_traces" {
  scope                = azurerm_storage_container.gameplay_traces.id
  role_definition_name = "Storage Blob Data Reader"
  principal_id         = azurerm_function_app_flex_consumption.gameplay_worker.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "gameplay_worker_queues" {
  for_each             = { traces = azurerm_storage_queue.gameplay_traces.id, poison = azurerm_storage_queue.gameplay_poison.id }
  scope                = each.value
  role_definition_name = "Storage Queue Data Contributor"
  principal_id         = azurerm_function_app_flex_consumption.gameplay_worker.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "gameplay_worker_index" {
  scope                = azurerm_storage_table.gameplay_runs.id
  role_definition_name = "Storage Table Data Contributor"
  principal_id         = azurerm_function_app_flex_consumption.gameplay_worker.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "gameplay_ingest_blob" {
  count                = var.telemetry_ingest_principal_id == "" ? 0 : 1
  scope                = azurerm_storage_container.gameplay_traces.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.telemetry_ingest_principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "gameplay_ingest_queue" {
  count                = var.telemetry_ingest_principal_id == "" ? 0 : 1
  scope                = azurerm_storage_queue.gameplay_traces.id
  role_definition_name = "Storage Queue Data Message Sender"
  principal_id         = var.telemetry_ingest_principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_consumption_budget_subscription" "infrastructure" {
  name            = "companion-infrastructure-cad-50"
  subscription_id = "/subscriptions/${data.azurerm_client_config.quotes.subscription_id}"
  amount          = 50
  time_grain      = "Monthly"

  time_period { start_date = "2026-09-01T00:00:00Z" }

  notification {
    enabled        = true
    threshold      = 80
    operator       = "GreaterThanOrEqualTo"
    threshold_type = "Actual"
    contact_roles  = ["Owner"]
  }
  notification {
    enabled        = true
    threshold      = 90
    operator       = "GreaterThanOrEqualTo"
    threshold_type = "Actual"
    contact_roles  = ["Owner"]
  }
  notification {
    enabled        = true
    threshold      = 100
    operator       = "GreaterThanOrEqualTo"
    threshold_type = "Forecasted"
    contact_roles  = ["Owner"]
  }
}

output "telemetry_worker_name" { value = azurerm_function_app_flex_consumption.gameplay_worker.name }
