output "app_url" {
  value = local.app_base_url
}

output "static_web_app_name" {
  value = module.static_app.name
}

output "static_web_app_hostname" {
  value = module.static_app.hostname
}

output "database_name" {
  value = azurerm_postgresql_flexible_server_database.env.name
}
