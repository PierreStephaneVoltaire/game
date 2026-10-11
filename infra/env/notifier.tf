resource "azurerm_storage_container" "notifier_deployments" {
  name                  = "notifier-${var.env}-deployments"
  storage_account_id    = data.azurerm_storage_account.shared.id
  container_access_type = "private"
}

resource "azurerm_service_plan" "notifier" {
  name                = "${var.name}-${var.env}-notifier"
  resource_group_name = var.resource_group_name
  location            = data.azurerm_storage_account.shared.location
  os_type             = "Linux"
  sku_name            = "FC1"
}

resource "azurerm_function_app_flex_consumption" "notifier" {
  name                        = "${var.name}-${var.env}-notifier"
  resource_group_name         = var.resource_group_name
  location                    = data.azurerm_storage_account.shared.location
  service_plan_id             = azurerm_service_plan.notifier.id
  storage_container_type      = "blobContainer"
  storage_container_endpoint  = "${data.azurerm_storage_account.shared.primary_blob_endpoint}${azurerm_storage_container.notifier_deployments.name}"
  storage_authentication_type = "SystemAssignedIdentity"
  runtime_name                = "python"
  runtime_version             = "3.11"
  instance_memory_in_mb       = 512
  maximum_instance_count      = 1
  https_only                  = true

  identity { type = "SystemAssigned" }
  site_config {}

  app_settings = {
    APP_BASE_URL                          = local.app_base_url
    DATABASE_URL                          = local.non_secret_app_settings.DATABASE_URL
    DATABASE_USERNAME                     = var.database_runtime_username
    ENVIRONMENT                           = local.non_secret_app_settings.ENVIRONMENT
    AzureWebJobsStorage                   = ""
    AzureWebJobsStorage__accountName      = data.azurerm_storage_account.shared.name
    AzureWebJobsStorage__credential       = "managedidentity"
    APPLICATIONINSIGHTS_CONNECTION_STRING = data.azurerm_application_insights.api.connection_string
    AzureFunctionsWebHost__hostid         = "companion-notifier-${var.env}"
    PYTHON_ENABLE_WORKER_EXTENSIONS       = "0"
  }

  lifecycle {
    ignore_changes = [
      app_settings["AZURE_CLIENT_ID"],
      app_settings["AZURE_TENANT_ID"],
      app_settings["AZURE_CLIENT_SECRET"],
      app_settings["DISCORD_BOT_TOKEN"],
    ]
  }
}

resource "azurerm_role_assignment" "notifier_deployments" {
  scope                = azurerm_storage_container.notifier_deployments.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_function_app_flex_consumption.notifier.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "notifier_host_storage" {
  for_each             = toset(["azure-webjobs-hosts", "azure-webjobs-secrets"])
  scope                = "${data.azurerm_storage_account.shared.id}/blobServices/default/containers/${each.value}"
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = azurerm_function_app_flex_consumption.notifier.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}
