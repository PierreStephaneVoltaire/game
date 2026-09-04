locals {
  discord_callback_url = var.discord_callback_url != "" ? var.discord_callback_url : "${var.app_base_url}/api/auth/discord/callback"
  non_secret_app_settings = merge(
    module.auth.app_settings,
    module.game_data.app_settings,
    module.global_data.app_settings,
    {
      DATABASE_URL = module.database.database_url
      ENVIRONMENT  = var.env_type
    }
  )
}

data "azurerm_resource_group" "existing" {
  name = var.resource_group_name
}

module "static_app" {
  source = "./modules/static-app"

  name              = var.name
  location          = data.azurerm_resource_group.existing.location
  resource_group_id = data.azurerm_resource_group.existing.id
  app_settings      = local.non_secret_app_settings
}

module "database" {
  source = "./modules/database"

  name                = var.name
  location            = data.azurerm_resource_group.existing.location
  resource_group_name = data.azurerm_resource_group.existing.name
  environment         = var.env_type
  entra_admin_login   = var.entra_admin_login
}

module "auth" {
  source = "./modules/auth"

  app_base_url         = var.app_base_url
  discord_client_id    = var.discord_client_id
  discord_callback_url = local.discord_callback_url
}

module "game_data" {
  source = "./modules/game-data"
}

module "global_data" {
  source = "./modules/global-data"
}

output "url" {
  value = var.app_base_url
}

output "static_web_app_name" {
  value = module.static_app.name
}

output "static_web_app_hostname" {
  value = module.static_app.hostname
}

output "database_host" {
  value = module.database.database_host
}

output "database_name" {
  value = module.database.database_name
}

output "database_url" {
  value = module.database.database_url
}

output "non_secret_app_settings" {
  value = local.non_secret_app_settings
}
