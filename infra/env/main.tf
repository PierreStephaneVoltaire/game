data "azurerm_resource_group" "existing" {
  name = var.resource_group_name
}

data "azurerm_storage_account" "shared" {
  name                = var.storage_account_name
  resource_group_name = var.resource_group_name
}

data "azurerm_resources" "dns_zone" {
  resource_group_name = var.resource_group_name
  type                = "Microsoft.Network/dnsZones"
}

data "azurerm_resources" "database_server" {
  resource_group_name = var.resource_group_name
  type                = "Microsoft.DBforPostgreSQL/flexibleServers"
  required_tags       = { stack = "shared" }
}

data "azurerm_postgresql_flexible_server" "shared" {
  name                = one(data.azurerm_resources.database_server.resources).name
  resource_group_name = var.resource_group_name
}

data "azurerm_application_insights" "api" {
  name                = "${var.name}-api"
  resource_group_name = var.resource_group_name
}

locals {
  is_prod      = var.env == "prod"
  zone_name    = one(data.azurerm_resources.dns_zone.resources).name
  host_name    = local.is_prod ? local.zone_name : "${var.env}.${local.zone_name}"
  app_base_url = "https://${local.host_name}"
  non_secret_app_settings = merge(
    module.auth.app_settings,
    module.game_data.app_settings,
    module.global_data.app_settings,
    {
      DATABASE_URL              = "postgresql+psycopg://${data.azurerm_postgresql_flexible_server.shared.fqdn}/${azurerm_postgresql_flexible_server_database.env.name}?user=${urlencode(var.ci_admin.login)}&sslmode=require"
      DATABASE_USERNAME         = var.database_runtime_username
      ENVIRONMENT               = local.is_prod ? "production" : "preview"
      TELEMETRY_STORAGE_ACCOUNT = data.azurerm_storage_account.shared.name
    }
  )
}

resource "azurerm_postgresql_flexible_server_database" "env" {
  name      = "${var.name}-${var.env}"
  server_id = data.azurerm_postgresql_flexible_server.shared.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

module "static_app" {
  source = "../modules/static-app"

  name              = "${var.name}-${var.env}"
  location          = data.azurerm_resource_group.existing.location
  resource_group_id = data.azurerm_resource_group.existing.id
  app_settings = merge(local.non_secret_app_settings, {
    APPLICATIONINSIGHTS_CONNECTION_STRING                    = data.azurerm_application_insights.api.connection_string
    APPINSIGHTS_INSTRUMENTATIONKEY                           = data.azurerm_application_insights.api.instrumentation_key
    "AzureFunctionsJobHost__logging__logLevel__Host.Results" = "Information"
    "AzureFunctionsJobHost__logging__logLevel__Function"     = "Information"
  })
}

module "auth" {
  source = "../modules/auth"

  app_base_url         = local.app_base_url
  discord_client_id    = var.discord_client_id
  discord_callback_url = "${local.app_base_url}/api/auth/discord/callback"
}

module "game_data" {
  source = "../modules/game-data"
}

module "global_data" {
  source = "../modules/global-data"
}
