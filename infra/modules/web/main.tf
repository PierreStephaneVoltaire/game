variable "name" {
  type = string
}

variable "location" {
  type = string
}

variable "environment" {
  type = string
}

locals {
  storage_name_base    = lower(replace("${var.name}${var.environment}", "/[^0-9A-Za-z]/", ""))
  storage_account_name = "${substr(local.storage_name_base, 0, min(17, length(local.storage_name_base)))}${substr(sha256("${var.name}:${var.environment}"), 0, 7)}"
}

resource "azurerm_resource_group" "this" {
  name     = "${var.name}-rg"
  location = var.location

  tags = {
    application = var.name
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "azurerm_static_web_app" "this" {
  name                = "${var.name}-web"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location

  sku_tier = "Free"
  sku_size = "Free"

  public_network_access_enabled = true
  preview_environments_enabled  = false

  app_settings = {
    AZURE_STORAGE_CONNECTION_STRING = azurerm_storage_account.this.primary_connection_string
    USERS_TABLE                     = module.user_accounts.users_table_name
    AUTH_RECORDS_TABLE              = module.user_accounts.auth_records_table_name
  }

  tags = {
    application = var.name
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "azurerm_storage_account" "this" {
  name                            = local.storage_account_name
  resource_group_name             = azurerm_resource_group.this.name
  location                        = azurerm_resource_group.this.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  account_kind                    = "StorageV2"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  public_network_access_enabled   = true
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = true

  tags = {
    application = var.name
    environment = var.environment
    managed_by  = "terraform"
  }

  lifecycle {
    prevent_destroy = true
  }
}

module "user_accounts" {
  source = "../user-accounts"

  storage_account_id = azurerm_storage_account.this.id
}

module "game_data" {
  source = "../game-data"

  storage_account_id = azurerm_storage_account.this.id
}

module "global_data" {
  source = "../global-data"

  storage_account_id = azurerm_storage_account.this.id
}

output "url" {
  value = "https://${azurerm_static_web_app.this.default_host_name}"
}

output "deployment_token" {
  value     = azurerm_static_web_app.this.api_key
  sensitive = true
}

output "storage_account_name" {
  value = azurerm_storage_account.this.name
}

output "table_names" {
  value = concat(
    module.user_accounts.table_names,
    module.game_data.table_names,
    module.global_data.table_names
  )
}
