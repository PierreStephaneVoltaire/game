variable "name" {
  type = string
}

variable "location" {
  type = string
}

variable "environment" {
  type = string
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

  tags = {
    application = var.name
    environment = var.environment
    managed_by  = "terraform"
  }
}

output "url" {
  value = "https://${azurerm_static_web_app.this.default_host_name}"
}

output "deployment_token" {
  value     = azurerm_static_web_app.this.api_key
  sensitive = true
}
