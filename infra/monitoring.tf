resource "azurerm_log_analytics_workspace" "api" {
  name                = "${var.name}-logs"
  location            = data.azurerm_resource_group.existing.location
  resource_group_name = data.azurerm_resource_group.existing.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_application_insights" "api" {
  name                = "${var.name}-api"
  location            = data.azurerm_resource_group.existing.location
  resource_group_name = data.azurerm_resource_group.existing.name
  workspace_id        = azurerm_log_analytics_workspace.api.id
  application_type    = "web"
  retention_in_days   = 30
}

# Adopt the logging resources enabled while investigating the login failure.
import {
  to = azurerm_log_analytics_workspace.api
  id = "${data.azurerm_resource_group.existing.id}/providers/Microsoft.OperationalInsights/workspaces/${var.name}-logs"
}

import {
  to = azurerm_application_insights.api
  id = "${data.azurerm_resource_group.existing.id}/providers/Microsoft.Insights/components/${var.name}-api"
}
