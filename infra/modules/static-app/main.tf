terraform {
  required_providers {
    azapi = {
      source = "Azure/azapi"
    }
  }
}

variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_id" { type = string }
variable "app_settings" { type = map(string) }

resource "azapi_resource" "this" {
  type      = "Microsoft.Web/staticSites@2023-12-01"
  name      = "${var.name}-web"
  location  = var.location
  parent_id = var.resource_group_id
  tags = {
    application = var.name
    environment = var.app_settings["ENVIRONMENT"]
    managed_by  = "terraform"
  }

  body = {
    properties = {
      stagingEnvironmentPolicy = "Enabled"
    }
    sku = {
      name = "Free"
      tier = "Free"
    }
  }

  response_export_values = ["properties.defaultHostname"]
}

data "azapi_resource_action" "app_settings" {
  type        = "Microsoft.Web/staticSites@2023-12-01"
  resource_id = azapi_resource.this.id
  action      = "listAppSettings"
  method      = "POST"

  sensitive_response_export_values = ["properties"]
}

resource "azapi_resource_action" "app_settings" {
  type        = "Microsoft.Web/staticSites/config@2023-12-01"
  resource_id = "${azapi_resource.this.id}/config/appsettings"
  method      = "PUT"

  body = {
    properties = merge(data.azapi_resource_action.app_settings.sensitive_output.properties, var.app_settings)
  }
}

output "name" { value = azapi_resource.this.name }
output "hostname" { value = azapi_resource.this.output.properties.defaultHostname }
