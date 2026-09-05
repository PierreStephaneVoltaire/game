variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "environment" { type = string }
variable "entra_admin_login" { type = string }
variable "entra_admin_type" { type = string }

data "azurerm_client_config" "current" {}

locals {
  compact_name = lower(replace("${var.name}${var.environment}", "/[^0-9A-Za-z]/", ""))
  unique_name  = "${substr(local.compact_name, 0, min(15, length(local.compact_name)))}${substr(sha256("${var.name}:${var.environment}"), 0, 7)}"
}

resource "azurerm_postgresql_flexible_server" "this" {
  name                          = "${local.unique_name}-pg"
  resource_group_name           = var.resource_group_name
  location                      = var.location
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

  tags = {
    application = var.name
    environment = var.environment
    managed_by  = "terraform"
  }

  lifecycle { prevent_destroy = true }
}

resource "azurerm_postgresql_flexible_server_active_directory_administrator" "this" {
  server_name         = azurerm_postgresql_flexible_server.this.name
  resource_group_name = var.resource_group_name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  object_id           = data.azurerm_client_config.current.object_id
  principal_name      = var.entra_admin_login
  principal_type      = var.entra_admin_type
}

resource "azurerm_postgresql_flexible_server_database" "this" {
  name      = "${var.name}-${var.environment}"
  server_id = azurerm_postgresql_flexible_server.this.id
  charset   = "UTF8"
  collation = "en_US.utf8"

  lifecycle { prevent_destroy = true }
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.this.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

output "database_host" { value = azurerm_postgresql_flexible_server.this.fqdn }
output "database_name" { value = azurerm_postgresql_flexible_server_database.this.name }
output "database_url" {
  value      = "postgresql+psycopg://${azurerm_postgresql_flexible_server.this.fqdn}/${azurerm_postgresql_flexible_server_database.this.name}?user=${urlencode(var.entra_admin_login)}&sslmode=require"
  depends_on = [azurerm_postgresql_flexible_server_active_directory_administrator.this]
}
