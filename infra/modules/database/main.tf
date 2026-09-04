variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "environment" { type = string }
variable "entra_admin_login" { type = string }

data "azurerm_client_config" "current" {}

locals {
  compact_name = lower(replace("${var.name}${var.environment}", "/[^0-9A-Za-z]/", ""))
  unique_name  = "${substr(local.compact_name, 0, min(15, length(local.compact_name)))}${substr(sha256("${var.name}:${var.environment}"), 0, 7)}"
}

resource "azurerm_mssql_server" "this" {
  name                          = "${local.unique_name}-sql"
  resource_group_name           = var.resource_group_name
  location                      = var.location
  version                       = "12.0"
  minimum_tls_version           = "1.2"
  public_network_access_enabled = true

  azuread_administrator {
    login_username              = var.entra_admin_login
    object_id                   = data.azurerm_client_config.current.object_id
    tenant_id                   = data.azurerm_client_config.current.tenant_id
    azuread_authentication_only = true
  }

  tags = {
    application = var.name
    environment = var.environment
    managed_by  = "terraform"
  }

  lifecycle { prevent_destroy = true }
}

resource "azurerm_mssql_database" "this" {
  name        = "${var.name}-${var.environment}"
  server_id   = azurerm_mssql_server.this.id
  sku_name    = "Basic"
  max_size_gb = 2

  tags = {
    application = var.name
    environment = var.environment
    managed_by  = "terraform"
  }

  lifecycle { prevent_destroy = true }
}

resource "azurerm_mssql_firewall_rule" "azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_mssql_server.this.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

output "database_host" { value = azurerm_mssql_server.this.fully_qualified_domain_name }
output "database_name" { value = azurerm_mssql_database.this.name }
output "database_url" {
  value = "mssql+pyodbc://@${azurerm_mssql_server.this.fully_qualified_domain_name}/${azurerm_mssql_database.this.name}?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes"
}
