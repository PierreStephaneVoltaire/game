data "azurerm_client_config" "current" {}

data "azurerm_resource_group" "existing" {
  name = var.resource_group_name
}

data "azurerm_storage_account" "shared" {
  name                = var.storage_account_name
  resource_group_name = var.resource_group_name
}

locals {
  tags = {
    application = var.name
    stack       = "shared"
    managed_by  = "terraform"
  }
  compact_name = lower(replace(var.name, "/[^0-9A-Za-z]/", ""))
  server_name  = "${substr(local.compact_name, 0, min(15, length(local.compact_name)))}${substr(sha256("${var.name}:shared:${var.database_location}"), 0, 7)}-pg"
}

resource "azurerm_postgresql_flexible_server" "shared" {
  name                          = local.server_name
  resource_group_name           = var.resource_group_name
  location                      = var.database_location
  version                       = "17"
  sku_name                      = "B_Standard_B1ms"
  storage_mb                    = 32768
  backup_retention_days         = 7
  public_network_access_enabled = true

  authentication {
    active_directory_auth_enabled = true
    password_auth_enabled         = false
    tenant_id                     = data.azurerm_client_config.current.tenant_id
  }

  tags = local.tags

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [zone]
  }
}

resource "azurerm_postgresql_flexible_server_active_directory_administrator" "admins" {
  for_each = {
    owner = { admin = var.owner_admin, type = "User" }
    ci    = { admin = var.ci_admin, type = "ServicePrincipal" }
  }
  server_name         = azurerm_postgresql_flexible_server.shared.name
  resource_group_name = var.resource_group_name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  object_id           = each.value.admin.object_id
  principal_name      = each.value.admin.login
  principal_type      = each.value.type
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.shared.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_log_analytics_workspace" "api" {
  name                = "${var.name}-logs"
  location            = data.azurerm_resource_group.existing.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_application_insights" "api" {
  name                = "${var.name}-api"
  location            = data.azurerm_resource_group.existing.location
  resource_group_name = var.resource_group_name
  workspace_id        = azurerm_log_analytics_workspace.api.id
  application_type    = "web"
  retention_in_days   = 30
  tags                = local.tags
}

data "azurerm_storage_container" "quotes" {
  name               = "companion-content"
  storage_account_id = data.azurerm_storage_account.shared.id
}

resource "azurerm_role_assignment" "quote_reader" {
  scope                = data.azurerm_storage_container.quotes.id
  role_definition_name = "Storage Blob Data Reader"
  principal_id         = var.ci_admin.object_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_consumption_budget_subscription" "infrastructure" {
  name            = "companion-infrastructure-${var.monthly_budget}"
  subscription_id = "/subscriptions/${data.azurerm_client_config.current.subscription_id}"
  amount          = var.monthly_budget
  time_grain      = "Monthly"

  time_period { start_date = "2026-10-01T00:00:00Z" }

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
