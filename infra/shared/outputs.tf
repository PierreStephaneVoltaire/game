output "database_server_name" {
  value = azurerm_postgresql_flexible_server.shared.name
}

output "database_host" {
  value = azurerm_postgresql_flexible_server.shared.fqdn
}

output "application_insights_name" {
  value = azurerm_application_insights.api.name
}

output "telemetry_worker_name" {
  value = azurerm_function_app_flex_consumption.gameplay_worker.name
}
